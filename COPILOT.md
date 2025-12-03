# 🤖 Copilot Developer Guide

> **AI Assistant Context Document**  
> This document provides comprehensive context for AI models and developers working with Paperless-AI Patched.

---

## 📋 Project Overview

**Paperless-AI Patched** is a community-maintained fork of [clusterzx/paperless-ai](https://github.com/clusterzx/paperless-ai) - an AI-powered document processing extension for [Paperless-ngx](https://github.com/paperless-ngx/paperless-ngx).

### Core Purpose
- Automatic document classification using AI (OpenAI, Ollama, DeepSeek, etc.)
- Smart tagging, correspondent detection, and metadata extraction
- RAG-based (Retrieval-Augmented Generation) document chat
- Web-based management interface with dark mode support

### Fork Characteristics
- **Type**: Community integration and testing fork
- **Purpose**: Test pending upstream PRs, apply community fixes, optimize Docker images
- **Upstream**: All core development credit belongs to [clusterzx](https://github.com/clusterzx)
- **Status**: Active maintenance, security patches, performance optimizations

---

## 🏗️ Architecture

### Technology Stack

#### Backend (Node.js)
- **Runtime**: Node.js 22 (LTS)
- **Framework**: Express.js 4.21.2
- **Database**: better-sqlite3 (SQLite with WAL mode)
- **Authentication**: JWT (jsonwebtoken) + API keys
- **Scheduling**: node-cron for periodic document scanning
- **Process Management**: PM2 (in Docker)

#### AI Integration
- **OpenAI SDK**: openai ^4.86.2
- **Multiple AI Providers**:
  - OpenAI (GPT-4, GPT-3.5)
  - Ollama (Mistral, Llama, Phi-3, Gemma-2)
  - Azure OpenAI
  - Custom OpenAI-compatible APIs (DeepSeek, OpenRouter, Together.ai, etc.)
- **Token Counting**: tiktoken ^1.0.20

#### RAG Service (Python)
- **Framework**: FastAPI (async web framework)
- **Embeddings**: sentence-transformers
- **Vector Store**: ChromaDB
- **Search**: BM25Okapi (keyword) + semantic search
- **Reranking**: CrossEncoder
- **ML Framework**: PyTorch (CPU-optimized)

#### Frontend
- **View Engine**: EJS (Embedded JavaScript templates)
- **CSS**: Tailwind CSS 3.4.16 (CDN)
- **JavaScript**: Vanilla JS (no framework)
- **Charts**: Chart.js for metrics visualization
- **Tables**: DataTables with server-side pagination
- **Icons**: Font Awesome 6.7.0

#### Docker
- **Base Image**: node:22-slim (Debian-based)
- **Multi-Service**: Node.js + Python RAG service
- **Build Variants**: 
  - `lite`: Node.js only (~400MB)
  - `full`: Node.js + Python RAG (~1.2GB)
- **Health Checks**: Built-in endpoint monitoring

### Project Structure

```
paperless-ai-enhanced/
├── server.js                 # Main Express server entry point
├── main.py                   # Python FastAPI RAG service
├── start-services.sh         # Docker startup script (PM2 + uvicorn)
├── ecosystem.config.js       # PM2 configuration
├── package.json              # Node.js dependencies
├── requirements.txt          # Python dependencies
├── Dockerfile                # Full Docker image (Node + Python)
├── Dockerfile.rag            # Lite Docker image (Node only)
├── docker-compose.yml        # Docker Compose configuration
│
├── config/
│   └── config.js            # Central configuration loader (.env parser)
│
├── models/
│   └── document.js          # SQLite database models and queries
│                             # Tables: processed_documents, history_documents,
│                             # openai_metrics, original_documents, users
│
├── routes/
│   ├── auth.js              # Authentication routes (login, logout, JWT)
│   ├── rag.js               # RAG chat endpoints (proxy to Python service)
│   └── setup.js             # Main API routes (dashboard, history, settings)
│
├── services/
│   ├── aiServiceFactory.js         # AI provider factory (OpenAI/Ollama/Custom)
│   ├── openaiService.js            # OpenAI API integration
│   ├── ollamaService.js            # Ollama API integration
│   ├── customService.js            # Generic OpenAI-compatible API
│   ├── azureService.js             # Azure OpenAI integration
│   ├── paperlessService.js         # Paperless-ngx API client
│   ├── chatService.js              # Document chat logic
│   ├── ragService.js               # RAG service proxy
│   ├── documentsService.js         # Document processing orchestration
│   ├── manualService.js            # Manual processing endpoints
│   ├── restrictionPromptService.js # AI restriction enforcement
│   ├── externalApiService.js       # External API integration
│   ├── setupService.js             # Setup wizard logic
│   ├── loggerService.js            # HTML/TXT logging
│   └── serviceUtils.js             # Shared utilities
│
├── views/                    # EJS templates
│   ├── layout.ejs           # Main layout wrapper
│   ├── dashboard.ejs        # Dashboard with metrics
│   ├── history.ejs          # Document history table
│   ├── settings.ejs         # Configuration UI
│   ├── chat.ejs             # AI chat interface
│   ├── rag.ejs              # RAG chat interface
│   ├── manual.ejs           # Manual processing UI
│   ├── setup.ejs            # Setup wizard
│   └── login.ejs            # Login page
│
├── public/
│   ├── css/
│   │   ├── dashboard.css    # Main styles + dark mode theme
│   │   ├── chat.css         # Chat interface styles
│   │   ├── settings.css     # Settings page styles
│   │   └── setup.css        # Setup wizard styles
│   └── js/
│       ├── dashboard.js     # Dashboard logic + Chart.js
│       ├── history.js       # DataTables + SSE progress
│       ├── chat.js          # Chat interface logic
│       ├── settings.js      # Settings form handlers
│       ├── setup.js         # Setup wizard logic
│       ├── manual.js        # Manual processing logic
│       └── playground.js    # Prompt testing playground
│
├── data/                     # Persistent data (Docker volume)
│   ├── .env                 # Environment configuration
│   ├── documents.db         # SQLite database
│   ├── documents.db-wal     # WAL file (write-ahead log)
│   └── chromadb/            # Vector store data (RAG)
│
├── Included_Fixes/          # Documentation of integrated fixes
│   ├── README.md            # Fix registry
│   ├── PR-772-infinite-retry-fix/
│   ├── PR-747-history-cleanup/
│   ├── PERF-001-history-pagination/
│   ├── DEP-001-remove-sqlite3/
│   └── DOCKER-001-optimize-images/
│
└── docs/                    # Additional documentation
    ├── README.md
    ├── RAG-DEV-GUIDE.md
    └── jsdoc_standards.md
```

---

## 🔑 Key Components

### 1. Document Processing Pipeline

**Flow**:
```
Cron Job (30min) → Scan Paperless-ngx → Filter Documents → AI Analysis → Update Metadata
```

**Implementation**:
- `server.js`: Cron scheduler (`node-cron`)
- `services/documentsService.js`: Main orchestration
- `services/paperlessService.js`: API calls to Paperless-ngx
- `services/aiServiceFactory.js`: Provider selection
- AI providers generate JSON with `title`, `tags`, `correspondent`, `document_type`, `document_date`

**Key Features**:
- Tag filtering (process only documents with specific tags)
- Retry mechanism with exponential backoff
- Token limit enforcement (128K default)
- Minimum content length validation (10 chars default)
- Duplicate detection (SQLite tracking)

### 2. RAG (Retrieval-Augmented Generation)

**Architecture**:
```
Node.js (/api/rag/*) → FastAPI (Python) → ChromaDB + BM25 → LLM → Response
```

**Implementation**:
- `main.py`: FastAPI service on port 8000
- Hybrid search: BM25 (keyword) + semantic embeddings
- CrossEncoder reranking for relevance
- Document chunking with overlap
- Persistent vector store in `data/chromadb/`

**Endpoints**:
- `POST /rag/index` - Index documents from Paperless-ngx
- `POST /rag/query` - RAG-based Q&A
- `GET /rag/status` - Check indexing status
- `DELETE /rag/clear` - Clear vector database

### 3. Authentication System

**Methods**:
1. **JWT Tokens**: Cookie-based sessions
2. **API Keys**: Header-based (`x-api-key`)

**Implementation**:
- `routes/auth.js`: Login/logout endpoints
- Middleware: `isAuthenticated` (validates JWT or API key)
- Password hashing: bcryptjs
- Session expiry: Configurable

**Security**:
- All `/api/*` endpoints protected (except `/api-docs`)
- CORS configured for cross-origin requests
- No default credentials (setup wizard required)

### 4. History Management

**Recent Optimizations** (PERF-001):
- SQL-based pagination (was: load all docs in memory)
- Tag caching with 5-minute TTL
- Server-side filtering/sorting
- Performance: 5-10s → <500ms with 1000+ documents

**Features**:
- History validation (detect missing documents)
- Bulk delete operations
- Real-time SSE progress indicators
- Filter by tag/correspondent
- DataTables integration

### 5. Dark Mode Theme

**Implementation**:
- CSS variables in `public/css/dashboard.css`
- `data-theme="light|dark"` attribute on `<html>`
- localStorage persistence
- Automatic image inversion (except `.no-invert`)

**Variables**:
```css
:root[data-theme="dark"] {
  --bg-primary: #0f172a;
  --text-primary: #f8fafc;
  --accent-primary: #60a5fa;
  /* ... */
}
```

---

## 🔧 Configuration

### Environment Variables

**Core Required**:
```bash
# Paperless-ngx Connection
PAPERLESS_API_URL=http://localhost:8000/api
PAPERLESS_API_TOKEN=your_token_here

# AI Provider Selection
AI_PROVIDER=openai|ollama|custom|azure

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4

# Ollama
OLLAMA_API_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2

# Custom Provider (DeepSeek, OpenRouter, etc.)
CUSTOM_BASE_URL=https://api.deepseek.com/v1
CUSTOM_API_KEY=your_key
CUSTOM_MODEL=deepseek-chat

# Azure OpenAI
AZURE_API_KEY=...
AZURE_ENDPOINT=...
AZURE_DEPLOYMENT_NAME=...
AZURE_API_VERSION=2023-05-15
```

**Processing Configuration**:
```bash
# Scan interval (cron format)
SCAN_INTERVAL=*/30 * * * *

# Token limits
TOKEN_LIMIT=128000
RESPONSE_TOKENS=1000

# Content validation
MIN_CONTENT_LENGTH=10

# Tag filtering
PROCESS_PREDEFINED_DOCUMENTS=yes
TAGS=pre-process

# AI restrictions
RESTRICT_TO_EXISTING_TAGS=no
RESTRICT_TO_EXISTING_CORRESPONDENTS=no
RESTRICT_TO_EXISTING_DOCUMENT_TYPES=no

# Feature toggles
ACTIVATE_TAGGING=yes
ACTIVATE_CORRESPONDENTS=yes
ACTIVATE_DOCUMENT_TYPE=yes
ACTIVATE_TITLE=yes
ACTIVATE_CUSTOM_FIELDS=yes

# Security
API_KEY=your_api_key_for_external_access
DISABLE_AUTOMATIC_PROCESSING=no
```

**RAG Configuration**:
```bash
RAG_SERVICE_URL=http://localhost:8000
RAG_SERVICE_ENABLED=true
```

**Docker**:
```bash
PAPERLESS_AI_PORT=3000
PUID=1000
PGID=1000
```

### File Locations

**Configuration**: `data/.env` (Docker) or `.env` (local)  
**Database**: `data/documents.db`  
**Vector Store**: `data/chromadb/`  
**Logs**: `logs.html`, `logs.txt`

---

## 🚀 Local Development Setup

### Prerequisites

**Required**:
- Node.js 22+ (LTS)
- Python 3.10+
- npm or pnpm
- Paperless-ngx instance (running and accessible)

**Optional**:
- Ollama (for local AI)
- Docker (for containerized development)

### Installation Steps

```bash
# 1. Clone repository
git clone https://github.com/Admonstrator/paperless-ai-patched.git
cd paperless-ai-patched

# 2. Install Node.js dependencies
npm install

# 3. Install Python dependencies (for RAG)
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# 4. Download NLTK data (required for RAG)
python3 -c "import nltk; nltk.download('punkt'); nltk.download('stopwords')"

# 5. Create configuration
mkdir -p data
cp .env.example data/.env
# Edit data/.env with your Paperless-ngx URL and API token

# 6. Initialize database
# Automatically created on first run

# 7. Start services

# Option A: Development (separate terminals)
# Terminal 1 - Node.js
npm run test  # Uses nodemon for auto-reload

# Terminal 2 - Python RAG service
source venv/bin/activate
python main.py

# Option B: Production (PM2)
npm install -g pm2
pm2 start ecosystem.config.js
```

### First-Time Setup

1. **Access UI**: http://localhost:3000
2. **Setup Wizard**: Configure admin user, AI provider, prompts
3. **Test Connection**: Dashboard should show Paperless-ngx status
4. **Manual Test**: Go to `/manual` and process a document
5. **Enable Automation**: Set `DISABLE_AUTOMATIC_PROCESSING=no`

---

## 🧪 Development Workflow

### Running Tests

```bash
# Linting
npm run lint  # ESLint + Prettier

# Manual Testing
# Use /playground route for prompt testing
# Use /manual for single document processing
```

### Common Development Tasks

**Add New AI Provider**:
1. Create `services/yourProviderService.js` (follow `openaiService.js` pattern)
2. Add to `services/aiServiceFactory.js`
3. Update `config/config.js` with provider config
4. Add to setup wizard in `views/settings.ejs`

**Add New Route**:
1. Add route in `routes/setup.js` (or create new route file)
2. Add `isAuthenticated` middleware for protected routes
3. Document with JSDoc + Swagger comments
4. Create EJS view in `views/`
5. Add navigation link in sidebar (all templates)

**Database Changes**:
1. Add table creation in `models/document.js`
2. Add prepared statements for queries
3. Export methods in module.exports
4. Use in services/routes

**Frontend Changes**:
1. Edit EJS templates in `views/`
2. Add CSS to appropriate file in `public/css/`
3. Add JavaScript to `public/js/`
4. Respect dark mode theme (use CSS variables)

### Debugging

**Enable Verbose Logging**:
```javascript
// models/document.js
const db = new Database(path.join(dataDir, 'documents.db'), { 
  verbose: console.log  // Uncomment this line
});
```

**Check Logs**:
- Browser Console: Frontend errors
- Terminal: Server logs
- `logs.html`: Structured HTML logs
- `logs.txt`: Plain text logs

**Common Issues**:
- **"Cannot connect to Paperless"**: Check `PAPERLESS_API_URL` and `PAPERLESS_API_TOKEN`
- **"AI provider error"**: Verify API keys and model availability
- **"RAG service unavailable"**: Ensure Python service is running on port 8000
- **Database locked**: Restart server (WAL mode should prevent this)

---

## 📊 Database Schema

### Tables

**processed_documents**:
```sql
CREATE TABLE processed_documents (
    id INTEGER PRIMARY KEY,
    document_id INTEGER UNIQUE,
    title TEXT,
    processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**history_documents**:
```sql
CREATE TABLE history_documents (
    id INTEGER PRIMARY KEY,
    document_id INTEGER,
    tags TEXT,              -- JSON array
    title TEXT,
    correspondent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**openai_metrics**:
```sql
CREATE TABLE openai_metrics (
    id INTEGER PRIMARY KEY,
    document_id INTEGER,
    promptTokens INTEGER,
    completionTokens INTEGER,
    totalTokens INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**original_documents**:
```sql
CREATE TABLE original_documents (
    id INTEGER PRIMARY KEY,
    document_id INTEGER,
    title TEXT,
    tags TEXT,              -- JSON array
    correspondent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**users**:
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    username TEXT,
    password TEXT,          -- bcrypt hash
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🔐 Security Considerations

### Best Practices

1. **Never commit `.env` files** (already in `.gitignore`)
2. **Use strong API keys** for external access
3. **Keep dependencies updated** (`npm audit`, `pip check`)
4. **Enable HTTPS** in production (reverse proxy)
5. **Restrict Docker ports** (bind to localhost if possible)
6. **Use read-only volumes** where appropriate
7. **Review Swagger docs** at `/api-docs` for API surface

### Authentication Flow

```
Request → isAuthenticated Middleware → Check JWT cookie OR x-api-key header → Allow/Deny
```

**JWT Generation**:
```javascript
const token = jwt.sign({ username }, API_KEY, { expiresIn: '24h' });
res.cookie('token', token, { httpOnly: true });
```

**API Key Validation**:
```javascript
const apiKey = req.headers['x-api-key'];
if (apiKey && apiKey === process.env.API_KEY) {
  return next();
}
```

---

## 🎯 Common Use Cases

### 1. Process Specific Documents

**Setup**:
1. Create tag in Paperless-ngx (e.g., "pre-process")
2. Set `PROCESS_PREDEFINED_DOCUMENTS=yes`
3. Set `TAGS=pre-process`
4. Add tag to documents you want processed

### 2. Custom AI Prompts

**Method 1: UI**
- Go to `/settings`
- Edit "System Prompt" field
- Save configuration

**Method 2: Environment Variable**
```bash
SYSTEM_PROMPT="Your custom instructions here..."
```

### 3. RAG Chat with Documents

**Workflow**:
1. Index documents: POST `/api/rag/index`
2. Wait for indexing to complete (check `/api/rag/status`)
3. Open `/rag` in browser
4. Ask questions about your documents

### 4. Manual Processing

**Use Case**: Review sensitive documents before AI tagging

**Steps**:
1. Go to `/manual`
2. Select document from list
3. Review AI suggestions
4. Accept or modify
5. Apply changes to Paperless-ngx

### 5. Restrict AI to Existing Data

**Prevent AI from creating new tags/correspondents**:
```bash
RESTRICT_TO_EXISTING_TAGS=yes
RESTRICT_TO_EXISTING_CORRESPONDENTS=yes
RESTRICT_TO_EXISTING_DOCUMENT_TYPES=yes
```

AI will only suggest from existing Paperless-ngx data.

---

## 🐛 Known Issues & Workarounds

### Issue: Infinite Retry Loop
**Fixed in**: PR-772, Commit 12c5f5b  
**Solution**: Retry limit with exponential backoff

### Issue: History Page Slow (1000+ docs)
**Fixed in**: PERF-001, Commit 0192182  
**Solution**: SQL pagination + tag caching

### Issue: SSE Progress Not Showing
**Fixed in**: Commit f249f71  
**Solution**: Force flush with `res.flush()` and `X-Accel-Buffering: no`

### Issue: Docker Build Size (1.5GB+)
**Fixed in**: DOCKER-001  
**Solution**: Lite variant (~400MB) without RAG, Full variant optimized (~1.2GB)

### Issue: Dark Mode Images Inverted
**Solution**: Add `class="no-invert"` to images that shouldn't be inverted

---

## 📚 API Reference

### Key Endpoints

**Authentication**:
- `POST /login` - User login (returns JWT)
- `GET /logout` - Clear session
- All API routes require `isAuthenticated` middleware

**Dashboard**:
- `GET /dashboard` - Main metrics dashboard
- `GET /api/stats` - Statistics JSON

**Document Processing**:
- `POST /api/process-document` - Manual processing
- `GET /api/documents/next-unprocessed` - Get next document
- `POST /api/reset-all-documents` - Clear all history
- `POST /api/reset-documents` - Clear selected documents

**History**:
- `GET /history` - History page (server-rendered)
- `GET /api/history` - DataTables pagination (server-side)
- `GET /api/history/load-progress` - SSE for initial load
- `GET /api/history/validate` - SSE for validation
- `POST /api/history/clear-cache` - Clear tag cache

**RAG Chat**:
- `POST /api/rag/index` - Index documents
- `POST /api/rag/query` - RAG query
- `GET /api/rag/status` - Indexing status
- `DELETE /api/rag/clear` - Clear vector DB

**Settings**:
- `GET /api/settings` - Current configuration
- `POST /api/settings` - Update configuration

**Swagger**: `/api-docs` for full API documentation

---

## 🤝 Contributing

### Upstream vs Fork

**For Core Features**: Contribute to [clusterzx/paperless-ai](https://github.com/clusterzx/paperless-ai)

**For This Fork**:
- Integration testing
- Docker optimizations
- Security patches
- Performance improvements
- Documentation

### Pull Request Guidelines

1. **Test thoroughly** - Local + Docker
2. **Follow existing patterns** - Service classes, error handling
3. **Document changes** - JSDoc + Swagger comments
4. **Update COPILOT.md** - If architecture changes
5. **Security first** - Use `isAuthenticated` middleware
6. **Performance aware** - Avoid N+1 queries, use pagination

### Code Style

- **JavaScript**: ESLint + Prettier
- **Naming**: camelCase for variables, PascalCase for classes
- **Async**: Use `async/await` over callbacks
- **Errors**: Log with `console.error('[ERROR]', ...)`
- **Comments**: JSDoc for functions, inline for complex logic

---

## 📝 Questions for Better Understanding

### Architectural Questions

1. **Why both Node.js AND Python?**
   - Node: Web server, API, document processing orchestration
   - Python: RAG service (better ML/AI libraries, faster vector operations)

2. **Why SQLite instead of PostgreSQL/MongoDB?**
   - Simplicity, zero-config, WAL mode for concurrency, good enough for single-instance

3. **Why EJS instead of React/Vue?**
   - Server-side rendering, simpler deployment, no build step, SEO-friendly

4. **Why PM2 in Docker?**
   - Manage both Node and Python processes, auto-restart, log management

### Integration Questions

5. **How does Paperless-AI discover new documents?**
   - Cron job (default 30min) queries Paperless-ngx API
   - Filters by tag if configured
   - Compares against `processed_documents` table

6. **How does RAG indexing work?**
   - Fetches documents from Paperless-ngx
   - Chunks text with overlap
   - Generates embeddings with sentence-transformers
   - Stores in ChromaDB vector database
   - BM25 index for keyword search

7. **What happens if AI generates invalid JSON?**
   - Try/catch with JSON.parse()
   - Retry with exponential backoff (up to 3 times)
   - Log error and skip document
   - Can be manually processed later

8. **Can multiple users use the system?**
   - Single-user design (admin account)
   - JWT/API key for authentication
   - No multi-tenancy support

### Configuration Questions

9. **Which AI provider is recommended?**
   - **Local/Privacy**: Ollama with Mistral or Llama
   - **Best quality**: OpenAI GPT-4
   - **Cost-effective**: DeepSeek via Custom API
   - **Enterprise**: Azure OpenAI

10. **How to handle large document archives?**
    - Use tag filtering (`PROCESS_PREDEFINED_DOCUMENTS=yes`)
    - Increase `SCAN_INTERVAL` to reduce frequency
    - Consider RAG indexing in batches
    - Monitor `openai_metrics` table for token usage

11. **How to customize prompts for specific document types?**
    - Edit `SYSTEM_PROMPT` in settings or .env
    - Use placeholders like `%CUSTOMFIELDS%` for dynamic content
    - Test in `/playground` before applying

12. **How to backup data?**
    - SQLite: Copy `data/documents.db` (stop server first or use `.backup`)
    - RAG: Copy `data/chromadb/` directory
    - Config: Copy `data/.env`

### Performance Questions

13. **Why is history page still slow?**
    - Check if indexes exist on `history_documents`
    - Verify tag cache is working (5min TTL)
    - Monitor SQL query timing in logs
    - Consider VACUUM on SQLite DB

14. **How to reduce Docker image size?**
    - Use `-lite` tag (no RAG, ~400MB)
    - Multi-stage builds (already implemented)
    - Avoid installing dev dependencies

15. **How to optimize RAG performance?**
    - Reduce chunk size/overlap
    - Use faster embedding model
    - Limit reranking to top-K results
    - Add caching layer

### Troubleshooting Questions

16. **Why doesn't dark mode work?**
    - Check localStorage: `localStorage.getItem('theme')`
    - Verify `data-theme` attribute on `<html>` element
    - Check CSS variable loading in browser DevTools

17. **Why aren't documents being processed?**
    - Check cron schedule: `SCAN_INTERVAL` format
    - Verify `DISABLE_AUTOMATIC_PROCESSING=no`
    - Check Paperless-ngx connectivity
    - Review logs for errors

18. **Why does RAG say "Service unavailable"?**
    - Ensure Python service is running (port 8000)
    - Check `RAG_SERVICE_ENABLED=true`
    - Verify ChromaDB directory exists and is writable
    - Check Python logs for errors

19. **How to reset everything?**
    ```bash
    # Delete database
    rm data/documents.db*
    
    # Clear RAG index
    rm -rf data/chromadb/
    
    # Restart server (will recreate tables)
    ```

20. **How to migrate from upstream to this fork?**
    - Backup `data/` directory
    - Pull new Docker image: `admonstrator/paperless-ai-patched`
    - Mount same volume: `-v ./data:/app/data`
    - Compatible with upstream data format

---

## 🔗 Useful Links

### Official
- **Upstream Project**: https://github.com/clusterzx/paperless-ai
- **This Fork**: https://github.com/Admonstrator/paperless-ai-patched
- **Docker Hub**: https://hub.docker.com/r/admonstrator/paperless-ai-patched
- **Paperless-ngx**: https://github.com/paperless-ngx/paperless-ngx

### Documentation
- **Installation Wiki**: https://github.com/clusterzx/paperless-ai/wiki/2.-Installation
- **Included Fixes**: `Included_Fixes/README.md`
- **RAG Dev Guide**: `docs/RAG-DEV-GUIDE.md`
- **JSDoc Standards**: `docs/jsdoc_standards.md`

### Community
- **Upstream Discord**: https://discord.gg/AvNekAfK38
- **Upstream Issues**: https://github.com/clusterzx/paperless-ai/issues
- **Fork Issues**: https://github.com/Admonstrator/paperless-ai-patched/issues

---

## 📄 License

MIT License - See [LICENSE](LICENSE) file

Original work Copyright © [clusterzx](https://github.com/clusterzx)  
Fork maintained by [Admonstrator](https://github.com/Admonstrator)

---

**Last Updated**: 2025-12-03  
**Version**: Based on upstream v3.0.9 + community patches
