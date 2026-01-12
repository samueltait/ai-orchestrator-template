# Canvas Plugin Development Guide

**Version:** 1.8.0 | **Updated:** 2026-01-11

This guide explains how to create custom canvas types for Claude Canvas.

---

## Architecture Overview

```
claude-canvas/
├── canvas/
│   └── src/
│       ├── cli.ts              # CLI entry point
│       ├── terminal.ts         # Terminal spawning
│       ├── canvases/           # Canvas implementations
│       │   ├── index.tsx       # Registry & render functions
│       │   ├── calendar.tsx    # Calendar canvas
│       │   ├── weather.tsx     # Weather canvas
│       │   ├── TEMPLATE.tsx    # Template for new canvases
│       │   └── [name]/         # Canvas subcomponents
│       ├── scenarios/          # Predefined configurations
│       ├── ipc/                # IPC protocol
│       └── components/         # Shared components
├── skills/                     # Claude Code skill documentation
└── package.json
```

---

## Quick Start: Create a New Canvas

### Step 1: Create Component File

Copy `TEMPLATE.tsx` and customize:

```bash
cp canvas/src/canvases/TEMPLATE.tsx canvas/src/canvases/mycanvas.tsx
```

### Step 2: Define Types

Create `canvas/src/canvases/mycanvas/types.ts`:

```typescript
export interface MyCanvasConfig {
  title?: string;
  data?: MyDataType[];
  refreshInterval?: number;
}

export interface MyDataType {
  id: string;
  name: string;
  value: number;
}
```

### Step 3: Implement Canvas Component

```typescript
// canvas/src/canvases/mycanvas.tsx
import React, { useState, useEffect } from "react";
import { Box, Text, useInput, useApp, useStdout } from "ink";
import { useIpcServer } from "../ipc/server";
import type { MyCanvasConfig } from "./mycanvas/types";

export function MyCanvas({
  id,
  config,
  socketPath,
  scenario = "display",
}: {
  id: string;
  config?: MyCanvasConfig;
  socketPath?: string;
  scenario?: string;
}) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const width = stdout?.columns || 80;

  const [data, setData] = useState(config?.data || []);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // IPC handler
  const handleIpc = (msg: any) => {
    switch (msg.type) {
      case "update":
        if (msg.config?.data) setData(msg.config.data);
        return { type: "ready", scenario };
      case "getSelection":
        return { type: "selection", data: data[selectedIndex] };
      case "close":
        exit();
        return null;
    }
    return null;
  };

  useIpcServer(id, handleIpc, socketPath);

  // Keyboard navigation
  useInput((input, key) => {
    if (key.escape || input === "q") exit();
    if (key.upArrow) setSelectedIndex((i) => Math.max(0, i - 1));
    if (key.downArrow) setSelectedIndex((i) => Math.min(data.length - 1, i + 1));
  });

  return (
    <Box flexDirection="column" width={width}>
      <Box borderStyle="single">
        <Text bold color="cyan">{config?.title || "My Canvas"}</Text>
      </Box>
      <Box flexDirection="column">
        {data.map((item, i) => (
          <Text key={item.id} color={i === selectedIndex ? "cyan" : undefined}>
            {i === selectedIndex ? "▶ " : "  "}{item.name}: {item.value}
          </Text>
        ))}
      </Box>
      <Text dimColor>↑/↓: Navigate | q: Quit</Text>
    </Box>
  );
}
```

### Step 4: Register in Index

Edit `canvas/src/canvases/index.tsx`:

```typescript
// Add import
import { MyCanvas } from "./mycanvas";
import type { MyCanvasConfig } from "./mycanvas/types";

// Add to switch statement in renderCanvas()
case "mycanvas":
  return renderMyCanvas(id, config as MyCanvasConfig | undefined, options);

// Add render function
async function renderMyCanvas(
  id: string,
  config?: MyCanvasConfig,
  options?: RenderOptions,
): Promise<void> {
  const { waitUntilExit } = render(
    <CanvasErrorBoundary canvasKind="mycanvas">
      <MyCanvas
        id={id}
        config={config}
        socketPath={options?.socketPath}
        scenario={options?.scenario || "display"}
      />
    </CanvasErrorBoundary>,
    { exitOnCtrlC: true },
  );
  await waitUntilExit();
}
```

### Step 5: Add Scenarios (Optional)

Create `canvas/src/scenarios/mycanvas/default.json`:

```json
{
  "title": "My Canvas - Default",
  "data": [
    { "id": "1", "name": "Item 1", "value": 100 },
    { "id": "2", "name": "Item 2", "value": 200 }
  ],
  "refreshInterval": 0
}
```

### Step 6: Add Skill Documentation

Create `canvas/skills/mycanvas/SKILL.md`:

```markdown
# MyCanvas Skill

Display custom data in an interactive terminal interface.

## Usage

\`\`\`bash
bun run canvas/src/cli.ts spawn mycanvas
bun run canvas/src/cli.ts spawn mycanvas --config '{"title":"Custom"}'
\`\`\`

## Configuration

| Field | Type | Description |
|-------|------|-------------|
| title | string | Canvas title |
| data | array | Items to display |
| refreshInterval | number | Auto-refresh (ms) |

## Keyboard Controls

- ↑/↓: Navigate items
- q: Quit canvas
```

### Step 7: Add Tests

Create `canvas/src/__tests__/mycanvas.test.ts`:

```typescript
import { test, expect, describe } from "bun:test";

describe("MyCanvas", () => {
  test("renders without error", async () => {
    const { MyCanvas } = await import("../canvases/mycanvas");
    expect(MyCanvas).toBeDefined();
  });

  test("handles empty data", () => {
    // Test with empty config
  });
});
```

---

## Component Patterns

### Data Fetching

```typescript
const [data, setData] = useState<DataType[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  async function fetchData() {
    try {
      setLoading(true);
      const response = await fetch(API_URL);
      const result = await response.json();
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }
  fetchData();
}, []);
```

### Auto-Refresh

```typescript
useEffect(() => {
  if (!config?.refreshInterval) return;

  const interval = setInterval(async () => {
    const newData = await fetchData();
    setData(newData);
  }, config.refreshInterval);

  return () => clearInterval(interval);
}, [config?.refreshInterval]);
```

### Mouse Support

```typescript
useInput(
  (input, key) => {
    // Handle mouse events via key.mouse
  },
  { isActive: true }
);
```

### Terminal Dimensions

```typescript
const { stdout } = useStdout();
const width = stdout?.columns || 80;
const height = stdout?.rows || 24;

// Calculate visible items based on height
const visibleItems = Math.max(1, height - 6); // Reserve for header/footer
```

---

## Styling Guide

### Colors

```typescript
// Available colors
<Text color="cyan">Primary</Text>
<Text color="green">Success</Text>
<Text color="yellow">Warning</Text>
<Text color="red">Error</Text>
<Text dimColor>Muted</Text>
<Text bold>Bold</Text>
<Text italic>Italic</Text>
<Text underline>Underline</Text>
```

### Box Styles

```typescript
<Box borderStyle="single">Single border</Box>
<Box borderStyle="double">Double border</Box>
<Box borderStyle="round">Rounded border</Box>
<Box borderStyle="bold">Bold border</Box>

<Box paddingX={1} paddingY={0}>Horizontal padding</Box>
<Box marginTop={1}>Top margin</Box>
```

### Layout

```typescript
// Vertical stack
<Box flexDirection="column">
  <Text>Row 1</Text>
  <Text>Row 2</Text>
</Box>

// Horizontal row
<Box flexDirection="row">
  <Text>Col 1</Text>
  <Text>Col 2</Text>
</Box>

// Grow to fill space
<Box flexGrow={1}>Fills available space</Box>

// Fixed width
<Box width={20}>Fixed 20 chars</Box>
```

---

## IPC Integration

### Server Setup

```typescript
import { useIpcServer } from "../ipc/server";

function MyCanvas({ id, socketPath }) {
  const handleMessage = (msg: IpcMessage): IpcMessage | null => {
    switch (msg.type) {
      case "update":
        // Handle update
        return { type: "ready", scenario: "display" };
      case "getSelection":
        return { type: "selection", data: currentSelection };
      default:
        return null;
    }
  };

  useIpcServer(id, handleMessage, socketPath);
}
```

### Sending Events

```typescript
// From canvas to controller (via IPC response)
return {
  type: "selected",
  data: {
    choice: selectedItem,
    timestamp: Date.now(),
  },
};
```

---

## Testing Locally

```bash
# Run in current terminal
bun run canvas/src/cli.ts show mycanvas

# Spawn in new pane/window
bun run canvas/src/cli.ts spawn mycanvas

# With custom config
bun run canvas/src/cli.ts spawn mycanvas --config '{"title":"Test"}'

# Run tests
bun test
```

---

## Checklist for New Canvas

- [ ] Create component file in `src/canvases/`
- [ ] Create types in `src/canvases/[name]/types.ts`
- [ ] Register in `src/canvases/index.tsx`
- [ ] Add scenario configs (optional)
- [ ] Add skill documentation in `skills/[name]/SKILL.md`
- [ ] Add tests in `src/__tests__/[name].test.ts`
- [ ] Update main README with new canvas type
- [ ] Test spawn in all terminals (iTerm2, tmux, Apple Terminal)

---

## Example Canvases

| Canvas | Complexity | Features |
|--------|------------|----------|
| weather | Simple | API fetch, auto-refresh |
| calendar | Medium | Date navigation, selection |
| document | Medium | Text editing, IPC |
| system | Complex | Process monitoring, graphs |
| flight | Complex | Multiple views, animations |

Study these implementations for patterns and best practices.
