# Documentation Index

**AI Assistant Template v2.0.0**

This folder contains extended documentation for the AI Assistant Template.

---

## Quick Reference

| Document | Purpose | When to Read |
|----------|---------|--------------|
| [CLI_REFERENCE.md](CLI_REFERENCE.md) | Actual CLI commands & wrapper scripts | Setting up CLI tools |
| [MODEL_REFERENCE.md](MODEL_REFERENCE.md) | Model versions & capabilities | Choosing the right model |
| [COST_TRACKING.md](COST_TRACKING.md) | Budget management & alerts | Managing API costs |
| [ERROR_HANDLING.md](ERROR_HANDLING.md) | Failure recovery examples | Debugging issues |
| [PERFORMANCE.md](PERFORMANCE.md) | Benchmarks & optimization | Improving speed/efficiency |
| [IPC_PROTOCOL.md](IPC_PROTOCOL.md) | Canvas IPC specification | Extending canvases |
| [PERMISSIONS.md](PERMISSIONS.md) | Claude Code permissions | Customizing permissions |
| [CANVAS_PLUGINS.md](CANVAS_PLUGINS.md) | Creating custom canvases | Building new canvas types |
| [PRD_WORKFLOW.md](PRD_WORKFLOW.md) | PRD creation & Notion integration | Planning new features |
| [PROTOTYPE_WORKFLOW.md](PROTOTYPE_WORKFLOW.md) | Iterative development stages | Building prototypes |

---

## Document Categories

### Getting Started
- Start with the main [README.md](../README.md)
- Follow [SETUP_CHECKLIST.md](../SETUP_CHECKLIST.md)
- Copy [CLAUDE.md](../CLAUDE.md) to your project

### CLI & Tools
- [CLI_REFERENCE.md](CLI_REFERENCE.md) - Which commands are real vs placeholders
- [MODEL_REFERENCE.md](MODEL_REFERENCE.md) - Model naming and versions

### Operations
- [COST_TRACKING.md](COST_TRACKING.md) - Monitor and control spending
- [ERROR_HANDLING.md](ERROR_HANDLING.md) - Handle failures gracefully
- [PERFORMANCE.md](PERFORMANCE.md) - Optimize for speed and cost

### Product Development
- [PRD_WORKFLOW.md](PRD_WORKFLOW.md) - Create and manage PRDs with Notion
- [PROTOTYPE_WORKFLOW.md](PROTOTYPE_WORKFLOW.md) - Iterative development stages

### Development
- [CANVAS_PLUGINS.md](CANVAS_PLUGINS.md) - Create custom canvas types
- [IPC_PROTOCOL.md](IPC_PROTOCOL.md) - Canvas communication protocol
- [PERMISSIONS.md](PERMISSIONS.md) - Configure Claude Code access

---

## Related Files

| File | Location | Purpose |
|------|----------|---------|
| Main README | `../README.md` | Project overview |
| Setup Guide | `../SETUP_CHECKLIST.md` | Installation steps |
| Tool Selection Guide | `../LLM_Orchestrator_Instructions.md` | Full tool selection patterns |
| OpenCode Guide | `../OpenCode_Quick_Start_Guide.md` | Autonomous coding |
| API Keys Template | `../env_template.sh` | Environment setup |
| Canvas Template | `../claude-canvas/canvas/src/canvases/TEMPLATE.tsx` | New canvas boilerplate |
| PRD Template | `../templates/PRD_TEMPLATE.md` | New PRD boilerplate |
| Spike Template | `../templates/SPIKE_TEMPLATE.md` | Technical spike template |
| Feedback Template | `../templates/FEEDBACK_TEMPLATE.md` | User testing feedback form |
| Feature Init Script | `../scripts/feature-init.sh` | Initialize new features |

---

## Contributing

When adding new documentation:

1. Create a new `.md` file in this folder
2. Add an entry to this index
3. Update the main README's documentation section
4. Update SETUP_CHECKLIST.md if relevant to setup
