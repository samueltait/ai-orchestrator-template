# AI Orchestration Template - Setup Checklist

**Version:** 1.9.0 | **Updated:** 2026-01-12

Use this checklist to set up the AI orchestration template. Check off each item as you complete it.

---

## Prerequisites

- [ ] macOS, Linux, or WSL2 on Windows
- [ ] Terminal access (iTerm2, Apple Terminal, or tmux recommended)
- [ ] Python 3.9+ installed
- [ ] Node.js 18+ or Bun runtime

---

## Phase 1: Core API Keys (Required)

### 1.1 Create Keys File
```bash
cp env_template.sh ~/.llm_keys
chmod 600 ~/.llm_keys
```
- [ ] Keys file created at `~/.llm_keys`
- [ ] Permissions set to 600 (owner read/write only)

### 1.2 Get API Keys

| Provider | URL | Free Tier | Notes |
|----------|-----|-----------|-------|
| Claude | Claude Max subscription | Via subscription | Best for reasoning |
| Google Gemini | https://aistudio.google.com/apikey | Yes | Long context, multimodal |
| OpenAI | https://platform.openai.com/api-keys | No | Content generation |
| Perplexity | https://perplexity.ai/settings/api | Limited | Web search |

- [ ] Claude Max subscription active (used by Claude Code CLI)
- [ ] `GEMINI_API_KEY` added
- [ ] `OPENAI_API_KEY` added
- [ ] `PERPLEXITY_API_KEY` added

### 1.3 Load Keys
```bash
echo 'source ~/.llm_keys' >> ~/.zshrc
source ~/.zshrc
```
- [ ] Source command added to shell profile
- [ ] Keys verified: `echo $GEMINI_API_KEY | head -c 10`

---

## Phase 2: Local Tools (Recommended)

### 2.1 Install Ollama
**macOS:**
```bash
# Download from https://ollama.com/download/mac
# Or if Homebrew is installed:
brew install ollama
```

**Linux:**
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

- [ ] Ollama installed: `ollama --version`

### 2.2 Pull Ollama Models
```bash
ollama pull llama3.2          # General purpose (3B)
ollama pull nomic-embed-text  # Embeddings for RAG
ollama pull codellama         # Code-specific (optional)
```
- [ ] llama3.2 pulled
- [ ] nomic-embed-text pulled

### 2.3 Install Python Tools
```bash
pip install pdfplumber chromadb marker-pdf
```
- [ ] pdfplumber installed
- [ ] chromadb installed
- [ ] marker-pdf installed

### 2.4 Install Bun Runtime
```bash
curl -fsSL https://bun.sh/install | bash
```
- [ ] Bun installed: `bun --version`

### 2.5 Set Up Claude Canvas
```bash
cd claude-canvas
bun install  # Creates bun.lock for reproducible builds
bun run canvas/src/cli.ts env  # Verify environment
```
- [ ] Dependencies installed (check `bun.lock` exists)
- [ ] Environment check passes

**Note:** The `bun.lock` file ensures consistent dependency versions across installations. Commit this file to version control for reproducible builds.

### 2.6 Set Up LLM Gateway
```bash
cd gateway
bun install

# Run tests to verify installation
bun test

# Start dashboard to verify it works
bun run dashboard  # Opens at http://localhost:3001/dashboard
```
- [ ] Dependencies installed
- [ ] Tests pass (68 tests)
- [ ] Dashboard starts successfully

**Gateway Features:**
- Semantic caching with real embeddings (OpenAI, Ollama)
- Intelligent routing (cost, latency, quality optimization)
- Streaming with first-token latency tracking
- Real-time monitoring dashboard
- Kubernetes Helm charts for deployment
- LLM-as-Judge evaluation

---

## Phase 3: Integrations (Optional)

### 3.1 Slack Bot
1. Go to https://api.slack.com/apps
2. Click "Create New App" → "From scratch"
3. Add OAuth scopes:
   - `chat:write`
   - `channels:read`
   - `channels:history`
   - `search:read`
4. Install to workspace
5. Copy Bot Token and Signing Secret

```bash
# Add to ~/.llm_keys:
export SLACK_BOT_TOKEN="xoxb-your-token"
export SLACK_SIGNING_SECRET="your-secret"
```
- [ ] Slack app created
- [ ] Bot token added
- [ ] Signing secret added

### 3.2 Notion Integration
1. Go to https://www.notion.so/my-integrations
2. Click "New integration"
3. Name it and select workspace
4. Copy the integration token
5. Share pages/databases with the integration

```bash
# Add to ~/.llm_keys:
export NOTION_API_KEY="secret_your-token"
```
- [ ] Integration created
- [ ] Token added
- [ ] Pages shared with integration

### 3.3 Google OAuth (Gmail & Calendar)
1. Go to https://console.cloud.google.com/apis/credentials
2. Create OAuth 2.0 Client ID (Desktop app)
3. Download client_secret JSON
4. Run OAuth flow to get refresh token

```bash
# Add to ~/.llm_keys:
export GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
export GOOGLE_CLIENT_SECRET="GOCSPX-your-secret"
export GOOGLE_REFRESH_TOKEN="1//your-refresh-token"
```

**OAuth Flow for Refresh Token:**
```bash
# Generate authorization URL
AUTH_URL="https://accounts.google.com/o/oauth2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=http://localhost&response_type=code&scope=https://www.googleapis.com/auth/gmail.send%20https://www.googleapis.com/auth/gmail.readonly%20https://www.googleapis.com/auth/calendar&access_type=offline&prompt=consent"

echo "Open this URL in browser:"
echo $AUTH_URL

# After authorizing, extract code from redirect URL and exchange:
curl -s -X POST https://oauth2.googleapis.com/token \
  -d "client_id=${GOOGLE_CLIENT_ID}" \
  -d "client_secret=${GOOGLE_CLIENT_SECRET}" \
  -d "code=YOUR_AUTH_CODE" \
  -d "grant_type=authorization_code" \
  -d "redirect_uri=http://localhost"
```

- [ ] OAuth client created
- [ ] Client ID added
- [ ] Client secret added
- [ ] Refresh token obtained and added

### 3.4 Rev.ai (Audio Transcription)
1. Go to https://www.rev.ai/account/settings
2. Create API access token
3. Cost: $0.02/min async, $0.05/min streaming

```bash
# Add to ~/.llm_keys:
export REVAI_API_KEY="your-revai-token"
```
- [ ] Rev.ai account created
- [ ] API token added

### 3.5 Pinecone (Vector Database)
1. Go to https://app.pinecone.io/
2. Create account (free starter available)
3. Create an index
4. Copy API key

```bash
# Add to ~/.llm_keys:
export PINECONE_API_KEY="your-pinecone-key"
export PINECONE_ENVIRONMENT="us-east-1-aws"
```
- [ ] Pinecone account created
- [ ] API key added
- [ ] Environment set

### 3.6 Figma MCP (Design Files)
1. Have an active Figma account (free or paid)
2. Add MCP server to Claude Code (one-time global setup):

```bash
# Add Figma MCP server
claude mcp add --transport http figma https://mcp.figma.com/mcp
```

3. Authenticate in Claude Code:
   - Type `/mcp` in Claude Code
   - Select the `figma` server
   - Click "Allow access" to authenticate with your Figma account

**Per-Project Authentication:**
- Each project should verify the connected account using `whoami`
- If working with multiple Figma accounts, switch accounts as needed (see CLAUDE.md)
- Authentication persists until you explicitly switch accounts

**Rate Limits:**
- Starter (free) plan: 6 tool calls/month
- Paid plans: Standard API rate limits

- [ ] Figma account active
- [ ] MCP server added to Claude Code
- [ ] Authentication completed via `/mcp`
- [ ] Verified correct account with `whoami`

---

## Phase 4: Verification

### 4.1 Test Core Services
```bash
# Verify keys loaded
source ~/.llm_keys
echo "Gemini: $(echo $GEMINI_API_KEY | head -c 10)..."
echo "OpenAI: $(echo $OPENAI_API_KEY | head -c 10)..."
```

### 4.2 Test Ollama
```bash
ollama list
ollama run llama3.2 "Say hello in 5 words"
```

### 4.3 Test Python Tools
```bash
python -c "import pdfplumber; print('pdfplumber OK')"
python -c "import chromadb; print('chromadb OK')"
```

### 4.4 Test Claude Canvas
```bash
cd claude-canvas
bun run canvas/src/cli.ts spawn weather
```

### 4.5 Test LLM Gateway
```bash
cd gateway

# Run tests
bun test

# Start dashboard
bun run dashboard &

# Check health endpoint
curl http://localhost:3001/dashboard/api/metrics
```

### 4.6 Test Figma MCP
```bash
# In Claude Code, type:
/mcp

# Verify figma server shows as "connected"
# Then try: "List the files in my Figma account"
```

### 4.7 Test Integrations (if configured)
```bash
# Slack
curl -X POST https://slack.com/api/auth.test \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN"

# Notion
curl https://api.notion.com/v1/users/me \
  -H "Authorization: Bearer $NOTION_API_KEY" \
  -H "Notion-Version: 2022-06-28"

# Google Calendar
curl "https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=1" \
  -H "Authorization: Bearer $(curl -s -X POST https://oauth2.googleapis.com/token \
    -d "client_id=$GOOGLE_CLIENT_ID" \
    -d "client_secret=$GOOGLE_CLIENT_SECRET" \
    -d "refresh_token=$GOOGLE_REFRESH_TOKEN" \
    -d "grant_type=refresh_token" | jq -r '.access_token')"

# Pinecone
curl "https://api.pinecone.io/indexes" \
  -H "Api-Key: $PINECONE_API_KEY"

# Rev.ai
curl https://api.rev.ai/speechtotext/v1/account \
  -H "Authorization: Bearer $REVAI_API_KEY"
```

---

## Verification Checklist

### Core (Required)
- [ ] API keys file created and secured
- [ ] At least one LLM API key configured
- [ ] Keys auto-load in new terminals

### Local Tools (Recommended)
- [ ] Ollama running with models
- [ ] Python PDF tools installed
- [ ] Claude Canvas working
- [ ] LLM Gateway tests passing
- [ ] Gateway dashboard accessible

### Integrations (Optional)
- [ ] Slack bot responding
- [ ] Notion API accessible
- [ ] Google OAuth working
- [ ] Rev.ai account active
- [ ] Pinecone index created
- [ ] Figma MCP connected

---

## Monthly Costs Estimate

| Service | Usage | Monthly Cost |
|---------|-------|--------------|
| **Claude** | Light use | $5-20 |
| **Gemini** | Moderate use | $1-10 |
| **OpenAI** | Light use | $5-15 |
| **Perplexity** | Light use | $5-10 |
| **Rev.ai** | 100 min/mo | $2 |
| **Pinecone** | Starter | Free |
| **Figma MCP** | With Figma plan | Free |
| **Ollama** | Unlimited | Free |
| **ChromaDB** | Unlimited | Free |

**Typical monthly total:** $20-60 for moderate use

---

## Next Steps

1. Read `LLM_Orchestrator_Instructions.md` for the full system prompt
2. Review `OpenCode_Quick_Start_Guide.md` for autonomous coding
3. Explore Claude Canvas capabilities in `claude-canvas/README.md`
4. Copy `CLAUDE.md` to your project for Claude Code integration

## Additional Documentation

The `docs/` folder contains extended documentation:

| Document | Purpose |
|----------|---------|
| `docs/CLI_REFERENCE.md` | Actual CLI commands and wrapper scripts |
| `docs/MODEL_REFERENCE.md` | Model versions, capabilities, and selection guide |
| `docs/COST_TRACKING.md` | Budget management and cost estimation |
| `docs/ERROR_HANDLING.md` | Worked examples of failure recovery |
| `docs/PERFORMANCE.md` | Benchmarks and optimization tips |
| `docs/IPC_PROTOCOL.md` | Canvas inter-process communication |
| `docs/PERMISSIONS.md` | Claude Code permissions reference |
| `docs/CANVAS_PLUGINS.md` | Guide to creating custom canvases |
