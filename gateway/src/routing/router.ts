/**
 * Intelligent Router - Routes requests to optimal provider/model
 * Based on cost, latency, quality, and complexity analysis
 */

import type {
  GatewayRequest,
  RoutingConfig,
  ProviderConfig,
  RoutingDecision,
  RoutingStrategy,
  ModelConfig,
  ModelCapability,
  Provider,
} from "../core/types";

export class IntelligentRouter {
  private config: RoutingConfig;
  private providers: ProviderConfig[];
  private modelScores: Map<string, ModelScore>;

  constructor(config: RoutingConfig, providers: ProviderConfig[]) {
    this.config = config;
    this.providers = providers.filter((p) => p.enabled);
    this.modelScores = new Map();
    this.initializeModelScores();
  }

  private initializeModelScores(): void {
    for (const provider of this.providers) {
      for (const model of provider.models) {
        const key = `${provider.provider}:${model.model}`;
        this.modelScores.set(key, {
          successRate: 1.0,
          avgLatency: model.latencyP50Ms,
          totalRequests: 0,
          recentErrors: 0,
        });
      }
    }
  }

  async route(request: GatewayRequest): Promise<RoutingDecision> {
    const strategy = request.routing?.strategy || this.config.defaultStrategy;
    const complexity = this.analyzeComplexity(request);

    // Get eligible models
    const eligibleModels = this.getEligibleModels(request, complexity);

    if (eligibleModels.length === 0) {
      throw new Error("No eligible models found for request");
    }

    // Score and rank models based on strategy
    const scoredModels = eligibleModels.map((m) => ({
      ...m,
      score: this.scoreModel(m, strategy, complexity, request),
    }));

    scoredModels.sort((a, b) => b.score - a.score);

    const selected = scoredModels[0]!;
    const alternatives = scoredModels.slice(1, 4).map((m) => `${m.provider}:${m.model}`);

    return {
      strategy,
      selectedModel: selected.model,
      selectedProvider: selected.provider,
      reason: this.explainDecision(selected, strategy, complexity),
      alternativesConsidered: alternatives,
      complexityScore: complexity,
    };
  }

  async getFallback(
    request: GatewayRequest,
    failedDecision: RoutingDecision
  ): Promise<RoutingDecision | null> {
    const excludeProviders = [
      ...(request.routing?.excludeProviders || []),
      failedDecision.selectedProvider,
    ];

    const modifiedRequest: GatewayRequest = {
      ...request,
      routing: {
        ...request.routing,
        excludeProviders,
      },
    };

    try {
      return await this.route(modifiedRequest);
    } catch {
      return null;
    }
  }

  private analyzeComplexity(request: GatewayRequest): number {
    let score = 0;

    // Message count factor
    const messageCount = request.messages.length;
    score += Math.min(messageCount / 20, 0.2);

    // Total content length
    const totalLength = request.messages.reduce((sum, m) => {
      const content = typeof m.content === "string"
        ? m.content
        : m.content.map((c) => c.text || "").join("");
      return sum + content.length;
    }, 0);
    score += Math.min(totalLength / 10000, 0.3);

    // Tool usage
    if (request.tools && request.tools.length > 0) {
      score += 0.2;
    }

    // System prompt complexity
    const systemMessage = request.messages.find((m) => m.role === "system");
    if (systemMessage) {
      const systemLength = typeof systemMessage.content === "string"
        ? systemMessage.content.length
        : 0;
      score += Math.min(systemLength / 5000, 0.15);
    }

    // Keywords indicating complexity
    const complexKeywords = [
      "analyze", "compare", "evaluate", "synthesize", "create",
      "design", "implement", "debug", "refactor", "optimize",
      "explain in detail", "step by step", "comprehensive",
    ];

    const lastMessage = request.messages[request.messages.length - 1];
    const lastContent = typeof lastMessage?.content === "string"
      ? lastMessage.content.toLowerCase()
      : "";

    for (const keyword of complexKeywords) {
      if (lastContent.includes(keyword)) {
        score += 0.05;
      }
    }

    return Math.min(score, 1.0);
  }

  private getEligibleModels(
    request: GatewayRequest,
    complexity: number
  ): ModelConfig[] {
    const eligible: ModelConfig[] = [];
    const excludeProviders = request.routing?.excludeProviders || [];
    const preferredProviders = request.routing?.preferredProviders;
    const requiredCapabilities = request.routing?.requiredCapabilities || [];

    for (const provider of this.providers) {
      // Skip excluded providers
      if (excludeProviders.includes(provider.provider)) continue;

      for (const model of provider.models) {
        // Check capabilities
        const hasCapabilities = requiredCapabilities.every((cap) =>
          model.capabilities.includes(cap)
        );
        if (!hasCapabilities) continue;

        // Check budget constraints
        if (request.metadata?.budget) {
          const budget = request.metadata.budget;
          if (budget.maxLatencyMs && model.latencyP95Ms > budget.maxLatencyMs) {
            continue;
          }
        }

        // Tier filtering based on complexity
        if (complexity < this.config.complexityThresholds.simple) {
          // Simple tasks can use economy models
          if (model.tier === "premium" && !preferredProviders?.includes(provider.provider)) {
            continue;
          }
        }

        eligible.push(model);
      }
    }

    // If preferred providers specified, prioritize them
    if (preferredProviders && preferredProviders.length > 0) {
      const preferred = eligible.filter((m) =>
        preferredProviders.includes(m.provider)
      );
      if (preferred.length > 0) {
        return preferred;
      }
    }

    return eligible;
  }

  private scoreModel(
    model: ModelConfig,
    strategy: RoutingStrategy,
    complexity: number,
    request: GatewayRequest
  ): number {
    const key = `${model.provider}:${model.model}`;
    const historicalScore = this.modelScores.get(key);

    let score = 0;

    // Base scores
    const costScore = 1 - Math.min((model.costPer1kInput + model.costPer1kOutput) / 0.1, 1);
    const latencyScore = 1 - Math.min(model.latencyP50Ms / 2000, 1);
    const qualityScore = this.getQualityScore(model, complexity);
    const reliabilityScore = historicalScore?.successRate || 1.0;

    // Weight by strategy
    switch (strategy) {
      case "cost_optimized":
        score = costScore * 0.5 + latencyScore * 0.2 + qualityScore * 0.2 + reliabilityScore * 0.1;
        break;
      case "latency_optimized":
        score = costScore * 0.1 + latencyScore * 0.5 + qualityScore * 0.2 + reliabilityScore * 0.2;
        break;
      case "quality_optimized":
        score = costScore * 0.1 + latencyScore * 0.1 + qualityScore * 0.6 + reliabilityScore * 0.2;
        break;
      case "balanced":
      default:
        score = costScore * 0.25 + latencyScore * 0.25 + qualityScore * 0.3 + reliabilityScore * 0.2;
    }

    // Bonus for capability match
    if (request.routing?.requiredCapabilities) {
      const matchCount = request.routing.requiredCapabilities.filter((cap) =>
        model.capabilities.includes(cap)
      ).length;
      score += matchCount * 0.05;
    }

    // Provider weight
    const provider = this.providers.find((p) => p.provider === model.provider);
    if (provider) {
      score *= provider.weight;
    }

    return score;
  }

  private getQualityScore(model: ModelConfig, complexity: number): number {
    // Premium models get higher quality score for complex tasks
    const tierScores: Record<string, number> = {
      premium: 0.9 + complexity * 0.1,
      standard: 0.7 + complexity * 0.1,
      economy: 0.5 + (1 - complexity) * 0.2,
    };

    let score = tierScores[model.tier] || 0.5;

    // Capability bonuses
    if (model.capabilities.includes("reasoning")) score += 0.05;
    if (model.capabilities.includes("coding")) score += 0.03;
    if (model.capabilities.includes("long_context")) score += 0.02;

    return Math.min(score, 1.0);
  }

  private explainDecision(
    model: ModelConfig & { score: number },
    strategy: RoutingStrategy,
    complexity: number
  ): string {
    const reasons: string[] = [];

    reasons.push(`Strategy: ${strategy}`);
    reasons.push(`Complexity: ${(complexity * 100).toFixed(0)}%`);
    reasons.push(`Tier: ${model.tier}`);
    reasons.push(`Score: ${model.score.toFixed(3)}`);

    if (model.capabilities.length > 0) {
      reasons.push(`Capabilities: ${model.capabilities.slice(0, 3).join(", ")}`);
    }

    return reasons.join(" | ");
  }

  // Update model scores based on actual performance
  recordResult(
    provider: Provider,
    model: string,
    success: boolean,
    latencyMs: number
  ): void {
    const key = `${provider}:${model}`;
    const score = this.modelScores.get(key);

    if (score) {
      score.totalRequests++;
      score.avgLatency = (score.avgLatency * 0.9) + (latencyMs * 0.1); // EMA

      if (success) {
        score.recentErrors = Math.max(0, score.recentErrors - 1);
      } else {
        score.recentErrors++;
      }

      // Update success rate with decay
      score.successRate = Math.max(0.1, 1 - (score.recentErrors / 10));
    }
  }
}

interface ModelScore {
  successRate: number;
  avgLatency: number;
  totalRequests: number;
  recentErrors: number;
}
