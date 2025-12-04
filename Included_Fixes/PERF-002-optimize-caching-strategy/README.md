# PERF-002: Optimize Caching Strategy

## Background

Die aktuelle Caching-Implementierung hat mehrere kritische Performance-Probleme:

### Hauptprobleme

1. **Vollständiges Neuladen bei jedem Scan**
   - Bei jedem `scanDocuments()`/`scanInitial()` Aufruf werden **alle** Tags, Correspondents und Documents von der Paperless-API geladen
   - Keine inkrementellen Updates
   - Keine Nutzung von Paperless-API Filteroptionen (`page`, `ordering`, `fields`)

2. **Ineffizienter Tag-Cache**
   - Cache-Lifetime von nur 3 Sekunden (`CACHE_LIFETIME = 3000ms`)
   - Cache wird bei jedem Request neu aufgebaut wenn abgelaufen
   - Kein intelligentes Invalidierung-Konzept

3. **Fehlende Pagination in kritischen Methoden**
   - `getTags()` lädt alle Tags auf einmal
   - `listCorrespondentsNames()` lädt alle Correspondents auf einmal
   - Bei großen Instanzen (1000+ Tags/Docs) führt dies zu:
     - Hoher Memory-Nutzung
     - Langen Antwortzeiten
     - API Rate-Limiting

4. **Redundante API-Calls**
   - `getAllDocuments()` wird bei jedem Scan aufgerufen
   - Keine Nutzung von `modified__gte` für inkrementelle Updates
   - Keine lokale Tracking-DB für "zuletzt verarbeitete Dokumente"

## Paperless-API Features (nicht genutzt)

Die Paperless-ngx API bietet viele Features, die **aktuell nicht genutzt werden**:

### Pagination
```javascript
// API unterstützt page_size Parameter
GET /api/documents/?page=1&page_size=100
```

### Filtering & Ordering
```javascript
// Nach Änderungsdatum filtern (inkrementelle Updates!)
GET /api/documents/?modified__gte=2024-12-03T10:00:00Z

// Nur spezifische Felder abrufen (Bandbreite sparen)
GET /api/documents/?fields=id,title,modified

// Nach Tags filtern
GET /api/documents/?tags__id__in=1,2,3
```

### Count Queries
```javascript
// Nur Anzahl abrufen (sehr schnell)
GET /api/tags/?count=true
// Response: { "count": 150 }
```

## Detaillierte Analyse

### Problem 1: `scanDocuments()` lädt alles bei jedem Scan

**Aktueller Code** (`server.js:407-450`):
```javascript
async function scanDocuments() {
  // PROBLEM: Lädt ALLE Tags/Docs bei JEDEM Scan
  let [existingTags, documents, ownUserId, existingCorrespondentList, existingDocumentTypes] = await Promise.all([
    paperlessService.getTags(),              // Lädt ALLE Tags (keine Pagination!)
    paperlessService.getAllDocuments(),      // Lädt ALLE Documents (keine Filter!)
    paperlessService.getOwnUserID(),
    paperlessService.listCorrespondentsNames(), // Lädt ALLE Correspondents
    paperlessService.listDocumentTypesNames()   // Lädt ALLE Document Types
  ]);
  
  // Diese Daten ändern sich selten, könnten gecached werden!
  existingCorrespondentList = existingCorrespondentList.map(correspondent => correspondent.name);
  let existingDocumentTypesList = existingDocumentTypes.map(docType => docType.name);
  const existingTagNames = existingTags.map(tag => tag.name);
  
  // Dann wird JEDES Dokument durchiteriert...
  for (const doc of documents) {
    // ...
  }
}
```

**Auswirkung**:
- Bei 1000 Documents + 200 Tags + 100 Correspondents = **1300+ API Calls** pro Scan
- Scan-Interval ist `*/30 * * * *` (alle 30 Min) → **62.400 API Calls/Tag**!

### Problem 2: Ineffiziente `getTags()` Methode

**Aktueller Code** (`paperlessService.js:403-450`):
```javascript
async getTags() {
  let tags = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const params = {
      page,
      page_size: 100,  // OK: Pagination vorhanden
      ordering: 'name'
    };

    const response = await this.client.get('/tags/', { params });
    tags = tags.concat(response.data.results);
    hasMore = response.data.next !== null;
    page++;

    // PROBLEM: Lädt ALLE Seiten, jedes Mal komplett
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return tags; // Array mit ALLEN Tags
}
```

### Problem 3: Tag-Cache mit 3 Sekunden Lifetime

**Aktueller Code** (`paperlessService.js:10-16`):
```javascript
constructor() {
  this.client = null;
  this.tagCache = new Map();
  this.customFieldCache = new Map();
  this.lastTagRefresh = 0;
  this.CACHE_LIFETIME = 3000; // 3 Sekunden - VIEL ZU KURZ!
}
```

**Problem**:
- Bei einem Scan-Zyklus von 30 Minuten macht ein 3-Sekunden-Cache keinen Sinn
- Cache wird praktisch bei jedem Request neu aufgebaut
- Kein Event-basiertes Invalidieren (z.B. nach Tag-Erstellung)

## Lösungsvorschläge

### 1. Persistenter Metadata-Cache

```javascript
class MetadataCache {
  constructor() {
    this.tags = new Map();
    this.correspondents = new Map();
    this.documentTypes = new Map();
    this.lastUpdate = {
      tags: null,
      correspondents: null,
      documentTypes: null
    };
    this.CACHE_TTL = 30 * 60 * 1000; // 30 Minuten
  }

  async ensureTags(paperlessService) {
    const now = Date.now();
    if (!this.lastUpdate.tags || (now - this.lastUpdate.tags) > this.CACHE_TTL) {
      console.log('[CACHE] Refreshing tags...');
      const tags = await paperlessService.getTags();
      this.tags.clear();
      tags.forEach(tag => this.tags.set(tag.id, tag));
      this.lastUpdate.tags = now;
    }
    return Array.from(this.tags.values());
  }

  invalidateTags() {
    this.lastUpdate.tags = null;
  }
}
```

### 2. Inkrementelles Document-Scanning

```javascript
async function scanDocumentsIncremental() {
  // Hole letzten Scan-Timestamp aus DB
  const lastScan = await documentModel.getLastScanTimestamp();
  
  // Nutze Paperless-API Filter für inkrementelle Updates
  const modifiedDocuments = await paperlessService.getDocuments({
    modified__gte: lastScan,
    ordering: '-modified',
    fields: 'id,title,modified,tags,correspondent'
  });
  
  console.log(`[SCAN] Found ${modifiedDocuments.length} modified documents since ${lastScan}`);
  
  // Nur geänderte Dokumente verarbeiten!
  for (const doc of modifiedDocuments) {
    await processDocument(doc, ...);
  }
  
  // Update Scan-Timestamp
  await documentModel.setLastScanTimestamp(Date.now());
}
```

### 3. Optimierte API-Calls mit Field Selection

```javascript
async getAllDocuments(options = {}) {
  const params = {
    page_size: 100,
    fields: options.fields || 'id,title,modified', // Nur benötigte Felder!
    ordering: options.ordering || '-modified'
  };
  
  // Optional: Filter für modified seit X
  if (options.modifiedSince) {
    params.modified__gte = options.modifiedSince;
  }
  
  // Optional: Filter für Tags
  if (options.tags) {
    params.tags__id__in = options.tags.join(',');
  }
  
  let documents = [];
  let nextUrl = '/documents/';
  
  while (nextUrl) {
    const response = await this.client.get(nextUrl, { params });
    documents = documents.concat(response.data.results);
    nextUrl = this._safeExtractRelativePath(response.data.next);
  }
  
  return documents;
}
```

### 4. Background Cache Refresh mit Cron

```javascript
// Separate Cron-Job für Cache-Updates (unabhängig vom Document-Scan)
cron.schedule('*/15 * * * *', async () => {
  console.log('[CACHE] Refreshing metadata caches...');
  await metadataCache.refreshAll();
});

// Document-Scan nutzt gecachte Daten
cron.schedule(config.scanInterval, async () => {
  console.log('[SCAN] Starting document scan...');
  const metadata = await metadataCache.getAll(); // Aus Cache!
  await scanDocuments(metadata);
});
```

### 5. Smart Tag Cache mit Event-basierter Invalidierung

```javascript
async createTagSafely(tagName) {
  try {
    const response = await this.client.post('/tags/', { name: tagName });
    const newTag = response.data;
    
    // WICHTIG: Cache sofort aktualisieren statt invalidieren
    this.tagCache.set(newTag.name.toLowerCase(), newTag);
    
    console.log(`[CACHE] Tag "${tagName}" created and added to cache`);
    return newTag;
  } catch (error) {
    // Bei Fehler: Cache invalidieren und neu laden
    await this.refreshTagCache();
    return await this.findExistingTag(tagName);
  }
}
```

## Performance-Impact (Schätzungen)

### Vorher
- **Scan-Dauer**: ~5-10 Minuten (bei 1000 Docs, 200 Tags)
- **API Calls pro Scan**: ~1500
- **API Calls pro Tag**: ~72.000 (bei 30min Interval)
- **Memory-Nutzung**: ~500MB (alle Daten im RAM)

### Nachher (mit allen Optimierungen)
- **Scan-Dauer**: ~30-60 Sekunden (nur geänderte Docs)
- **API Calls pro Scan**: ~50-100 (nur geänderte Docs + cached metadata)
- **API Calls pro Tag**: ~2.400 (96% Reduktion!)
- **Memory-Nutzung**: ~100MB (nur aktive Daten)

## Testing

### Vor der Implementierung testen
```bash
# 1. Baseline Messung
time node -e "
const paperlessService = require('./services/paperlessService');
paperlessService.initialize();
(async () => {
  const start = Date.now();
  await paperlessService.getTags();
  await paperlessService.getAllDocuments();
  console.log('Duration:', Date.now() - start, 'ms');
})();
"

# 2. Memory-Profiling
node --inspect server.js
# Chrome DevTools → Memory → Take Heap Snapshot
```

### Nach der Implementierung
```bash
# Test incremental scan
node tests/test-incremental-scan.js

# Verify cache behavior
node tests/test-metadata-cache.js
```

## Upstream Status

- [ ] Noch nicht als Issue gemeldet
- [ ] PR noch nicht erstellt
- [ ] Upstream könnte stark profitieren (gilt für alle Instanzen mit >500 Docs)

## Implementation Checklist

- [x] `MetadataCache` Service implementieren (`services/metadataCache.js`)
- [x] `getLastScanTimestamp()` / `setLastScanTimestamp()` in `models/document.js`
- [x] `scanDocumentsIncremental()` Funktion (in `server.js`)
- [x] `getDocumentsOptimized()` mit Filter-Optionen (`services/paperlessService.js`)
- [x] Separate Cron-Jobs für Cache-Refresh und Scan
- [x] Tag-Cache Lifetime auf 30min erhöhen (configurable via `METADATA_CACHE_TTL`)
- [x] Cache Admin UI (`/cache-admin`)
- [x] Tests schreiben (`tests/test-metadata-cache.js`, `tests/test-incremental-scan.js`)
- [ ] Performance-Messungen durchführen (after deployment)
- [x] Dokumentation aktualisieren

## Implementation Summary

All optimization strategies have been successfully implemented:

### 1. MetadataCache Service
- **File**: `services/metadataCache.js`
- **Features**:
  - 30-minute cache TTL (configurable via `METADATA_CACHE_TTL` env var)
  - Separate caches for tags, correspondents, and document types
  - Hit/miss/refresh statistics tracking
  - Event-based cache updates (add to cache on create)
  - Manual refresh and clear operations

### 2. Database Enhancements
- **File**: `models/document.js`
- **Changes**:
  - New `system_state` table for tracking scan timestamps and metadata
  - `getSystemState(key)` / `setSystemState(key, value)` methods
  - `getLastScanTimestamp()` / `setLastScanTimestamp()` helpers

### 3. Incremental Scanning
- **File**: `server.js`
- **Changes**:
  - `scanDocuments()` now uses `metadataCache` instead of direct API calls
  - Incremental mode: only processes documents modified since last scan
  - Falls back to full scan if no previous timestamp or if disabled
  - Enable/disable via `ENABLE_INCREMENTAL_SCAN` env var (default: enabled)

### 4. Optimized API Calls
- **File**: `services/paperlessService.js`
- **New Method**: `getDocumentsOptimized(options)`
- **Supported Options**:
  - `modifiedSince`: ISO timestamp for incremental updates
  - `fields`: Comma-separated field selection
  - `ordering`: Sort order
  - `tags`: Filter by tag IDs
  - `pageSize`: Custom page size

### 5. Separate Cron Jobs
- **Cache refresh**: Every 15 minutes (configurable via `CACHE_REFRESH_INTERVAL`)
- **Document scan**: Uses existing `SCAN_INTERVAL` config
- Both jobs independent - cache refreshes don't block scanning

### 6. Cache Admin UI
- **Route**: `/cache-admin`
- **Features**:
  - Real-time cache statistics (size, age, hit rate)
  - Manual cache refresh button
  - Clear cache button
  - Trigger immediate scan
  - Reset statistics
  - Auto-refresh stats every 30 seconds
  - Configuration display (TTL, intervals, incremental mode status)

### 7. Navigation Integration
- Cache Admin link added to all views with navigation:
  - `dashboard.ejs`
  - `chat.ejs`
  - `history.ejs`
  - `manual.ejs`
  - `playground.ejs`
  - `settings.ejs`

## Configuration

### New Environment Variables

```bash
# Metadata cache TTL in milliseconds (default: 30 minutes)
METADATA_CACHE_TTL=1800000

# Cache refresh interval (cron format, default: every 15 minutes)
CACHE_REFRESH_INTERVAL="*/15 * * * *"

# Enable/disable incremental scanning (default: enabled)
ENABLE_INCREMENTAL_SCAN=yes
```

## Testing

Run the test scripts to verify functionality:

```bash
# Test metadata cache performance
node tests/test-metadata-cache.js

# Test incremental scanning
node tests/test-incremental-scan.js
```

Expected results:
- Cache hits should be 5-50x faster than cache misses
- Incremental scans should process 90-99% fewer documents (depending on activity)
- Field selection should improve query speed by 2-5x

## Related Issues

- PERF-001: History Pagination (bereits implementiert)
- Upstream Issue: N/A (sollte erstellt werden)

## Author Notes

Diese Optimierung ist **kritisch** für Produktions-Deployments mit:
- 500+ Dokumenten
- 100+ Tags
- 50+ Correspondents
- Frequent scanning (< 60min intervals)

Die aktuell Implementierung skaliert nicht gut und kann zu:
- Paperless-API Rate-Limiting führen
- Hoher Server-Last auf beiden Seiten
- Langsamen Scan-Zyklen
- Potentiellen Memory-Leaks bei sehr großen Instanzen
