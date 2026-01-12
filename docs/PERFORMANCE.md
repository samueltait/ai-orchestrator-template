# Performance Benchmarks & Optimization

**Version:** 1.8.0 | **Updated:** 2026-01-11

This document provides performance benchmarks and optimization guidance for the AI Orchestrator.

---

## Latency Benchmarks

### Model Response Times (P50/P95)

| Model | Input Size | P50 Latency | P95 Latency | Notes |
|-------|------------|-------------|-------------|-------|
| gemini-2.0-flash-lite | 1K tokens | 0.8s | 1.5s | Fastest cloud option |
| gemini-2.5-flash | 1K tokens | 1.2s | 2.5s | Good balance |
| gemini-2.5-flash | 10K tokens | 2.5s | 5.0s | Scales linearly |
| gemini-2.5-pro | 1K tokens | 2.0s | 4.0s | More reasoning |
| gemini-2.5-pro | 100K tokens | 15s | 30s | Long context |
| gpt-4o-mini | 1K tokens | 1.0s | 2.0s | Fast |
| gpt-4o | 1K tokens | 2.5s | 5.0s | Higher quality |
| claude-sonnet-4 | 1K tokens | 2.0s | 4.0s | Balanced |
| claude-opus-4-5 | 1K tokens | 4.0s | 8.0s | Highest quality |
| perplexity | Search query | 3.0s | 6.0s | Includes web search |

### Local Tool Latencies

| Tool | Operation | Typical Latency |
|------|-----------|-----------------|
| Ollama (llama3.2) | 1K tokens | 2-5s (depends on hardware) |
| Ollama (nomic-embed) | Embedding | 0.1-0.5s |
| pdfplumber | 10 page PDF | 0.5-1.0s |
| Marker | 10 page PDF | 2-5s |
| ChromaDB | Query (1000 docs) | 0.05-0.1s |

### Claude Canvas Spawn Times

| Terminal | Spawn Method | Time to Interactive |
|----------|--------------|---------------------|
| iTerm2 | Split pane | 1.5-2.0s |
| tmux | Split pane | 1.0-1.5s |
| Apple Terminal | New window | 2.0-3.0s |
| Pane reuse | Any terminal | 0.3-0.5s |

---

## Parallelization Guidelines

### Maximum Concurrent Requests

| Provider | Recommended Max | Hard Limit | Notes |
|----------|-----------------|------------|-------|
| Gemini | 5 | 60/min | Generous quota |
| OpenAI | 3 | Tier-dependent | Check your tier |
| Anthropic | 3 | Tier-dependent | Check your tier |
| Perplexity | 2 | 20/min | Most restrictive |
| Ollama | CPU cores | N/A | Local, CPU-bound |

### Stagger Delay Between Requests

```bash
# Recommended: 500ms between parallel requests to same provider
for task in "${tasks[@]}"; do
  run_task "$task" &
  sleep 0.5  # Stagger to avoid burst limits
done
wait
```

### Provider Diversity for Parallelism

```bash
# GOOD: Different providers in parallel
perplexity_cli --query "topic A" > a.md &
gemini_cli --model flash --task "analyze" > b.md &
openai_cli --model gpt-4o-mini --task "generate" > c.md &
wait
# All 3 run truly in parallel

# SUBOPTIMAL: Same provider in parallel
gemini_cli --task "task 1" &
gemini_cli --task "task 2" &
gemini_cli --task "task 3" &
wait
# May hit rate limits, stagger recommended
```

---

## Throughput Optimization

### Token Processing Rates

| Model | Tokens/Second (Output) | Notes |
|-------|------------------------|-------|
| gemini-2.0-flash-lite | 150-200 | Fastest |
| gemini-2.5-flash | 100-150 | Good |
| gpt-4o-mini | 100-150 | Good |
| gpt-4o | 50-80 | Slower but better |
| claude-sonnet-4 | 80-120 | Balanced |
| claude-opus-4-5 | 40-60 | Slowest, highest quality |

### Batch Processing Efficiency

```bash
# Inefficient: 10 separate API calls
for item in {1..10}; do
  gemini_cli --task "process item $item"  # 10 × 1.2s = 12s total
done

# Efficient: 1 batched API call
items=$(printf '%s\n' {1..10} | jq -Rs .)
gemini_cli --task "process these items: $items"  # 1 × 3s = 3s total
```

### Streaming vs. Non-Streaming

| Mode | Latency to First Token | Total Time | Use Case |
|------|------------------------|------------|----------|
| Non-streaming | Full response time | Same | Background jobs, scripts |
| Streaming | 200-500ms | Same | Interactive, real-time display |

---

## Memory & Resource Usage

### Ollama Memory Requirements

| Model | RAM Required | GPU VRAM |
|-------|--------------|----------|
| llama3.2 (3B) | 4GB | 4GB |
| llama3.2:7b | 8GB | 6GB |
| llama3.2:70b | 64GB | 48GB |
| codellama (7B) | 8GB | 6GB |
| deepseek-coder (6.7B) | 8GB | 6GB |
| nomic-embed-text | 1GB | N/A |

### Claude Canvas Resource Usage

| Component | Memory | CPU | Notes |
|-----------|--------|-----|-------|
| CLI process | 50-100MB | Low | Bun runtime |
| Weather canvas | 60MB | Low | API polling every 30s |
| System canvas | 80MB | Medium | Process monitoring |
| Calendar canvas | 50MB | Low | Static display |
| Document canvas | 70MB | Low | Text rendering |
| Flight tracker | 100MB | Medium | Real-time updates |

---

## Optimization Techniques

### 1. Context Compression

```bash
# Problem: 50KB document costs $0.50 with Opus
# Solution: Summarize first

# Step 1: Compress with cheap model
gemini_cli --model gemini-2.0-flash-lite --in large_doc.md \
  --task "Extract key points as bullets" > summary.md  # $0.001

# Step 2: Analyze compressed version
claude_cli --model claude-opus-4-5 --in summary.md \
  --task "Deep analysis"  # $0.05 instead of $0.50
```

### 2. Progressive Refinement

```bash
# Start cheap, escalate only if needed
result=$(gemini_cli --model gemini-2.0-flash-lite --task "$TASK")

# Check if quality is sufficient
if ! meets_quality_bar "$result"; then
  result=$(gemini_cli --model gemini-2.5-flash --task "$TASK")
fi

if ! meets_quality_bar "$result"; then
  result=$(claude_cli --model claude-sonnet-4 --task "$TASK")
fi
```

### 3. Caching Strategy

```bash
#!/bin/bash
# Cache expensive results with TTL

CACHE_DIR="$HOME/.llm_cache"
CACHE_TTL=3600  # 1 hour

cached_query() {
  local key=$(echo "$*" | md5sum | cut -d' ' -f1)
  local cache_file="$CACHE_DIR/${key}.cache"
  local meta_file="$CACHE_DIR/${key}.meta"

  # Check cache validity
  if [ -f "$cache_file" ] && [ -f "$meta_file" ]; then
    local cached_at=$(cat "$meta_file")
    local now=$(date +%s)
    if [ $((now - cached_at)) -lt $CACHE_TTL ]; then
      cat "$cache_file"
      return 0
    fi
  fi

  # Cache miss - run query
  mkdir -p "$CACHE_DIR"
  local result=$("$@")
  echo "$result" > "$cache_file"
  date +%s > "$meta_file"
  echo "$result"
}

# Usage
cached_query gemini_cli --model gemini-2.5-pro --task "expensive analysis"
```

### 4. Request Deduplication

```bash
# Avoid duplicate requests in parallel workflows
declare -A PENDING_REQUESTS

dedup_request() {
  local key=$(echo "$*" | md5sum | cut -d' ' -f1)

  if [ -n "${PENDING_REQUESTS[$key]}" ]; then
    # Wait for existing request
    wait "${PENDING_REQUESTS[$key]}"
    cat "/tmp/request_${key}.result"
    return
  fi

  # Start new request
  (
    "$@" > "/tmp/request_${key}.result"
  ) &
  PENDING_REQUESTS[$key]=$!
  wait $!
  cat "/tmp/request_${key}.result"
}
```

---

## Timeout Recommendations

### By Model Type

| Model Category | Default Timeout | Max Timeout | Retry Timeout |
|----------------|-----------------|-------------|---------------|
| Fast (Flash, Mini) | 30s | 60s | 45s |
| Balanced (Sonnet, Pro) | 60s | 120s | 90s |
| Slow (Opus) | 90s | 300s | 180s |
| Perplexity Search | 20s | 45s | 30s |
| OpenCode Tasks | 300s | 600s | 450s |

### By Input Size

| Input Size | Timeout Multiplier |
|------------|-------------------|
| <1K tokens | 1.0x |
| 1K-10K tokens | 1.5x |
| 10K-50K tokens | 2.0x |
| 50K-100K tokens | 3.0x |
| >100K tokens | 4.0x |

```bash
# Dynamic timeout calculation
calculate_timeout() {
  local base_timeout=$1
  local input_tokens=$2

  if [ $input_tokens -lt 1000 ]; then
    echo $base_timeout
  elif [ $input_tokens -lt 10000 ]; then
    echo $((base_timeout * 3 / 2))
  elif [ $input_tokens -lt 50000 ]; then
    echo $((base_timeout * 2))
  elif [ $input_tokens -lt 100000 ]; then
    echo $((base_timeout * 3))
  else
    echo $((base_timeout * 4))
  fi
}
```

---

## Performance Monitoring

### Request Timing

```bash
#!/bin/bash
# Wrapper to time API requests

timed_request() {
  local start=$(date +%s.%N)
  local result=$("$@")
  local end=$(date +%s.%N)
  local duration=$(echo "$end - $start" | bc)

  # Log timing
  echo "{\"command\": \"$*\", \"duration_s\": $duration, \"timestamp\": \"$(date -Iseconds)\"}" >> ~/.llm_perf.log

  echo "$result"
}

# Usage
timed_request gemini_cli --model gemini-2.5-flash --task "analyze"
```

### Aggregated Stats

```bash
#!/bin/bash
# Analyze performance log

analyze_perf() {
  echo "=== LLM Performance Stats ==="

  # Average latency by model
  echo "Average latency by model:"
  jq -r '.command' ~/.llm_perf.log | \
    grep -oE 'gemini-[a-z0-9.-]+|gpt-[a-z0-9-]+|claude-[a-z0-9-]+' | \
    sort | uniq -c | sort -rn

  # P50/P95 latencies
  echo "
Overall latencies:"
  jq -r '.duration_s' ~/.llm_perf.log | \
    sort -n | \
    awk '{
      a[NR]=$1; sum+=$1
    }
    END {
      print "  Mean: " sum/NR "s"
      print "  P50: " a[int(NR*0.5)] "s"
      print "  P95: " a[int(NR*0.95)] "s"
      print "  P99: " a[int(NR*0.99)] "s"
    }'
}
```

---

## Quick Reference: Optimization Checklist

- [ ] Use cheapest model that meets quality requirements
- [ ] Compress context before expensive operations
- [ ] Cache results for repeated queries
- [ ] Batch multiple items into single requests
- [ ] Use provider diversity for parallel tasks
- [ ] Set appropriate timeouts based on input size
- [ ] Monitor and log performance metrics
- [ ] Stagger parallel requests (500ms delay)
- [ ] Use streaming for interactive use cases
- [ ] Prefer local tools for mechanical operations
