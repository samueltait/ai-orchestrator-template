# Claude Code Permissions Reference

**Version:** 1.8.0 | **Updated:** 2026-01-11

This document explains the permissions configured in `.claude/settings.local.json` and how to customize them for your needs.

---

## Overview

The `.claude/settings.local.json` file controls which tools and commands Claude Code can execute without prompting for confirmation. This provides a balance between convenience and security.

---

## Current Configuration

```json
{
  "permissions": {
    "allow": [
      "Bash(grep:*)",
      "Bash(python3:*)",
      "Bash(tree:*)",
      "WebSearch",
      "WebFetch(domain:github.com)",
      "Bash(bun:*)",
      "Bash(echo:*)",
      "Bash(tmux:*)",
      "Bash(cd:*)",
      "Bash(ollama --version:*)",
      "Bash(pandoc:*)",
      "Bash(curl:*)",
      "Bash(sh)",
      "Bash(brew install:*)",
      "Bash(pip3 install:*)",
      "Bash(ollama pull:*)",
      "Bash(ollama list:*)",
      "Bash(ollama run:*)",
      "Bash(chmod:*)",
      "Bash(source ~/.llm_keys)",
      "Bash(ls:*)",
      "WebFetch(domain:help.figma.com)",
      "Bash(claude mcp add:*)",
      "Bash(claude mcp list:*)",
      "mcp__figma__whoami",
      "WebFetch(domain:developers.figma.com)",
      "Bash(claude mcp:*)",
      "Bash(unzip:*)",
      "Bash(opencode --version:*)",
      "Bash([ -n \"$GEMINI_API_KEY\" ])",
      "Bash([ -n \"$OPENAI_API_KEY\" ])",
      "Bash([ -n \"$PERPLEXITY_API_KEY\" ])",
      "Bash(claude --version:*)"
    ]
  }
}
```

---

## Permission Categories

### File Operations

| Permission | Purpose | Risk Level |
|------------|---------|------------|
| `Bash(grep:*)` | Search file contents | Low |
| `Bash(tree:*)` | View directory structure | Low |
| `Bash(ls:*)` | List files | Low |
| `Bash(cd:*)` | Change directory | Low |

### Runtime Tools

| Permission | Purpose | Risk Level |
|------------|---------|------------|
| `Bash(bun:*)` | Run Bun commands (Canvas) | Low |
| `Bash(python3:*)` | Run Python scripts | Medium |
| `Bash(sh)` | Run shell scripts | Medium |

### Package Management

| Permission | Purpose | Risk Level |
|------------|---------|------------|
| `Bash(brew install:*)` | Install Homebrew packages | Medium |
| `Bash(pip3 install:*)` | Install Python packages | Medium |
| `Bash(ollama pull:*)` | Download Ollama models | Low |

### AI/ML Tools

| Permission | Purpose | Risk Level |
|------------|---------|------------|
| `Bash(ollama:*)` | Run local LLM inference | Low |
| `Bash(opencode --version:*)` | Check OpenCode version | Low |
| `Bash(claude:*)` | Claude Code CLI operations | Low |

### MCP Servers

| Permission | Purpose | Risk Level |
|------------|---------|------------|
| `mcp__figma__whoami` | Check Figma account | Low |
| `Bash(claude mcp:*)` | Manage MCP servers | Low |

### Web Access

| Permission | Purpose | Risk Level |
|------------|---------|------------|
| `WebSearch` | Search the web | Low |
| `WebFetch(domain:github.com)` | Fetch from GitHub | Low |
| `WebFetch(domain:help.figma.com)` | Fetch Figma help docs | Low |
| `WebFetch(domain:developers.figma.com)` | Fetch Figma API docs | Low |

### Environment Checks

| Permission | Purpose | Risk Level |
|------------|---------|------------|
| `Bash([ -n "$GEMINI_API_KEY" ])` | Verify key is set | Low |
| `Bash([ -n "$OPENAI_API_KEY" ])` | Verify key is set | Low |
| `Bash([ -n "$PERPLEXITY_API_KEY" ])` | Verify key is set | Low |
| `Bash(source ~/.llm_keys)` | Load API keys | Low |

---

## Permission Syntax

### Bash Commands

```json
// Exact command only
"Bash(ollama --version)"

// Command with any arguments
"Bash(grep:*)"

// Command starting with prefix
"Bash(brew install:*)"
```

### Web Access

```json
// Allow all web searches
"WebSearch"

// Allow fetch from specific domain
"WebFetch(domain:github.com)"

// Allow fetch from any domain (NOT recommended)
"WebFetch"
```

### MCP Tools

```json
// Specific MCP tool
"mcp__figma__whoami"

// All tools from MCP server (NOT recommended)
"mcp__figma__*"
```

---

## Adding Permissions

### For New Tools

```json
{
  "permissions": {
    "allow": [
      // ... existing permissions ...
      "Bash(your-command:*)"
    ]
  }
}
```

### For New Domains

```json
{
  "permissions": {
    "allow": [
      // ... existing permissions ...
      "WebFetch(domain:your-domain.com)"
    ]
  }
}
```

### For MCP Tools

```json
{
  "permissions": {
    "allow": [
      // ... existing permissions ...
      "mcp__your_server__tool_name"
    ]
  }
}
```

---

## Security Best Practices

### DO

- Use specific command patterns, not wildcards
- Limit WebFetch to known, trusted domains
- Review permissions periodically
- Use `Bash(command --option:*)` for specific subcommands

### DON'T

- Add `Bash(rm:*)` or `Bash(sudo:*)`
- Allow `WebFetch` without domain restriction
- Add `Bash(*:*)` (allows all commands)
- Allow write operations to sensitive paths

---

## Recommended Additions

### For Development

```json
"Bash(npm:*)",
"Bash(yarn:*)",
"Bash(pnpm:*)",
"Bash(git status:*)",
"Bash(git diff:*)",
"Bash(git log:*)"
```

### For Testing

```json
"Bash(pytest:*)",
"Bash(bun test:*)",
"Bash(npm test:*)"
```

### For Documentation

```json
"WebFetch(domain:docs.anthropic.com)",
"WebFetch(domain:ai.google.dev)",
"WebFetch(domain:platform.openai.com)"
```

---

## Removing Permissions

To require confirmation for a previously allowed command, remove it from the `allow` array:

```json
{
  "permissions": {
    "allow": [
      // Remove the line for the command you want to restrict
    ]
  }
}
```

---

## Troubleshooting

### Permission Denied

If Claude Code asks for confirmation for an allowed command:

1. Check the exact command matches the pattern
2. Verify no typos in `settings.local.json`
3. Restart Claude Code session

### Find Required Permission

When Claude asks for permission, note the exact tool call:

```
Claude wants to run: Bash(some-command --flag value)
```

Add this pattern to your allow list:

```json
"Bash(some-command:*)"  // Allow with any args
// or
"Bash(some-command --flag:*)"  // Allow only with --flag
```

---

## Full Template

Here's a comprehensive template for common development workflows:

```json
{
  "permissions": {
    "allow": [
      // File operations (read-only)
      "Bash(grep:*)",
      "Bash(find:*)",
      "Bash(ls:*)",
      "Bash(tree:*)",
      "Bash(cat:*)",
      "Bash(head:*)",
      "Bash(tail:*)",
      "Bash(wc:*)",

      // Git (read-only)
      "Bash(git status:*)",
      "Bash(git diff:*)",
      "Bash(git log:*)",
      "Bash(git branch:*)",

      // Package managers
      "Bash(bun:*)",
      "Bash(npm:*)",
      "Bash(pip3:*)",
      "Bash(brew:*)",

      // AI tools
      "Bash(ollama:*)",
      "Bash(claude:*)",
      "Bash(opencode:*)",

      // Python
      "Bash(python3:*)",
      "Bash(pytest:*)",

      // Web access
      "WebSearch",
      "WebFetch(domain:github.com)",
      "WebFetch(domain:stackoverflow.com)",
      "WebFetch(domain:docs.anthropic.com)",

      // MCP
      "mcp__figma__*"
    ]
  }
}
```
