# Copilot Instructions for Paperless-AI Patched

## Project Context
Community fork of [clusterzx/paperless-ai](https://github.com/clusterzx/paperless-ai) - an AI-powered document processing extension for Paperless-ngx. This fork focuses on integration testing, performance optimizations, and Docker improvements. Core development credit belongs to the upstream project.

## Architecture

### Dual Runtime System
- **Node.js (Express)**: Main API server, document processing, UI (`server.js`)
- **Python (FastAPI)**: Optional RAG service for semantic search (`main.py`)
- **Startup**: `start-services.sh` launches both with PM2 + uvicorn
- **Database**: better-sqlite3 with WAL mode (`models/document.js`)

### Service Layer Pattern
All services follow singleton pattern: `class ServiceName { ... }; module.exports = new ServiceName();`

**AI Provider Factory** (`services/aiServiceFactory.js`):
- Returns appropriate service based on `config.aiProvider` (openai|ollama|custom|azure)
- All AI services must implement: `analyzeDocument(content, doc, existingTags, correspondents)`
- Use `RestrictionPromptService.processRestrictionsInPrompt()` for placeholder replacement (`%RESTRICTED_TAGS%`, `%RESTRICTED_CORRESPONDENTS%`)

**Token Management** (`services/serviceUtils.js`):
- `calculateTokens(text, model)` - Uses tiktoken for OpenAI models, character estimation (÷4) for others
- `truncateToTokenLimit(text, maxTokens, model)` - Smart truncation with safety buffer

### Configuration System
All config loads from `data/.env` via `config/config.js`. Key patterns:
- Boolean parsing: `parseEnvBoolean(value, defaultValue)` - handles 'yes'/'no', 'true'/'false', '1'/'0'
- Feature toggles: `activateTagging`, `activateCorrespondents`, etc.
- AI restrictions: `restrictToExistingTags`, `restrictToExistingCorrespondents`

### Database Schema
5 key tables in `data/documents.db` (see `models/document.js`):
- `processed_documents` - Tracks processed docs (document_id, title)
- `history_documents` - UI history with pagination support
- `openai_metrics` - Token usage tracking
- `original_documents` - Pre-AI metadata snapshot
- `users` - Authentication (bcryptjs passwords)

**Performance Pattern**: Use prepared statements for all queries. History pagination uses SQL `LIMIT/OFFSET`, not in-memory filtering.

## Critical Workflows

### Document Processing Flow
1. `node-cron` triggers scan based on `config.scanInterval` (cron format)
2. `scanDocuments()` fetches from Paperless-ngx API
3. Retry tracking: `retryTracker` Map prevents infinite loops (max 3 attempts)
4. Content validation: Documents need ≥ `MIN_CONTENT_LENGTH` chars (default: 10)
5. **Tag filtering**: If `PROCESS_PREDEFINED_DOCUMENTS=yes`, only process docs with tags matching `TAGS` env var
6. AI service processes via factory pattern
7. Results posted back to Paperless-ngx via `paperlessService.updateDocument()`

**Key Files**: `server.js` lines 150-400, `services/paperlessService.js`

### RAG Service Integration
- Python service runs on port 8000 (configurable via `RAG_SERVICE_URL`)
- Node.js proxies requests through `services/ragService.js`
- Embeddings: sentence-transformers with ChromaDB vector store
- Hybrid search: BM25 (keyword) + semantic embeddings, weighted 30/70
- **Important**: RAG endpoints check `RAG_SERVICE_ENABLED` before proxying

### Authentication & Security
- JWT stored in cookies (`jwt` cookie name)
- API key support via `x-api-key` header
- Middleware: `isAuthenticated` checks both JWT and API key
- Protected routes use `protectApiRoute` middleware
- **Pattern**: All `/api/*` routes require authentication except `/api-docs`

### Server-Side Pagination (PERF-001)
History table uses SQL-based pagination instead of loading all records:
```javascript
// In routes/setup.js - /api/history endpoint
const { start, length, search, order } = req.query; // DataTables params
// Use getPaginatedHistoryDocuments() with LIMIT/OFFSET
```
Tag caching with 5-minute TTL reduces Paperless-ngx API calls by ~95%.

## Development Commands

```bash
# Local development (auto-reload)
npm run test  # Uses nodemon

# Python RAG service
source venv/bin/activate
python main.py --host 127.0.0.1 --port 8000

# Production (Docker uses this)
pm2 start ecosystem.config.js

# Database inspection
sqlite3 data/documents.db "SELECT * FROM processed_documents LIMIT 5;"
```

## Code Conventions

### Error Handling
- Always log to both `htmlLogger` and `txtLogger` for user-facing operations
- Use try-catch in all async routes
- Return meaningful HTTP status codes (400 for validation, 500 for server errors)

### Frontend Integration
- EJS templates in `views/` (no framework)
- DataTables for server-side pagination - expects `{data, recordsTotal, recordsFiltered}` response format
- SSE for progress: Set `X-Accel-Buffering: no` header and call `res.flush()` after each write
- Dark mode: Uses `data-theme` attribute + CSS variables (see `public/css/dashboard.css`)

### API Response Patterns
```javascript
// Success
res.json({ success: true, data: {...}, message: 'Optional' });

// Error
res.status(400).json({ success: false, error: 'Message' });

// SSE Progress
res.writeHead(200, { 'Content-Type': 'text/event-stream', 'X-Accel-Buffering': 'no' });
res.write(`data: ${JSON.stringify({ progress: 50, message: 'Processing...' })}\n\n`);
res.flush();
```

## Testing & Debugging

### Key Test Files
- `tests/test-pr772-fix.js` - Retry logic validation
- `tests/test-restriction-service.js` - Placeholder replacement
- History validation: `/api/history/validate` endpoint (SSE-based)

### Common Issues
1. **Infinite retry loops**: Check `retryTracker` Map, max 3 attempts (PR-772)
2. **Slow history page**: Verify SQL pagination is used, not `getHistoryDocuments()` (PERF-001)
3. **RAG not working**: Check `RAG_SERVICE_ENABLED=true` and Python service is running
4. **Dark mode images**: Add `class="no-invert"` to images that shouldn't be inverted

## Fix Documentation & Workflow

### Documentation Pattern
All integrated fixes documented in `Included_Fixes/` with pattern: `{PR|PERF|SEC|DOCKER|CI}-NNN-name/README.md`

### Change Workflow (IMPORTANT)
**Every change MUST follow this process:**

1. **Create Feature Branch**
   ```bash
   # Pattern: {type}-{number}-{short-description}
   git checkout -b PERF-002-optimize-rag-queries
   git checkout -b PR-800-fix-ollama-timeout
   git checkout -b SEC-002-validate-api-inputs
   ```

2. **Implement Changes**
   - Make code modifications
   - Test thoroughly
   - Commit with descriptive messages

3. **Document in Included_Fixes/**
   ```bash
   mkdir -p Included_Fixes/{TYPE}-{NNN}-{name}/
   ```
   
   Create `README.md` with:
   - **Background**: Why this fix was needed
   - **Changes**: What was modified (file-by-file if complex)
   - **Testing**: How to verify the fix
   - **Impact**: Performance/security/functionality improvements
   - **Upstream Status**: Link to upstream PR if applicable
   
   See existing fixes for reference:
   - `Included_Fixes/PR-772-infinite-retry-fix/README.md`
   - `Included_Fixes/PERF-001-history-pagination/README.md`
   - `Included_Fixes/SEC-001-ssrf-code-injection/README.md`

4. **Update Included_Fixes/README.md**
   - Add entry to appropriate table (PRs, Performance, Security, etc.)
   - Include fix ID, title, status (✅ Applied), and integration date

5. **Update Global README.md**
   - Add entry to "Integrated Fixes" table in main `README.md`
   - Use same format: `| Category | [FIX-ID](link) | Description | ✅ Status |`
   - Keep table organized by category

6. **Commit Documentation**
   ```bash
   git add Included_Fixes/ README.md
   git commit -m "docs: document {TYPE}-{NNN} fix"
   ```

7. **Create Pull Request**
   - Title: `[{TYPE}-{NNN}] Short description`
   - Link to upstream PR if applicable
   - Reference any related issues

### Fix Type Prefixes
- `PR-XXX` - Upstream pull request integration
- `PERF-XXX` - Performance optimization
- `SEC-XXX` - Security fix
- `DOCKER-XXX` - Docker/containerization improvement
- `CI-XXX` - CI/CD workflow enhancement
- `DEP-XXX` - Dependency update/removal
- `UI-XXX` - UI/UX improvement

### Example Fix Documentation Structure
```markdown
# {TYPE}-{NNN}: Short Title

## Background
Explain the problem, bug, or optimization opportunity.

## Changes
- `file1.js`: Modified function X to handle Y
- `file2.js`: Added validation for Z
- `config/config.js`: New environment variable FEATURE_ENABLED

## Testing
\`\`\`bash
npm run test
# OR
node tests/test-new-feature.js
\`\`\`

## Impact
- Performance: 50% faster queries
- Security: Prevents SSRF attacks
- Functionality: Supports new AI provider

## Upstream Status
- [ ] Not submitted
- [ ] PR opened: [#XXX](link)
- [x] Merged upstream
- [ ] Upstream declined (reason)
```

## Additional Context
See `COPILOT.md` for comprehensive documentation including API reference, configuration details, and troubleshooting guides.
