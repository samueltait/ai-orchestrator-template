/**
 * LLM Gateway - Production-grade AI orchestration
 *
 * Features:
 * - Multi-provider support (Anthropic, OpenAI, Gemini, Ollama)
 * - Semantic caching (up to 95% cost reduction)
 * - Intelligent routing (cost, latency, quality optimization)
 * - Circuit breakers and automatic failover
 * - Distributed tracing (OpenTelemetry compatible)
 * - Cost tracking with budget alerts
 * - Security guardrails (PII detection, prompt injection prevention)
 * - Evaluation framework (automated evals, A/B testing, LLM-as-Judge)
 * - Async job queue for background processing
 * - Streaming support with first-token latency tracking
 * - Real-time monitoring dashboard
 * - Kubernetes-ready with Helm charts
 */

// Core
export { LLMGateway, createGateway } from "./core/gateway";
export { ProviderAdapter } from "./core/providers";
export { StreamingProvider } from "./core/streaming";
export type {
  GatewayRequest,
  GatewayResponse,
  GatewayConfig,
  Message,
  Provider,
  ModelConfig,
  RoutingStrategy,
  RoutingDecision,
  TokenUsage,
  CostBreakdown,
} from "./core/types";

// Cache
export { SemanticCache, RedisSemanticCache } from "./cache/semantic-cache";
export { DistributedRedisCache } from "./cache/redis-cache";
export { EmbeddingProvider } from "./cache/embeddings";

// Routing
export { IntelligentRouter } from "./routing/router";

// Reliability
export { CircuitBreaker, CircuitBreakerRegistry } from "./reliability/circuit-breaker";
export { RetryHandler, RequestDeduplicator } from "./reliability/retry";

// Observability
export { Tracer, MetricsCollector as TracerMetrics } from "./observability/tracer";
export { Logger, AuditLogger } from "./observability/logger";

// Security
export { SecurityGuard, RateLimiter } from "./security/guard";

// Cost
export { CostTracker } from "./cost/tracker";

// Evaluation
export { EvaluationFramework, RegressionTester } from "./evaluation/framework";
export { LLMJudge } from "./evaluation/llm-judge";

// Context
export { ContextManager, TokenCounter } from "./context/manager";

// Queue
export { JobQueue, RequestBatcher } from "./queue/job-queue";

// Dashboard
export {
  MetricsCollector,
  getMetricsCollector,
  DashboardServer,
  createDashboardServer,
} from "./dashboard";

// Quick start helper
export function quickStart() {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║                    LLM Gateway - Quick Start                   ║
╚════════════════════════════════════════════════════════════════╝

1. Set up environment variables:
   export ANTHROPIC_API_KEY="your-key"
   export OPENAI_API_KEY="your-key"
   export GEMINI_API_KEY="your-key"

2. Basic usage:
   import { createGateway } from "@ai-orchestrator/gateway";

   const gateway = createGateway();

   const response = await gateway.complete({
     id: "req-1",
     messages: [
       { role: "user", content: "Hello, world!" }
     ],
     routing: {
       strategy: "balanced",  // or "cost_optimized", "latency_optimized", "quality_optimized"
       cacheEnabled: true,
       fallbackEnabled: true,
     }
   });

   console.log(response.content);
   console.log(\`Cost: $\${response.cost.totalCost.toFixed(4)}\`);
   console.log(\`Latency: \${response.latencyMs}ms\`);
   console.log(\`Cached: \${response.cached}\`);

3. With custom config:
   const gateway = createGateway({
     cache: {
       enabled: true,
       semanticSimilarityThreshold: 0.9,
     },
     routing: {
       defaultStrategy: "cost_optimized",
     },
     cost: {
       budgets: {
         daily: 50,
         monthly: 1000,
       },
     },
   });

4. Async job processing:
   import { JobQueue, createGateway } from "@ai-orchestrator/gateway";

   const gateway = createGateway();
   const queue = new JobQueue({ maxConcurrency: 5 });
   queue.setProcessor((request) => gateway.complete(request));

   const jobId = await queue.submit({
     id: "job-1",
     messages: [{ role: "user", content: "Process this in background" }],
   });

   const result = await queue.waitForJob(jobId);

5. Run the playground:
   bun run playground

For full documentation, see the README.md
`);
}

// CLI entry point
if (import.meta.main) {
  const args = process.argv.slice(2);

  if (args[0] === "help" || args[0] === "--help") {
    quickStart();
  } else if (args[0] === "health") {
    // Health check
    const { createGateway: createGw } = await import("./core/gateway");
    const gateway = createGw();
    const health = await gateway.healthCheck();
    console.log("Provider Health:");
    for (const [provider, healthy] of Object.entries(health)) {
      console.log(`  ${provider}: ${healthy ? "✓" : "✗"}`);
    }
  } else if (args[0] === "stats") {
    // Get stats
    const { createGateway: createGw } = await import("./core/gateway");
    const gateway = createGw();
    const stats = await gateway.getStats();
    console.log("Gateway Stats:");
    console.log(JSON.stringify(stats, null, 2));
  } else if (args[0] === "dashboard") {
    // Start dashboard server
    const port = parseInt(args[1]) || 3001;
    const { createDashboardServer } = await import("./dashboard");
    console.log("Starting LLM Gateway Dashboard...");
    const server = createDashboardServer({ port });
    console.log(`Dashboard available at http://localhost:${port}/dashboard`);
    console.log("Press Ctrl+C to stop");
    // Keep process running
    process.on("SIGINT", () => {
      console.log("\nShutting down dashboard...");
      server.stop();
      process.exit(0);
    });
  } else if (args[0] === "playground") {
    // Start interactive playground - just import the file which starts the server
    await import("./playground/server");
  } else {
    quickStart();
  }
}
