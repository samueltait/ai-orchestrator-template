# LLM API Keys Configuration
# Part of AI Orchestration Template v1.8.0
#
# SECURITY WARNING:
# - DO NOT commit this file with real keys to version control
# - DO NOT store in shared folders (Google Drive, Dropbox, etc.)
# - Copy this template to a secure local location (e.g., ~/.llm_keys)
# - Then add "source ~/.llm_keys" to your ~/.zshrc or ~/.bashrc
#
# Quick Setup:
#   1. Copy this file: cp env_template.sh ~/.llm_keys
#   2. Edit ~/.llm_keys and add your real API keys
#   3. Secure the file: chmod 600 ~/.llm_keys
#   4. Add to shell profile: echo 'source ~/.llm_keys' >> ~/.zshrc
#   5. Reload: source ~/.zshrc
#
# For detailed setup instructions, see SETUP_CHECKLIST.md

# Path configuration
export PATH="$HOME/Library/Python/3.9/bin:$PATH"
export PATH="$HOME/.npm-global/bin:$PATH"
export PATH="$HOME/.local/bin:$PATH"

# ==============================================================================
# CORE LLM PROVIDERS
# ==============================================================================

# Google Gemini (also used for Nano Banana image generation)
# Get key at: https://aistudio.google.com/apikey
# Pricing: https://ai.google.dev/pricing
export GEMINI_API_KEY="your-gemini-api-key-here"

# OpenAI
# Get key at: https://platform.openai.com/api-keys
# Pricing: https://openai.com/pricing
export OPENAI_API_KEY="your-openai-api-key-here"

# Perplexity
# Get key at: https://www.perplexity.ai/settings/api
# Pricing: https://docs.perplexity.ai/guides/pricing
export PERPLEXITY_API_KEY="your-perplexity-api-key-here"

# Anthropic (Claude)
# Uses Claude Max subscription via Claude Code CLI - no API key needed
# For API access: https://console.anthropic.com/settings/keys

# ==============================================================================
# AUDIO/TRANSCRIPTION
# ==============================================================================

# Rev.ai (Speech-to-Text)
# Get key at: https://www.rev.ai/account/settings
# Pricing: $0.02/min async, $0.05/min streaming
export REVAI_API_KEY="your-revai-api-key-here"

# ==============================================================================
# VECTOR DATABASE / RAG
# ==============================================================================

# Pinecone (Managed Vector DB)
# Get key at: https://app.pinecone.io/
# Pricing: Free starter, $70/mo production
export PINECONE_API_KEY="your-pinecone-api-key-here"
export PINECONE_ENVIRONMENT="your-pinecone-environment"

# ==============================================================================
# INTEGRATIONS (OAuth tokens managed separately - see MCP setup)
# ==============================================================================

# Slack Bot Token
# Get at: https://api.slack.com/apps → Your App → OAuth & Permissions
# Free for basic bot functionality
export SLACK_BOT_TOKEN="xoxb-your-slack-bot-token"
export SLACK_SIGNING_SECRET="your-slack-signing-secret"

# Notion Integration Token
# Get at: https://www.notion.so/my-integrations
# Free for integrations
export NOTION_API_KEY="secret_your-notion-integration-token"

# Google OAuth (Calendar, Gmail, Drive)
# Get at: https://console.cloud.google.com/apis/credentials
# Free (quota limits apply)
export GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
export GOOGLE_CLIENT_SECRET="your-google-client-secret"
export GOOGLE_REFRESH_TOKEN="your-google-refresh-token"

# ==============================================================================
# LOCAL TOOLS (No API keys required)
# ==============================================================================
# Ollama: curl -fsSL https://ollama.com/install.sh | sh
# ChromaDB: pip install chromadb
# Whisper.cpp: brew install whisper-cpp (or build from source)
# pdfplumber: pip install pdfplumber
# Pandoc: brew install pandoc
# Marker: pip install marker-pdf
