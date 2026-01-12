# OpenCode Quick Start Guide

**Version:** 1.8.0 | **Updated:** 2026-01-11

OpenCode is an AI-powered CLI for autonomous coding tasks. It uses specialized agents with built-in task tracking, session persistence, and multi-model routing.

---

## Installation

```bash
# Install via npm (if available)
npm install -g opencode-cli

# Or via pip
pip install opencode

# Verify installation
opencode --version
```

---

## Basic Usage

### One-Off Tasks
```bash
# Simple task
opencode run "fix the authentication bug in src/auth.ts"

# With specific agent
opencode run --agent explore "explain how the API routing works"

# With specific model
opencode run -m anthropic/claude-opus-4-5 "architect a new microservice"
```

### Interactive Mode
```bash
opencode  # Starts interactive session
```

---

## Available Agents

| Agent | Purpose | Default Model | Best For |
|-------|---------|---------------|----------|
| **explore** | Read-only codebase analysis | claude-3-5-haiku | Understanding code, finding patterns |
| **plan** | Implementation planning | claude-sonnet-4 | Designing solutions, task breakdown |
| **build** | Build and compile projects | claude-sonnet-4 | Build scripts, compilation issues |
| **oracle** | Complex reasoning | claude-opus-4-5 | Architectural decisions, complex debugging |
| **librarian** | Code search and lookup | claude-3-5-haiku | Finding files, function definitions |

### Using Agents
```bash
# Explore codebase (read-only, won't modify files)
opencode run --agent explore "map out the authentication system"

# Plan implementation (creates plan but doesn't execute)
opencode run --agent plan "design a caching layer for the database"

# Use oracle for complex reasoning
opencode run --agent oracle "debug this race condition in the worker pool"
```

---

## Ultrawork Mode

For complex, multi-step tasks that benefit from parallel execution:

```bash
opencode run "ultrawork: refactor the user module and add comprehensive tests"
```

**Ultrawork automatically:**
- Breaks task into parallel subtasks
- Runs multiple agents simultaneously
- Coordinates results
- Handles dependencies between steps

### When to Use Ultrawork
- Multi-file refactors
- Feature implementation + tests
- Large-scale code migrations
- Tasks requiring both analysis and implementation

---

## Session Persistence

OpenCode maintains session state across invocations:

```bash
# Start a session
opencode run "analyze the codebase structure"

# Continue in same session (remembers context)
opencode run "now add authentication based on what you learned"

# Start fresh session
opencode run --new-session "unrelated task"
```

### Managing Sessions
```bash
# List sessions
opencode sessions list

# Resume specific session
opencode sessions resume <session-id>

# Clear session
opencode sessions clear
```

---

## Model Configuration

### Override Default Model
```bash
# Use specific model for a task
opencode run -m anthropic/claude-opus-4-5 "complex architectural decision"
opencode run -m anthropic/claude-sonnet-4 "standard implementation"
opencode run -m anthropic/claude-3-5-haiku "quick lookup"
```

### Available Models
| Provider | Model ID | Use Case |
|----------|----------|----------|
| Anthropic | `anthropic/claude-opus-4-5` | Complex reasoning, architecture |
| Anthropic | `anthropic/claude-sonnet-4` | Balanced, general coding |
| Anthropic | `anthropic/claude-3-5-haiku` | Fast, simple tasks |

---

## Common Patterns

### Codebase Exploration
```bash
# Understand structure
opencode run --agent explore "map out the project structure and key modules"

# Find specific patterns
opencode run --agent librarian "find all API endpoint definitions"

# Trace data flow
opencode run --agent explore "trace how user authentication flows through the system"
```

### Implementation
```bash
# Plan before implementing
opencode run --agent plan "design the user notification feature"

# Then implement
opencode run "implement the notification feature based on the plan"

# Or use ultrawork for both
opencode run "ultrawork: design and implement user notifications with tests"
```

### Bug Fixing
```bash
# Diagnose issue
opencode run --agent explore "investigate why login fails after session timeout"

# Fix with context
opencode run "fix the session timeout bug you identified"
```

### Refactoring
```bash
# Large refactor with parallel execution
opencode run "ultrawork: refactor the database layer to use connection pooling"

# Targeted refactor
opencode run "refactor the auth middleware to use async/await"
```

---

## Output and Logging

### View Task Output
```bash
# Task output goes to stdout by default
opencode run "task" > output.md

# JSON output for parsing
opencode run --output-format json "task" > output.json
```

### Verbose Mode
```bash
# See detailed agent reasoning
opencode run -v "task"

# Even more detail
opencode run -vv "task"
```

---

## Integration with Orchestrator

When the LLM Orchestrator routes to OpenCode:

```bash
# Standard pattern
opencode run --agent explore "analysis task" > analysis.md
opencode run --agent plan "planning task" > plan.md
opencode run "ultrawork: implementation task"

# Piping context
cat context.md | opencode run "implement based on this context"
```

### Timeout Handling
OpenCode tasks may take 5-10 minutes for complex work:
```bash
# Default timeout: 300s (5 min)
# For complex tasks, orchestrator uses 600s (10 min)
timeout 600s opencode run "ultrawork: large refactor"
```

---

## Troubleshooting

### API Key Issues
```bash
# Verify Claude Code subscription is active
claude --version

# Source your keys file for other providers
source ~/.llm_keys
```

### Session Problems
```bash
# Clear corrupted session
opencode sessions clear

# Start fresh
opencode run --new-session "task"
```

### Timeout on Large Tasks
```bash
# Increase timeout
opencode run --timeout 600 "large task"

# Or break into smaller steps
opencode run --agent plan "break this into steps"
# Then run each step separately
```

---

## Best Practices

1. **Use explore first** — Understand before modifying
2. **Plan complex changes** — Use plan agent before ultrawork
3. **Specific prompts** — Be precise about what files/functions to modify
4. **Check outputs** — Review generated code before committing
5. **Session continuity** — Use sessions for related multi-step work
6. **Right-size models** — Use haiku for quick tasks, opus for complex reasoning

---

## Combining with Claude Canvas

For visual monitoring while OpenCode runs autonomous tasks:

```bash
# Open system monitor in side pane
cd claude-canvas && bun run canvas/src/cli.ts spawn system && cd ..

# Then run OpenCode task (monitor stays open)
opencode run "ultrawork: refactor authentication system"
```

**Use Claude Canvas alongside OpenCode for:**
- System monitoring during long-running tasks
- Viewing generated documentation (document canvas)
- Scheduling meetings based on code review findings (calendar canvas)

---

## Quick Reference

```bash
# Explore codebase
opencode run --agent explore "what does X do?"

# Plan implementation
opencode run --agent plan "how should I implement X?"

# Simple fix
opencode run "fix X in file Y"

# Complex implementation
opencode run "ultrawork: implement feature X with tests"

# Specific model
opencode run -m anthropic/claude-opus-4-5 "complex task"
```
