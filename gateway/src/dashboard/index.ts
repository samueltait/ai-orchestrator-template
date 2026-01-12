/**
 * Dashboard Module - Real-time monitoring UI
 */

export {
  MetricsCollector,
  getMetricsCollector,
  type MetricsCollectorConfig,
  type RequestMetric,
  type ProviderHealth,
  type CacheStats,
  type CostMetrics,
  type AggregatedMetrics,
  type TimeSeriesPoint,
  type DashboardState,
  type DashboardAlert,
} from "./metrics-collector";

export {
  DashboardServer,
  createDashboardServer,
  type DashboardServerConfig,
} from "./server";
