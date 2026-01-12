# Canvas IPC Protocol

**Version:** 1.8.0 | **Updated:** 2026-01-11

This document describes the Inter-Process Communication (IPC) protocol used by Claude Canvas for communication between the CLI controller and canvas instances.

---

## Overview

Claude Canvas uses Unix domain sockets for IPC, enabling:
- Real-time updates to running canvases
- Data retrieval from canvas state
- Clean shutdown coordination
- Session tracking for pane reuse

---

## Socket Architecture

### Socket Location

```
/tmp/canvas-{id}.sock
```

Where `{id}` is the unique canvas instance ID (e.g., `calendar-1`, `weather-1`).

### Protocol

- **Transport:** Unix domain socket
- **Format:** Line-delimited JSON (newline-separated)
- **Direction:** Bidirectional
- **Encoding:** UTF-8

---

## Message Types

### Controller → Canvas Messages

#### `update`
Update canvas configuration at runtime.

```json
{
  "type": "update",
  "config": {
    "title": "New Title",
    "items": ["item1", "item2"]
  }
}
```

#### `getSelection`
Request current selection from canvas.

```json
{
  "type": "getSelection"
}
```

#### `getContent`
Request current content (document canvas).

```json
{
  "type": "getContent"
}
```

#### `close`
Request canvas to close gracefully.

```json
{
  "type": "close"
}
```

### Canvas → Controller Messages

#### `ready`
Canvas is initialized and ready.

```json
{
  "type": "ready",
  "scenario": "display"
}
```

#### `selection`
Response to `getSelection` request.

```json
{
  "type": "selection",
  "data": {
    "date": "2026-01-15",
    "time": "10:00"
  }
}
```

#### `content`
Response to `getContent` request.

```json
{
  "type": "content",
  "data": "# Document Title\n\nContent here..."
}
```

#### `selected`
User made a selection (interactive mode).

```json
{
  "type": "selected",
  "data": {
    "choice": "option1",
    "metadata": {}
  }
}
```

#### `cancelled`
User cancelled the interaction.

```json
{
  "type": "cancelled"
}
```

---

## Session Tracking Files

Used for pane reuse across canvas spawns:

| Terminal | File | Contents |
|----------|------|----------|
| tmux | `/tmp/claude-canvas-pane-id` | tmux pane ID (e.g., `%5`) |
| iTerm2 | `/tmp/claude-canvas-iterm2-session` | Session unique ID |
| Apple Terminal | `/tmp/claude-canvas-terminal-window` | Window ID (integer) |

---

## Implementation Examples

### TypeScript Server (Canvas Side)

```typescript
import { createServer, type Socket } from "net";

export function useIpcServer(
  id: string,
  handler: (msg: IpcMessage) => IpcMessage | null,
  socketPath?: string
) {
  const path = socketPath || `/tmp/canvas-${id}.sock`;

  // Remove stale socket
  try { unlinkSync(path); } catch {}

  const server = createServer((socket: Socket) => {
    let buffer = "";

    socket.on("data", (data) => {
      buffer += data.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const message = JSON.parse(line);
          const response = handler(message);
          if (response) {
            socket.write(JSON.stringify(response) + "\n");
          }
        } catch (e) {
          console.error("IPC parse error:", e);
        }
      }
    });
  });

  server.listen(path);
  return server;
}
```

### Bash Client (Controller Side)

```bash
#!/bin/bash
# Send message to running canvas

send_to_canvas() {
  local id=$1
  local message=$2
  local socket="/tmp/canvas-${id}.sock"

  if [ ! -S "$socket" ]; then
    echo "Error: Canvas $id not running"
    return 1
  fi

  echo "$message" | nc -U "$socket"
}

# Examples
send_to_canvas "calendar-1" '{"type":"update","config":{"title":"Updated"}}'
send_to_canvas "document-1" '{"type":"getContent"}'
send_to_canvas "weather-1" '{"type":"close"}'
```

### Bun Client (TypeScript)

```typescript
async function sendToCanvas(
  id: string,
  message: IpcMessage
): Promise<IpcMessage | null> {
  const socketPath = `/tmp/canvas-${id}.sock`;

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timeout")), 5000);

    Bun.connect({
      unix: socketPath,
      socket: {
        data(socket, data) {
          clearTimeout(timeout);
          const response = JSON.parse(data.toString().trim());
          resolve(response);
          socket.end();
        },
        open(socket) {
          socket.write(JSON.stringify(message) + "\n");
        },
        close() {
          clearTimeout(timeout);
          resolve(null);
        },
        error(socket, error) {
          clearTimeout(timeout);
          reject(error);
        },
      },
    });
  });
}

// Usage
const content = await sendToCanvas("document-1", { type: "getContent" });
```

---

## Error Handling

### Socket Not Found

```bash
if [ ! -S "/tmp/canvas-${id}.sock" ]; then
  echo "Canvas not running. Spawning new instance..."
  bun run canvas/src/cli.ts spawn $canvas_type --id $id
fi
```

### Stale Socket Cleanup

```typescript
// On canvas startup
const socketPath = `/tmp/canvas-${id}.sock`;
try {
  await Bun.file(socketPath).exists() && unlinkSync(socketPath);
} catch {}
```

### Timeout Protection

```typescript
const TIMEOUT_MS = 5000;

const response = await Promise.race([
  sendToCanvas(id, message),
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error("IPC timeout")), TIMEOUT_MS)
  ),
]);
```

---

## Canvas-Specific Protocols

### Calendar Canvas

```typescript
// Meeting picker response
{
  "type": "selected",
  "data": {
    "date": "2026-01-15",
    "time": "10:00",
    "duration": 60
  }
}
```

### Document Canvas

```typescript
// Get selection (highlighted text)
{ "type": "getSelection" }
// Response
{ "type": "selection", "data": { "start": 0, "end": 50, "text": "..." }}

// Get full content
{ "type": "getContent" }
// Response
{ "type": "content", "data": "# Full document content..." }
```

### Weather Canvas

```typescript
// Update location
{ "type": "update", "config": { "location": "New York, NY" }}

// Response includes current data
{
  "type": "ready",
  "scenario": "weather",
  "data": {
    "temperature": 72,
    "conditions": "Sunny"
  }
}
```

---

## Debugging

### Monitor Socket Traffic

```bash
# Watch for connections
sudo socat -v UNIX-LISTEN:/tmp/canvas-debug.sock,fork UNIX-CONNECT:/tmp/canvas-calendar-1.sock
```

### Check Socket Status

```bash
# List canvas sockets
ls -la /tmp/canvas-*.sock

# Check if socket is active
nc -zU /tmp/canvas-calendar-1.sock && echo "Active" || echo "Inactive"
```

### Log IPC Messages

```typescript
// Add to handler
const handleIpcMessage = (message: IpcMessage) => {
  console.error(`[IPC] Received: ${JSON.stringify(message)}`);
  const response = processMessage(message);
  console.error(`[IPC] Sending: ${JSON.stringify(response)}`);
  return response;
};
```

---

## Security Considerations

1. **Socket Permissions:** Created with user-only access (mode 0600)
2. **Local Only:** Unix sockets are not network-accessible
3. **No Authentication:** Trust is based on file system permissions
4. **Cleanup:** Sockets are removed on canvas exit

```bash
# Verify socket permissions
ls -la /tmp/canvas-*.sock
# Should show: srw------- (user read/write only)
```
