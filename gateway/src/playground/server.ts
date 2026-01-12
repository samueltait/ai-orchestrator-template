/**
 * Playground Server - Interactive testing interface
 */

import { createGateway } from "../core/gateway";
import type { GatewayRequest, RoutingStrategy } from "../core/types";

const gateway = createGateway();

// HTML template for playground
const playgroundHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LLM Gateway Playground</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1a1a2e;
      color: #eee;
      min-height: 100vh;
      padding: 20px;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { color: #00d4ff; margin-bottom: 20px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .panel {
      background: #16213e;
      border-radius: 8px;
      padding: 20px;
    }
    h2 { color: #00d4ff; font-size: 1rem; margin-bottom: 15px; }
    label { display: block; margin-bottom: 5px; color: #888; font-size: 0.85rem; }
    textarea, select, input {
      width: 100%;
      padding: 10px;
      border: 1px solid #333;
      border-radius: 4px;
      background: #0f0f23;
      color: #eee;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 0.9rem;
    }
    textarea { min-height: 200px; resize: vertical; }
    select { cursor: pointer; }
    button {
      background: #00d4ff;
      color: #000;
      border: none;
      padding: 12px 24px;
      border-radius: 4px;
      font-weight: bold;
      cursor: pointer;
      margin-top: 15px;
    }
    button:hover { background: #00b8e6; }
    button:disabled { background: #555; cursor: not-allowed; }
    .options { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px; }
    .response-area {
      background: #0f0f23;
      border-radius: 4px;
      padding: 15px;
      min-height: 200px;
      white-space: pre-wrap;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 0.85rem;
      overflow-x: auto;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-top: 15px;
    }
    .stat {
      background: #0f0f23;
      padding: 10px;
      border-radius: 4px;
      text-align: center;
    }
    .stat-value { font-size: 1.2rem; color: #00d4ff; }
    .stat-label { font-size: 0.75rem; color: #888; }
    .error { color: #ff6b6b; }
    .success { color: #51cf66; }
    .loading { opacity: 0.5; }
  </style>
</head>
<body>
  <div class="container">
    <h1>LLM Gateway Playground</h1>

    <div class="grid">
      <div class="panel">
        <h2>Request</h2>
        <div class="options">
          <div>
            <label>Strategy</label>
            <select id="strategy">
              <option value="balanced">Balanced</option>
              <option value="cost_optimized">Cost Optimized</option>
              <option value="latency_optimized">Latency Optimized</option>
              <option value="quality_optimized">Quality Optimized</option>
            </select>
          </div>
          <div>
            <label>Provider (optional)</label>
            <select id="provider">
              <option value="">Auto</option>
              <option value="anthropic">Anthropic</option>
              <option value="openai">OpenAI</option>
              <option value="gemini">Gemini</option>
              <option value="ollama">Ollama</option>
            </select>
          </div>
        </div>

        <label>System Prompt (optional)</label>
        <textarea id="system" placeholder="You are a helpful assistant..."></textarea>

        <label style="margin-top: 15px;">User Message</label>
        <textarea id="prompt" placeholder="Enter your prompt here...">Hello! What's 2 + 2?</textarea>

        <div class="options" style="margin-top: 15px;">
          <div>
            <label>
              <input type="checkbox" id="cache" checked> Enable Cache
            </label>
          </div>
          <div>
            <label>
              <input type="checkbox" id="fallback" checked> Enable Fallback
            </label>
          </div>
        </div>

        <button id="send" onclick="sendRequest()">Send Request</button>
      </div>

      <div class="panel">
        <h2>Response</h2>
        <div id="response" class="response-area">Response will appear here...</div>

        <div class="stats">
          <div class="stat">
            <div class="stat-value" id="latency">-</div>
            <div class="stat-label">Latency (ms)</div>
          </div>
          <div class="stat">
            <div class="stat-value" id="cost">-</div>
            <div class="stat-label">Cost ($)</div>
          </div>
          <div class="stat">
            <div class="stat-value" id="tokens">-</div>
            <div class="stat-label">Tokens</div>
          </div>
          <div class="stat">
            <div class="stat-value" id="cached">-</div>
            <div class="stat-label">Cached</div>
          </div>
        </div>

        <h2 style="margin-top: 20px;">Routing Decision</h2>
        <div id="routing" class="response-area" style="min-height: 100px;">-</div>
      </div>
    </div>
  </div>

  <script>
    async function sendRequest() {
      const btn = document.getElementById('send');
      const responseEl = document.getElementById('response');
      const routingEl = document.getElementById('routing');

      btn.disabled = true;
      btn.textContent = 'Sending...';
      responseEl.textContent = 'Loading...';
      responseEl.className = 'response-area loading';

      try {
        const messages = [];

        const system = document.getElementById('system').value.trim();
        if (system) {
          messages.push({ role: 'system', content: system });
        }

        const prompt = document.getElementById('prompt').value.trim();
        if (!prompt) {
          throw new Error('Please enter a prompt');
        }
        messages.push({ role: 'user', content: prompt });

        const body = {
          messages,
          routing: {
            strategy: document.getElementById('strategy').value,
            cacheEnabled: document.getElementById('cache').checked,
            fallbackEnabled: document.getElementById('fallback').checked,
          }
        };

        const provider = document.getElementById('provider').value;
        if (provider) {
          body.routing.preferredProviders = [provider];
        }

        const res = await fetch('/api/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Request failed');
        }

        responseEl.textContent = data.content;
        responseEl.className = 'response-area success';

        document.getElementById('latency').textContent = data.latencyMs;
        document.getElementById('cost').textContent = data.cost.totalCost.toFixed(6);
        document.getElementById('tokens').textContent = data.usage.totalTokens;
        document.getElementById('cached').textContent = data.cached ? 'Yes' : 'No';

        routingEl.textContent = JSON.stringify(data.metadata.routingDecision, null, 2);

      } catch (err) {
        responseEl.textContent = 'Error: ' + err.message;
        responseEl.className = 'response-area error';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Send Request';
      }
    }
  </script>
</body>
</html>
`;

// Start server
const server = Bun.serve({
  port: 3456,
  async fetch(req) {
    const url = new URL(req.url);

    // Serve playground UI
    if (url.pathname === "/" || url.pathname === "/playground") {
      return new Response(playgroundHTML, {
        headers: { "Content-Type": "text/html" },
      });
    }

    // API endpoint
    if (url.pathname === "/api/complete" && req.method === "POST") {
      try {
        const body = (await req.json()) as {
          messages: Array<{ role: string; content: string }>;
          routing?: {
            strategy?: RoutingStrategy;
            cacheEnabled?: boolean;
            fallbackEnabled?: boolean;
            preferredProviders?: string[];
          };
        };

        const request: GatewayRequest = {
          id: `playground_${Date.now()}`,
          messages: body.messages.map((m) => ({
            role: m.role as "system" | "user" | "assistant",
            content: m.content,
          })),
          routing: body.routing as GatewayRequest["routing"],
        };

        const response = await gateway.complete(request);

        return Response.json(response);
      } catch (error) {
        const err = error as Error;
        return Response.json({ error: err.message }, { status: 500 });
      }
    }

    // Health check
    if (url.pathname === "/api/health") {
      const health = await gateway.healthCheck();
      return Response.json(health);
    }

    // Stats
    if (url.pathname === "/api/stats") {
      const stats = await gateway.getStats();
      return Response.json(stats);
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`
╔════════════════════════════════════════════════════════════════╗
║              LLM Gateway Playground Running                    ║
╚════════════════════════════════════════════════════════════════╝

  Open in browser: http://localhost:${server.port}

  API Endpoints:
    POST /api/complete  - Send completion request
    GET  /api/health    - Check provider health
    GET  /api/stats     - Get gateway statistics

  Press Ctrl+C to stop
`);
