# 🌙 Nightly Builds - Manual Trigger Guide

## Automatic Builds

The nightly workflow runs automatically:
- **Daily**: Every day at 2:00 AM UTC
- **On Push**: When the PERF-002 branch is updated

## Manual Trigger via GitHub Actions

### Option 1: GitHub Web Interface

1. Go to the repository on GitHub:
   ```
   https://github.com/Admonstrator/paperless-ai-patched/actions
   ```

2. Click on **"Docker Nightly Build"** in the left sidebar

3. Click the **"Run workflow"** dropdown button

4. Select branch: **PERF-002-optimize-caching-strategy**

5. Click **"Run workflow"**

### Option 2: GitHub CLI

```bash
# Install GitHub CLI if not already installed
brew install gh  # macOS
# or: apt install gh  # Linux

# Authenticate (first time only)
gh auth login

# Trigger the workflow
gh workflow run "Docker Nightly Build" \
  --repo Admonstrator/paperless-ai-patched \
  --ref PERF-002-optimize-caching-strategy
```

### Option 3: API Call

```bash
# Using curl with GitHub Personal Access Token
curl -X POST \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer YOUR_GITHUB_TOKEN" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  https://api.github.com/repos/Admonstrator/paperless-ai-patched/actions/workflows/docker-nightly.yml/dispatches \
  -d '{"ref":"PERF-002-optimize-caching-strategy"}'
```

## Verify Build Status

### Via GitHub Actions Web UI

1. Go to: https://github.com/Admonstrator/paperless-ai-patched/actions
2. Click on **"Docker Nightly Build"**
3. See the latest run status

### Via GitHub CLI

```bash
# List recent workflow runs
gh run list --workflow="Docker Nightly Build" --repo Admonstrator/paperless-ai-patched

# Watch a specific run
gh run watch <run-id> --repo Admonstrator/paperless-ai-patched
```

## Check Available Images

### Docker Hub

```bash
# Check tags
curl -s "https://hub.docker.com/v2/repositories/admonstrator/paperless-ai-patched/tags/?page_size=100" | \
  jq -r '.results[] | select(.name | contains("nightly")) | .name'

# Expected output:
# nightly
# nightly-lite
# nightly-20251204
# perf-002-latest
```

### GitHub Container Registry

```bash
# List GHCR tags (requires authentication)
gh api /user/packages/container/paperless-ai-patched/versions | \
  jq -r '.[].metadata.container.tags[]' | \
  grep nightly

# Or check via Docker
docker pull ghcr.io/admonstrator/paperless-ai-patched:nightly
```

## Build Artifacts

After a successful build, the following images are available:

**Docker Hub**:
- `admonstrator/paperless-ai-patched:nightly`
- `admonstrator/paperless-ai-patched:nightly-lite`
- `admonstrator/paperless-ai-patched:nightly-YYYYMMDD`
- `admonstrator/paperless-ai-patched:perf-002-latest`

**GitHub Container Registry**:
- `ghcr.io/admonstrator/paperless-ai-patched:nightly`
- `ghcr.io/admonstrator/paperless-ai-patched:nightly-lite`
- `ghcr.io/admonstrator/paperless-ai-patched:nightly-YYYYMMDD`
- `ghcr.io/admonstrator/paperless-ai-patched:perf-002-latest`

## Troubleshooting

### Build Failed

1. Check the workflow logs:
   ```bash
   gh run view <run-id> --log --repo Admonstrator/paperless-ai-patched
   ```

2. Common issues:
   - **Docker Hub credentials**: Check `DOCKER_USERNAME` and `DOCKER_PASSWORD` secrets
   - **GHCR permissions**: Ensure `GITHUB_TOKEN` has `packages: write` permission
   - **Disk space**: Build might fail if runner runs out of space

### Image Not Available

1. Check if build completed successfully (see workflow status)
2. Wait 2-3 minutes for registry propagation
3. Verify image name and tag are correct
4. Try pulling with explicit registry:
   ```bash
   docker pull admonstrator/paperless-ai-patched:nightly --platform linux/amd64
   ```

### Authentication Issues

For GHCR, you need to authenticate:

```bash
# Create personal access token with read:packages scope
# https://github.com/settings/tokens

# Login to GHCR
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Pull image
docker pull ghcr.io/admonstrator/paperless-ai-patched:nightly
```

## Build Duration

Typical build times:
- **Lite image**: 5-8 minutes
- **Both platforms** (amd64 + arm64): 10-15 minutes
- **With cold cache**: Up to 20 minutes

## Next Steps

After build completes:
1. Pull the nightly image
2. Test in a development environment
3. Report issues on GitHub
4. Provide feedback for PERF-002 optimization

See [NIGHTLY.md](NIGHTLY.md) for usage instructions.
