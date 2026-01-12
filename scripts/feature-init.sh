#!/bin/bash
#
# feature-init.sh - Initialize a new feature with PRD and Notion tracking
#
# Usage:
#   ./scripts/feature-init.sh "feature-name"
#   ./scripts/feature-init.sh "feature-name" --no-notion
#
# This script:
#   1. Creates a PRD from template in docs/prds/
#   2. Optionally creates a Notion page for tracking
#   3. Opens the PRD in your default editor

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the script's directory (to find templates)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Configuration
TEMPLATE_PATH="$PROJECT_ROOT/templates/PRD_TEMPLATE.md"
PRDS_DIR="$PROJECT_ROOT/docs/prds"

# Parse arguments
FEATURE_NAME=""
CREATE_NOTION=true

while [[ $# -gt 0 ]]; do
    case $1 in
        --no-notion)
            CREATE_NOTION=false
            shift
            ;;
        --help|-h)
            echo "Usage: $0 <feature-name> [--no-notion]"
            echo ""
            echo "Initialize a new feature with PRD and optional Notion tracking."
            echo ""
            echo "Arguments:"
            echo "  feature-name    Name of the feature (use-kebab-case)"
            echo ""
            echo "Options:"
            echo "  --no-notion     Skip Notion page creation"
            echo "  --help, -h      Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0 user-authentication"
            echo "  $0 payment-integration --no-notion"
            exit 0
            ;;
        *)
            FEATURE_NAME="$1"
            shift
            ;;
    esac
done

# Validate feature name
if [ -z "$FEATURE_NAME" ]; then
    echo -e "${RED}Error: Feature name is required${NC}"
    echo "Usage: $0 <feature-name> [--no-notion]"
    exit 1
fi

# Convert feature name to kebab-case (lowercase, spaces to hyphens)
FEATURE_SLUG=$(echo "$FEATURE_NAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -cd '[:alnum:]-')

# Paths
PRD_PATH="$PRDS_DIR/$FEATURE_SLUG.md"

echo -e "${BLUE}Initializing feature: ${GREEN}$FEATURE_NAME${NC}"
echo ""

# Check if PRD already exists
if [ -f "$PRD_PATH" ]; then
    echo -e "${YELLOW}Warning: PRD already exists at $PRD_PATH${NC}"
    read -p "Overwrite? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 1
    fi
fi

# Create PRDs directory if it doesn't exist
mkdir -p "$PRDS_DIR"

# Check template exists
if [ ! -f "$TEMPLATE_PATH" ]; then
    echo -e "${RED}Error: Template not found at $TEMPLATE_PATH${NC}"
    exit 1
fi

# Create PRD from template
echo -e "${BLUE}Creating PRD...${NC}"
cp "$TEMPLATE_PATH" "$PRD_PATH"

# Replace placeholders in PRD
TODAY=$(date +%Y-%m-%d)
FEATURE_TITLE=$(echo "$FEATURE_NAME" | sed 's/-/ /g' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) tolower(substr($i,2))}1')

# Use sed to replace placeholders (cross-platform)
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s/\[Feature Name\]/$FEATURE_TITLE/g" "$PRD_PATH"
    sed -i '' "s/YYYY-MM-DD/$TODAY/g" "$PRD_PATH"
else
    # Linux
    sed -i "s/\[Feature Name\]/$FEATURE_TITLE/g" "$PRD_PATH"
    sed -i "s/YYYY-MM-DD/$TODAY/g" "$PRD_PATH"
fi

echo -e "${GREEN}Created: $PRD_PATH${NC}"

# Create Notion page if enabled and API key is set
NOTION_PAGE_URL=""
if [ "$CREATE_NOTION" = true ]; then
    if [ -n "$NOTION_API_KEY" ] && [ -n "$NOTION_PRD_DATABASE_ID" ]; then
        echo -e "${BLUE}Creating Notion page...${NC}"

        # Create Notion page via API
        RESPONSE=$(curl -s -X POST "https://api.notion.com/v1/pages" \
            -H "Authorization: Bearer $NOTION_API_KEY" \
            -H "Notion-Version: 2022-06-28" \
            -H "Content-Type: application/json" \
            -d "{
                \"parent\": { \"database_id\": \"$NOTION_PRD_DATABASE_ID\" },
                \"properties\": {
                    \"Name\": { \"title\": [{ \"text\": { \"content\": \"$FEATURE_TITLE\" } }] },
                    \"Status\": { \"select\": { \"name\": \"Draft\" } },
                    \"Stage\": { \"select\": { \"name\": \"PRD\" } },
                    \"Priority\": { \"select\": { \"name\": \"P1\" } }
                }
            }")

        # Extract page URL from response
        NOTION_PAGE_URL=$(echo "$RESPONSE" | grep -o '"url":"[^"]*"' | head -1 | cut -d'"' -f4)

        if [ -n "$NOTION_PAGE_URL" ]; then
            echo -e "${GREEN}Created Notion page: $NOTION_PAGE_URL${NC}"

            # Update PRD with Notion link
            if [[ "$OSTYPE" == "darwin"* ]]; then
                sed -i '' "s|\[Link after sync\]|$NOTION_PAGE_URL|g" "$PRD_PATH"
            else
                sed -i "s|\[Link after sync\]|$NOTION_PAGE_URL|g" "$PRD_PATH"
            fi
        else
            echo -e "${YELLOW}Warning: Failed to create Notion page${NC}"
            echo "Response: $RESPONSE"
        fi
    else
        echo -e "${YELLOW}Skipping Notion: NOTION_API_KEY or NOTION_PRD_DATABASE_ID not set${NC}"
        echo "Set these in ~/.llm_keys to enable Notion integration"
    fi
fi

# Summary
echo ""
echo -e "${GREEN}Feature initialized successfully!${NC}"
echo ""
echo "Files created:"
echo "  - PRD: $PRD_PATH"
if [ -n "$NOTION_PAGE_URL" ]; then
    echo "  - Notion: $NOTION_PAGE_URL"
fi
echo ""
echo "Next steps:"
echo "  1. Edit the PRD: $PRD_PATH"
echo "  2. Fill out all sections"
echo "  3. Update status to 'In Review' when ready"
echo "  4. See docs/PRD_WORKFLOW.md for guidance"
echo ""

# Open PRD in editor if EDITOR is set
if [ -n "$EDITOR" ]; then
    read -p "Open PRD in $EDITOR? (Y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        $EDITOR "$PRD_PATH"
    fi
fi
