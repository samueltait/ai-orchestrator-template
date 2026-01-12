# AI Assistant Template

**Version:** 2.1.0 | **Updated:** 2026-01-12

A comprehensive multi-tool AI assistant configuration for software development, research, and automation tasks. This template provides ready-to-use configurations for selecting the optimal tools and services.

---

## Quick Start

```bash
# 1. Clone/copy this template to your project
cp -r ai_template ~/projects/my_project/ai

# 2. Set up API keys
cp env_template.sh ~/.llm_keys
# Edit ~/.llm_keys and add your API keys
chmod 600 ~/.llm_keys
echo 'source ~/.llm_keys' >> ~/.zshrc
source ~/.zshrc

# 3. Install local tools
./setup.sh  # or follow SETUP_CHECKLIST.md manually

# 4. Verify installation
source ~/.llm_keys && echo "Keys loaded"
ollama --version && echo "Ollama ready"
bun --version && echo "Bun ready"
```

---

## What's Included

| Component | Description |
|-----------|-------------|
| **LLM Gateway** | Production-grade API gateway with semantic caching, intelligent routing, streaming, real-time dashboard, and Kubernetes deployment |
| **Tool Selection Guide** | Multi-tool selection system for optimal service usage |
| **Claude Canvas** | Visual TUI toolkit for terminal displays |
| **OpenCode Guide** | Autonomous multi-file coding agent reference |
| **Integration Setup** | Slack, Notion, Gmail, Calendar configurations |
| **Local Tools** | Ollama, ChromaDB, PDF processors |

---

## Available AI Services

### Cloud Services
| Service | Use Case | Cost |
|---------|----------|------|
| **Claude** | Complex reasoning, orchestration | Subscription |
| **Gemini** | Long context, multimodal, cost-effective | $-$$ |
| **OpenAI GPT** | Content generation, coding | $$ |
| **Perplexity** | Live web search with citations | $$ |
| **Rev.ai** | Audio/video transcription | $0.02/min |
| **Pinecone** | Managed vector database | Free-$70/mo |
| **Figma MCP** | Design file access | Free (with Figma) |

### Local Services (Free)
| Service | Use Case |
|---------|----------|
| **Ollama** | Private LLM inference |
| **ChromaDB** | Local vector database |
| **Whisper.cpp** | Local transcription |
| **pdfplumber/Marker** | PDF extraction |
| **Claude Canvas** | Terminal UI displays |

### Integrations
| Service | Capabilities |
|---------|--------------|
| **Slack** | Send messages, search channels |
| **Notion** | Create/query pages and databases |
| **Gmail** | Send/read emails |
| **Google Calendar** | List/create events |

---

## Directory Structure

```
ai_template/
├── README.md                          # This file
├── CLAUDE.md                          # Claude Code project instructions (copy to project root)
├── SETUP_CHECKLIST.md                 # Step-by-step setup guide
├── setup.sh                           # Automated setup script
├── env_template.sh                    # API keys template (copy to ~/.llm_keys)
├── LLM_Orchestrator_Instructions.md   # Full tool selection guide and patterns
├── OpenCode_Quick_Start_Guide.md      # OpenCode CLI reference
├── .github/workflows/ci.yml           # CI/CD pipeline
├── .claude/settings.local.json        # Claude Code permissions
├── docs/                              # Extended documentation
│   ├── CLI_REFERENCE.md               # Actual CLI commands & wrappers
│   ├── MODEL_REFERENCE.md             # Model versions & capabilities
│   ├── COST_TRACKING.md               # Budget management
│   ├── ERROR_HANDLING.md              # Failure recovery examples
│   ├── PERFORMANCE.md                 # Benchmarks & optimization
│   ├── IPC_PROTOCOL.md                # Canvas IPC specification
│   ├── PERMISSIONS.md                 # Permissions reference
│   ├── CANVAS_PLUGINS.md              # Custom canvas development
│   ├── PRD_WORKFLOW.md                # PRD creation & Notion integration
│   └── PROTOTYPE_WORKFLOW.md          # Iterative development workflow
├── templates/                         # Reusable templates
│   ├── PRD_TEMPLATE.md                # New PRD template
│   ├── SPIKE_TEMPLATE.md              # Technical spike template
│   ├── FEEDBACK_TEMPLATE.md           # User testing feedback form
│   └── notion-schemas/                # Notion database schemas
├── scripts/                           # Helper scripts
│   └── feature-init.sh                # Initialize new features
├── gateway/                           # LLM Gateway
│   ├── README.md                      # Gateway documentation
│   ├── src/
│   │   ├── core/                      # Gateway core, types, providers, streaming
│   │   ├── cache/                     # Semantic caching, Redis, embeddings
│   │   ├── routing/                   # Intelligent routing
│   │   ├── reliability/               # Circuit breakers, retries
│   │   ├── observability/             # Tracing, logging, metrics
│   │   ├── security/                  # PII detection, guardrails
│   │   ├── cost/                      # Cost tracking, budgets
│   │   ├── evaluation/                # Evals, A/B testing, LLM-as-Judge
│   │   ├── context/                   # Token counting, compression
│   │   ├── queue/                     # Async job processing
│   │   ├── dashboard/                 # Real-time monitoring UI
│   │   └── playground/                # Interactive testing UI
│   ├── k8s/helm/                      # Kubernetes Helm charts
│   └── package.json
└── claude-canvas/                     # Visual TUI toolkit
    ├── README.md                      # Canvas documentation
    ├── CLAUDE.md                      # Canvas-specific instructions
    ├── package.json
    └── canvas/
        ├── src/
        │   ├── cli.ts                 # Canvas CLI entry point
        │   ├── canvases/              # Canvas implementations
        │   │   └── TEMPLATE.tsx       # Template for new canvases
        │   └── __tests__/             # Test suite
        └── skills/                    # Claude Code skill docs
```

---

## Setup Options

### Minimal Setup (Core LLMs only)
For basic AI tool access:
1. Have Claude Max subscription (for Claude Code CLI)
2. Get API keys: Gemini, OpenAI, Perplexity
3. Copy `env_template.sh` to `~/.llm_keys`
4. Add keys and source the file

### Standard Setup (+ Local Tools)
Add local processing capabilities:
1. Complete Minimal Setup
2. Install Ollama: `https://ollama.com/download`
3. Install Python tools: `pip install pdfplumber chromadb marker-pdf`
4. Install Bun: `https://bun.sh`

### Full Setup (+ Integrations)
Add productivity integrations:
1. Complete Standard Setup
2. Set up Slack bot at `https://api.slack.com/apps`
3. Create Notion integration at `https://notion.so/my-integrations`
4. Set up Google OAuth at `https://console.cloud.google.com`
5. Get Rev.ai key at `https://rev.ai`

See `SETUP_CHECKLIST.md` for detailed instructions.

---

## PRD & Prototype Development

This template includes a structured workflow for feature development with Notion integration:

### Development Stages

| Stage | Purpose | Duration |
|-------|---------|----------|
| **PRD** | Define problem & requirements | 1-3 days |
| **Spike** | Validate technical feasibility | 1-2 days |
| **Prototype** | Build working proof of concept | 3-7 days |
| **User Testing** | Gather real user feedback | 1-3 days |
| **Iterate** | Refine based on feedback | Variable |
| **Production** | Ship production-ready code | Variable |

### Quick Start

```bash
# Initialize a new feature
./scripts/feature-init.sh "user-authentication"

# This creates:
# - docs/prds/user-authentication.md (PRD from template)
# - Notion page for tracking (if configured)
```

### Notion Integration

PRDs sync with Notion for status tracking:

```bash
# Add to ~/.llm_keys
export NOTION_API_KEY="secret_your-token"
export NOTION_PRD_DATABASE_ID="your-database-id"
```

See `docs/PRD_WORKFLOW.md` and `docs/PROTOTYPE_WORKFLOW.md` for complete documentation.

---

## Routing Quick Reference

**Follow in order, stop at first match:**

1. **Secrets/credentials** → Ollama (local only)
2. **Audio transcription** → Rev.ai or Whisper.cpp
3. **Image generation** → Nano Banana (Gemini)
4. **PDF extraction** → pdfplumber / Marker
5. **Semantic search** → Pinecone / ChromaDB
6. **Notifications** → Slack / Gmail / Notion
7. **Design files/tokens** → Figma MCP
8. **Current web facts** → Perplexity
9. **Multi-file code changes** → OpenCode
10. **Dynamic webpage** → Claude Chrome
11. **Terminal display** → Claude Canvas
12. **Single-file coding** → Claude Opus
13. **>100k context** → Gemini Pro
14. **Cost-sensitive** → Gemini Flash / Ollama
15. **Complex reasoning** → Claude
16. **Long-form content** → OpenAI GPT

---

## Cost Tiers

| Tier | Use Case | Target Cost |
|------|----------|-------------|
| 1 | Simple extraction, formatting | <$0.001/call |
| 2 | Standard tasks | $0.001-0.01/call |
| 3 | Complex tasks | $0.01-0.05/call |
| 4 | Critical tasks | $0.05+/call |

**Cost Optimization Tips:**
- Use Tier 1 models to summarize before passing to expensive models
- Run Ollama for sensitive data (free)
- Batch non-urgent requests
- Use Gemini for long documents (1M context, cheaper than multiple calls)

---

## Usage Examples

> **Note:** The CLI commands below (`perplexity_cli`, `gemini_cli`, etc.) are placeholders.
> See [docs/CLI_REFERENCE.md](docs/CLI_REFERENCE.md) for actual commands and wrapper scripts.

### LLM Gateway (Recommended for Production)
```typescript
import { createGateway } from "@ai-orchestrator/gateway";

const gateway = createGateway({
  cache: { enabled: true, semanticSimilarityThreshold: 0.9 },
  routing: { defaultStrategy: "balanced" },
  cost: { budgets: { daily: 50 } },
});

const response = await gateway.complete({
  id: "req-1",
  messages: [{ role: "user", content: "What is machine learning?" }],
  routing: { strategy: "cost_optimized", fallbackEnabled: true },
});

console.log(response.content);
console.log(`Cost: $${response.cost.totalCost.toFixed(4)}`);
console.log(`Cached: ${response.cached}`);
```

### Gateway Streaming
```typescript
import { StreamingProvider, collectStream } from "@ai-orchestrator/gateway";

const streaming = new StreamingProvider({
  provider: "anthropic",
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Stream tokens to stdout
for await (const chunk of streaming.stream(request, "claude-sonnet-4-20250514")) {
  if (chunk.type === "text") process.stdout.write(chunk.text);
}

// Or collect full response with metrics
const result = await collectStream(streaming.stream(request, model));
console.log(`First token: ${result.metrics.firstTokenMs}ms`);
```

### Gateway Dashboard
```bash
cd gateway

# Start real-time monitoring dashboard
bun run dashboard

# Open http://localhost:3001/dashboard
```

### Gateway Kubernetes Deployment
```bash
# Deploy with Helm
helm install llm-gateway ./gateway/k8s/helm \
  --set secrets.anthropicApiKey=$ANTHROPIC_API_KEY \
  --set secrets.openaiApiKey=$OPENAI_API_KEY
```

### Research + Report
```bash
# Gather current info
perplexity_cli --query "AI agents 2026" > research.md

# Summarize for context compression
gemini_cli --model gemini-2.0-flash-lite --in research.md \
  --task "Extract key points" > summary.md

# Generate report
openai_cli --model gpt-4o --in summary.md \
  --task "Write executive summary" > report.md
```

### Multi-File Code Changes
```bash
# Explore codebase
opencode run --agent explore "explain the auth system"

# Plan implementation
opencode run --agent plan "add OAuth2 support"

# Implement
opencode run "ultrawork: implement OAuth2 with tests"
```

### Visual Monitoring
```bash
cd claude-canvas

# System monitor
bun run canvas/src/cli.ts spawn system

# Weather display
bun run canvas/src/cli.ts spawn weather

# Calendar view
bun run canvas/src/cli.ts spawn calendar
```

### Design-to-Code (Figma)
```bash
# In Claude Code, reference Figma designs directly:
"Look at the login screen in https://figma.com/file/xxx and generate a React component"

# Extract design tokens:
"Get the color palette and typography from this Figma file"

# Access FigJam flows:
"Review the user flow diagram in this FigJam board and create the routing structure"
```

### Private Data Processing
```bash
# Process sensitive data locally
ollama run llama3.2 "summarize this confidential document: $(cat secret.txt)"

# Local embeddings for RAG
echo "document text" | ollama run nomic-embed-text
```

---

## Integration with Projects

### As Claude Code Instructions
Copy `CLAUDE.md` to your project root. Claude Code will automatically follow the tool selection patterns.

### As System Prompt
Use `LLM_Orchestrator_Instructions.md` as a system prompt for any LLM to enable multi-tool capabilities.

### CLI Integration
Source the keys file in your shell profile:
```bash
echo 'source ~/.llm_keys' >> ~/.zshrc
```

---

## Updating Tools

Run before starting work:
```bash
# Load API keys
source ~/.llm_keys

# Update Claude Canvas
cd claude-canvas && git pull && bun install && cd ..

# Update Ollama models
ollama pull llama3.2
ollama pull nomic-embed-text

# Update Claude Code
claude update
```

---

## Troubleshooting

### API Key Issues
```bash
# Check keys are loaded
echo $GEMINI_API_KEY | head -c 10
echo $OPENAI_API_KEY | head -c 10

# Verify Claude Code subscription
claude --version

# Reload keys
source ~/.llm_keys
```

### Ollama Not Running
```bash
# Start Ollama service
ollama serve &

# Verify
ollama list
```

### Claude Canvas Path Issues
If paths with spaces cause issues, ensure the canvas CLI quotes paths correctly. The fix has been applied to `claude-canvas/canvas/src/terminal.ts`.

---

## Security Notes

- Never commit `~/.llm_keys` to version control
- Use Ollama for processing any sensitive/confidential data
- Sanitize PII before sending to cloud APIs
- The `env_template.sh` in this repo contains only placeholders

---

## License

This template is provided as-is for personal and commercial use.

---

## Extended Documentation

See the `docs/` folder for detailed guides:

| Document | Description |
|----------|-------------|
| [CLI Reference](docs/CLI_REFERENCE.md) | Actual CLI commands, wrapper scripts, and placeholders explained |
| [Model Reference](docs/MODEL_REFERENCE.md) | Model versions, capabilities matrix, and selection guide |
| [Cost Tracking](docs/COST_TRACKING.md) | Budget management, cost estimation, and alerts |
| [Error Handling](docs/ERROR_HANDLING.md) | Worked examples of failure recovery and fallbacks |
| [Performance](docs/PERFORMANCE.md) | Latency benchmarks, optimization tips, parallelization |
| [IPC Protocol](docs/IPC_PROTOCOL.md) | Canvas inter-process communication specification |
| [Permissions](docs/PERMISSIONS.md) | Claude Code permissions configuration |
| [Canvas Plugins](docs/CANVAS_PLUGINS.md) | Guide to creating custom canvas types |

---

## Resources

- [Claude Code Documentation](https://docs.anthropic.com/claude-code)
- [Ollama](https://ollama.com)
- [OpenCode](https://github.com/opencode-ai/opencode)
- [Perplexity API](https://docs.perplexity.ai)
- [Gemini API](https://ai.google.dev)
