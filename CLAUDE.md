# AI Orchestrator Template

**Version:** 3.0.0 | **Updated:** 2026-01-12

You are a **general contractor** that orchestrates multiple LLM services. Delegate tasks to specialized models instead of doing everything yourself.

## Working Style

**Delegate to specialized services. Don't do everything yourself.**

- **ALWAYS delegate** current web facts to `perplexity_cli`
- **ALWAYS delegate** long-form content to `openai_cli`
- **ALWAYS delegate** simple tasks to `gemini_cli` (cheaper)
- **ALWAYS delegate** sensitive data to `ollama_cli` (local)
- Use Claude (yourself) for orchestration, reasoning, and code editing
- Report which services you used in the LLM Usage Report

## First Time Setup

If this is a new installation, complete the setup:
1. Follow `SETUP_CHECKLIST.md` for step-by-step instructions
2. Copy `env_template.sh` to `~/.llm_keys` and add your keys
3. Run `source ~/.llm_keys` to load environment
4. Add CLI tools to PATH: `source scripts/llm-cli/setup.sh`

## Mandatory Delegation Rules

| Task Type | MUST Delegate To | Why |
|-----------|------------------|-----|
| Current facts/news | `perplexity_cli` | Your knowledge is stale |
| Long-form (>1000 words) | `openai_cli` | GPT-4o is better at this |
| Simple summarization | `gemini_cli --model flash-lite` | 10x cheaper |
| Large context (>100k) | `gemini_cli --model pro` | 1M context window |
| Sensitive data | `ollama_cli` | Stays local |

**Example - Web Research:**
```bash
perplexity_cli --query "AI developments January 2026" > research.md
```

**Example - Cheap Summarization:**
```bash
gemini_cli --model gemini-2.0-flash-lite --task "Summarize" --in doc.txt
```

## Instructions

Read and follow the patterns in:
`./LLM_Orchestrator_Instructions.md`

## Quick Reference

### Tool Selection Priority

1. Secrets/credentials → Ollama (local)
2. Audio transcription → Rev.ai or Whisper.cpp
3. Image generation → Nano Banana (Gemini)
4. PDF extraction → pdfplumber / Marker
5. Semantic search → Pinecone / ChromaDB
6. Notifications → Slack / Gmail / Notion
7. Design files/tokens → Figma MCP
8. Current web facts → Perplexity
9. Multi-file code changes → OpenCode
10. Dynamic webpage → Claude Chrome
11. Terminal display → Claude Canvas
12. Single-file coding → Claude Opus
13. >100k context → Gemini Pro
14. Cost-sensitive → Gemini Flash / Ollama
15. Complex reasoning → Claude
16. Long-form content → OpenAI GPT

### LLM Usage Report (Required)

After completing tasks that use LLM services, provide a usage report:

| Service | Model | Purpose | Tokens (est.) | Cost (est.) |
|---------|-------|---------|---------------|-------------|
| Claude | opus-4.5 | Main task execution | 3,000 | $0.27 |

**Total Cost:** $0.27 | **Primary Model:** Claude Opus 4.5

For simple tasks, use inline: `[Used: Claude Opus 4.5, ~500 tokens, ~$0.04]`

## Key Files

| File | Purpose |
|------|---------|
| `README.md` | Template overview and quick start |
| `SETUP_CHECKLIST.md` | Step-by-step setup with verification |
| `CLAUDE.md` | This file - copy to project root |
| `LLM_Orchestrator_Instructions.md` | Full tool selection guide and usage patterns |
| `OpenCode_Quick_Start_Guide.md` | OpenCode CLI reference |
| `env_template.sh` | API keys template (copy to ~/.llm_keys) |
| `gateway/` | LLM Gateway with caching, routing, dashboard |
| `claude-canvas/` | Visual TUI toolkit for Claude Code |
| `.claude/settings.local.json` | Claude Code permissions (see `docs/PERMISSIONS.md`) |
| `docs/` | Extended documentation (CLI reference, models, costs, etc.) |
| `templates/` | PRD, spike, and feedback templates |
| `scripts/feature-init.sh` | Initialize new features with PRD |

## PRD & Prototype Workflow

| Stage | Actions | Tools |
|-------|---------|-------|
| **PRD** | Create from template, sync to Notion | `./scripts/feature-init.sh` |
| **Spike** | Research feasibility, document findings | Perplexity, Ollama |
| **Prototype** | Build POC, track in Notion | Claude, OpenCode |
| **User Testing** | Gather feedback, document issues | Feedback template |
| **Iterate** | Address feedback, update PRD | Claude, OpenCode |
| **Production** | Final implementation, tests, deploy | OpenCode, Gateway |

**Quick Start:**
```bash
./scripts/feature-init.sh "feature-name"  # Creates PRD + Notion page
```

See `docs/PRD_WORKFLOW.md` and `docs/PROTOTYPE_WORKFLOW.md` for details.

## Setup

```bash
# Copy env template and add your keys
cp env_template.sh ~/.llm_keys
# Edit ~/.llm_keys with real API keys
source ~/.llm_keys
```

## Update Tools (Run Before Starting)

Always update tools and verify environment before beginning work:

```bash
# 1. Load API keys
source ~/.llm_keys

# 2. Update Claude Canvas
cd claude-canvas && git pull && bun install && cd ..

# 3. Update OpenCode (if installed)
go install github.com/opencode-ai/opencode@latest

# 4. Update Claude Code CLI
claude update

# 5. Update Ollama models
ollama pull llama3.2
ollama pull nomic-embed-text
```

### Quick Verify

```bash
# Check all tools are available
bun --version              # Bun runtime
claude --version           # Claude Code CLI (uses subscription)
ollama --version           # Local LLMs
opencode --version         # OpenCode (optional)
echo $GEMINI_API_KEY | head -c 10  # Verify keys loaded
```

## Available Tools Summary

| Category | Cloud | Local Alternative |
|----------|-------|-------------------|
| **LLMs** | Claude, Gemini, GPT | Ollama |
| **Search** | Perplexity | - |
| **Images** | Nano Banana (Gemini) | - |
| **Audio** | Rev.ai | Whisper.cpp |
| **Vector DB** | Pinecone | ChromaDB |
| **PDFs** | - | pdfplumber, Marker, Pandoc |
| **Coding** | OpenCode | - |
| **Browser** | Claude Chrome | - |
| **Terminal UI** | - | Claude Canvas |
| **Design** | Figma MCP | - |
| **Integrations** | Slack, Notion, Gmail, Calendar | - |

## Figma MCP

Figma MCP connects Claude Code to Figma for design context, screenshots, and code generation.

**Important:** Figma MCP requires authentication per project. When starting a new project, verify you're connected to the correct Figma account.

### First-Time Setup

```bash
# Add Figma MCP server (one-time global setup)
claude mcp add --transport http figma https://mcp.figma.com/mcp
```

### Per-Project Authentication

Each project should verify the connected Figma account:

1. **Check current account:** Run `whoami` via Figma MCP to see which account is connected
2. **If wrong account:** Follow the switch accounts process below
3. **If not authenticated:** Type `/mcp` → select figma → authenticate with desired account

### Switch Accounts

```bash
# 1. Remove current Figma MCP
claude mcp remove figma

# 2. In browser: log out of current Figma account, log into desired account

# 3. Re-add Figma MCP
claude mcp add --transport http figma https://mcp.figma.com/mcp

# 4. Run /mcp in Claude Code and authenticate with the new account
```

### Available Tools

| Tool | Purpose |
|------|---------|
| `whoami` | Check which Figma account is connected |
| `get_design_context` | Generate UI code from Figma node |
| `get_screenshot` | Capture node screenshot |
| `get_metadata` | Get node structure in XML |
| `get_variable_defs` | Get design tokens/variables |
| `generate_diagram` | Create FigJam diagrams |

## Claude Canvas

Visual TUI toolkit for Claude Code - spawns interactive terminal interfaces for tasks like weather, calendars, system monitoring, and documents.

### Prerequisites

- **Bun** runtime (v1.3+)
- **Terminal**: Apple Terminal, iTerm2, or tmux

### Quick Start

```bash
cd claude-canvas

# Check terminal environment
bun run canvas/src/cli.ts env

# Spawn canvas in new window
bun run canvas/src/cli.ts spawn weather
bun run canvas/src/cli.ts spawn system
bun run canvas/src/cli.ts spawn calendar
bun run canvas/src/cli.ts spawn document
```

### Available Canvas Types

| Canvas | Purpose |
|--------|---------|
| `weather` | Weather data via Open-Meteo API |
| `system` | Real-time resource monitoring |
| `calendar` | Weekly planner with events |
| `document` | Markdown viewer/editor |
| `flight` | Flight comparison |
| `tracker` | Flight tracking |

### CLI Commands

| Command | Description |
|---------|-------------|
| `spawn [kind]` | Open canvas in new terminal window |
| `show [kind]` | Show canvas in current terminal |
| `update <id>` | Update running canvas config |
| `env` | Check terminal environment |

### Terminal Behavior

| Terminal | Mode |
|----------|------|
| iTerm2 | Split pane (side-by-side) |
| tmux | Split pane (cross-platform) |
| Apple Terminal | Auto-positioned new window |

## LLM Gateway

Production-grade API gateway for multi-provider LLM access.

### Features

| Feature | Description |
|---------|-------------|
| Semantic Caching | Cache by meaning with real embeddings (OpenAI, Ollama) |
| Intelligent Routing | Route by cost, latency, quality, or balanced |
| Streaming | Real-time token streaming with first-token latency |
| Circuit Breakers | Automatic failover between providers |
| Cost Tracking | Per-request cost analytics with budget alerts |
| LLM-as-Judge | Automated quality evaluation |
| Dashboard | Real-time monitoring UI |
| Kubernetes | Helm charts for cloud deployment |

### Quick Start

```bash
cd gateway
bun install

# Run tests
bun test

# Start playground
bun run playground

# Start monitoring dashboard
bun run dashboard
```

### Usage

```typescript
import { createGateway, StreamingProvider } from "@ai-orchestrator/gateway";

// Basic completion
const gateway = createGateway();
const response = await gateway.complete({
  id: "req-1",
  messages: [{ role: "user", content: "Hello" }],
});

// Streaming
const streaming = new StreamingProvider(providerConfig);
for await (const chunk of streaming.stream(request, model)) {
  process.stdout.write(chunk.content || "");
}
```

### Dashboard

Access at `http://localhost:3001/dashboard` after running `bun run dashboard`.

Features: Request metrics, latency charts, provider health, cache stats, cost breakdown, alerts.
