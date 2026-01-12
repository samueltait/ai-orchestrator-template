#!/bin/bash
# AI Orchestration Template - Setup Script
# Version: 1.8.0
#
# This script installs local tools required for the AI orchestration template.
# Run: ./setup.sh

set -e

echo "=========================================="
echo "AI Orchestration Template Setup"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check function
check_installed() {
    if command -v "$1" &> /dev/null; then
        echo -e "${GREEN}[OK]${NC} $1 is installed"
        return 0
    else
        echo -e "${YELLOW}[MISSING]${NC} $1 is not installed"
        return 1
    fi
}

# Detect OS
OS="unknown"
if [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
fi

echo "Detected OS: $OS"
echo ""

# Phase 1: Check prerequisites
echo "Phase 1: Checking prerequisites..."
echo "-----------------------------------"

check_installed python3 || { echo -e "${RED}Please install Python 3.9+${NC}"; exit 1; }
check_installed pip || check_installed pip3 || { echo -e "${RED}Please install pip${NC}"; exit 1; }

echo ""

# Phase 2: Setup API keys file
echo "Phase 2: Setting up API keys..."
echo "--------------------------------"

if [ -f ~/.llm_keys ]; then
    echo -e "${GREEN}[OK]${NC} ~/.llm_keys already exists"
else
    echo "Creating ~/.llm_keys from template..."
    cp env_template.sh ~/.llm_keys
    chmod 600 ~/.llm_keys
    echo -e "${GREEN}[OK]${NC} Created ~/.llm_keys (remember to add your API keys)"
fi

# Check if source command is in shell profile
SHELL_RC=""
if [ -f ~/.zshrc ]; then
    SHELL_RC=~/.zshrc
elif [ -f ~/.bashrc ]; then
    SHELL_RC=~/.bashrc
fi

if [ -n "$SHELL_RC" ]; then
    if grep -q "source ~/.llm_keys" "$SHELL_RC"; then
        echo -e "${GREEN}[OK]${NC} Shell profile already sources ~/.llm_keys"
    else
        echo "Adding source command to $SHELL_RC..."
        echo -e "\n# Load LLM API keys\nsource ~/.llm_keys" >> "$SHELL_RC"
        echo -e "${GREEN}[OK]${NC} Added to $SHELL_RC"
    fi
fi

echo ""

# Phase 3: Install Python tools
echo "Phase 3: Installing Python tools..."
echo "------------------------------------"

PIP_CMD="pip"
if ! command -v pip &> /dev/null; then
    PIP_CMD="pip3"
fi

echo "Installing pdfplumber..."
$PIP_CMD install --quiet pdfplumber && echo -e "${GREEN}[OK]${NC} pdfplumber installed" || echo -e "${YELLOW}[WARN]${NC} pdfplumber failed"

echo "Installing chromadb..."
$PIP_CMD install --quiet chromadb && echo -e "${GREEN}[OK]${NC} chromadb installed" || echo -e "${YELLOW}[WARN]${NC} chromadb failed"

echo "Installing marker-pdf..."
$PIP_CMD install --quiet marker-pdf && echo -e "${GREEN}[OK]${NC} marker-pdf installed" || echo -e "${YELLOW}[WARN]${NC} marker-pdf failed"

echo ""

# Phase 4: Install Bun (if not present)
echo "Phase 4: Installing Bun..."
echo "--------------------------"

if check_installed bun; then
    echo "Bun already installed"
else
    echo "Installing Bun..."
    curl -fsSL https://bun.sh/install | bash
    export BUN_INSTALL="$HOME/.bun"
    export PATH="$BUN_INSTALL/bin:$PATH"
    echo -e "${GREEN}[OK]${NC} Bun installed"
fi

echo ""

# Phase 5: Setup Claude Canvas
echo "Phase 5: Setting up Claude Canvas..."
echo "-------------------------------------"

if [ -d "claude-canvas" ]; then
    cd claude-canvas
    echo "Installing Claude Canvas dependencies..."
    bun install --silent
    echo -e "${GREEN}[OK]${NC} Claude Canvas ready"
    cd ..
else
    echo -e "${YELLOW}[WARN]${NC} claude-canvas directory not found"
fi

echo ""

# Phase 6: Ollama reminder
echo "Phase 6: Ollama Setup..."
echo "------------------------"

if check_installed ollama; then
    echo "Pulling recommended models..."
    ollama pull llama3.2 2>/dev/null && echo -e "${GREEN}[OK]${NC} llama3.2 ready" || echo -e "${YELLOW}[WARN]${NC} Failed to pull llama3.2"
    ollama pull nomic-embed-text 2>/dev/null && echo -e "${GREEN}[OK]${NC} nomic-embed-text ready" || echo -e "${YELLOW}[WARN]${NC} Failed to pull nomic-embed-text"
else
    echo ""
    echo -e "${YELLOW}Ollama not installed. Install manually:${NC}"
    if [ "$OS" == "macos" ]; then
        echo "  Download from: https://ollama.com/download/mac"
    else
        echo "  curl -fsSL https://ollama.com/install.sh | sh"
    fi
    echo ""
    echo "Then run:"
    echo "  ollama pull llama3.2"
    echo "  ollama pull nomic-embed-text"
fi

echo ""
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Edit ~/.llm_keys and add your API keys"
echo "2. Run: source ~/.llm_keys"
echo "3. Install Ollama if not already installed"
echo "4. See SETUP_CHECKLIST.md for integration setup"
echo ""
echo "Verify installation:"
echo "  source ~/.llm_keys && echo \"Keys loaded\""
echo "  python3 -c \"import pdfplumber; print('pdfplumber OK')\""
echo "  bun --version"
echo ""
