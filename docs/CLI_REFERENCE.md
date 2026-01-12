# CLI Commands Reference

**Version:** 1.8.0 | **Updated:** 2026-01-11

This document provides the actual CLI commands used by the AI Orchestrator. Commands marked with `[PLACEHOLDER]` require you to create wrapper scripts or use the underlying APIs directly.

---

## Command Status Legend

| Status | Meaning |
|--------|---------|
| Built-in | Command works out of the box after installation |
| Wrapper | Requires wrapper script (template provided below) |
| MCP | Uses Claude Code MCP server |
| Native | Uses native system command |

---

## LLM Provider CLIs

### Claude (via Claude Code)

**Status:** Built-in (with Claude Max subscription)

```bash
# Claude Code CLI - direct interaction
claude                           # Start interactive session
claude --version                 # Check version
claude update                    # Update to latest version
claude "your prompt here"        # One-shot query

# API usage (if you have CLAUDE_API_KEY)
# Note: Claude Max subscription doesn't require API key for CLI
```

### Gemini

**Status:** Wrapper required

The orchestrator uses `gemini_cli` as a placeholder. Create this wrapper:

```bash
#!/bin/bash
# Save as ~/bin/gemini_cli and chmod +x

# Usage: gemini_cli --model MODEL --in FILE --task "TASK" > output
# Usage: gemini_cli --model MODEL --task "TASK" (reads stdin)

MODEL="gemini-2.5-flash"
INPUT_FILE=""
TASK=""
OUTPUT_FORMAT="text"

while [[ $# -gt 0 ]]; do
  case $1 in
    --model) MODEL="$2"; shift 2 ;;
    --in) INPUT_FILE="$2"; shift 2 ;;
    --task) TASK="$2"; shift 2 ;;
    --output-format) OUTPUT_FORMAT="$2"; shift 2 ;;
    *) shift ;;
  esac
done

# Read input
if [ -n "$INPUT_FILE" ]; then
  CONTENT=$(cat "$INPUT_FILE")
else
  CONTENT=$(cat)
fi

# Build prompt
PROMPT="$TASK

Content:
$CONTENT"

# Call Gemini API
curl -s "https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"contents\": [{\"parts\": [{\"text\": $(echo "$PROMPT" | jq -Rs .)}]}],
    \"generationConfig\": {\"temperature\": 0.7}
  }" | jq -r '.candidates[0].content.parts[0].text'
```

**Available models:**
- `gemini-2.0-flash-lite` - Tier 1, cheapest
- `gemini-2.5-flash` - Tier 2, balanced
- `gemini-2.5-pro` - Tier 3, 1M context

### OpenAI

**Status:** Wrapper required

```bash
#!/bin/bash
# Save as ~/bin/openai_cli and chmod +x

MODEL="gpt-4o"
INPUT_FILE=""
TASK=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --model) MODEL="$2"; shift 2 ;;
    --in) INPUT_FILE="$2"; shift 2 ;;
    --task) TASK="$2"; shift 2 ;;
    *) shift ;;
  esac
done

if [ -n "$INPUT_FILE" ]; then
  CONTENT=$(cat "$INPUT_FILE")
else
  CONTENT=$(cat)
fi

PROMPT="$TASK

Content:
$CONTENT"

curl -s https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"$MODEL\",
    \"messages\": [{\"role\": \"user\", \"content\": $(echo "$PROMPT" | jq -Rs .)}]
  }" | jq -r '.choices[0].message.content'
```

**Available models:**
- `gpt-4o-mini` - Tier 2, fast
- `gpt-4o` - Tier 3, strong generalist

### Perplexity

**Status:** Wrapper required

```bash
#!/bin/bash
# Save as ~/bin/perplexity_cli and chmod +x

QUERY=""
TOP_K=5

while [[ $# -gt 0 ]]; do
  case $1 in
    --query) QUERY="$2"; shift 2 ;;
    --top-k) TOP_K="$2"; shift 2 ;;
    *) shift ;;
  esac
done

curl -s https://api.perplexity.ai/chat/completions \
  -H "Authorization: Bearer $PERPLEXITY_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"llama-3.1-sonar-large-128k-online\",
    \"messages\": [{\"role\": \"user\", \"content\": $(echo "$QUERY" | jq -Rs .)}],
    \"return_citations\": true
  }" | jq -r '.choices[0].message.content'
```

---

## Local Tools

### Ollama

**Status:** Built-in

```bash
# Install
curl -fsSL https://ollama.com/install.sh | sh  # Linux
brew install ollama                             # macOS

# Commands
ollama serve                    # Start server (runs in background)
ollama pull llama3.2            # Download model
ollama list                     # List installed models
ollama run llama3.2 "prompt"    # Run inference
ollama run codellama "prompt"   # Code-specific model

# Embedding
echo "text" | ollama run nomic-embed-text
```

**Recommended models:**
- `llama3.2` - General purpose (3B)
- `llama3.2:70b` - Complex reasoning (needs GPU)
- `codellama` - Code-specific
- `nomic-embed-text` - Embeddings for RAG
- `deepseek-coder` - Cost-free coding alternative

### PDF Tools

**Status:** Native (Python)

```bash
# Install
pip install pdfplumber marker-pdf
brew install pandoc  # or apt-get install pandoc

# pdfplumber - Extract text/tables
python -c "
import pdfplumber
with pdfplumber.open('doc.pdf') as pdf:
    for page in pdf.pages:
        print(page.extract_text())
"

# Marker - ML-based PDF to Markdown
marker doc.pdf --output doc.md

# Pandoc - Format conversion
pandoc doc.md -o doc.pdf
pandoc doc.docx -o doc.md
```

---

## Claude Canvas

**Status:** Built-in (Bun required)

```bash
# Navigate to canvas directory
cd claude-canvas

# Check environment
bun run canvas/src/cli.ts env

# Spawn canvases (opens in new pane/window)
bun run canvas/src/cli.ts spawn weather
bun run canvas/src/cli.ts spawn system
bun run canvas/src/cli.ts spawn calendar
bun run canvas/src/cli.ts spawn document
bun run canvas/src/cli.ts spawn tracker

# Show in current terminal
bun run canvas/src/cli.ts show weather

# Update running canvas
bun run canvas/src/cli.ts update calendar-1 --config '{"events":[]}'

# With custom config
bun run canvas/src/cli.ts spawn document --config '{"content":"# Hello"}'
```

---

## OpenCode

**Status:** Built-in (Go required for install)

```bash
# Install
go install github.com/opencode-ai/opencode@latest

# Commands
opencode --version
opencode run "task description"
opencode run --agent explore "explain the auth system"
opencode run --agent plan "add OAuth2 support"
opencode run "ultrawork: complex multi-step task"
```

**Agents:**
- `explore` - Read-only codebase analysis
- `plan` - Implementation planning
- `build` - Build and compile
- `oracle` - Complex reasoning
- `librarian` - Code search

---

## Integrations

### Slack

**Status:** Wrapper required

```bash
#!/bin/bash
# Save as ~/bin/slack_cli

ACTION=$1
shift

case $ACTION in
  send)
    CHANNEL=""
    MESSAGE=""
    while [[ $# -gt 0 ]]; do
      case $1 in
        --channel) CHANNEL="$2"; shift 2 ;;
        --message) MESSAGE="$2"; shift 2 ;;
        *) shift ;;
      esac
    done
    curl -s -X POST https://slack.com/api/chat.postMessage \
      -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"channel\": \"$CHANNEL\", \"text\": \"$MESSAGE\"}"
    ;;
  search)
    QUERY=""
    LIMIT=10
    while [[ $# -gt 0 ]]; do
      case $1 in
        --query) QUERY="$2"; shift 2 ;;
        --limit) LIMIT="$2"; shift 2 ;;
        *) shift ;;
      esac
    done
    curl -s "https://slack.com/api/search.messages?query=$(echo "$QUERY" | jq -sRr @uri)&count=$LIMIT" \
      -H "Authorization: Bearer $SLACK_BOT_TOKEN"
    ;;
esac
```

### Notion

**Status:** Wrapper required

```bash
#!/bin/bash
# Save as ~/bin/notion_cli

ACTION=$1
shift

case $ACTION in
  page)
    # notion_cli page create --parent DB_ID --title "Title" --content file.md
    ;;
  db)
    # notion_cli db query --id DB_ID --filter '{"Status": "In Progress"}'
    ;;
esac

# See Notion API docs: https://developers.notion.com/
```

### Google Calendar

**Status:** Wrapper required (OAuth)

```bash
#!/bin/bash
# Save as ~/bin/gcal_cli

# Get access token from refresh token
get_token() {
  curl -s -X POST https://oauth2.googleapis.com/token \
    -d "client_id=$GOOGLE_CLIENT_ID" \
    -d "client_secret=$GOOGLE_CLIENT_SECRET" \
    -d "refresh_token=$GOOGLE_REFRESH_TOKEN" \
    -d "grant_type=refresh_token" | jq -r '.access_token'
}

TOKEN=$(get_token)

case $1 in
  events)
    # gcal_cli events list --calendar primary --days 7
    curl -s "https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=10" \
      -H "Authorization: Bearer $TOKEN"
    ;;
  event)
    # gcal_cli event create --title "Review" --start "2026-01-15T10:00" --duration 60
    ;;
esac
```

### Rev.ai

**Status:** Wrapper required

```bash
#!/bin/bash
# Save as ~/bin/revai_cli

case $1 in
  transcribe)
    FILE=$2
    curl -s -X POST https://api.rev.ai/speechtotext/v1/jobs \
      -H "Authorization: Bearer $REVAI_API_KEY" \
      -H "Content-Type: audio/mpeg" \
      --data-binary @"$FILE"
    ;;
esac
```

---

## Figma MCP

**Status:** MCP Server

```bash
# Add MCP server (one-time)
claude mcp add --transport http figma https://mcp.figma.com/mcp

# Authenticate (in Claude Code)
/mcp → select figma → authenticate

# Available tools (use via Claude Code):
# - whoami
# - get_design_context
# - get_screenshot
# - get_metadata
# - get_variable_defs
# - generate_diagram
```

---

## Vector Databases

### ChromaDB

**Status:** Native (Python)

```bash
# Install
pip install chromadb

# Usage (Python)
python -c "
import chromadb
client = chromadb.Client()
collection = client.create_collection('docs')
collection.add(documents=['text'], ids=['id1'])
results = collection.query(query_texts=['search'], n_results=5)
print(results)
"
```

### Pinecone

**Status:** Wrapper required

```bash
#!/bin/bash
# Save as ~/bin/pinecone_cli

case $1 in
  index)
    # pinecone_cli index create my-index --dimension 1536
    ;;
  upsert)
    # pinecone_cli upsert --index my-index --file embeddings.json
    ;;
  query)
    # pinecone_cli query --index my-index --vector "..." --top-k 5
    ;;
esac

# See Pinecone API docs: https://docs.pinecone.io/
```

---

## Wrapper Scripts Location

Save wrapper scripts to `~/bin/` and add to PATH:

```bash
mkdir -p ~/bin
echo 'export PATH="$HOME/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

Or use the full paths in your orchestration commands.

---

## Quick Verification

```bash
# Core
claude --version           # Claude Code
echo $GEMINI_API_KEY | head -c 10
echo $OPENAI_API_KEY | head -c 10

# Local
ollama list
bun --version
python -c "import pdfplumber; print('OK')"

# Canvas
cd claude-canvas && bun run canvas/src/cli.ts env

# OpenCode
opencode --version
```
