# Model Reference Guide

**Version:** 1.8.0 | **Updated:** 2026-01-11

This document provides a comprehensive reference for all AI models available in the orchestration system, with clear versioning and capabilities.

---

## Model Naming Conventions

### Gemini Models

| Display Name | Full Model ID | Release | Status |
|--------------|---------------|---------|--------|
| Gemini 2.0 Flash-Lite | `gemini-2.0-flash-lite` | Dec 2024 | Current |
| Gemini 2.5 Flash | `gemini-2.5-flash` | Feb 2025 | Current |
| Gemini 2.5 Pro | `gemini-2.5-pro` | Mar 2025 | Current |
| Gemini 3 Pro Image | `gemini-3-pro-image-preview` | Dec 2025 | Preview |

**Note:** Gemini uses `X.Y` versioning. The `2.0` series is older than `2.5`. Always prefer `2.5` models for new work.

### OpenAI Models

| Display Name | Full Model ID | Context | Status |
|--------------|---------------|---------|--------|
| GPT-4o Mini | `gpt-4o-mini` | 128K | Current |
| GPT-4o | `gpt-4o` | 128K | Current |
| GPT-4 Turbo | `gpt-4-turbo` | 128K | Legacy |

**Note:** `-mini` variants are optimized for speed and cost. Non-mini variants prioritize quality.

### Claude Models

| Display Name | Full Model ID | Context | Status |
|--------------|---------------|---------|--------|
| Claude 3.5 Haiku | `claude-3-5-haiku-20241022` | 200K | Current |
| Claude Sonnet 4 | `claude-sonnet-4-20250514` | 200K | Current |
| Claude Opus 4.5 | `claude-opus-4-5-20251101` | 200K | Current (Best) |

**Note:** Claude uses date-based versioning (`YYYYMMDD`). Higher numbers = newer. Opus 4.5 is the most capable.

---

## Model Capabilities Matrix

### Reasoning & Analysis

| Model | Complex Reasoning | Code Analysis | Math | Planning |
|-------|------------------|---------------|------|----------|
| claude-opus-4-5 | Excellent | Excellent | Excellent | Excellent |
| claude-sonnet-4 | Very Good | Very Good | Very Good | Very Good |
| gemini-2.5-pro | Very Good | Very Good | Good | Good |
| gpt-4o | Very Good | Good | Good | Good |
| gemini-2.5-flash | Good | Good | Fair | Good |
| gpt-4o-mini | Good | Fair | Fair | Fair |
| gemini-2.0-flash-lite | Fair | Fair | Fair | Fair |

### Context & Speed

| Model | Max Context | Speed | Streaming |
|-------|-------------|-------|-----------|
| gemini-2.5-pro | 1M tokens | Medium | Yes |
| gemini-2.5-flash | 1M tokens | Fast | Yes |
| gemini-2.0-flash-lite | 1M tokens | Fastest | Yes |
| claude-opus-4-5 | 200K tokens | Slow | Yes |
| claude-sonnet-4 | 200K tokens | Medium | Yes |
| gpt-4o | 128K tokens | Medium | Yes |
| gpt-4o-mini | 128K tokens | Fast | Yes |

### Specialized Capabilities

| Model | Web Search | Image Gen | Image Analysis | Code Exec |
|-------|------------|-----------|----------------|-----------|
| perplexity-sonar | Native | No | No | No |
| gemini-2.5-flash-image | No | Yes | Yes | No |
| gemini-3-pro-image-preview | No | Yes (HQ) | Yes | No |
| claude-opus-4-5 | No | No | Yes | Via tools |
| gpt-4o | No | Via DALL-E | Yes | Via tools |

---

## Cost Tiers Explained

### Tier 1: Economy ($0.001 or less per call)

**Use for:** Simple extraction, formatting, basic Q&A, high-volume tasks

**Models:**
- `gemini-2.0-flash-lite` - Best value
- `ollama/llama3.2` - Free, local
- `ollama/nomic-embed-text` - Free embeddings

**Example tasks:**
- Extract JSON from text
- Reformat markdown
- Simple summarization
- Data cleaning

### Tier 2: Standard ($0.001-0.01 per call)

**Use for:** General tasks, balanced quality/cost

**Models:**
- `gemini-2.5-flash` - Recommended default
- `gpt-4o-mini` - Good alternative
- `claude-3-5-haiku` - Fast Claude option
- `deepseek-chat` - Budget option

**Example tasks:**
- Code explanation
- Content rewriting
- Translation
- Standard summarization

### Tier 3: Professional ($0.01-0.05 per call)

**Use for:** Complex tasks requiring high quality

**Models:**
- `gemini-2.5-pro` - Long context specialist
- `claude-sonnet-4` - Balanced power
- `gpt-4o` - Strong generalist

**Example tasks:**
- Complex code analysis
- Multi-step reasoning
- Technical documentation
- Security reviews

### Tier 4: Premium ($0.05+ per call)

**Use for:** Critical tasks where quality is paramount

**Models:**
- `claude-opus-4-5` - Best reasoning (SWE-bench: 80.9%)

**Example tasks:**
- Architecture decisions
- Critical code reviews
- Complex debugging
- High-stakes analysis

---

## Model Selection Decision Tree

```
START
  │
  ├─ Contains secrets/PII?
  │   └─ YES → Ollama (local)
  │
  ├─ Need current web data?
  │   └─ YES → Perplexity
  │
  ├─ Need image generation?
  │   └─ YES → Gemini Image models
  │
  ├─ Context > 200K tokens?
  │   └─ YES → Gemini 2.5 Pro (1M context)
  │
  ├─ Multi-file code changes?
  │   └─ YES → OpenCode
  │
  ├─ Single-file coding/debugging?
  │   └─ YES → Claude Opus 4.5
  │
  ├─ Budget constrained?
  │   └─ YES → Gemini 2.0 Flash-Lite or Ollama
  │
  ├─ Complex reasoning needed?
  │   └─ YES → Claude Opus 4.5 or Sonnet 4
  │
  ├─ Long-form content generation?
  │   └─ YES → GPT-4o
  │
  └─ General task
      └─ → Gemini 2.5 Flash (default)
```

---

## Ollama Model Guide

### Recommended Models

| Model | Size | Use Case | Speed |
|-------|------|----------|-------|
| `llama3.2` | 3B | Fast general tasks | Very Fast |
| `llama3.2:7b` | 7B | Better quality general | Fast |
| `llama3.2:70b` | 70B | Best local quality | Slow |
| `codellama` | 7B | Code-specific | Fast |
| `deepseek-coder` | 6.7B | Coding alternative | Fast |
| `nomic-embed-text` | 137M | Embeddings | Instant |

### Installation Commands

```bash
# Core models
ollama pull llama3.2           # 3B general purpose
ollama pull nomic-embed-text   # Embeddings

# Optional
ollama pull codellama          # Code-focused
ollama pull deepseek-coder     # Coding alternative
ollama pull llama3.2:70b       # High quality (needs GPU)
```

### Hardware Requirements

| Model Size | Minimum RAM | Recommended RAM | GPU VRAM |
|------------|-------------|-----------------|----------|
| 3B | 4GB | 8GB | 4GB |
| 7B | 8GB | 16GB | 6GB |
| 13B | 16GB | 32GB | 10GB |
| 70B | 64GB | 128GB | 48GB |

---

## Perplexity Search Models

| Model ID | Context | Features |
|----------|---------|----------|
| `llama-3.1-sonar-small-128k-online` | 128K | Fast, citations |
| `llama-3.1-sonar-large-128k-online` | 128K | Better quality |
| `llama-3.1-sonar-huge-128k-online` | 128K | Best quality |

**Always include:** `"return_citations": true` for source tracking.

---

## Version History Quick Reference

### Latest Stable Versions (January 2026)

| Provider | Latest Model | Previous |
|----------|--------------|----------|
| Anthropic | claude-opus-4-5-20251101 | claude-sonnet-4-20250514 |
| Google | gemini-2.5-pro | gemini-2.5-flash |
| OpenAI | gpt-4o | gpt-4o-mini |

### Deprecation Warnings

| Model | Status | Replacement |
|-------|--------|-------------|
| gemini-1.5-pro | Deprecated | gemini-2.5-pro |
| gpt-4-turbo | Legacy | gpt-4o |
| claude-3-opus | Superseded | claude-opus-4-5 |

---

## Model Update Cadence

| Provider | Update Frequency | How to Stay Current |
|----------|------------------|---------------------|
| Anthropic | Major: ~6 months | Check docs.anthropic.com |
| Google | Major: ~3-4 months | Check ai.google.dev |
| OpenAI | Major: ~4-6 months | Check platform.openai.com |

### Checking for Updates

```bash
# Claude Code
claude --version
claude update

# Check model availability
curl -s https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY" | jq '.data[].id'

# Gemini models
curl -s "https://generativelanguage.googleapis.com/v1beta/models?key=$GEMINI_API_KEY" | \
  jq '.models[].name'
```

---

## Quick Selection Guide

| Task Type | Recommended Model | Fallback |
|-----------|------------------|----------|
| Quick extraction | gemini-2.0-flash-lite | ollama/llama3.2 |
| General coding | claude-sonnet-4 | gpt-4o |
| Code review | claude-opus-4-5 | claude-sonnet-4 |
| Long document | gemini-2.5-pro | gemini-2.5-flash |
| Research | perplexity-sonar-large | gemini+grounding |
| Image generation | gemini-2.5-flash-image | gemini-3-pro-image |
| Sensitive data | ollama/llama3.2 | (no cloud fallback) |
| Multi-file refactor | opencode | claude-opus-4-5 |
