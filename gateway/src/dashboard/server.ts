/**
 * Dashboard Server - Real-time monitoring UI server
 */

import { MetricsCollector, getMetricsCollector, type DashboardState } from "./metrics-collector";

export interface DashboardServerConfig {
  port: number;
  host: string;
  cors: boolean;
  basePath: string;
}

const DEFAULT_CONFIG: DashboardServerConfig = {
  port: 3001,
  host: "0.0.0.0",
  cors: true,
  basePath: "/dashboard",
};

export class DashboardServer {
  private config: DashboardServerConfig;
  private collector: MetricsCollector;
  private server: ReturnType<typeof Bun.serve> | null = null;
  private sseClients: Set<ReadableStreamDefaultController<Uint8Array>> = new Set();

  constructor(
    collector: MetricsCollector,
    config: Partial<DashboardServerConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.collector = collector;

    // Subscribe to metrics updates
    this.collector.subscribe((state) => this.broadcast(state));
  }

  /**
   * Start the dashboard server
   */
  start(): void {
    if (this.server) return;

    const self = this;
    this.server = Bun.serve({
      port: this.config.port,
      hostname: this.config.host,
      fetch(req) {
        return self.handleRequest(req);
      },
    });

    console.log(`Dashboard running at http://${this.config.host}:${this.config.port}${this.config.basePath}`);
  }

  /**
   * Stop the dashboard server
   */
  stop(): void {
    if (this.server) {
      this.server.stop();
      this.server = null;
    }

    // Close all SSE connections
    for (const controller of this.sseClients) {
      try {
        controller.close();
      } catch {
        // Ignore close errors
      }
    }
    this.sseClients.clear();
  }

  /**
   * Get headers with optional CORS
   */
  private getHeaders(additionalHeaders: Record<string, string> = {}): Record<string, string> {
    const headers: Record<string, string> = { ...additionalHeaders };
    if (this.config.cors) {
      headers["Access-Control-Allow-Origin"] = "*";
      headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
      headers["Access-Control-Allow-Headers"] = "Content-Type";
    }
    return headers;
  }

  /**
   * Handle incoming requests
   */
  private async handleRequest(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

    if (req.method === "OPTIONS") {
      return new Response(null, { headers: this.getHeaders() });
    }

    // API routes
    if (path === `${this.config.basePath}/api/metrics`) {
      return new Response(JSON.stringify(this.collector.getState()), {
        headers: this.getHeaders({ "Content-Type": "application/json" }),
      });
    }

    if (path === `${this.config.basePath}/api/stream`) {
      return this.handleSSE();
    }

    if (path === `${this.config.basePath}/api/alerts/acknowledge` && req.method === "POST") {
      try {
        const body = await req.json() as { alertId: string };
        this.collector.acknowledgeAlert(body.alertId);
        return new Response(JSON.stringify({ success: true }), {
          headers: this.getHeaders({ "Content-Type": "application/json" }),
        });
      } catch {
        return new Response(JSON.stringify({ error: "Invalid request" }), {
          status: 400,
          headers: this.getHeaders({ "Content-Type": "application/json" }),
        });
      }
    }

    // Serve dashboard HTML
    if (path === this.config.basePath || path === `${this.config.basePath}/`) {
      return new Response(this.getDashboardHTML(), {
        headers: this.getHeaders({ "Content-Type": "text/html" }),
      });
    }

    return new Response("Not Found", { status: 404 });
  }

  /**
   * Handle SSE connection
   */
  private handleSSE(): Response {
    const self = this;

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        self.sseClients.add(controller);

        // Send initial state
        const state = self.collector.getState();
        const data = `data: ${JSON.stringify(state)}\n\n`;
        controller.enqueue(new TextEncoder().encode(data));
      },
      cancel() {
        // Client disconnected
      },
    });

    return new Response(stream, {
      headers: this.getHeaders({
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      }),
    });
  }

  /**
   * Broadcast state to all SSE clients
   */
  private broadcast(state: DashboardState): void {
    const data = `data: ${JSON.stringify(state)}\n\n`;
    const encoded = new TextEncoder().encode(data);

    for (const controller of this.sseClients) {
      try {
        controller.enqueue(encoded);
      } catch {
        // Client disconnected, remove from set
        this.sseClients.delete(controller);
      }
    }
  }

  /**
   * Get the dashboard HTML
   */
  private getDashboardHTML(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LLM Gateway Dashboard</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <style>
    :root {
      --bg-primary: #0f172a;
      --bg-secondary: #1e293b;
      --bg-tertiary: #334155;
      --text-primary: #f1f5f9;
      --text-secondary: #94a3b8;
      --accent-blue: #3b82f6;
      --accent-green: #22c55e;
      --accent-yellow: #eab308;
      --accent-red: #ef4444;
      --accent-purple: #a855f7;
      --border: #475569;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      min-height: 100vh;
    }

    .dashboard {
      padding: 20px;
      max-width: 1800px;
      margin: 0 auto;
    }

    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border);
    }

    header h1 {
      font-size: 24px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .status-indicator {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: var(--accent-green);
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    .status-indicator.disconnected {
      background: var(--accent-red);
      animation: none;
    }

    .header-stats {
      display: flex;
      gap: 24px;
      font-size: 14px;
      color: var(--text-secondary);
    }

    .header-stat {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .header-stat strong {
      color: var(--text-primary);
    }

    .grid {
      display: grid;
      gap: 20px;
    }

    .grid-4 {
      grid-template-columns: repeat(4, 1fr);
    }

    .grid-3 {
      grid-template-columns: repeat(3, 1fr);
    }

    .grid-2 {
      grid-template-columns: repeat(2, 1fr);
    }

    @media (max-width: 1200px) {
      .grid-4 { grid-template-columns: repeat(2, 1fr); }
      .grid-3 { grid-template-columns: repeat(2, 1fr); }
    }

    @media (max-width: 768px) {
      .grid-4, .grid-3, .grid-2 { grid-template-columns: 1fr; }
    }

    .card {
      background: var(--bg-secondary);
      border-radius: 12px;
      padding: 20px;
      border: 1px solid var(--border);
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .card-title {
      font-size: 14px;
      font-weight: 500;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .metric-card .value {
      font-size: 36px;
      font-weight: 700;
      margin-bottom: 4px;
    }

    .metric-card .change {
      font-size: 13px;
      color: var(--text-secondary);
    }

    .metric-card .change.positive { color: var(--accent-green); }
    .metric-card .change.negative { color: var(--accent-red); }

    .chart-container {
      height: 200px;
      position: relative;
    }

    .provider-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .provider-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px;
      background: var(--bg-tertiary);
      border-radius: 8px;
    }

    .provider-info {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .provider-status {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }

    .provider-status.healthy { background: var(--accent-green); }
    .provider-status.degraded { background: var(--accent-yellow); }
    .provider-status.down { background: var(--accent-red); }

    .provider-name {
      font-weight: 500;
    }

    .provider-metrics {
      display: flex;
      gap: 16px;
      font-size: 13px;
      color: var(--text-secondary);
    }

    .provider-metric {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
    }

    .provider-metric-value {
      color: var(--text-primary);
      font-weight: 500;
    }

    .cache-stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      text-align: center;
    }

    .cache-stat {
      padding: 16px;
      background: var(--bg-tertiary);
      border-radius: 8px;
    }

    .cache-stat-value {
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 4px;
    }

    .cache-stat-label {
      font-size: 12px;
      color: var(--text-secondary);
    }

    .cost-breakdown {
      margin-top: 16px;
    }

    .cost-bar {
      height: 8px;
      background: var(--bg-tertiary);
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 12px;
    }

    .cost-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--accent-green), var(--accent-yellow), var(--accent-red));
      border-radius: 4px;
      transition: width 0.3s ease;
    }

    .cost-providers {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .cost-provider {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      background: var(--bg-tertiary);
      border-radius: 6px;
      font-size: 13px;
    }

    .cost-provider-color {
      width: 8px;
      height: 8px;
      border-radius: 2px;
    }

    .alerts-container {
      max-height: 300px;
      overflow-y: auto;
    }

    .alert {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px;
      background: var(--bg-tertiary);
      border-radius: 8px;
      margin-bottom: 8px;
      border-left: 3px solid;
    }

    .alert.error { border-left-color: var(--accent-red); }
    .alert.warning { border-left-color: var(--accent-yellow); }
    .alert.info { border-left-color: var(--accent-blue); }

    .alert-content {
      flex: 1;
    }

    .alert-title {
      font-weight: 500;
      margin-bottom: 4px;
    }

    .alert-message {
      font-size: 13px;
      color: var(--text-secondary);
    }

    .alert-time {
      font-size: 12px;
      color: var(--text-secondary);
    }

    .alert-dismiss {
      background: none;
      border: none;
      color: var(--text-secondary);
      cursor: pointer;
      padding: 4px;
      font-size: 18px;
      line-height: 1;
    }

    .alert-dismiss:hover {
      color: var(--text-primary);
    }

    .request-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }

    .request-table th,
    .request-table td {
      padding: 10px 12px;
      text-align: left;
      border-bottom: 1px solid var(--border);
    }

    .request-table th {
      color: var(--text-secondary);
      font-weight: 500;
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.5px;
    }

    .request-table tr:hover {
      background: var(--bg-tertiary);
    }

    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 500;
    }

    .badge.success { background: rgba(34, 197, 94, 0.2); color: var(--accent-green); }
    .badge.error { background: rgba(239, 68, 68, 0.2); color: var(--accent-red); }
    .badge.cached { background: rgba(168, 85, 247, 0.2); color: var(--accent-purple); }

    .empty-state {
      text-align: center;
      padding: 40px;
      color: var(--text-secondary);
    }

    .section {
      margin-top: 20px;
    }

    .section-title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 16px;
    }
  </style>
</head>
<body>
  <div class="dashboard">
    <header>
      <h1>
        <span class="status-indicator" id="connectionStatus"></span>
        LLM Gateway Dashboard
      </h1>
      <div class="header-stats">
        <div class="header-stat">
          <span>Last Updated:</span>
          <strong id="lastUpdated">--</strong>
        </div>
        <div class="header-stat">
          <span>Uptime:</span>
          <strong id="uptime">--</strong>
        </div>
      </div>
    </header>

    <!-- Key Metrics -->
    <div class="grid grid-4">
      <div class="card metric-card">
        <div class="card-header">
          <span class="card-title">Requests / min</span>
        </div>
        <div class="value" id="requestsPerMin">0</div>
        <div class="change" id="requestsChange">--</div>
      </div>
      <div class="card metric-card">
        <div class="card-header">
          <span class="card-title">P95 Latency</span>
        </div>
        <div class="value" id="p95Latency">0ms</div>
        <div class="change" id="latencyChange">--</div>
      </div>
      <div class="card metric-card">
        <div class="card-header">
          <span class="card-title">Success Rate</span>
        </div>
        <div class="value" id="successRate">100%</div>
        <div class="change" id="successChange">--</div>
      </div>
      <div class="card metric-card">
        <div class="card-header">
          <span class="card-title">Total Cost</span>
        </div>
        <div class="value" id="totalCost">$0.00</div>
        <div class="change" id="costProjection">--</div>
      </div>
    </div>

    <!-- Charts -->
    <div class="section">
      <div class="grid grid-2">
        <div class="card">
          <div class="card-header">
            <span class="card-title">Request Volume</span>
          </div>
          <div class="chart-container">
            <canvas id="requestChart"></canvas>
          </div>
        </div>
        <div class="card">
          <div class="card-header">
            <span class="card-title">Latency (P95)</span>
          </div>
          <div class="chart-container">
            <canvas id="latencyChart"></canvas>
          </div>
        </div>
      </div>
    </div>

    <!-- Provider Health & Cache Stats -->
    <div class="section">
      <div class="grid grid-2">
        <div class="card">
          <div class="card-header">
            <span class="card-title">Provider Health</span>
          </div>
          <div class="provider-list" id="providerList">
            <div class="empty-state">No providers active</div>
          </div>
        </div>
        <div class="card">
          <div class="card-header">
            <span class="card-title">Cache Performance</span>
          </div>
          <div class="cache-stats">
            <div class="cache-stat">
              <div class="cache-stat-value" id="cacheHitRate">0%</div>
              <div class="cache-stat-label">Hit Rate</div>
            </div>
            <div class="cache-stat">
              <div class="cache-stat-value" id="cacheSavedCost">$0.00</div>
              <div class="cache-stat-label">Cost Saved</div>
            </div>
            <div class="cache-stat">
              <div class="cache-stat-value" id="cacheSavedLatency">0ms</div>
              <div class="cache-stat-label">Latency Saved</div>
            </div>
          </div>
          <div class="chart-container" style="margin-top: 16px;">
            <canvas id="cacheChart"></canvas>
          </div>
        </div>
      </div>
    </div>

    <!-- Cost & Alerts -->
    <div class="section">
      <div class="grid grid-2">
        <div class="card">
          <div class="card-header">
            <span class="card-title">Cost Breakdown</span>
          </div>
          <div class="cost-breakdown">
            <div class="cost-bar">
              <div class="cost-bar-fill" id="budgetBar" style="width: 0%"></div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 16px; font-size: 13px;">
              <span>Budget Used: <strong id="budgetUsed">0%</strong></span>
              <span>Projected Daily: <strong id="projectedDaily">$0.00</strong></span>
            </div>
            <div class="cost-providers" id="costProviders"></div>
          </div>
        </div>
        <div class="card">
          <div class="card-header">
            <span class="card-title">Active Alerts</span>
          </div>
          <div class="alerts-container" id="alertsContainer">
            <div class="empty-state">No active alerts</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Recent Requests -->
    <div class="section">
      <div class="card">
        <div class="card-header">
          <span class="card-title">Recent Requests</span>
        </div>
        <div style="overflow-x: auto;">
          <table class="request-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Provider</th>
                <th>Model</th>
                <th>Latency</th>
                <th>Tokens</th>
                <th>Cost</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody id="requestsTable">
              <tr><td colspan="7" class="empty-state">No requests yet</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

  <script>
    const basePath = window.location.pathname.replace(/\\/$/, '');
    let eventSource = null;
    let charts = {};
    const startTime = Date.now();
    const providerColors = {
      anthropic: '#d97706',
      openai: '#22c55e',
      gemini: '#3b82f6',
      ollama: '#a855f7',
    };

    // Initialize charts
    function initCharts() {
      const chartConfig = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
        scales: {
          x: {
            display: false,
          },
          y: {
            grid: { color: 'rgba(71, 85, 105, 0.3)' },
            ticks: { color: '#94a3b8' },
          },
        },
      };

      charts.requests = new Chart(document.getElementById('requestChart'), {
        type: 'line',
        data: {
          labels: [],
          datasets: [{
            data: [],
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            fill: true,
            tension: 0.4,
          }],
        },
        options: chartConfig,
      });

      charts.latency = new Chart(document.getElementById('latencyChart'), {
        type: 'line',
        data: {
          labels: [],
          datasets: [{
            data: [],
            borderColor: '#22c55e',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            fill: true,
            tension: 0.4,
          }],
        },
        options: chartConfig,
      });

      charts.cache = new Chart(document.getElementById('cacheChart'), {
        type: 'line',
        data: {
          labels: [],
          datasets: [{
            data: [],
            borderColor: '#a855f7',
            backgroundColor: 'rgba(168, 85, 247, 0.1)',
            fill: true,
            tension: 0.4,
          }],
        },
        options: chartConfig,
      });
    }

    // Connect to SSE
    function connect() {
      if (eventSource) {
        eventSource.close();
      }

      eventSource = new EventSource(basePath + '/api/stream');

      eventSource.onopen = () => {
        document.getElementById('connectionStatus').classList.remove('disconnected');
      };

      eventSource.onmessage = (event) => {
        const state = JSON.parse(event.data);
        updateDashboard(state);
      };

      eventSource.onerror = () => {
        document.getElementById('connectionStatus').classList.add('disconnected');
        setTimeout(connect, 5000);
      };
    }

    // Update dashboard with new state
    function updateDashboard(state) {
      const { current, timeSeries, recentRequests, alerts } = state;

      // Update last updated time
      document.getElementById('lastUpdated').textContent = new Date().toLocaleTimeString();

      // Update uptime
      const uptimeMs = Date.now() - startTime;
      const uptimeMin = Math.floor(uptimeMs / 60000);
      document.getElementById('uptime').textContent = uptimeMin < 60
        ? uptimeMin + 'm'
        : Math.floor(uptimeMin / 60) + 'h ' + (uptimeMin % 60) + 'm';

      // Update key metrics
      document.getElementById('requestsPerMin').textContent = current.requests.total;
      document.getElementById('p95Latency').textContent = Math.round(current.latency.p95) + 'ms';

      const successRate = current.requests.total > 0
        ? ((current.requests.successful / current.requests.total) * 100).toFixed(1)
        : '100';
      document.getElementById('successRate').textContent = successRate + '%';
      document.getElementById('totalCost').textContent = '$' + current.cost.totalCost.toFixed(4);
      document.getElementById('costProjection').textContent =
        'Projected: $' + current.cost.projectedDaily.toFixed(2) + '/day';

      // Update charts
      updateChart(charts.requests, timeSeries.requests);
      updateChart(charts.latency, timeSeries.latency);
      updateChart(charts.cache, timeSeries.cacheHitRate);

      // Update provider health
      updateProviders(current.providers);

      // Update cache stats
      document.getElementById('cacheHitRate').textContent = current.cache.hitRate.toFixed(1) + '%';
      document.getElementById('cacheSavedCost').textContent = '$' + current.cache.savedCost.toFixed(4);
      document.getElementById('cacheSavedLatency').textContent = Math.round(current.cache.savedLatencyMs) + 'ms';

      // Update cost breakdown
      document.getElementById('budgetBar').style.width = Math.min(current.cost.budgetUsed, 100) + '%';
      document.getElementById('budgetUsed').textContent = current.cost.budgetUsed.toFixed(1) + '%';
      document.getElementById('projectedDaily').textContent = '$' + current.cost.projectedDaily.toFixed(2);
      updateCostProviders(current.cost.costByProvider);

      // Update alerts
      updateAlerts(alerts);

      // Update recent requests
      updateRecentRequests(recentRequests);
    }

    function updateChart(chart, data) {
      const labels = data.map(p => new Date(p.timestamp).toLocaleTimeString());
      const values = data.map(p => p.value);
      chart.data.labels = labels;
      chart.data.datasets[0].data = values;
      chart.update('none');
    }

    function updateProviders(providers) {
      const container = document.getElementById('providerList');
      if (providers.length === 0) {
        container.innerHTML = '<div class="empty-state">No providers active</div>';
        return;
      }

      container.innerHTML = providers.map(p => \`
        <div class="provider-item">
          <div class="provider-info">
            <div class="provider-status \${p.status}"></div>
            <span class="provider-name">\${p.provider}</span>
          </div>
          <div class="provider-metrics">
            <div class="provider-metric">
              <span class="provider-metric-value">\${Math.round(p.latencyP95)}ms</span>
              <span>P95</span>
            </div>
            <div class="provider-metric">
              <span class="provider-metric-value">\${p.successRate.toFixed(1)}%</span>
              <span>Success</span>
            </div>
            <div class="provider-metric">
              <span class="provider-metric-value">\${p.requestCount}</span>
              <span>Requests</span>
            </div>
          </div>
        </div>
      \`).join('');
    }

    function updateCostProviders(costByProvider) {
      const container = document.getElementById('costProviders');
      const entries = Object.entries(costByProvider);
      if (entries.length === 0) {
        container.innerHTML = '<span class="empty-state">No cost data</span>';
        return;
      }

      container.innerHTML = entries.map(([provider, cost]) => \`
        <div class="cost-provider">
          <div class="cost-provider-color" style="background: \${providerColors[provider] || '#64748b'}"></div>
          <span>\${provider}: $\${cost.toFixed(4)}</span>
        </div>
      \`).join('');
    }

    function updateAlerts(alerts) {
      const container = document.getElementById('alertsContainer');
      if (alerts.length === 0) {
        container.innerHTML = '<div class="empty-state">No active alerts</div>';
        return;
      }

      container.innerHTML = alerts.map(a => \`
        <div class="alert \${a.type}">
          <div class="alert-content">
            <div class="alert-title">\${a.title}</div>
            <div class="alert-message">\${a.message}</div>
            <div class="alert-time">\${new Date(a.timestamp).toLocaleTimeString()}</div>
          </div>
          <button class="alert-dismiss" onclick="dismissAlert('\${a.id}')">&times;</button>
        </div>
      \`).join('');
    }

    function updateRecentRequests(requests) {
      const tbody = document.getElementById('requestsTable');
      if (requests.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No requests yet</td></tr>';
        return;
      }

      tbody.innerHTML = requests.slice(0, 20).map(r => \`
        <tr>
          <td>\${new Date(r.timestamp).toLocaleTimeString()}</td>
          <td>\${r.provider}</td>
          <td>\${r.model}</td>
          <td>\${Math.round(r.latencyMs)}ms</td>
          <td>\${r.inputTokens + r.outputTokens}</td>
          <td>$\${r.cost.toFixed(6)}</td>
          <td>
            \${r.cached ? '<span class="badge cached">Cached</span>' : ''}
            \${r.success
              ? '<span class="badge success">Success</span>'
              : '<span class="badge error">Error</span>'}
          </td>
        </tr>
      \`).join('');
    }

    async function dismissAlert(alertId) {
      try {
        await fetch(basePath + '/api/alerts/acknowledge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ alertId }),
        });
      } catch (e) {
        console.error('Failed to dismiss alert:', e);
      }
    }

    // Initialize
    initCharts();
    connect();

    // Fallback polling if SSE fails
    setInterval(async () => {
      if (eventSource?.readyState !== EventSource.OPEN) {
        try {
          const res = await fetch(basePath + '/api/metrics');
          const state = await res.json();
          updateDashboard(state);
        } catch (e) {
          console.error('Polling failed:', e);
        }
      }
    }, 5000);
  </script>
</body>
</html>`;
  }
}

/**
 * Create and start dashboard server
 */
export function createDashboardServer(
  config?: Partial<DashboardServerConfig>
): DashboardServer {
  const collector = getMetricsCollector();
  collector.start();
  const server = new DashboardServer(collector, config);
  server.start();
  return server;
}
