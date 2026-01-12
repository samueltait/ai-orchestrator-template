# Error Handling & Recovery

**Version:** 1.8.0 | **Updated:** 2026-01-11

This document provides worked examples of error handling and recovery strategies for the AI Orchestrator.

---

## Error Types & Detection

| Error Type | Detection Method | Typical Causes |
|------------|------------------|----------------|
| Format Error | JSON validation, missing fields | Malformed response, truncation |
| Quality Error | Content analysis, doesn't address task | Wrong model, unclear prompt |
| Timeout | Request exceeds time limit | Large input, slow model |
| Rate Limit | HTTP 429 response | Too many requests |
| Auth Error | HTTP 401/403 response | Invalid/expired API key |
| Content Policy | Refusal message in response | Sensitive content blocked |

---

## Worked Examples

### Example 1: JSON Format Error Recovery

**Scenario:** Gemini returns malformed JSON when asked for structured output.

```bash
#!/bin/bash
# Example: Extract entities from text, expect JSON output

INPUT="Apple Inc. announced a new product in Cupertino, California on January 15, 2026."
EXPECTED_FORMAT='{"entities": [{"name": "string", "type": "ORG|LOC|DATE"}]}'

MAX_RETRIES=3
attempt=1

while [ $attempt -le $MAX_RETRIES ]; do
  echo "[Attempt $attempt] Extracting entities..."

  result=$(gemini_cli --model gemini-2.5-flash --task "
Extract named entities from this text as JSON.
Format: $EXPECTED_FORMAT

Text: $INPUT
" 2>&1)

  # Validate JSON
  if echo "$result" | jq -e '.' > /dev/null 2>&1; then
    # Check required fields exist
    if echo "$result" | jq -e '.entities' > /dev/null 2>&1; then
      echo "SUCCESS: Valid JSON received"
      echo "$result" | jq .
      exit 0
    fi
  fi

  echo "[Attempt $attempt] Invalid JSON, retrying with correction prompt..."

  # Retry with explicit correction
  result=$(gemini_cli --model gemini-2.5-flash --task "
Your previous output was not valid JSON. Please return ONLY valid JSON.
Required format: $EXPECTED_FORMAT

Do not include any text before or after the JSON.

Text to analyze: $INPUT
" 2>&1)

  # Try to extract JSON from response (in case model wrapped it)
  extracted=$(echo "$result" | grep -oE '\{.*\}' | head -1)
  if echo "$extracted" | jq -e '.entities' > /dev/null 2>&1; then
    echo "SUCCESS: Extracted valid JSON"
    echo "$extracted" | jq .
    exit 0
  fi

  ((attempt++))
done

echo "FAILED: Could not get valid JSON after $MAX_RETRIES attempts"
echo "Last response: $result"
exit 1
```

**Output:**
```
[Attempt 1] Extracting entities...
[Attempt 1] Invalid JSON, retrying with correction prompt...
SUCCESS: Extracted valid JSON
{
  "entities": [
    {"name": "Apple Inc.", "type": "ORG"},
    {"name": "Cupertino, California", "type": "LOC"},
    {"name": "January 15, 2026", "type": "DATE"}
  ]
}
```

---

### Example 2: Quality Degradation with Fallback

**Scenario:** GPT-4o-mini gives generic response, escalate to GPT-4o.

```bash
#!/bin/bash
# Example: Code review that requires specific feedback

CODE=$(cat <<'EOF'
def calculate_tax(income, rate):
    if income < 0:
        return income * rate
    return income * rate
EOF
)

TASK="Review this code. List SPECIFIC bugs with line numbers. If no bugs, say 'No bugs found'."

# Quality check: Response must mention specific issues or confirm no bugs
check_quality() {
  local response=$1
  # Bad responses: generic advice, no specifics
  if echo "$response" | grep -qiE "(looks good|no issues|well written)" && \
     ! echo "$response" | grep -qE "(line [0-9]|bug|error|issue:)"; then
    return 1  # Low quality
  fi
  # Good responses: specific line references or explicit no bugs
  if echo "$response" | grep -qE "(line [0-9]|No bugs found|bug:|error:)"; then
    return 0  # Good quality
  fi
  return 1  # Uncertain, treat as low quality
}

echo "=== Trying GPT-4o-mini first (Tier 2) ==="
response=$(openai_cli --model gpt-4o-mini --task "$TASK" <<< "$CODE")
echo "$response"

if check_quality "$response"; then
  echo "
Quality: PASS - Response is specific"
  exit 0
fi

echo "
Quality: FAIL - Response too generic, escalating to GPT-4o..."

echo "=== Escalating to GPT-4o (Tier 3) ==="
response=$(openai_cli --model gpt-4o --task "$TASK

IMPORTANT: Be specific. Mention exact line numbers and exact issues. Do not give general advice." <<< "$CODE")
echo "$response"

if check_quality "$response"; then
  echo "
[FALLBACK: gpt-4o-mini gave generic response, used gpt-4o]"
  exit 0
fi

echo "
WARNING: Both models gave low-quality responses. Manual review recommended."
exit 1
```

**Expected Output:**
```
=== Trying GPT-4o-mini first (Tier 2) ===
The code looks reasonable but could use some improvements...

Quality: FAIL - Response too generic, escalating to GPT-4o...

=== Escalating to GPT-4o (Tier 3) ===
Bug found on line 3: When income is negative, the function still calculates
tax (income * rate), which would result in a negative tax amount. This is
likely unintended - negative income should probably return 0 or raise an error.

Line 3: `return income * rate` should be `return 0` or `raise ValueError("Income cannot be negative")`

[FALLBACK: gpt-4o-mini gave generic response, used gpt-4o]
```

---

### Example 3: Timeout with Retry and Fallback

**Scenario:** Gemini Pro times out on large document, retry then fallback.

```bash
#!/bin/bash
# Example: Analyze large document with timeout handling

LARGE_DOC="large_report.md"  # 100KB document
TASK="Summarize the key findings and recommendations"
DEFAULT_TIMEOUT=60
EXTENDED_TIMEOUT=120

# Wrapper with timeout
run_with_timeout() {
  local timeout=$1
  local model=$2
  local input=$3
  local task=$4

  timeout "${timeout}s" gemini_cli --model "$model" --in "$input" --task "$task" 2>&1
  return $?
}

echo "=== Attempt 1: gemini-2.5-pro with ${DEFAULT_TIMEOUT}s timeout ==="
result=$(run_with_timeout $DEFAULT_TIMEOUT "gemini-2.5-pro" "$LARGE_DOC" "$TASK")
exit_code=$?

if [ $exit_code -eq 0 ] && [ -n "$result" ]; then
  echo "$result"
  exit 0
elif [ $exit_code -eq 124 ]; then
  echo "TIMEOUT after ${DEFAULT_TIMEOUT}s"
else
  echo "ERROR: Exit code $exit_code"
fi

echo "
=== Attempt 2: Retry with extended timeout (${EXTENDED_TIMEOUT}s) ==="
result=$(run_with_timeout $EXTENDED_TIMEOUT "gemini-2.5-pro" "$LARGE_DOC" "$TASK")
exit_code=$?

if [ $exit_code -eq 0 ] && [ -n "$result" ]; then
  echo "$result"
  echo "
[RETRY: Succeeded with extended timeout]"
  exit 0
elif [ $exit_code -eq 124 ]; then
  echo "TIMEOUT after ${EXTENDED_TIMEOUT}s"
fi

echo "
=== Attempt 3: Fallback to chunked processing with Flash ==="
# Split document and process in chunks
echo "Splitting document into chunks..."

# Extract first 20KB (roughly 5000 tokens)
head -c 20000 "$LARGE_DOC" > /tmp/chunk1.md
tail -c +20001 "$LARGE_DOC" | head -c 20000 > /tmp/chunk2.md
tail -c +40001 "$LARGE_DOC" > /tmp/chunk3.md

for i in 1 2 3; do
  if [ -s "/tmp/chunk${i}.md" ]; then
    echo "Processing chunk $i..."
    gemini_cli --model gemini-2.5-flash --in "/tmp/chunk${i}.md" \
      --task "Extract key points from this section" > "/tmp/summary${i}.md"
  fi
done

# Combine and final summary
cat /tmp/summary*.md > /tmp/combined.md
result=$(gemini_cli --model gemini-2.5-flash --in /tmp/combined.md \
  --task "Synthesize these summaries into a final summary with key findings and recommendations")

echo "$result"
echo "
[FALLBACK: Used chunked processing after timeout]"

# Cleanup
rm -f /tmp/chunk*.md /tmp/summary*.md /tmp/combined.md
```

---

### Example 4: Rate Limit with Exponential Backoff

**Scenario:** Perplexity returns 429, implement backoff.

```bash
#!/bin/bash
# Example: Research query with rate limit handling

QUERY="Latest developments in quantum computing 2026"
MAX_RETRIES=5
RETRY_DELAYS=(2 5 10 20 40)  # Exponential backoff

attempt=0
while [ $attempt -lt $MAX_RETRIES ]; do
  echo "[Attempt $((attempt + 1))] Querying Perplexity..."

  # Capture both output and HTTP status
  response=$(curl -s -w "\n%{http_code}" \
    -X POST https://api.perplexity.ai/chat/completions \
    -H "Authorization: Bearer $PERPLEXITY_API_KEY" \
    -H "Content-Type: application/json" \
    -d "{
      \"model\": \"llama-3.1-sonar-large-128k-online\",
      \"messages\": [{\"role\": \"user\", \"content\": \"$QUERY\"}]
    }")

  http_code=$(echo "$response" | tail -1)
  body=$(echo "$response" | sed '$d')

  case $http_code in
    200)
      echo "$body" | jq -r '.choices[0].message.content'
      echo "
SUCCESS on attempt $((attempt + 1))"
      exit 0
      ;;
    429)
      delay=${RETRY_DELAYS[$attempt]}
      echo "RATE LIMITED (429). Waiting ${delay}s before retry..."
      sleep $delay
      ((attempt++))
      ;;
    401|403)
      echo "AUTH ERROR ($http_code). Check PERPLEXITY_API_KEY"
      exit 1
      ;;
    5*)
      delay=${RETRY_DELAYS[$attempt]}
      echo "SERVER ERROR ($http_code). Waiting ${delay}s before retry..."
      sleep $delay
      ((attempt++))
      ;;
    *)
      echo "UNEXPECTED ERROR ($http_code): $body"
      exit 1
      ;;
  esac
done

echo "FAILED: Exceeded max retries due to rate limiting"
echo "Suggestion: Wait 1 minute and try again, or switch to alternative provider"

# Fallback to web search via different provider
echo "
=== Falling back to Gemini with grounding ==="
gemini_cli --model gemini-2.5-flash --task "Search the web and summarize: $QUERY"
```

---

### Example 5: Parallel Task Failure Recovery

**Scenario:** One of three parallel tasks fails, continue with others.

```bash
#!/bin/bash
# Example: Parallel research with partial failure handling

TOPICS=(
  "AI agent developments 2026"
  "Quantum computing breakthroughs 2026"
  "Climate technology innovations 2026"
)

PIDS=()
RESULTS=()
FAILURES=()

# Start parallel tasks
echo "Starting ${#TOPICS[@]} parallel research tasks..."
for i in "${!TOPICS[@]}"; do
  topic="${TOPICS[$i]}"
  output_file="/tmp/research_${i}.md"

  (
    perplexity_cli --query "$topic" > "$output_file" 2>&1
    echo $? > "/tmp/research_${i}.status"
  ) &

  PIDS+=($!)
  echo "  Started task $i: $topic (PID: ${PIDS[$i]})"
done

# Wait for all tasks with timeout
echo "
Waiting for tasks to complete (max 60s each)..."
for i in "${!PIDS[@]}"; do
  pid=${PIDS[$i]}
  topic="${TOPICS[$i]}"

  # Wait with timeout
  timeout 60s tail --pid=$pid -f /dev/null 2>/dev/null
  wait $pid 2>/dev/null

  status=$(cat "/tmp/research_${i}.status" 2>/dev/null || echo "1")
  output=$(cat "/tmp/research_${i}.md" 2>/dev/null)

  if [ "$status" = "0" ] && [ -n "$output" ]; then
    echo "  Task $i SUCCEEDED: $topic"
    RESULTS+=("$output")
  else
    echo "  Task $i FAILED: $topic"
    FAILURES+=("$topic")
  fi
done

# Report results
echo "
=== Results Summary ==="
echo "Succeeded: ${#RESULTS[@]}/${#TOPICS[@]}"
echo "Failed: ${#FAILURES[@]}/${#TOPICS[@]}"

if [ ${#FAILURES[@]} -gt 0 ]; then
  echo "
Failed topics:"
  for topic in "${FAILURES[@]}"; do
    echo "  - $topic"
  done

  echo "
Retrying failed tasks sequentially..."
  for topic in "${FAILURES[@]}"; do
    echo "Retrying: $topic"
    result=$(perplexity_cli --query "$topic" 2>&1)
    if [ -n "$result" ]; then
      RESULTS+=("$result")
      echo "  Retry SUCCEEDED"
    else
      echo "  Retry FAILED - marking as incomplete"
    fi
  done
fi

# Combine successful results
if [ ${#RESULTS[@]} -gt 0 ]; then
  echo "
=== Synthesizing ${#RESULTS[@]} research results ==="
  printf '%s\n\n---\n\n' "${RESULTS[@]}" > /tmp/combined_research.md
  gemini_cli --model gemini-2.5-flash --in /tmp/combined_research.md \
    --task "Synthesize these research findings into a unified summary"
fi

# Cleanup
rm -f /tmp/research_*.md /tmp/research_*.status /tmp/combined_research.md

# Exit with warning if any failures
if [ ${#FAILURES[@]} -gt 0 ]; then
  echo "
WARNING: Some tasks failed. Results may be incomplete."
  exit 1
fi
```

---

### Example 6: Content Policy Violation Recovery

**Scenario:** Model refuses request, rephrase and retry.

```bash
#!/bin/bash
# Example: Security analysis that might trigger content filters

CODE=$(cat <<'EOF'
def validate_input(user_input):
    # TODO: Add input validation
    return eval(user_input)  # Process user command
EOF
)

TASK="Analyze this code for security vulnerabilities"

echo "=== Attempt 1: Direct security analysis ==="
result=$(openai_cli --model gpt-4o --task "$TASK" <<< "$CODE")

# Check for refusal patterns
if echo "$result" | grep -qiE "(cannot assist|unable to|sorry|can't help|policy)"; then
  echo "Content policy triggered. Rephrasing request..."

  echo "=== Attempt 2: Rephrased as educational review ==="
  REPHRASED_TASK="For educational purposes, review this Python code and identify any patterns
that might make it vulnerable to security issues. Focus on:
1. Input handling
2. Use of dangerous functions
3. Potential for injection attacks

This is for a secure coding training course."

  result=$(openai_cli --model gpt-4o --task "$REPHRASED_TASK" <<< "$CODE")

  if echo "$result" | grep -qiE "(cannot assist|unable to|sorry)"; then
    echo "Still blocked. Trying alternative model..."

    echo "=== Attempt 3: Using Claude for security review ==="
    result=$(claude "Review this code for security best practices:

$CODE

What improvements would you recommend for production use?")
  fi
fi

echo "$result"

# Check if we got useful output
if echo "$result" | grep -qiE "(eval|injection|validation|sanitize|vulnerable)"; then
  echo "
Analysis completed successfully."
else
  echo "
WARNING: May not have received complete security analysis."
fi
```

---

## Fallback Chain Reference

| Primary Model | Fallback 1 | Fallback 2 | Notes |
|---------------|------------|------------|-------|
| claude-opus-4-5 | claude-sonnet-4 | gemini-2.5-pro | Quality degradation minimal |
| gemini-2.5-pro | claude-sonnet-4 | gpt-4o | Cross-provider diversity |
| gpt-4o | gpt-4o-mini | gemini-2.5-flash | Cost reduction |
| perplexity | gemini+grounding | manual search | Web search alternatives |

---

## Error Logging Template

```bash
log_error() {
  local step=$1
  local model=$2
  local error_type=$3
  local message=$4

  cat >> "$HOME/.llm_errors.log" <<EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "step": "$step",
  "model": "$model",
  "error_type": "$error_type",
  "message": "$message"
}
EOF
}

# Usage
log_error "3" "gemini-2.5-pro" "timeout" "Request exceeded 120s limit"
```
