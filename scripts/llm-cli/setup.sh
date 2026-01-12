#!/bin/bash
#
# setup.sh - Add LLM CLI tools to PATH
#
# Usage:
#   source scripts/llm-cli/setup.sh
#
# Or add to ~/.zshrc:
#   export PATH="$PATH:/path/to/ai_template/scripts/llm-cli"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Add to PATH for this session
export PATH="$PATH:$SCRIPT_DIR"

echo "LLM CLI tools added to PATH for this session."
echo ""
echo "Available commands:"
echo "  gemini_cli      - Google Gemini API"
echo "  openai_cli      - OpenAI API"
echo "  perplexity_cli  - Perplexity search API"
echo "  ollama_cli      - Local Ollama models"
echo ""
echo "To make permanent, add to ~/.zshrc:"
echo "  export PATH=\"\$PATH:$SCRIPT_DIR\""
echo ""
echo "Test with:"
echo "  gemini_cli --help"
echo "  perplexity_cli --query 'test query'"
