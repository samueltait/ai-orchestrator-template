# PRD Workflow Guide

**Version:** 1.0.0 | **Updated:** 2026-01-12

A structured workflow for creating and managing Product Requirements Documents (PRDs) with Notion integration.

---

## Quick Reference

| Action | Command |
|--------|---------|
| Create new PRD | `./scripts/feature-init.sh "feature-name"` |
| Sync to Notion | `notion_cli prd create --file docs/prds/feature-name.md` |
| Update status | `notion_cli prd update --id $PRD_ID --status "In Development"` |
| List PRDs | `notion_cli prd list --status "Approved"` |

---

## PRD Structure

Every PRD follows this structured format (see `templates/PRD_TEMPLATE.md`):

### Header
```markdown
# [Feature Name] PRD

**Status:** Draft | In Review | Approved | In Development | Complete
**Created:** YYYY-MM-DD | **Updated:** YYYY-MM-DD
**Author:** [Name]
**Notion:** [Link to Notion page]
```

### Required Sections

| Section | Purpose | Guidance |
|---------|---------|----------|
| **Problem Statement** | What problem and who experiences it | 2-3 sentences, user-focused |
| **Goals & Success Metrics** | Measurable outcomes | 2-4 goals with specific metrics |
| **Requirements** | What must be built | Prioritized: P0 (must), P1 (should), P2 (nice) |
| **Technical Approach** | How to build it | High-level approach, key decisions |
| **Open Questions** | Unresolved issues | Track with checkboxes |
| **References** | Related materials | Links to designs, research, related PRDs |

---

## Status Flow

```
Draft → In Review → Approved → In Development → Complete
                 ↓
              Rejected (with feedback)
```

| Status | Meaning | Next Actions |
|--------|---------|--------------|
| **Draft** | Initial creation, incomplete | Fill out all sections |
| **In Review** | Ready for stakeholder feedback | Gather comments, resolve questions |
| **Approved** | Ready for development | Begin spike/prototype |
| **In Development** | Active work in progress | Update progress in Notion |
| **Complete** | Feature shipped | Archive, link to release notes |
| **Rejected** | Not moving forward | Document reasons, archive |

---

## Notion Integration

### Database Setup

1. Create a Notion database with the schema in `templates/notion-schemas/prd-database.json`
2. Add your Notion API key to `~/.llm_keys`:
   ```bash
   export NOTION_API_KEY="secret_your-token"
   export NOTION_PRD_DATABASE_ID="your-database-id"
   ```
3. Share the database with your Notion integration

### Database Properties

| Property | Type | Values |
|----------|------|--------|
| Name | Title | Feature name |
| Status | Select | Draft, In Review, Approved, In Development, Complete, Rejected |
| Priority | Select | P0, P1, P2 |
| Author | Person | Team member |
| Created | Date | Auto-set |
| Updated | Date | Auto-updated |
| Stage | Select | PRD, Spike, Prototype, Testing, Iterate, Production |
| Tags | Multi-select | Custom tags |
| Link | URL | Link to local PRD file or repo |

### CLI Commands

```bash
# Create PRD in Notion from local file
notion_cli prd create --file docs/prds/feature-name.md

# Sync local PRD to existing Notion page
notion_cli prd sync --id $PAGE_ID --file docs/prds/feature-name.md

# Update status
notion_cli prd update --id $PAGE_ID --status "Approved" --stage "Spike"

# List PRDs by status
notion_cli prd list --status "In Development"

# List PRDs by stage
notion_cli prd list --stage "Prototype"

# Export Notion PRD to local markdown
notion_cli prd export --id $PAGE_ID --output docs/prds/feature-name.md
```

### Notion API Direct Access

If using the Notion API directly:

```bash
# Create a new PRD page
curl -X POST "https://api.notion.com/v1/pages" \
  -H "Authorization: Bearer $NOTION_API_KEY" \
  -H "Notion-Version: 2022-06-28" \
  -H "Content-Type: application/json" \
  -d '{
    "parent": { "database_id": "'$NOTION_PRD_DATABASE_ID'" },
    "properties": {
      "Name": { "title": [{ "text": { "content": "Feature Name" } }] },
      "Status": { "select": { "name": "Draft" } },
      "Priority": { "select": { "name": "P1" } },
      "Stage": { "select": { "name": "PRD" } }
    }
  }'

# Update PRD status
curl -X PATCH "https://api.notion.com/v1/pages/$PAGE_ID" \
  -H "Authorization: Bearer $NOTION_API_KEY" \
  -H "Notion-Version: 2022-06-28" \
  -H "Content-Type: application/json" \
  -d '{
    "properties": {
      "Status": { "select": { "name": "Approved" } },
      "Stage": { "select": { "name": "Spike" } }
    }
  }'

# Query PRDs by status
curl -X POST "https://api.notion.com/v1/databases/$NOTION_PRD_DATABASE_ID/query" \
  -H "Authorization: Bearer $NOTION_API_KEY" \
  -H "Notion-Version: 2022-06-28" \
  -H "Content-Type: application/json" \
  -d '{
    "filter": {
      "property": "Status",
      "select": { "equals": "In Development" }
    }
  }'
```

---

## Creating a New PRD

### 1. Initialize Feature

```bash
# Create PRD from template
./scripts/feature-init.sh "user-authentication"

# This creates:
# - docs/prds/user-authentication.md (from template)
# - Optionally creates Notion page
```

### 2. Fill Out Template

Edit `docs/prds/user-authentication.md`:

```markdown
# User Authentication PRD

**Status:** Draft
**Created:** 2026-01-12 | **Updated:** 2026-01-12
**Author:** Sam
**Notion:** [Link after sync]

## Problem Statement

Users currently have no way to create accounts or log in to the application.
This prevents personalization, saved preferences, and secure access to user-specific data.

## Goals & Success Metrics

| Goal | Metric | Target |
|------|--------|--------|
| Enable user registration | Registration completion rate | >80% |
| Secure authentication | Zero security incidents | 0 |
| Fast login experience | Login time | <2 seconds |

## Requirements

### Must Have (P0)
- [ ] Email/password registration
- [ ] Email/password login
- [ ] Password reset flow
- [ ] Session management

### Should Have (P1)
- [ ] OAuth (Google, GitHub)
- [ ] Remember me functionality
- [ ] Account settings page

### Nice to Have (P2)
- [ ] Two-factor authentication
- [ ] Social profile import

## Technical Approach

- Use JWT tokens for session management
- Store passwords with bcrypt (cost factor 12)
- OAuth via Passport.js
- Rate limiting on auth endpoints

## Open Questions

- [ ] Should we support SSO for enterprise customers?
- [ ] What's the session timeout policy?

## References

- [Design mockups](link-to-figma)
- [Security requirements](link-to-doc)
```

### 3. Sync to Notion

```bash
# Create Notion page from PRD
notion_cli prd create --file docs/prds/user-authentication.md

# Update PRD with Notion link
# Add the returned page URL to the PRD header
```

### 4. Request Review

- Update status to "In Review"
- Share Notion page with stakeholders
- Collect feedback in Notion comments
- Resolve open questions

### 5. Get Approval

- Address all feedback
- Resolve all open questions
- Update status to "Approved"
- Ready for development

---

## PRD Review Checklist

Before moving a PRD to "Approved":

- [ ] Problem statement is clear and user-focused
- [ ] Goals have measurable success metrics
- [ ] All P0 requirements are necessary and sufficient
- [ ] Technical approach is validated (spike complete if needed)
- [ ] All open questions are resolved
- [ ] Stakeholders have reviewed and approved
- [ ] Notion page is synced and up-to-date

---

## Best Practices

### Writing Good Problem Statements

**Good:**
> Users lose their shopping cart contents when they close the browser, leading to abandoned purchases and frustration.

**Bad:**
> We need a cart persistence feature.

### Writing Good Requirements

**Good:**
> - [ ] Cart contents persist for 30 days after last modification
> - [ ] Users see a "cart restored" notification on return

**Bad:**
> - [ ] Make carts persist
> - [ ] Show notification

### Prioritization Guidelines

| Priority | Criteria |
|----------|----------|
| **P0 (Must Have)** | Feature doesn't work without it |
| **P1 (Should Have)** | Significantly improves value, but workarounds exist |
| **P2 (Nice to Have)** | Polish, convenience, future-proofing |

---

## Integration with Development Workflow

PRDs feed into the prototype development workflow:

```
PRD (this doc) → Spike → Prototype → User Testing → Iterate → Production
```

Once a PRD is approved:
1. Update stage to "Spike" in Notion
2. Create spike document (see `PROTOTYPE_WORKFLOW.md`)
3. Validate technical approach
4. Begin prototype development

See `docs/PROTOTYPE_WORKFLOW.md` for the full development workflow.

---

## Related Documentation

| Document | Purpose |
|----------|---------|
| `PROTOTYPE_WORKFLOW.md` | Development stages after PRD approval |
| `templates/PRD_TEMPLATE.md` | Blank PRD template to copy |
| `templates/notion-schemas/prd-database.json` | Notion database schema |
