// services/metadataCache.js
const Logger = require('./loggerService');

const htmlLogger = new Logger({
  logFile: 'logs.html',
  format: 'html',
  timestamp: true,
  maxFileSize: 1024 * 1024 * 10
});

const txtLogger = new Logger({
  logFile: 'logs.txt',
  format: 'txt',
  timestamp: true,
  maxFileSize: 1024 * 1024 * 10
});

/**
 * Metadata Cache Service
 * Caches tags, correspondents, and document types with configurable TTL
 * Reduces API calls to Paperless-ngx dramatically
 */
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
    
    this.stats = {
      hits: { tags: 0, correspondents: 0, documentTypes: 0 },
      misses: { tags: 0, correspondents: 0, documentTypes: 0 },
      refreshes: { tags: 0, correspondents: 0, documentTypes: 0 }
    };
    
    // 30 minutes cache TTL (configurable via env)
    this.CACHE_TTL = parseInt(process.env.METADATA_CACHE_TTL || '1800000', 10); // 30 min default
    
    console.log(`[MetadataCache] Initialized with TTL: ${this.CACHE_TTL}ms (${this.CACHE_TTL / 60000} minutes)`);
  }

  /**
   * Check if cache is still valid
   */
  _isCacheValid(type) {
    const lastUpdate = this.lastUpdate[type];
    if (!lastUpdate) return false;
    
    const now = Date.now();
    const age = now - lastUpdate;
    return age < this.CACHE_TTL;
  }

  /**
   * Get cache age in human-readable format
   */
  getCacheAge(type) {
    const lastUpdate = this.lastUpdate[type];
    if (!lastUpdate) return 'Never';
    
    const age = Date.now() - lastUpdate;
    const minutes = Math.floor(age / 60000);
    const seconds = Math.floor((age % 60000) / 1000);
    
    return `${minutes}m ${seconds}s`;
  }

  /**
   * Ensure tags cache is populated and valid
   */
  async ensureTags(paperlessService) {
    if (this._isCacheValid('tags') && this.tags.size > 0) {
      this.stats.hits.tags++;
      console.log(`[MetadataCache] Tags cache HIT (age: ${this.getCacheAge('tags')}, size: ${this.tags.size})`);
      return Array.from(this.tags.values());
    }

    this.stats.misses.tags++;
    await this.refreshTags(paperlessService);
    return Array.from(this.tags.values());
  }

  /**
   * Refresh tags cache from Paperless API
   */
  async refreshTags(paperlessService) {
    try {
      this.stats.refreshes.tags++;
      console.log('[MetadataCache] Refreshing tags cache...');
      htmlLogger.log('[MetadataCache] Refreshing tags cache...', 'info');
      
      const tags = await paperlessService.getTags();
      
      this.tags.clear();
      tags.forEach(tag => {
        this.tags.set(tag.id, tag);
      });
      
      this.lastUpdate.tags = Date.now();
      
      console.log(`[MetadataCache] Tags cache refreshed: ${this.tags.size} tags loaded`);
      htmlLogger.log(`[MetadataCache] Tags cache refreshed: ${this.tags.size} tags loaded`, 'success');
      
      return Array.from(this.tags.values());
    } catch (error) {
      console.error('[MetadataCache] Error refreshing tags:', error.message);
      htmlLogger.log(`[MetadataCache] Error refreshing tags: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Ensure correspondents cache is populated and valid
   */
  async ensureCorrespondents(paperlessService) {
    if (this._isCacheValid('correspondents') && this.correspondents.size > 0) {
      this.stats.hits.correspondents++;
      console.log(`[MetadataCache] Correspondents cache HIT (age: ${this.getCacheAge('correspondents')}, size: ${this.correspondents.size})`);
      return Array.from(this.correspondents.values());
    }

    this.stats.misses.correspondents++;
    await this.refreshCorrespondents(paperlessService);
    return Array.from(this.correspondents.values());
  }

  /**
   * Refresh correspondents cache from Paperless API
   */
  async refreshCorrespondents(paperlessService) {
    try {
      this.stats.refreshes.correspondents++;
      console.log('[MetadataCache] Refreshing correspondents cache...');
      htmlLogger.log('[MetadataCache] Refreshing correspondents cache...', 'info');
      
      const correspondents = await paperlessService.listCorrespondentsNames();
      
      this.correspondents.clear();
      correspondents.forEach(correspondent => {
        this.correspondents.set(correspondent.id, correspondent);
      });
      
      this.lastUpdate.correspondents = Date.now();
      
      console.log(`[MetadataCache] Correspondents cache refreshed: ${this.correspondents.size} correspondents loaded`);
      htmlLogger.log(`[MetadataCache] Correspondents cache refreshed: ${this.correspondents.size} correspondents loaded`, 'success');
      
      return Array.from(this.correspondents.values());
    } catch (error) {
      console.error('[MetadataCache] Error refreshing correspondents:', error.message);
      htmlLogger.log(`[MetadataCache] Error refreshing correspondents: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Ensure document types cache is populated and valid
   */
  async ensureDocumentTypes(paperlessService) {
    if (this._isCacheValid('documentTypes') && this.documentTypes.size > 0) {
      this.stats.hits.documentTypes++;
      console.log(`[MetadataCache] DocumentTypes cache HIT (age: ${this.getCacheAge('documentTypes')}, size: ${this.documentTypes.size})`);
      return Array.from(this.documentTypes.values());
    }

    this.stats.misses.documentTypes++;
    await this.refreshDocumentTypes(paperlessService);
    return Array.from(this.documentTypes.values());
  }

  /**
   * Refresh document types cache from Paperless API
   */
  async refreshDocumentTypes(paperlessService) {
    try {
      this.stats.refreshes.documentTypes++;
      console.log('[MetadataCache] Refreshing document types cache...');
      htmlLogger.log('[MetadataCache] Refreshing document types cache...', 'info');
      
      const documentTypes = await paperlessService.listDocumentTypesNames();
      
      this.documentTypes.clear();
      documentTypes.forEach(docType => {
        this.documentTypes.set(docType.id, docType);
      });
      
      this.lastUpdate.documentTypes = Date.now();
      
      console.log(`[MetadataCache] DocumentTypes cache refreshed: ${this.documentTypes.size} document types loaded`);
      htmlLogger.log(`[MetadataCache] DocumentTypes cache refreshed: ${this.documentTypes.size} document types loaded`, 'success');
      
      return Array.from(this.documentTypes.values());
    } catch (error) {
      console.error('[MetadataCache] Error refreshing document types:', error.message);
      htmlLogger.log(`[MetadataCache] Error refreshing document types: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Refresh all caches
   */
  async refreshAll(paperlessService) {
    console.log('[MetadataCache] Refreshing all caches...');
    htmlLogger.log('[MetadataCache] Refreshing all caches...', 'info');
    
    const startTime = Date.now();
    
    try {
      await Promise.all([
        this.refreshTags(paperlessService),
        this.refreshCorrespondents(paperlessService),
        this.refreshDocumentTypes(paperlessService)
      ]);
      
      const duration = Date.now() - startTime;
      console.log(`[MetadataCache] All caches refreshed in ${duration}ms`);
      htmlLogger.log(`[MetadataCache] All caches refreshed in ${duration}ms`, 'success');
      
      return true;
    } catch (error) {
      console.error('[MetadataCache] Error refreshing all caches:', error.message);
      htmlLogger.log(`[MetadataCache] Error refreshing all caches: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Clear all caches (force refresh on next request)
   */
  clearAll() {
    console.log('[MetadataCache] Clearing all caches...');
    htmlLogger.log('[MetadataCache] Clearing all caches...', 'info');
    
    this.tags.clear();
    this.correspondents.clear();
    this.documentTypes.clear();
    
    this.lastUpdate.tags = null;
    this.lastUpdate.correspondents = null;
    this.lastUpdate.documentTypes = null;
    
    console.log('[MetadataCache] All caches cleared');
    htmlLogger.log('[MetadataCache] All caches cleared', 'success');
  }

  /**
   * Add single tag to cache (for event-based updates)
   */
  addTag(tag) {
    this.tags.set(tag.id, tag);
    console.log(`[MetadataCache] Tag added to cache: ${tag.name} (ID: ${tag.id})`);
  }

  /**
   * Add single correspondent to cache
   */
  addCorrespondent(correspondent) {
    this.correspondents.set(correspondent.id, correspondent);
    console.log(`[MetadataCache] Correspondent added to cache: ${correspondent.name} (ID: ${correspondent.id})`);
  }

  /**
   * Add single document type to cache
   */
  addDocumentType(docType) {
    this.documentTypes.set(docType.id, docType);
    console.log(`[MetadataCache] DocumentType added to cache: ${docType.name} (ID: ${docType.id})`);
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const totalHits = this.stats.hits.tags + this.stats.hits.correspondents + this.stats.hits.documentTypes;
    const totalMisses = this.stats.misses.tags + this.stats.misses.correspondents + this.stats.misses.documentTypes;
    const totalRequests = totalHits + totalMisses;
    const hitRate = totalRequests > 0 ? ((totalHits / totalRequests) * 100).toFixed(2) : 0;

    return {
      tags: {
        size: this.tags.size,
        lastUpdate: this.lastUpdate.tags,
        age: this.getCacheAge('tags'),
        valid: this._isCacheValid('tags'),
        hits: this.stats.hits.tags,
        misses: this.stats.misses.tags,
        refreshes: this.stats.refreshes.tags
      },
      correspondents: {
        size: this.correspondents.size,
        lastUpdate: this.lastUpdate.correspondents,
        age: this.getCacheAge('correspondents'),
        valid: this._isCacheValid('correspondents'),
        hits: this.stats.hits.correspondents,
        misses: this.stats.misses.correspondents,
        refreshes: this.stats.refreshes.correspondents
      },
      documentTypes: {
        size: this.documentTypes.size,
        lastUpdate: this.lastUpdate.documentTypes,
        age: this.getCacheAge('documentTypes'),
        valid: this._isCacheValid('documentTypes'),
        hits: this.stats.hits.documentTypes,
        misses: this.stats.misses.documentTypes,
        refreshes: this.stats.refreshes.documentTypes
      },
      overall: {
        totalHits,
        totalMisses,
        totalRequests,
        hitRate: `${hitRate}%`,
        cacheTTL: `${this.CACHE_TTL / 60000} minutes`
      }
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      hits: { tags: 0, correspondents: 0, documentTypes: 0 },
      misses: { tags: 0, correspondents: 0, documentTypes: 0 },
      refreshes: { tags: 0, correspondents: 0, documentTypes: 0 }
    };
    console.log('[MetadataCache] Statistics reset');
  }
}

// Export singleton instance
module.exports = new MetadataCache();
