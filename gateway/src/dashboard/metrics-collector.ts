/**
 * Metrics Collector - Aggregates gateway metrics for dashboard
 */

import type { GatewayRequest, GatewayResponse, GatewayConfig } from "../core/types";

export interface RequestMetric {
  id: string;
  timestamp: number;
  provider: string;
  model: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  cached: boolean;
  success: boolean;
  error?: string;
}

export interface ProviderHealth {
  provider: string;
  status: "healthy" | "degraded" | "down";
  latencyP50: number;
  latencyP95: number;
  latencyP99: number;
  successRate: number;
  requestCount: number;
  circuitState: "closed" | "open" | "half-open";
  lastError?: string;
  lastErrorTime?: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  avgSimilarity: number;
  savedCost: number;
  savedLatencyMs: number;
}

export interface CostMetrics {
  totalCost: number;
  costByProvider: Record<string, number>;
  costByModel: Record<string, number>;
  budget: number;
  budgetUsed: number;
  projectedDaily: number;
  projectedMonthly: number;
}

export interface AggregatedMetrics {
  timestamp: number;
  windowMs: number;
  requests: {
    total: number;
    successful: number;
    failed: number;
    cached: number;
  };
  latency: {
    avg: number;
    p50: number;
    p95: number;
    p99: number;
    min: number;
    max: number;
  };
  tokens: {
    input: number;
    output: number;
    total: number;
  };
  providers: ProviderHealth[];
  cache: CacheStats;
  cost: CostMetrics;
}

export interface TimeSeriesPoint {
  timestamp: number;
  value: number;
}

export interface DashboardState {
  current: AggregatedMetrics;
  timeSeries: {
    requests: TimeSeriesPoint[];
    latency: TimeSeriesPoint[];
    cost: TimeSeriesPoint[];
    cacheHitRate: TimeSeriesPoint[];
    tokensPerSecond: TimeSeriesPoint[];
  };
  recentRequests: RequestMetric[];
  alerts: DashboardAlert[];
}

export interface DashboardAlert {
  id: string;
  type: "error" | "warning" | "info";
  title: string;
  message: string;
  timestamp: number;
  acknowledged: boolean;
}

export interface MetricsCollectorConfig {
  retentionMs: number;
  aggregationWindowMs: number;
  maxRecentRequests: number;
  maxTimeSeriesPoints: number;
  alertThresholds: {
    errorRatePercent: number;
    latencyP95Ms: number;
    budgetUsedPercent: number;
    cacheHitRatePercent: number;
  };
}

const DEFAULT_CONFIG: MetricsCollectorConfig = {
  retentionMs: 24 * 60 * 60 * 1000, // 24 hours
  aggregationWindowMs: 60 * 1000, // 1 minute
  maxRecentRequests: 100,
  maxTimeSeriesPoints: 1440, // 24 hours at 1 min resolution
  alertThresholds: {
    errorRatePercent: 5,
    latencyP95Ms: 5000,
    budgetUsedPercent: 80,
    cacheHitRatePercent: 20,
  },
};

export class MetricsCollector {
  private config: MetricsCollectorConfig;
  private requests: RequestMetric[] = [];
  private timeSeries: DashboardState["timeSeries"] = {
    requests: [],
    latency: [],
    cost: [],
    cacheHitRate: [],
    tokensPerSecond: [],
  };
  private alerts: DashboardAlert[] = [];
  private providerStates: Map<string, {
    latencies: number[];
    errors: number;
    successes: number;
    circuitState: "closed" | "open" | "half-open";
    lastError?: string;
    lastErrorTime?: number;
  }> = new Map();
  private cacheStats: CacheStats = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    size: 0,
    avgSimilarity: 0,
    savedCost: 0,
    savedLatencyMs: 0,
  };
  private costMetrics: CostMetrics = {
    totalCost: 0,
    costByProvider: {},
    costByModel: {},
    budget: 100, // Default budget
    budgetUsed: 0,
    projectedDaily: 0,
    projectedMonthly: 0,
  };
  private listeners: Set<(state: DashboardState) => void> = new Set();
  private aggregationInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config: Partial<MetricsCollectorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start collecting metrics
   */
  start(): void {
    if (this.aggregationInterval) return;

    this.aggregationInterval = setInterval(() => {
      this.aggregate();
      this.cleanup();
      this.checkAlerts();
      this.notifyListeners();
    }, this.config.aggregationWindowMs);
  }

  /**
   * Stop collecting metrics
   */
  stop(): void {
    if (this.aggregationInterval) {
      clearInterval(this.aggregationInterval);
      this.aggregationInterval = null;
    }
  }

  /**
   * Record a request metric
   */
  recordRequest(metric: RequestMetric): void {
    this.requests.push(metric);

    // Update provider state
    let providerState = this.providerStates.get(metric.provider);
    if (!providerState) {
      providerState = {
        latencies: [],
        errors: 0,
        successes: 0,
        circuitState: "closed",
      };
      this.providerStates.set(metric.provider, providerState);
    }

    providerState.latencies.push(metric.latencyMs);
    if (metric.success) {
      providerState.successes++;
    } else {
      providerState.errors++;
      providerState.lastError = metric.error;
      providerState.lastErrorTime = metric.timestamp;
    }

    // Update cost metrics
    this.costMetrics.totalCost += metric.cost;
    this.costMetrics.costByProvider[metric.provider] =
      (this.costMetrics.costByProvider[metric.provider] || 0) + metric.cost;
    this.costMetrics.costByModel[metric.model] =
      (this.costMetrics.costByModel[metric.model] || 0) + metric.cost;
    this.costMetrics.budgetUsed = (this.costMetrics.totalCost / this.costMetrics.budget) * 100;

    // Keep recent requests trimmed
    while (this.requests.length > this.config.maxRecentRequests * 10) {
      this.requests.shift();
    }
  }

  /**
   * Record cache hit/miss
   */
  recordCacheAccess(hit: boolean, similarity?: number, savedCost?: number, savedLatencyMs?: number): void {
    if (hit) {
      this.cacheStats.hits++;
      if (savedCost) this.cacheStats.savedCost += savedCost;
      if (savedLatencyMs) this.cacheStats.savedLatencyMs += savedLatencyMs;
    } else {
      this.cacheStats.misses++;
    }

    const total = this.cacheStats.hits + this.cacheStats.misses;
    this.cacheStats.hitRate = total > 0 ? (this.cacheStats.hits / total) * 100 : 0;

    if (similarity) {
      const totalWithSimilarity = this.cacheStats.hits;
      this.cacheStats.avgSimilarity =
        (this.cacheStats.avgSimilarity * (totalWithSimilarity - 1) + similarity) / totalWithSimilarity;
    }
  }

  /**
   * Update cache size
   */
  updateCacheSize(size: number): void {
    this.cacheStats.size = size;
  }

  /**
   * Update circuit breaker state
   */
  updateCircuitState(provider: string, state: "closed" | "open" | "half-open"): void {
    const providerState = this.providerStates.get(provider);
    if (providerState) {
      providerState.circuitState = state;
    }
  }

  /**
   * Set budget
   */
  setBudget(budget: number): void {
    this.costMetrics.budget = budget;
    this.costMetrics.budgetUsed = (this.costMetrics.totalCost / budget) * 100;
  }

  /**
   * Subscribe to state updates
   */
  subscribe(callback: (state: DashboardState) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Get current dashboard state
   */
  getState(): DashboardState {
    return {
      current: this.getCurrentMetrics(),
      timeSeries: this.timeSeries,
      recentRequests: this.requests.slice(-this.config.maxRecentRequests).reverse(),
      alerts: this.alerts.filter(a => !a.acknowledged),
    };
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
    }
  }

  /**
   * Get aggregated metrics for the current window
   */
  private getCurrentMetrics(): AggregatedMetrics {
    const now = Date.now();
    const windowStart = now - this.config.aggregationWindowMs;
    const windowRequests = this.requests.filter(r => r.timestamp >= windowStart);

    const latencies = windowRequests.map(r => r.latencyMs).sort((a, b) => a - b);
    const successful = windowRequests.filter(r => r.success);
    const cached = windowRequests.filter(r => r.cached);

    // Calculate projections based on recent rate
    const hourMs = 60 * 60 * 1000;
    const recentHourRequests = this.requests.filter(r => r.timestamp >= now - hourMs);
    const hourlyRate = recentHourRequests.length > 0
      ? recentHourRequests.reduce((sum, r) => sum + r.cost, 0)
      : 0;
    this.costMetrics.projectedDaily = hourlyRate * 24;
    this.costMetrics.projectedMonthly = hourlyRate * 24 * 30;

    return {
      timestamp: now,
      windowMs: this.config.aggregationWindowMs,
      requests: {
        total: windowRequests.length,
        successful: successful.length,
        failed: windowRequests.length - successful.length,
        cached: cached.length,
      },
      latency: {
        avg: latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
        p50: this.percentile(latencies, 50),
        p95: this.percentile(latencies, 95),
        p99: this.percentile(latencies, 99),
        min: latencies.length > 0 ? latencies[0] : 0,
        max: latencies.length > 0 ? latencies[latencies.length - 1] : 0,
      },
      tokens: {
        input: windowRequests.reduce((sum, r) => sum + r.inputTokens, 0),
        output: windowRequests.reduce((sum, r) => sum + r.outputTokens, 0),
        total: windowRequests.reduce((sum, r) => sum + r.inputTokens + r.outputTokens, 0),
      },
      providers: this.getProviderHealth(),
      cache: { ...this.cacheStats },
      cost: { ...this.costMetrics },
    };
  }

  /**
   * Get provider health metrics
   */
  private getProviderHealth(): ProviderHealth[] {
    const health: ProviderHealth[] = [];

    for (const [provider, state] of this.providerStates) {
      const latencies = state.latencies.sort((a, b) => a - b);
      const total = state.successes + state.errors;
      const successRate = total > 0 ? (state.successes / total) * 100 : 100;

      let status: "healthy" | "degraded" | "down" = "healthy";
      if (state.circuitState === "open") {
        status = "down";
      } else if (successRate < 95 || state.circuitState === "half-open") {
        status = "degraded";
      }

      health.push({
        provider,
        status,
        latencyP50: this.percentile(latencies, 50),
        latencyP95: this.percentile(latencies, 95),
        latencyP99: this.percentile(latencies, 99),
        successRate,
        requestCount: total,
        circuitState: state.circuitState,
        lastError: state.lastError,
        lastErrorTime: state.lastErrorTime,
      });
    }

    return health;
  }

  /**
   * Aggregate metrics into time series
   */
  private aggregate(): void {
    const metrics = this.getCurrentMetrics();
    const point = { timestamp: metrics.timestamp };

    this.addTimeSeriesPoint("requests", { ...point, value: metrics.requests.total });
    this.addTimeSeriesPoint("latency", { ...point, value: metrics.latency.p95 });
    this.addTimeSeriesPoint("cost", { ...point, value: metrics.cost.totalCost });
    this.addTimeSeriesPoint("cacheHitRate", { ...point, value: metrics.cache.hitRate });

    const tokensPerSec = metrics.tokens.total / (metrics.windowMs / 1000);
    this.addTimeSeriesPoint("tokensPerSecond", { ...point, value: tokensPerSec });
  }

  /**
   * Add point to time series, maintaining max length
   */
  private addTimeSeriesPoint(
    series: keyof DashboardState["timeSeries"],
    point: TimeSeriesPoint
  ): void {
    this.timeSeries[series].push(point);
    while (this.timeSeries[series].length > this.config.maxTimeSeriesPoints) {
      this.timeSeries[series].shift();
    }
  }

  /**
   * Clean up old data
   */
  private cleanup(): void {
    const cutoff = Date.now() - this.config.retentionMs;

    // Clean requests
    this.requests = this.requests.filter(r => r.timestamp >= cutoff);

    // Clean time series
    for (const series of Object.values(this.timeSeries)) {
      while (series.length > 0 && series[0].timestamp < cutoff) {
        series.shift();
      }
    }

    // Reset provider latencies periodically to prevent unbounded growth
    for (const state of this.providerStates.values()) {
      if (state.latencies.length > 10000) {
        state.latencies = state.latencies.slice(-1000);
      }
    }
  }

  /**
   * Check for alert conditions
   */
  private checkAlerts(): void {
    const metrics = this.getCurrentMetrics();
    const { alertThresholds } = this.config;

    // Error rate alert
    if (metrics.requests.total > 0) {
      const errorRate = (metrics.requests.failed / metrics.requests.total) * 100;
      if (errorRate > alertThresholds.errorRatePercent) {
        this.addAlert("warning", "High Error Rate",
          `Error rate is ${errorRate.toFixed(1)}% (threshold: ${alertThresholds.errorRatePercent}%)`);
      }
    }

    // Latency alert
    if (metrics.latency.p95 > alertThresholds.latencyP95Ms) {
      this.addAlert("warning", "High Latency",
        `P95 latency is ${metrics.latency.p95.toFixed(0)}ms (threshold: ${alertThresholds.latencyP95Ms}ms)`);
    }

    // Budget alert
    if (metrics.cost.budgetUsed > alertThresholds.budgetUsedPercent) {
      this.addAlert("warning", "Budget Warning",
        `Budget usage is ${metrics.cost.budgetUsed.toFixed(1)}% (threshold: ${alertThresholds.budgetUsedPercent}%)`);
    }

    // Cache hit rate alert
    if (metrics.cache.hitRate < alertThresholds.cacheHitRatePercent &&
        (metrics.cache.hits + metrics.cache.misses) > 100) {
      this.addAlert("info", "Low Cache Hit Rate",
        `Cache hit rate is ${metrics.cache.hitRate.toFixed(1)}% (threshold: ${alertThresholds.cacheHitRatePercent}%)`);
    }

    // Provider down alerts
    for (const provider of metrics.providers) {
      if (provider.status === "down") {
        this.addAlert("error", "Provider Down",
          `${provider.provider} circuit breaker is open. Last error: ${provider.lastError || "Unknown"}`);
      }
    }
  }

  /**
   * Add alert if not already present
   */
  private addAlert(type: DashboardAlert["type"], title: string, message: string): void {
    const existing = this.alerts.find(
      a => a.title === title && !a.acknowledged && Date.now() - a.timestamp < 5 * 60 * 1000
    );
    if (existing) return;

    this.alerts.push({
      id: crypto.randomUUID(),
      type,
      title,
      message,
      timestamp: Date.now(),
      acknowledged: false,
    });

    // Keep alerts trimmed
    while (this.alerts.length > 100) {
      this.alerts.shift();
    }
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch (e) {
        console.error("Error in metrics listener:", e);
      }
    }
  }

  /**
   * Calculate percentile
   */
  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }
}

// Singleton instance for convenience
let collector: MetricsCollector | null = null;

export function getMetricsCollector(config?: Partial<MetricsCollectorConfig>): MetricsCollector {
  if (!collector) {
    collector = new MetricsCollector(config);
  }
  return collector;
}
