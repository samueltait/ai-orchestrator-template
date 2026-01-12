# Cost Tracking & Budget Management

**Version:** 1.8.0 | **Updated:** 2026-01-11

This document explains how to track, estimate, and manage costs when using the AI Orchestration Template.

---

## Cost Tier Reference

| Tier | Use Case | Target Cost | Example Models |
|------|----------|-------------|----------------|
| 1 | Simple extraction, formatting | <$0.001/call | gemini-2.0-flash-lite, Ollama |
| 2 | Standard tasks | $0.001-0.01/call | gemini-2.5-flash, gpt-4o-mini |
| 3 | Complex tasks | $0.01-0.05/call | gemini-2.5-pro, claude-sonnet-4, gpt-4o |
| 4 | Critical tasks | $0.05+/call | claude-opus-4-5 |

---

## Current Pricing (January 2026)

### Per 1M Tokens

| Model | Input | Output | Context | Tier |
|-------|-------|--------|---------|------|
| gemini-2.0-flash-lite | $0.075 | $0.30 | 1M | 1 |
| gemini-2.5-flash | $0.15 | $0.60 | 1M | 2 |
| gpt-4o-mini | $0.15 | $0.60 | 128K | 2 |
| deepseek-chat | $0.14 | $0.28 | 64K | 2 |
| gemini-2.5-pro | $1.25 | $5.00 | 1M | 3 |
| claude-sonnet-4 | $3.00 | $15.00 | 200K | 3 |
| gpt-4o | $2.50 | $10.00 | 128K | 3 |
| claude-opus-4-5 | $15.00 | $75.00 | 200K | 4 |

### Free/Subscription Services

| Service | Cost Model |
|---------|------------|
| Ollama | Free (runs locally) |
| Claude Code CLI | Included in Claude Max subscription |
| ChromaDB | Free (runs locally) |
| Open-Meteo (weather) | Free API |
| OpenSky Network (flights) | Free API |

### Pay-Per-Use Services

| Service | Pricing |
|---------|---------|
| Rev.ai | $0.02/min async, $0.05/min streaming |
| Pinecone | Free starter, $70/mo production |
| Figma MCP | Free with Figma account (rate limits apply) |

---

## Cost Estimation Script

Save this script to track costs across workflows:

```bash
#!/bin/bash
# Save as ~/bin/estimate_cost

# Token estimation (rough: ~4 chars per token)
estimate_tokens() {
  local chars=$(echo "$1" | wc -c)
  echo $((chars / 4))
}

# Cost calculation
calculate_cost() {
  local model=$1
  local input_tokens=$2
  local output_tokens=$3

  case $model in
    gemini-2.0-flash-lite)
      echo "scale=6; ($input_tokens * 0.000000075) + ($output_tokens * 0.0000003)" | bc
      ;;
    gemini-2.5-flash)
      echo "scale=6; ($input_tokens * 0.00000015) + ($output_tokens * 0.0000006)" | bc
      ;;
    gemini-2.5-pro)
      echo "scale=6; ($input_tokens * 0.00000125) + ($output_tokens * 0.000005)" | bc
      ;;
    gpt-4o-mini)
      echo "scale=6; ($input_tokens * 0.00000015) + ($output_tokens * 0.0000006)" | bc
      ;;
    gpt-4o)
      echo "scale=6; ($input_tokens * 0.0000025) + ($output_tokens * 0.00001)" | bc
      ;;
    claude-sonnet-4)
      echo "scale=6; ($input_tokens * 0.000003) + ($output_tokens * 0.000015)" | bc
      ;;
    claude-opus-4-5)
      echo "scale=6; ($input_tokens * 0.000015) + ($output_tokens * 0.000075)" | bc
      ;;
    *)
      echo "0"
      ;;
  esac
}

# Usage
if [ $# -lt 3 ]; then
  echo "Usage: estimate_cost <model> <input_tokens> <output_tokens>"
  echo "Example: estimate_cost gpt-4o 1000 500"
  exit 1
fi

cost=$(calculate_cost "$1" "$2" "$3")
echo "Estimated cost: \$${cost}"
```

---

## Runtime Cost Tracking

### Workflow Cost Logger

Add this to your orchestration scripts:

```bash
#!/bin/bash
# Save as ~/bin/cost_logger

COST_LOG="${COST_LOG:-$HOME/.llm_costs.log}"
BUDGET_ALERT="${BUDGET_ALERT:-0.50}"

log_cost() {
  local workflow=$1
  local model=$2
  local cost=$3
  local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  echo "$timestamp,$workflow,$model,$cost" >> "$COST_LOG"

  # Check daily total
  local today=$(date +"%Y-%m-%d")
  local daily_total=$(grep "^$today" "$COST_LOG" | awk -F',' '{sum += $4} END {print sum}')

  if (( $(echo "$daily_total > $BUDGET_ALERT" | bc -l) )); then
    echo "WARNING: Daily spend \$$daily_total exceeds alert threshold \$$BUDGET_ALERT"
  fi
}

get_daily_total() {
  local today=$(date +"%Y-%m-%d")
  grep "^$today" "$COST_LOG" | awk -F',' '{sum += $4} END {printf "%.4f", sum}'
}

get_monthly_total() {
  local month=$(date +"%Y-%m")
  grep "^$month" "$COST_LOG" | awk -F',' '{sum += $4} END {printf "%.4f", sum}'
}

case $1 in
  log)
    log_cost "$2" "$3" "$4"
    ;;
  daily)
    echo "Daily total: \$$(get_daily_total)"
    ;;
  monthly)
    echo "Monthly total: \$$(get_monthly_total)"
    ;;
  *)
    echo "Usage: cost_logger log <workflow> <model> <cost>"
    echo "       cost_logger daily"
    echo "       cost_logger monthly"
    ;;
esac
```

### Integration with Orchestrator

Add cost logging to your workflow commands:

```bash
# After each API call, log the cost
perplexity_cli --query "research topic" > research.md
cost_logger log "research-workflow" "perplexity" "0.005"

gemini_cli --model gemini-2.5-flash --in research.md --task "summarize" > summary.md
cost_logger log "research-workflow" "gemini-2.5-flash" "0.002"

# Check totals
cost_logger daily
cost_logger monthly
```

---

## Budget Alerts

### Environment Variables

```bash
# Add to ~/.llm_keys
export DAILY_BUDGET_ALERT=0.50      # Alert when daily spend exceeds $0.50
export MONTHLY_BUDGET_LIMIT=50.00   # Hard limit for monthly spend
export COST_LOG="$HOME/.llm_costs.log"
```

### Pre-Execution Budget Check

```bash
#!/bin/bash
# Save as ~/bin/check_budget

check_budget() {
  local estimated_cost=$1
  local monthly_total=$(cost_logger monthly | grep -oE '[0-9]+\.[0-9]+')
  local new_total=$(echo "$monthly_total + $estimated_cost" | bc)

  if (( $(echo "$new_total > $MONTHLY_BUDGET_LIMIT" | bc -l) )); then
    echo "ERROR: This operation (\$$estimated_cost) would exceed monthly budget"
    echo "Current: \$$monthly_total | Limit: \$$MONTHLY_BUDGET_LIMIT"
    return 1
  fi
  return 0
}

# Usage in workflow
if check_budget 0.10; then
  # Proceed with expensive operation
  claude_cli --model claude-opus-4-5 --task "complex analysis"
else
  echo "Switching to cheaper model..."
  gemini_cli --model gemini-2.5-flash --task "complex analysis"
fi
```

---

## Cost Optimization Strategies

### 1. Summarize Before Passing

```bash
# Bad: Pass full 50KB document to expensive model
cat large_doc.md | claude_cli --model claude-opus-4-5 --task "analyze"  # ~$0.50

# Good: Summarize first with cheap model
gemini_cli --model gemini-2.0-flash-lite --in large_doc.md \
  --task "Extract key points" > summary.md  # ~$0.001
cat summary.md | claude_cli --model claude-opus-4-5 --task "analyze"  # ~$0.05
```

### 2. Use Tiered Fallbacks

```bash
# Start with cheapest, escalate if needed
result=$(gemini_cli --model gemini-2.0-flash-lite --task "$TASK")
if [ -z "$result" ] || echo "$result" | grep -q "unable to"; then
  result=$(gemini_cli --model gemini-2.5-flash --task "$TASK")
fi
```

### 3. Batch Requests

```bash
# Instead of 10 separate calls
for item in "${items[@]}"; do
  gemini_cli --task "process $item"  # 10 × $0.002 = $0.02
done

# Batch into one call
echo "${items[@]}" | gemini_cli --task "process all items"  # 1 × $0.003 = $0.003
```

### 4. Cache Expensive Results

```bash
CACHE_DIR="$HOME/.llm_cache"
mkdir -p "$CACHE_DIR"

cached_call() {
  local cache_key=$(echo "$*" | md5sum | cut -d' ' -f1)
  local cache_file="$CACHE_DIR/$cache_key"

  if [ -f "$cache_file" ]; then
    cat "$cache_file"
    return
  fi

  result=$("$@")
  echo "$result" > "$cache_file"
  echo "$result"
}

# Usage
cached_call gemini_cli --model gemini-2.5-pro --task "expensive analysis"
```

---

## Monthly Cost Estimates

### Light Usage ($20-30/month)

- 50-100 Claude queries via subscription
- 500 Gemini Flash calls
- 100 Perplexity searches
- Unlimited Ollama
- Unlimited Claude Canvas

### Moderate Usage ($50-75/month)

- 200+ Claude queries
- 2000 Gemini Flash calls
- 200 Perplexity searches
- 50 GPT-4o calls
- 100 min Rev.ai transcription

### Heavy Usage ($100-150/month)

- 500+ Claude queries
- 5000 Gemini calls (mixed models)
- 500 Perplexity searches
- 200 GPT-4o calls
- 500 min Rev.ai transcription
- Pinecone production tier

---

## Cost Report Template

Include this at the end of orchestration outputs:

```markdown
## Cost Summary

| Step | Model | Tokens (in/out) | Cost |
|------|-------|-----------------|------|
| 1 | perplexity | ~2000/1500 | $0.005 |
| 2 | gemini-2.0-flash-lite | ~3000/500 | $0.001 |
| 3 | gpt-4o | ~1000/2000 | $0.025 |

**Total Estimated Cost:** $0.031
**Daily Running Total:** $0.15
**Monthly Running Total:** $12.45

---
*Cost tracking powered by AI Orchestration Template v1.8.0*
```

---

## Alerts & Notifications

### Slack Alert on Budget Threshold

```bash
#!/bin/bash
# Add to cost_logger

send_budget_alert() {
  local message=$1
  if [ -n "$SLACK_BOT_TOKEN" ]; then
    curl -s -X POST https://slack.com/api/chat.postMessage \
      -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"channel\": \"#alerts\", \"text\": \"$message\"}"
  fi
}

# In log_cost function, after budget check:
if (( $(echo "$daily_total > $BUDGET_ALERT" | bc -l) )); then
  send_budget_alert "Daily LLM spend \$$daily_total exceeds \$$BUDGET_ALERT threshold"
fi
```
