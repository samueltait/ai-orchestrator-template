# LLM Gateway

Production-grade AI orchestration layer with semantic caching, intelligent routing, streaming, real-time monitoring, and Kubernetes-ready deployment.

## Features

| Feature | Description | Impact |
|---------|-------------|--------|
| **Semantic Caching** | Cache responses by meaning with real embeddings | Up to 95% cost reduction |
| **Intelligent Routing** | Route by cost, latency, quality, or balanced | Optimal provider selection |
| **Streaming Support** | Real-time token streaming with latency metrics | Better UX, first-token tracking |
| **Automatic Failover** | Circuit breakers with fallback providers | 99.9%+ availability |
| **Cost Tracking** | Real-time per-request cost analytics | Budget control |
| **Security Guardrails** | PII detection, prompt injection prevention | Compliance ready |
| **Distributed Tracing** | OpenTelemetry-compatible tracing | Full observability |
| **LLM-as-Judge** | Automated quality evaluation with AI judges | Quality assurance |
| **Real-time Dashboard** | Live monitoring UI with charts and alerts | Operational visibility |
| **Kubernetes Ready** | Helm charts with HPA, PDB, and probes | Cloud-native deployment |
| **Async Job Queue** | Background processing with webhooks | Handle burst traffic |

## Quick Start

```bash
# Install dependencies
bun install

# Set environment variables
export ANTHROPIC_API_KEY="your-key"
export OPENAI_API_KEY="your-key"
export GEMINI_API_KEY="your-key"

# Run playground
bun run playground

# Run monitoring dashboard
bun run dashboard

# Run tests
bun test
```

## Basic Usage

```typescript
import { createGateway } from "@ai-orchestrator/gateway";

const gateway = createGateway();

const response = await gateway.complete({
  id: "req-1",
  messages: [
    { role: "system", content: "You are helpful." },
    { role: "user", content: "Hello!" }
  ],
  routing: {
    strategy: "balanced",      // cost_optimized | latency_optimized | quality_optimized
    cacheEnabled: true,
    fallbackEnabled: true,
  }
});

console.log(response.content);
console.log(`Cost: $${response.cost.totalCost.toFixed(6)}`);
console.log(`Latency: ${response.latencyMs}ms`);
console.log(`Provider: ${response.provider}`);
console.log(`Cached: ${response.cached}`);
```

## Streaming

Stream responses in real-time with first-token latency tracking:

```typescript
import { StreamingProvider } from "@ai-orchestrator/gateway";

const streaming = new StreamingProvider({
  anthropic: { apiKey: process.env.ANTHROPIC_API_KEY },
  openai: { apiKey: process.env.OPENAI_API_KEY },
});

const request = {
  id: "stream-1",
  messages: [{ role: "user", content: "Write a poem about AI" }],
};

// Stream tokens
for await (const chunk of streaming.stream(request, "claude-sonnet-4-20250514")) {
  if (chunk.type === "text") {
    process.stdout.write(chunk.text);
  } else if (chunk.type === "metrics") {
    console.log(`\nFirst token: ${chunk.firstTokenMs}ms`);
    console.log(`Total: ${chunk.totalMs}ms`);
    console.log(`Speed: ${chunk.tokensPerSecond.toFixed(1)} tok/s`);
  }
}

// Or convert to SSE for web clients
const sseStream = streaming.toSSE(request, "gpt-4o");
return new Response(sseStream, {
  headers: { "Content-Type": "text/event-stream" }
});
```

## Real-time Dashboard

Launch the monitoring dashboard for live metrics visualization:

```bash
# Start dashboard on default port 3001
bun run dashboard

# Or specify custom port
bun run src/index.ts dashboard 3002
```

Then open `http://localhost:3001/dashboard` in your browser.

### Dashboard Features

- **Key Metrics**: Requests/min, P95 latency, success rate, total cost
- **Live Charts**: Request volume, latency trends, cache hit rate
- **Provider Health**: Status, circuit breaker state, per-provider metrics
- **Cache Stats**: Hit rate, cost savings, latency savings
- **Cost Breakdown**: Budget usage, per-provider costs, projections
- **Alerts**: Real-time alerts for errors, latency spikes, budget warnings
- **Request Log**: Recent requests with details

### Integrating Metrics

```typescript
import { getMetricsCollector, createDashboardServer } from "@ai-orchestrator/gateway";

// Get the metrics collector singleton
const collector = getMetricsCollector();

// Record custom metrics
collector.recordRequest({
  id: "req-123",
  timestamp: Date.now(),
  provider: "anthropic",
  model: "claude-sonnet-4-20250514",
  latencyMs: 450,
  inputTokens: 100,
  outputTokens: 200,
  cost: 0.003,
  cached: false,
  success: true,
});

collector.recordCacheAccess(true, 0.95, 0.002, 300); // hit, similarity, savedCost, savedLatency

// Subscribe to real-time updates
collector.subscribe((state) => {
  console.log(`Requests: ${state.current.requests.total}`);
  console.log(`P95 Latency: ${state.current.latency.p95}ms`);
});
```

## Distributed Redis Cache

For multi-instance deployments, use Redis-backed semantic caching:

```typescript
import { DistributedRedisCache, EmbeddingProvider } from "@ai-orchestrator/gateway";

// Configure real embeddings
const embeddings = new EmbeddingProvider({
  provider: "openai",       // or "ollama" for local
  model: "text-embedding-3-small",
  apiKey: process.env.OPENAI_API_KEY,
});

// Create distributed cache
const cache = new DistributedRedisCache(
  {
    enabled: true,
    type: "redis",
    redisUrl: "redis://localhost:6379",
    ttlSeconds: 3600,
    maxSize: 10000,
    semanticSimilarityThreshold: 0.92,
  },
  embeddings
);

await cache.connect();

// Use with gateway
const gateway = createGateway({
  cache: {
    enabled: true,
    type: "redis",
    redisUrl: "redis://localhost:6379",
  }
});
```

### Embedding Providers

| Provider | Models | Use Case |
|----------|--------|----------|
| OpenAI | `text-embedding-ada-002`, `text-embedding-3-small` | Production, high quality |
| Ollama | `nomic-embed-text`, `mxbai-embed-large` | Local, free, private |
| Local | Hash-based | Development, testing |

## LLM-as-Judge Evaluation

Automatically evaluate response quality using AI judges:

```typescript
import { LLMJudge, createGateway } from "@ai-orchestrator/gateway";

const gateway = createGateway();
const judge = new LLMJudge({
  provider: "anthropic",
  model: "claude-sonnet-4-20250514",
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Evaluate a single response
const request = {
  id: "eval-1",
  messages: [{ role: "user", content: "Explain quantum computing" }],
};
const response = await gateway.complete(request);

const evaluation = await judge.evaluate(request, response);
console.log(`Helpfulness: ${evaluation.scores.helpfulness}/10`);
console.log(`Accuracy: ${evaluation.scores.accuracy}/10`);
console.log(`Clarity: ${evaluation.scores.clarity}/10`);
console.log(`Safety: ${evaluation.scores.safety}/10`);
console.log(`Overall: ${evaluation.overall}/10`);
console.log(`Feedback: ${evaluation.explanation}`);

// Pairwise comparison (A/B testing)
const responseA = await gateway.complete({ ...request, provider: "anthropic" });
const responseB = await gateway.complete({ ...request, provider: "openai" });

const comparison = await judge.evaluatePairwise(request, responseA, responseB);
console.log(`Winner: ${comparison.winner}`); // "A", "B", or "tie"
console.log(`Reason: ${comparison.explanation}`);

// Multi-judge ensemble for higher confidence
const ensemble = await judge.evaluateWithEnsemble(request, response, {
  judges: [
    { provider: "anthropic", model: "claude-sonnet-4-20250514" },
    { provider: "openai", model: "gpt-4o" },
  ],
  aggregation: "average", // or "median", "min"
});
console.log(`Consensus score: ${ensemble.overall}`);
console.log(`Agreement: ${ensemble.agreement}%`);
```

## Kubernetes Deployment

Deploy to Kubernetes using the included Helm charts:

```bash
# Install the chart
helm install llm-gateway ./k8s/helm \
  --set secrets.anthropicApiKey=$ANTHROPIC_API_KEY \
  --set secrets.openaiApiKey=$OPENAI_API_KEY \
  --set secrets.geminiApiKey=$GEMINI_API_KEY

# With custom values
helm install llm-gateway ./k8s/helm -f my-values.yaml

# Upgrade
helm upgrade llm-gateway ./k8s/helm

# Uninstall
helm uninstall llm-gateway
```

### Helm Chart Features

| Resource | Description |
|----------|-------------|
| **Deployment** | Main gateway pods with health probes |
| **Service** | ClusterIP service with metrics port |
| **ConfigMap** | Gateway configuration |
| **HPA** | Auto-scaling based on CPU/memory |
| **PDB** | Pod disruption budget for HA |
| **ServiceAccount** | RBAC configuration |

### Configuration Values

```yaml
# values.yaml
replicaCount: 3

image:
  repository: your-registry/llm-gateway
  tag: latest

resources:
  requests:
    cpu: 500m
    memory: 512Mi
  limits:
    cpu: 2000m
    memory: 2Gi

autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70

gateway:
  cache:
    enabled: true
    type: redis
    redisUrl: redis://redis-master:6379
  routing:
    defaultStrategy: balanced
  cost:
    budgets:
      daily: 100
      monthly: 2000

observability:
  metrics:
    enabled: true
    port: 9090
```

## Routing Strategies

| Strategy | Optimization | Best For |
|----------|--------------|----------|
| `balanced` | Equal weight to all factors | General use |
| `cost_optimized` | Minimize cost | High-volume, simple tasks |
| `latency_optimized` | Minimize response time | Real-time applications |
| `quality_optimized` | Maximize response quality | Complex reasoning tasks |

## Full Configuration

```typescript
const gateway = createGateway({
  // Provider configuration
  providers: [
    {
      provider: "anthropic",
      apiKey: process.env.ANTHROPIC_API_KEY,
      enabled: true,
      weight: 1.0,
      models: [
        {
          model: "claude-sonnet-4-20250514",
          tier: "premium",
          capabilities: ["reasoning", "coding", "vision"],
        }
      ]
    }
  ],

  // Caching
  cache: {
    enabled: true,
    type: "redis",                     // "memory" or "redis"
    redisUrl: "redis://localhost:6379",
    ttlSeconds: 3600,
    maxSize: 10000,
    semanticSimilarityThreshold: 0.92,
    embeddingProvider: "openai",       // or "ollama", "local"
    embeddingModel: "text-embedding-3-small",
  },

  // Routing
  routing: {
    defaultStrategy: "balanced",
    complexityThresholds: {
      simple: 0.3,
      medium: 0.6,
      complex: 1.0,
    },
  },

  // Reliability
  reliability: {
    retryAttempts: 3,
    retryDelayMs: 1000,
    circuitBreaker: {
      failureThreshold: 5,
      recoveryTimeMs: 30000,
    },
  },

  // Security
  security: {
    piiDetection: {
      enabled: true,
      action: "mask",  // mask | block | warn
    },
    promptInjection: {
      enabled: true,
      action: "warn",  // block | warn
    },
  },

  // Cost management
  cost: {
    budgets: {
      daily: 100,
      weekly: 500,
      monthly: 2000,
    },
    alerts: {
      enabled: true,
      thresholds: [0.5, 0.75, 0.9],
      webhookUrl: "https://your-webhook.com/alerts",
    },
  },

  // Observability
  observability: {
    tracing: {
      enabled: true,
      serviceName: "llm-gateway",
      exporterUrl: "http://localhost:4318/v1/traces",
    },
    metrics: {
      enabled: true,
      port: 9090,
    },
  },
});
```

## Async Job Queue

For background processing and burst traffic handling:

```typescript
import { JobQueue, createGateway } from "@ai-orchestrator/gateway";

const gateway = createGateway();
const queue = new JobQueue({ maxConcurrency: 10 });

queue.setProcessor((request) => gateway.complete(request));

// Submit job
const jobId = await queue.submit({
  id: "job-1",
  messages: [{ role: "user", content: "Process in background" }],
}, {
  priority: 10,
  webhookUrl: "https://your-app.com/webhook",
});

// Wait for result (or use webhook)
const result = await queue.waitForJob(jobId);
```

## Evaluation & A/B Testing

```typescript
import { EvaluationFramework } from "@ai-orchestrator/gateway";

const evaluator = new EvaluationFramework();

// Register A/B test
evaluator.registerABTest({
  id: "prompt-test-1",
  name: "System prompt comparison",
  variants: [
    { id: "control", promptTemplate: "You are helpful." },
    { id: "detailed", promptTemplate: "You are a helpful assistant. Be concise." },
  ],
  trafficSplit: [50, 50],
  metrics: ["relevance", "helpfulness"],
  startDate: new Date(),
});

// Get variant for user
const variant = evaluator.assignVariant("prompt-test-1", userId);

// After response, record result
evaluator.recordABResult("prompt-test-1", variant.id, requestId, evalScores, latencyMs, cost);

// Get test results
const results = evaluator.getABTestStats("prompt-test-1");
console.log(`Winner: ${results.winner} (${results.confidence * 100}% confidence)`);
```

## CLI Commands

```bash
# Show help and quick start guide
bun run start

# Check provider health
bun run health

# Get gateway statistics
bun run stats

# Start interactive playground
bun run playground

# Start monitoring dashboard
bun run dashboard

# Run tests
bun test

# Type check
bun run typecheck
```

## API Reference

### Gateway Methods

| Method | Description |
|--------|-------------|
| `complete(request)` | Send completion request |
| `healthCheck()` | Check all provider health |
| `getStats()` | Get cache, cost, latency stats |

### Request Options

```typescript
interface GatewayRequest {
  id: string;
  messages: Message[];
  model?: string;              // Force specific model
  provider?: Provider;         // Force specific provider
  maxTokens?: number;
  temperature?: number;
  tools?: Tool[];
  stream?: boolean;
  metadata?: {
    userId?: string;           // For tracking
    projectId?: string;
    featureId?: string;
    budget?: {
      maxCostUsd?: number;
      maxLatencyMs?: number;
    };
  };
  routing?: {
    strategy?: RoutingStrategy;
    preferredProviders?: Provider[];
    excludeProviders?: Provider[];
    requiredCapabilities?: ModelCapability[];
    fallbackEnabled?: boolean;
    cacheEnabled?: boolean;
  };
}
```

### Response Structure

```typescript
interface GatewayResponse {
  id: string;
  requestId: string;
  provider: Provider;
  model: string;
  content: string;
  toolCalls?: ToolCall[];
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  latencyMs: number;
  cached: boolean;
  cost: {
    inputCost: number;
    outputCost: number;
    totalCost: number;
    currency: "USD";
  };
  metadata: {
    routingDecision: RoutingDecision;
    cacheStatus: CacheStatus;
    retryCount: number;
    traceId: string;
    spanId: string;
  };
}
```

## Security Features

### PII Detection

Automatically detects and masks:
- Email addresses
- Social Security Numbers
- Credit card numbers
- Phone numbers

### Prompt Injection Prevention

Detects common injection patterns:
- Instruction override attempts
- Role manipulation
- System prompt extraction
- Jailbreak attempts

## Observability

### Distributed Tracing

Traces are exported in OpenTelemetry format. Configure your collector:

```typescript
{
  observability: {
    tracing: {
      enabled: true,
      serviceName: "my-app",
      exporterUrl: "http://localhost:4318/v1/traces"
    }
  }
}
```

### Metrics (Prometheus format)

```bash
curl http://localhost:3456/api/stats
```

Available metrics:
- `llm_gateway_requests_total`
- `llm_gateway_request_duration_ms`
- `llm_gateway_input_tokens_total`
- `llm_gateway_output_tokens_total`
- `llm_gateway_cost_usd_total`
- `llm_gateway_cache_hits_total`
- `llm_gateway_cache_misses_total`

## Testing

```bash
# Run all tests
bun test

# Run with watch
bun test --watch

# Type check
bun run typecheck
```

## Project Structure

```
gateway/
├── src/
│   ├── core/           # Gateway core, types, providers, streaming
│   ├── cache/          # Semantic caching, Redis, embeddings
│   ├── routing/        # Intelligent routing
│   ├── reliability/    # Circuit breakers, retries
│   ├── observability/  # Tracing, logging, metrics
│   ├── security/       # PII, injection, rate limiting
│   ├── cost/           # Cost tracking, budgets
│   ├── evaluation/     # Evals, A/B testing, LLM-as-Judge
│   ├── context/        # Token counting, compression
│   ├── queue/          # Async job processing
│   ├── dashboard/      # Real-time monitoring UI
│   ├── playground/     # Interactive testing UI
│   └── __tests__/      # Test suite
├── k8s/
│   └── helm/           # Kubernetes Helm charts
│       ├── Chart.yaml
│       ├── values.yaml
│       └── templates/
├── package.json
├── tsconfig.json
└── README.md
```

## Supported Providers

| Provider | Models | Features |
|----------|--------|----------|
| Anthropic | Claude 4, Claude 3.5 | Reasoning, Vision, Tools, Streaming |
| OpenAI | GPT-4o, GPT-4o-mini | Reasoning, Vision, Tools, Streaming |
| Gemini | 2.0 Flash, 1.5 Pro | Long context, Fast, Streaming |
| Ollama | Llama 3.2, etc. | Local, Free, Private, Streaming |

## Changelog

### v1.0.0

- Multi-provider LLM gateway (Anthropic, OpenAI, Gemini, Ollama)
- Semantic caching with cosine similarity
- Intelligent routing strategies
- Circuit breaker and retry handling
- Distributed tracing (OpenTelemetry)
- PII detection and prompt injection prevention
- Cost tracking with budget alerts
- Evaluation framework with A/B testing
- Async job queue
- Interactive playground UI

### v1.1.0 (Latest)

- **Streaming support** with first-token latency tracking
- **Distributed Redis cache** for multi-instance deployments
- **Real embedding models** (OpenAI ada, Ollama nomic)
- **LLM-as-Judge** evaluation with pairwise comparison
- **Real-time monitoring dashboard** with SSE updates
- **Kubernetes Helm charts** with HPA, PDB, probes

## License

MIT
