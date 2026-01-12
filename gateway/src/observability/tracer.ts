/**
 * Distributed Tracing - OpenTelemetry-compatible tracing
 */

import { nanoid } from "nanoid";

interface TracingConfig {
  enabled: boolean;
  serviceName: string;
  exporterUrl?: string;
}

interface Span {
  spanId: string;
  traceId: string;
  parentSpanId?: string;
  name: string;
  startTime: number;
  endTime?: number;
  attributes: Record<string, unknown>;
  events: SpanEvent[];
  status: "ok" | "error" | "unset";
  error?: Error;
}

interface SpanEvent {
  name: string;
  timestamp: number;
  attributes?: Record<string, unknown>;
}

interface Trace {
  traceId: string;
  spans: Map<string, Span>;
  startTime: number;
  endTime?: number;
}

export class Tracer {
  private config: TracingConfig;
  private traces: Map<string, Trace> = new Map();
  private currentTrace?: string;
  private currentSpan?: string;
  private latencyHistory: number[] = [];

  constructor(config: TracingConfig) {
    this.config = config;
  }

  startTrace(requestId: string): string {
    if (!this.config.enabled) return requestId;

    const traceId = `trace_${nanoid(16)}`;
    this.traces.set(traceId, {
      traceId,
      spans: new Map(),
      startTime: Date.now(),
    });
    this.currentTrace = traceId;
    return traceId;
  }

  endTrace(traceId: string): void {
    if (!this.config.enabled) return;

    const trace = this.traces.get(traceId);
    if (trace) {
      trace.endTime = Date.now();
      const duration = trace.endTime - trace.startTime;
      this.latencyHistory.push(duration);

      // Keep last 1000 latencies
      if (this.latencyHistory.length > 1000) {
        this.latencyHistory.shift();
      }

      // Export trace (in production, send to collector)
      this.exportTrace(trace);

      // Cleanup old traces
      if (this.traces.size > 100) {
        const oldestKey = this.traces.keys().next().value;
        if (oldestKey) this.traces.delete(oldestKey);
      }
    }
  }

  startSpan(name: string, parentSpanId?: string): string {
    if (!this.config.enabled || !this.currentTrace) return nanoid(8);

    const spanId = `span_${nanoid(12)}`;
    const span: Span = {
      spanId,
      traceId: this.currentTrace,
      parentSpanId: parentSpanId || this.currentSpan,
      name,
      startTime: Date.now(),
      attributes: {},
      events: [],
      status: "unset",
    };

    const trace = this.traces.get(this.currentTrace);
    if (trace) {
      trace.spans.set(spanId, span);
    }

    this.currentSpan = spanId;
    return spanId;
  }

  endSpan(spanId: string): void {
    if (!this.config.enabled || !this.currentTrace) return;

    const trace = this.traces.get(this.currentTrace);
    const span = trace?.spans.get(spanId);

    if (span) {
      span.endTime = Date.now();
      if (span.status === "unset") {
        span.status = "ok";
      }
    }
  }

  setSpanAttribute(spanId: string, key: string, value: unknown): void {
    if (!this.config.enabled || !this.currentTrace) return;

    const trace = this.traces.get(this.currentTrace);
    const span = trace?.spans.get(spanId);

    if (span) {
      span.attributes[key] = value;
    }
  }

  addSpanEvent(spanId: string, name: string, attributes?: Record<string, unknown>): void {
    if (!this.config.enabled || !this.currentTrace) return;

    const trace = this.traces.get(this.currentTrace);
    const span = trace?.spans.get(spanId);

    if (span) {
      span.events.push({
        name,
        timestamp: Date.now(),
        attributes,
      });
    }
  }

  recordError(spanId: string, error: Error): void {
    if (!this.config.enabled || !this.currentTrace) return;

    const trace = this.traces.get(this.currentTrace);
    const span = trace?.spans.get(spanId);

    if (span) {
      span.status = "error";
      span.error = error;
      span.events.push({
        name: "exception",
        timestamp: Date.now(),
        attributes: {
          "exception.type": error.name,
          "exception.message": error.message,
          "exception.stacktrace": error.stack,
        },
      });
    }
  }

  getLatencyStats(): { p50: number; p95: number; p99: number } {
    if (this.latencyHistory.length === 0) {
      return { p50: 0, p95: 0, p99: 0 };
    }

    const sorted = [...this.latencyHistory].sort((a, b) => a - b);
    const p50Index = Math.floor(sorted.length * 0.5);
    const p95Index = Math.floor(sorted.length * 0.95);
    const p99Index = Math.floor(sorted.length * 0.99);

    return {
      p50: sorted[p50Index] || 0,
      p95: sorted[p95Index] || sorted[sorted.length - 1] || 0,
      p99: sorted[p99Index] || sorted[sorted.length - 1] || 0,
    };
  }

  private exportTrace(trace: Trace): void {
    if (!this.config.exporterUrl) {
      // Log to stdout in OTLP-like format
      const traceData = {
        traceId: trace.traceId,
        duration: trace.endTime ? trace.endTime - trace.startTime : 0,
        spans: Array.from(trace.spans.values()).map((span) => ({
          spanId: span.spanId,
          name: span.name,
          duration: span.endTime ? span.endTime - span.startTime : 0,
          status: span.status,
          attributes: span.attributes,
          events: span.events,
        })),
      };

      console.log(JSON.stringify({ type: "trace", data: traceData }));
      return;
    }

    // Send to collector (async, fire and forget)
    this.sendToCollector(trace).catch((err) => {
      console.error("Failed to export trace:", err);
    });
  }

  private async sendToCollector(trace: Trace): Promise<void> {
    if (!this.config.exporterUrl) return;

    const spans = Array.from(trace.spans.values()).map((span) => ({
      traceId: span.traceId,
      spanId: span.spanId,
      parentSpanId: span.parentSpanId,
      name: span.name,
      startTimeUnixNano: span.startTime * 1000000,
      endTimeUnixNano: (span.endTime || Date.now()) * 1000000,
      attributes: Object.entries(span.attributes).map(([key, value]) => ({
        key,
        value: { stringValue: String(value) },
      })),
      status: { code: span.status === "error" ? 2 : 1 },
    }));

    await fetch(this.config.exporterUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        resourceSpans: [
          {
            resource: {
              attributes: [
                {
                  key: "service.name",
                  value: { stringValue: this.config.serviceName },
                },
              ],
            },
            scopeSpans: [{ spans }],
          },
        ],
      }),
    });
  }
}

/**
 * Metrics collector for LLM-specific metrics
 */
export class MetricsCollector {
  private prefix: string;
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();

  constructor(prefix: string = "llm_gateway_") {
    this.prefix = prefix;
  }

  increment(name: string, value: number = 1, labels?: Record<string, string>): void {
    const key = this.buildKey(name, labels);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);
  }

  gauge(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.buildKey(name, labels);
    this.gauges.set(key, value);
  }

  histogram(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.buildKey(name, labels);
    const values = this.histograms.get(key) || [];
    values.push(value);
    if (values.length > 1000) values.shift();
    this.histograms.set(key, values);
  }

  // Record LLM-specific metrics
  recordRequest(provider: string, model: string, latencyMs: number, success: boolean): void {
    const labels = { provider, model };
    this.increment("requests_total", 1, labels);
    this.histogram("request_duration_ms", latencyMs, labels);

    if (!success) {
      this.increment("errors_total", 1, labels);
    }
  }

  recordTokens(provider: string, model: string, inputTokens: number, outputTokens: number): void {
    const labels = { provider, model };
    this.increment("input_tokens_total", inputTokens, labels);
    this.increment("output_tokens_total", outputTokens, labels);
  }

  recordCost(provider: string, model: string, costUsd: number): void {
    const labels = { provider, model };
    this.increment("cost_usd_total", costUsd, labels);
  }

  recordCacheHit(hit: boolean): void {
    if (hit) {
      this.increment("cache_hits_total");
    } else {
      this.increment("cache_misses_total");
    }
  }

  private buildKey(name: string, labels?: Record<string, string>): string {
    const fullName = `${this.prefix}${name}`;
    if (!labels) return fullName;

    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(",");

    return `${fullName}{${labelStr}}`;
  }

  // Export in Prometheus format
  toPrometheus(): string {
    const lines: string[] = [];

    for (const [key, value] of this.counters) {
      lines.push(`${key} ${value}`);
    }

    for (const [key, value] of this.gauges) {
      lines.push(`${key} ${value}`);
    }

    for (const [key, values] of this.histograms) {
      if (values.length === 0) continue;
      const sorted = [...values].sort((a, b) => a - b);
      lines.push(`${key}_count ${values.length}`);
      lines.push(`${key}_sum ${values.reduce((a, b) => a + b, 0)}`);
      lines.push(`${key}_p50 ${sorted[Math.floor(sorted.length * 0.5)] || 0}`);
      lines.push(`${key}_p95 ${sorted[Math.floor(sorted.length * 0.95)] || 0}`);
      lines.push(`${key}_p99 ${sorted[Math.floor(sorted.length * 0.99)] || 0}`);
    }

    return lines.join("\n");
  }
}
