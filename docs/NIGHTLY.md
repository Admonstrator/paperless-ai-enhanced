# Nightly Builds

## Overview

Nightly builds are automatically generated from the `PERF-002-optimize-caching-strategy` branch every night at 2 AM UTC. These builds include experimental caching optimizations that are not yet merged to the main branch.

## Available Tags

### Docker Hub
- `admonstrator/paperless-ai-patched:nightly` - Latest nightly build (Lite)
- `admonstrator/paperless-ai-patched:nightly-lite` - Same as above
- `admonstrator/paperless-ai-patched:nightly-YYYYMMDD` - Dated nightly build
- `admonstrator/paperless-ai-patched:perf-002-latest` - Latest from PERF-002 branch

### GitHub Container Registry
- `ghcr.io/admonstrator/paperless-ai-patched:nightly` - Latest nightly build (Lite)
- `ghcr.io/admonstrator/paperless-ai-patched:nightly-lite` - Same as above
- `ghcr.io/admonstrator/paperless-ai-patched:nightly-YYYYMMDD` - Dated nightly build
- `ghcr.io/admonstrator/paperless-ai-patched:perf-002-latest` - Latest from PERF-002 branch

## Usage

### Docker Compose

```yaml
version: '3.8'

services:
  paperless-ai:
    image: admonstrator/paperless-ai-patched:nightly
    # or: image: ghcr.io/admonstrator/paperless-ai-patched:nightly
    container_name: paperless-ai
    ports:
      - "8080:8080"
    volumes:
      - ./data:/app/data
    environment:
      # Your environment variables
      PAPERLESS_URL: "http://your-paperless-instance:8000"
      PAPERLESS_API_TOKEN: "your-api-token"
      # ... other config
    restart: unless-stopped
```

### Docker Run

```bash
# Docker Hub
docker pull admonstrator/paperless-ai-patched:nightly
docker run -d \
  --name paperless-ai \
  -p 8080:8080 \
  -v ./data:/app/data \
  -e PAPERLESS_URL="http://your-paperless-instance:8000" \
  -e PAPERLESS_API_TOKEN="your-api-token" \
  admonstrator/paperless-ai-patched:nightly

# GitHub Container Registry
docker pull ghcr.io/admonstrator/paperless-ai-patched:nightly
docker run -d \
  --name paperless-ai \
  -p 8080:8080 \
  -v ./data:/app/data \
  -e PAPERLESS_URL="http://your-paperless-instance:8000" \
  -e PAPERLESS_API_TOKEN="your-api-token" \
  ghcr.io/admonstrator/paperless-ai-patched:nightly
```

## What's Different in Nightly Builds?

The nightly builds include the PERF-002 caching optimizations:

1. **MetadataCache Service** - 30-minute cache TTL instead of 3 seconds
2. **Incremental Scanning** - Only processes documents modified since last scan
3. **Optimized API Calls** - Field selection and filtering support
4. **Separate Cron Jobs** - Cache refresh independent from document scan
5. **Cache Admin UI** - New `/cache-admin` page for monitoring

### Performance Improvements
- **96% reduction** in Paperless-ngx API calls (~72,000 → ~2,400 per day)
- **Scan duration**: 5-10 minutes → 30-60 seconds (incremental mode)
- **Cache hit rate**: >95% after warm-up

### New Environment Variables

```bash
# Metadata cache TTL in milliseconds (default: 30 minutes)
METADATA_CACHE_TTL=1800000

# Cache refresh interval (cron format, default: every 15 minutes)
CACHE_REFRESH_INTERVAL="*/15 * * * *"

# Enable/disable incremental scanning (default: enabled)
ENABLE_INCREMENTAL_SCAN=yes
```

## Testing & Feedback

These builds are for testing purposes. Please report any issues on GitHub:
- Issues: https://github.com/Admonstrator/paperless-ai-patched/issues
- PR Discussion: [PERF-002](https://github.com/Admonstrator/paperless-ai-patched/pull/XXX)

## Accessing Cache Admin

The nightly builds include a new Cache Admin interface:

1. Log in to your Paperless-AI instance
2. Navigate to `http://your-instance:8080/cache-admin`
3. View real-time cache statistics
4. Force cache refresh or clear cache
5. Trigger manual document scan

## Build Schedule

- **Automatic**: Every day at 2:00 AM UTC
- **Manual**: Can be triggered via GitHub Actions
- **On Push**: Automatically builds when PERF-002 branch is updated

## Migration Path

Once PERF-002 is merged to main:
1. The nightly tag will point to the main branch
2. All optimizations will be in the `latest` tag
3. Previous nightly builds remain available as dated tags

## Stability Warning

⚠️ **Important**: Nightly builds are experimental and may contain bugs. Use in production at your own risk.

Recommended for:
- Testing new features
- Evaluating performance improvements
- Development environments
- Beta testing

Not recommended for:
- Production deployments without testing
- Critical document processing workflows
- Instances with >10,000 documents (without testing first)

## Rollback

If you experience issues, revert to the stable release:

```bash
# Docker Compose
docker pull admonstrator/paperless-ai-patched:latest
docker-compose up -d

# Docker Run
docker stop paperless-ai
docker rm paperless-ai
docker pull admonstrator/paperless-ai-patched:latest
docker run -d ... admonstrator/paperless-ai-patched:latest
```

## Build Information

Each nightly build includes:
- **Branch**: PERF-002-optimize-caching-strategy
- **Build Date**: YYYYMMDD format in tag
- **Commit SHA**: Available in Docker labels
- **Version**: nightly-YYYYMMDD

Check build labels:
```bash
docker inspect admonstrator/paperless-ai-patched:nightly | jq '.[0].Config.Labels'
```
