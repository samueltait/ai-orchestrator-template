/**
 * LLM Gateway - Core orchestration layer
 * Handles request routing, caching, reliability, and observability
 */

import { nanoid } from "nanoid";
import type {
  GatewayRequest,
  GatewayResponse,
  GatewayConfig,
  Provider,
  RoutingDecision,
  TokenUsage,
  CostBreakdown,
} from "./types";
import { SemanticCache } from "../cache/semantic-cache";
import { IntelligentRouter } from "../routing/router";
import { CircuitBreaker } from "../reliability/circuit-breaker";
import { RetryHandler } from "../reliability/retry";
import { Tracer } from "../observability/tracer";
import { CostTracker } from "../cost/tracker";
import { SecurityGuard } from "../security/guard";
import { ProviderAdapter } from "./providers";
import { Logger } from "../observability/logger";

export class LLMGateway {
  private config: GatewayConfig;
  private cache: SemanticCache;
  private router: IntelligentRouter;
  private circuitBreakers: Map<Provider, CircuitBreaker>;
  private retryHandler: RetryHandler;
  private tracer: Tracer;
  private costTracker: CostTracker;
  private securityGuard: SecurityGuard;
  private providers: Map<Provider, ProviderAdapter>;
  private logger: Logger;

  constructor(config: GatewayConfig) {
    this.config = config;
    this.logger = new Logger(config.observability.logging);
    this.cache = new SemanticCache(config.cache);
    this.router = new IntelligentRouter(config.routing, config.providers);
    this.circuitBreakers = new Map();
    this.retryHandler = new RetryHandler(config.reliability);
    this.tracer = new Tracer(config.observability.tracing);
    this.costTracker = new CostTracker(config.cost);
    this.securityGuard = new SecurityGuard(config.security);
    this.providers = new Map();

    this.initializeProviders();
    this.initializeCircuitBreakers();
  }

  private initializeProviders(): void {
    for (const providerConfig of this.config.providers) {
      if (providerConfig.enabled) {
        this.providers.set(
          providerConfig.provider,
          new ProviderAdapter(providerConfig)
        );
      }
    }
  }

  private initializeCircuitBreakers(): void {
    for (const providerConfig of this.config.providers) {
      this.circuitBreakers.set(
        providerConfig.provider,
        new CircuitBreaker(
          providerConfig.provider,
          this.config.reliability.circuitBreaker
        )
      );
    }
  }

  async complete(request: GatewayRequest): Promise<GatewayResponse> {
    const startTime = Date.now();
    const traceId = this.tracer.startTrace(request.id);
    const spanId = this.tracer.startSpan("gateway.complete");

    try {
      // Security checks
      const securityResult = await this.securityGuard.check(request);
      if (securityResult.blocked) {
        throw new Error(`Request blocked: ${securityResult.reason}`);
      }
      if (securityResult.sanitizedRequest) {
        request = securityResult.sanitizedRequest;
      }

      // Check budget
      const budgetOk = await this.costTracker.checkBudget(request.metadata);
      if (!budgetOk) {
        throw new Error("Budget exceeded");
      }

      // Check cache
      if (request.routing?.cacheEnabled !== false && this.config.cache.enabled) {
        const cachedResponse = await this.cache.get(request);
        if (cachedResponse) {
          this.logger.info("Cache hit", { requestId: request.id });
          return this.buildResponse(
            request,
            cachedResponse,
            { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
            Date.now() - startTime,
            true,
            traceId,
            spanId
          );
        }
      }

      // Route to best provider/model
      const routingDecision = await this.router.route(request);
      this.logger.info("Routing decision", {
        requestId: request.id,
        provider: routingDecision.selectedProvider,
        model: routingDecision.selectedModel,
        reason: routingDecision.reason
      });

      // Execute with retry and circuit breaker
      const result = await this.executeWithResilience(request, routingDecision);

      // Cache the response
      if (request.routing?.cacheEnabled !== false && this.config.cache.enabled) {
        await this.cache.set(request, result.content);
      }

      // Track cost
      await this.costTracker.track({
        requestId: request.id,
        provider: routingDecision.selectedProvider,
        model: routingDecision.selectedModel,
        usage: result.usage,
        metadata: request.metadata,
      });

      const response = this.buildResponse(
        request,
        result.content,
        result.usage,
        Date.now() - startTime,
        false,
        traceId,
        spanId,
        routingDecision,
        result.toolCalls
      );

      this.tracer.endSpan(spanId);
      this.tracer.endTrace(traceId);

      return response;
    } catch (error) {
      this.tracer.recordError(spanId, error as Error);
      this.tracer.endSpan(spanId);
      this.tracer.endTrace(traceId);
      throw error;
    }
  }

  private async executeWithResilience(
    request: GatewayRequest,
    routingDecision: RoutingDecision
  ): Promise<{ content: string; usage: TokenUsage; toolCalls?: { id: string; name: string; arguments: string }[] }> {
    const provider = routingDecision.selectedProvider;
    const circuitBreaker = this.circuitBreakers.get(provider)!;

    // Check circuit breaker
    if (!circuitBreaker.canExecute()) {
      // Try fallback provider
      const fallbackDecision = await this.router.getFallback(
        request,
        routingDecision
      );
      if (fallbackDecision) {
        return this.executeWithResilience(request, fallbackDecision);
      }
      throw new Error(`Circuit breaker open for ${provider}, no fallback available`);
    }

    try {
      const result = await this.retryHandler.execute(async () => {
        const adapter = this.providers.get(provider);
        if (!adapter) {
          throw new Error(`Provider ${provider} not configured`);
        }
        return adapter.complete(request, routingDecision.selectedModel);
      });

      circuitBreaker.recordSuccess();
      return result;
    } catch (error) {
      circuitBreaker.recordFailure();

      // Try fallback on failure
      if (request.routing?.fallbackEnabled !== false) {
        const fallbackDecision = await this.router.getFallback(
          request,
          routingDecision
        );
        if (fallbackDecision) {
          this.logger.warn("Primary provider failed, using fallback", {
            primary: provider,
            fallback: fallbackDecision.selectedProvider,
          });
          return this.executeWithResilience(request, fallbackDecision);
        }
      }
      throw error;
    }
  }

  private buildResponse(
    request: GatewayRequest,
    content: string,
    usage: TokenUsage,
    latencyMs: number,
    cached: boolean,
    traceId: string,
    spanId: string,
    routingDecision?: RoutingDecision,
    toolCalls?: { id: string; name: string; arguments: string }[]
  ): GatewayResponse {
    const provider = routingDecision?.selectedProvider || "anthropic";
    const model = routingDecision?.selectedModel || "claude-3-5-sonnet-20241022";
    const cost = this.calculateCost(provider, model, usage);

    return {
      id: nanoid(),
      requestId: request.id,
      provider,
      model,
      content,
      toolCalls,
      usage,
      latencyMs,
      cached,
      cost,
      metadata: {
        routingDecision: routingDecision || {
          strategy: "balanced",
          selectedModel: model,
          selectedProvider: provider,
          reason: cached ? "Cache hit" : "Default routing",
          alternativesConsidered: [],
        },
        cacheStatus: {
          hit: cached,
          ttlSeconds: cached ? this.config.cache.ttlSeconds : undefined,
        },
        retryCount: 0,
        traceId,
        spanId,
      },
    };
  }

  private calculateCost(
    provider: Provider,
    model: string,
    usage: TokenUsage
  ): CostBreakdown {
    const providerConfig = this.config.providers.find(
      (p) => p.provider === provider
    );
    const modelConfig = providerConfig?.models.find((m) => m.model === model);

    const inputCost = modelConfig
      ? (usage.inputTokens / 1000) * modelConfig.costPer1kInput
      : 0;
    const outputCost = modelConfig
      ? (usage.outputTokens / 1000) * modelConfig.costPer1kOutput
      : 0;

    return {
      inputCost,
      outputCost,
      totalCost: inputCost + outputCost,
      currency: "USD",
    };
  }

  // Health check endpoint
  async healthCheck(): Promise<Record<Provider, boolean>> {
    const health: Record<string, boolean> = {};
    for (const [provider, adapter] of this.providers) {
      try {
        health[provider] = await adapter.healthCheck();
      } catch {
        health[provider] = false;
      }
    }
    return health as Record<Provider, boolean>;
  }

  // Get current stats
  async getStats(): Promise<{
    cache: { hits: number; misses: number; hitRate: number };
    cost: { daily: number; weekly: number; monthly: number };
    latency: { p50: number; p95: number; p99: number };
    providers: Record<Provider, { requests: number; errors: number; avgLatency: number }>;
  }> {
    return {
      cache: await this.cache.getStats(),
      cost: await this.costTracker.getStats(),
      latency: this.tracer.getLatencyStats(),
      providers: this.getProviderStats(),
    };
  }

  private getProviderStats(): Record<Provider, { requests: number; errors: number; avgLatency: number }> {
    const stats: Record<string, { requests: number; errors: number; avgLatency: number }> = {};
    for (const [provider, cb] of this.circuitBreakers) {
      stats[provider] = cb.getStats();
    }
    return stats as Record<Provider, { requests: number; errors: number; avgLatency: number }>;
  }
}

// Factory function with sensible defaults
export function createGateway(
  overrides: Partial<GatewayConfig> = {}
): LLMGateway {
  const defaultConfig: GatewayConfig = {
    providers: [
      {
        provider: "anthropic",
        apiKey: process.env.ANTHROPIC_API_KEY || "",
        enabled: true,
        weight: 1,
        models: [
          {
            provider: "anthropic",
            model: "claude-sonnet-4-20250514",
            tier: "premium",
            maxTokens: 200000,
            costPer1kInput: 0.003,
            costPer1kOutput: 0.015,
            latencyP50Ms: 800,
            latencyP95Ms: 2000,
            capabilities: ["reasoning", "coding", "creative", "vision", "function_calling", "long_context"],
          },
          {
            provider: "anthropic",
            model: "claude-3-5-haiku-20241022",
            tier: "economy",
            maxTokens: 200000,
            costPer1kInput: 0.0008,
            costPer1kOutput: 0.004,
            latencyP50Ms: 400,
            latencyP95Ms: 1000,
            capabilities: ["coding", "fast", "cheap"],
          },
        ],
      },
      {
        provider: "openai",
        apiKey: process.env.OPENAI_API_KEY || "",
        enabled: true,
        weight: 1,
        models: [
          {
            provider: "openai",
            model: "gpt-4o",
            tier: "premium",
            maxTokens: 128000,
            costPer1kInput: 0.0025,
            costPer1kOutput: 0.01,
            latencyP50Ms: 600,
            latencyP95Ms: 1500,
            capabilities: ["reasoning", "coding", "creative", "vision", "function_calling"],
          },
          {
            provider: "openai",
            model: "gpt-4o-mini",
            tier: "economy",
            maxTokens: 128000,
            costPer1kInput: 0.00015,
            costPer1kOutput: 0.0006,
            latencyP50Ms: 300,
            latencyP95Ms: 800,
            capabilities: ["coding", "fast", "cheap"],
          },
        ],
      },
      {
        provider: "gemini",
        apiKey: process.env.GEMINI_API_KEY || "",
        enabled: true,
        weight: 1,
        models: [
          {
            provider: "gemini",
            model: "gemini-2.0-flash",
            tier: "standard",
            maxTokens: 1000000,
            costPer1kInput: 0.000075,
            costPer1kOutput: 0.0003,
            latencyP50Ms: 500,
            latencyP95Ms: 1200,
            capabilities: ["reasoning", "coding", "long_context", "fast", "cheap"],
          },
        ],
      },
      {
        provider: "ollama",
        apiKey: "",
        baseUrl: "http://localhost:11434",
        enabled: true,
        weight: 0.5,
        models: [
          {
            provider: "ollama",
            model: "llama3.2",
            tier: "economy",
            maxTokens: 8192,
            costPer1kInput: 0,
            costPer1kOutput: 0,
            latencyP50Ms: 200,
            latencyP95Ms: 500,
            capabilities: ["coding", "fast", "cheap"],
          },
        ],
      },
    ],
    routing: {
      defaultStrategy: "balanced",
      complexityThresholds: {
        simple: 0.3,
        medium: 0.6,
        complex: 1.0,
      },
      modelMapping: {},
    },
    cache: {
      enabled: true,
      type: "memory",
      ttlSeconds: 3600,
      maxSize: 1000,
      semanticSimilarityThreshold: 0.92,
    },
    reliability: {
      retryAttempts: 3,
      retryDelayMs: 1000,
      retryBackoffMultiplier: 2,
      circuitBreaker: {
        failureThreshold: 5,
        recoveryTimeMs: 30000,
        halfOpenRequests: 3,
      },
      timeout: {
        requestMs: 60000,
        streamMs: 300000,
      },
    },
    observability: {
      tracing: {
        enabled: true,
        serviceName: "llm-gateway",
      },
      metrics: {
        enabled: true,
        prefix: "llm_gateway_",
      },
      logging: {
        level: "info",
        format: "json",
      },
    },
    security: {
      piiDetection: {
        enabled: true,
        action: "mask",
        patterns: [
          "\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b", // Email
          "\\b\\d{3}-\\d{2}-\\d{4}\\b", // SSN
          "\\b\\d{16}\\b", // Credit card
          "\\b\\d{3}-\\d{3}-\\d{4}\\b", // Phone
        ],
      },
      promptInjection: {
        enabled: true,
        action: "warn",
      },
      outputSanitization: {
        enabled: true,
        blockedPatterns: [],
      },
      auditLog: {
        enabled: true,
        destination: "stdout",
      },
    },
    cost: {
      budgets: {
        daily: 100,
        weekly: 500,
        monthly: 2000,
        perRequest: 1,
      },
      alerts: {
        enabled: true,
        thresholds: [0.5, 0.75, 0.9, 1.0],
      },
      tracking: {
        byUser: true,
        byProject: true,
        byFeature: true,
      },
    },
  };

  // Deep merge configs
  const mergedConfig = deepMerge(defaultConfig, overrides);
  return new LLMGateway(mergedConfig);
}

function deepMerge(target: GatewayConfig, source: Partial<GatewayConfig>): GatewayConfig {
  const result = { ...target };

  for (const key of Object.keys(source) as (keyof GatewayConfig)[]) {
    const sourceValue = source[key];
    const targetValue = (result as unknown as Record<string, unknown>)[key];

    if (sourceValue === undefined) continue;

    if (
      typeof sourceValue === "object" &&
      sourceValue !== null &&
      !Array.isArray(sourceValue) &&
      typeof targetValue === "object" &&
      targetValue !== null &&
      !Array.isArray(targetValue)
    ) {
      // Recursively merge objects (shallow merge for nested)
      (result as unknown as Record<string, unknown>)[key] = {
        ...(targetValue as object),
        ...(sourceValue as object),
      };
    } else {
      (result as unknown as Record<string, unknown>)[key] = sourceValue;
    }
  }

  return result;
}
