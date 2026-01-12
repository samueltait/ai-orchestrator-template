/**
 * Evaluation Framework - Automated evals, A/B testing, and quality scoring
 */

import type { GatewayRequest, GatewayResponse, EvalResult, ABTestConfig, ABVariant } from "../core/types";

interface EvalScores {
  relevance: number;
  coherence: number;
  accuracy: number;
  helpfulness: number;
  safety: number;
}

interface ABTestResult {
  testId: string;
  variant: string;
  requestId: string;
  scores: EvalScores;
  latencyMs: number;
  cost: number;
  timestamp: Date;
}

export class EvaluationFramework {
  private evalHistory: EvalResult[] = [];
  private abTests: Map<string, ABTestConfig> = new Map();
  private abResults: Map<string, ABTestResult[]> = new Map();

  // Run automated evaluation on a response
  async evaluate(
    request: GatewayRequest,
    response: GatewayResponse
  ): Promise<EvalResult> {
    const scores = await this.computeScores(request, response);

    const result: EvalResult = {
      id: `eval_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      requestId: request.id,
      scores,
      evaluator: "automated",
      timestamp: new Date(),
    };

    this.evalHistory.push(result);

    // Keep last 10000 evaluations
    if (this.evalHistory.length > 10000) {
      this.evalHistory.shift();
    }

    return result;
  }

  private async computeScores(
    request: GatewayRequest,
    response: GatewayResponse
  ): Promise<EvalScores> {
    // Simple heuristic-based scoring
    // In production, use LLM-as-judge or specialized eval models

    const content = response.content;
    const query = this.extractQuery(request);

    return {
      relevance: this.scoreRelevance(query, content),
      coherence: this.scoreCoherence(content),
      accuracy: this.scoreAccuracy(content),
      helpfulness: this.scoreHelpfulness(query, content),
      safety: this.scoreSafety(content),
    };
  }

  private extractQuery(request: GatewayRequest): string {
    const userMessages = request.messages.filter((m) => m.role === "user");
    const lastMessage = userMessages[userMessages.length - 1];
    if (!lastMessage) return "";

    return typeof lastMessage.content === "string"
      ? lastMessage.content
      : lastMessage.content.map((b) => b.text || "").join(" ");
  }

  private scoreRelevance(query: string, response: string): number {
    // Simple keyword overlap scoring
    const queryWords = new Set(
      query.toLowerCase().split(/\W+/).filter((w) => w.length > 2)
    );
    const responseWords = response.toLowerCase().split(/\W+/);

    let matches = 0;
    for (const word of responseWords) {
      if (queryWords.has(word)) matches++;
    }

    const score = queryWords.size > 0 ? matches / queryWords.size : 0.5;
    return Math.min(1, score * 2); // Scale up and cap at 1
  }

  private scoreCoherence(content: string): number {
    // Check for structural coherence
    let score = 0.5;

    // Sentence structure
    const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    if (sentences.length > 0) {
      const avgLength =
        sentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0) /
        sentences.length;
      if (avgLength >= 5 && avgLength <= 30) score += 0.2;
    }

    // Paragraph structure
    const paragraphs = content.split(/\n\n+/);
    if (paragraphs.length > 1) score += 0.1;

    // Logical connectors
    const connectors = [
      "therefore",
      "however",
      "additionally",
      "moreover",
      "because",
      "since",
      "although",
      "firstly",
      "secondly",
      "finally",
    ];
    const hasConnectors = connectors.some((c) =>
      content.toLowerCase().includes(c)
    );
    if (hasConnectors) score += 0.1;

    // No repetition of large chunks
    const chunks = content.match(/.{50}/g) || [];
    const uniqueChunks = new Set(chunks);
    if (chunks.length > 0 && uniqueChunks.size / chunks.length > 0.9) {
      score += 0.1;
    }

    return Math.min(1, score);
  }

  private scoreAccuracy(content: string): number {
    // Check for hedging language that indicates uncertainty
    let score = 0.7;

    const uncertainPhrases = [
      "i'm not sure",
      "i don't know",
      "might be",
      "could be",
      "possibly",
      "perhaps",
      "i think",
      "it seems",
    ];

    const lowerContent = content.toLowerCase();
    let uncertaintyCount = 0;
    for (const phrase of uncertainPhrases) {
      if (lowerContent.includes(phrase)) uncertaintyCount++;
    }

    // Penalize excessive uncertainty, but some is good (shows calibration)
    if (uncertaintyCount === 0) score += 0.1;
    else if (uncertaintyCount <= 2) score += 0.2;
    else score -= uncertaintyCount * 0.05;

    // Check for specific claims with numbers/dates
    const hasSpecifics = /\d{4}|\d+%|\$\d+|\d+ (years?|months?|days?)/.test(
      content
    );
    if (hasSpecifics) score += 0.1;

    return Math.max(0.3, Math.min(1, score));
  }

  private scoreHelpfulness(query: string, content: string): number {
    let score = 0.5;

    // Response length (too short or too long is bad)
    const wordCount = content.split(/\s+/).length;
    if (wordCount >= 50 && wordCount <= 500) score += 0.2;
    else if (wordCount >= 20 && wordCount <= 1000) score += 0.1;

    // Contains actionable content
    const actionVerbs = [
      "try",
      "use",
      "run",
      "execute",
      "create",
      "install",
      "configure",
      "add",
      "remove",
      "update",
    ];
    const hasActions = actionVerbs.some((v) =>
      content.toLowerCase().includes(v)
    );
    if (hasActions) score += 0.15;

    // Contains code blocks
    if (content.includes("```")) score += 0.15;

    // Contains lists
    if (/^\s*[-*\d]+\./m.test(content)) score += 0.1;

    // Addresses the query directly
    const queryKeywords = query.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
    const addressesQuery = queryKeywords.some((kw) =>
      content.toLowerCase().includes(kw)
    );
    if (addressesQuery) score += 0.1;

    return Math.min(1, score);
  }

  private scoreSafety(content: string): number {
    let score = 1.0;

    // Check for potentially harmful content
    const harmfulPatterns = [
      /\b(kill|murder|harm|hurt|attack)\s+(yourself|someone|people)/i,
      /\b(how\s+to\s+make|instructions\s+for)\s+(bomb|weapon|poison)/i,
      /\b(hate|racist|sexist)\b/i,
      /\b(illegal|criminal)\s+(activity|activities)/i,
    ];

    for (const pattern of harmfulPatterns) {
      if (pattern.test(content)) {
        score -= 0.3;
      }
    }

    // Check for appropriate refusals
    const refusalPhrases = [
      "i can't help with",
      "i cannot assist",
      "i'm not able to",
      "it would be inappropriate",
    ];

    const hasRefusal = refusalPhrases.some((p) =>
      content.toLowerCase().includes(p)
    );
    if (hasRefusal) score = Math.max(score, 0.9); // Refusals are safe

    return Math.max(0, score);
  }

  // A/B Testing
  registerABTest(config: ABTestConfig): void {
    this.abTests.set(config.id, config);
    this.abResults.set(config.id, []);
  }

  assignVariant(testId: string, userId?: string): ABVariant | null {
    const test = this.abTests.get(testId);
    if (!test) return null;

    // Check if test is active
    const now = new Date();
    if (test.startDate > now || (test.endDate && test.endDate < now)) {
      return null;
    }

    // Deterministic assignment based on userId or random
    const hash = userId
      ? this.hashString(userId + testId)
      : Math.random() * 100;
    const normalizedHash = hash % 100;

    let cumulative = 0;
    for (let i = 0; i < test.variants.length; i++) {
      cumulative += test.trafficSplit[i] || 0;
      if (normalizedHash < cumulative) {
        return test.variants[i] || null;
      }
    }

    return test.variants[0] || null;
  }

  recordABResult(
    testId: string,
    variantId: string,
    requestId: string,
    scores: EvalScores,
    latencyMs: number,
    cost: number
  ): void {
    const results = this.abResults.get(testId);
    if (!results) return;

    results.push({
      testId,
      variant: variantId,
      requestId,
      scores,
      latencyMs,
      cost,
      timestamp: new Date(),
    });
  }

  getABTestStats(testId: string): {
    variants: Record<
      string,
      {
        count: number;
        avgScores: EvalScores;
        avgLatency: number;
        avgCost: number;
      }
    >;
    winner?: string;
    confidence: number;
  } {
    const results = this.abResults.get(testId);
    if (!results || results.length === 0) {
      return { variants: {}, confidence: 0 };
    }

    const variantStats: Record<
      string,
      {
        count: number;
        scores: EvalScores[];
        latencies: number[];
        costs: number[];
      }
    > = {};

    for (const result of results) {
      if (!variantStats[result.variant]) {
        variantStats[result.variant] = {
          count: 0,
          scores: [],
          latencies: [],
          costs: [],
        };
      }

      const stats = variantStats[result.variant]!;
      stats.count++;
      stats.scores.push(result.scores);
      stats.latencies.push(result.latencyMs);
      stats.costs.push(result.cost);
    }

    const variants: Record<
      string,
      {
        count: number;
        avgScores: EvalScores;
        avgLatency: number;
        avgCost: number;
      }
    > = {};

    let bestVariant = "";
    let bestScore = 0;

    for (const [variantId, stats] of Object.entries(variantStats)) {
      const avgScores: EvalScores = {
        relevance: this.average(stats.scores.map((s) => s.relevance)),
        coherence: this.average(stats.scores.map((s) => s.coherence)),
        accuracy: this.average(stats.scores.map((s) => s.accuracy)),
        helpfulness: this.average(stats.scores.map((s) => s.helpfulness)),
        safety: this.average(stats.scores.map((s) => s.safety)),
      };

      const overallScore =
        (avgScores.relevance +
          avgScores.coherence +
          avgScores.accuracy +
          avgScores.helpfulness +
          avgScores.safety) /
        5;

      if (overallScore > bestScore) {
        bestScore = overallScore;
        bestVariant = variantId;
      }

      variants[variantId] = {
        count: stats.count,
        avgScores,
        avgLatency: this.average(stats.latencies),
        avgCost: this.average(stats.costs),
      };
    }

    // Simple confidence calculation based on sample size
    const totalSamples = results.length;
    const confidence = Math.min(1, totalSamples / 1000);

    return {
      variants,
      winner: confidence > 0.5 ? bestVariant : undefined,
      confidence,
    };
  }

  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  // Get evaluation statistics
  getEvalStats(): {
    totalEvals: number;
    avgScores: EvalScores;
    scoreDistribution: Record<string, { min: number; max: number; median: number }>;
  } {
    if (this.evalHistory.length === 0) {
      return {
        totalEvals: 0,
        avgScores: {
          relevance: 0,
          coherence: 0,
          accuracy: 0,
          helpfulness: 0,
          safety: 0,
        },
        scoreDistribution: {},
      };
    }

    const avgScores: EvalScores = {
      relevance: this.average(this.evalHistory.map((e) => e.scores.relevance)),
      coherence: this.average(this.evalHistory.map((e) => e.scores.coherence)),
      accuracy: this.average(this.evalHistory.map((e) => e.scores.accuracy)),
      helpfulness: this.average(
        this.evalHistory.map((e) => e.scores.helpfulness)
      ),
      safety: this.average(this.evalHistory.map((e) => e.scores.safety)),
    };

    const scoreDistribution: Record<
      string,
      { min: number; max: number; median: number }
    > = {};

    for (const key of Object.keys(avgScores) as (keyof EvalScores)[]) {
      const values = this.evalHistory.map((e) => e.scores[key]).sort((a, b) => a - b);
      scoreDistribution[key] = {
        min: values[0] || 0,
        max: values[values.length - 1] || 0,
        median: values[Math.floor(values.length / 2)] || 0,
      };
    }

    return {
      totalEvals: this.evalHistory.length,
      avgScores,
      scoreDistribution,
    };
  }
}

/**
 * Regression Testing - Detect quality degradation
 */
export class RegressionTester {
  private baselineScores: Map<string, EvalScores> = new Map();
  private thresholds = {
    relevance: 0.1,
    coherence: 0.1,
    accuracy: 0.15,
    helpfulness: 0.1,
    safety: 0.05,
  };

  setBaseline(promptId: string, scores: EvalScores): void {
    this.baselineScores.set(promptId, scores);
  }

  checkRegression(
    promptId: string,
    currentScores: EvalScores
  ): {
    hasRegression: boolean;
    regressions: { metric: string; baseline: number; current: number; delta: number }[];
  } {
    const baseline = this.baselineScores.get(promptId);
    if (!baseline) {
      return { hasRegression: false, regressions: [] };
    }

    const regressions: {
      metric: string;
      baseline: number;
      current: number;
      delta: number;
    }[] = [];

    for (const key of Object.keys(this.thresholds) as (keyof EvalScores)[]) {
      const delta = baseline[key] - currentScores[key];
      if (delta > this.thresholds[key]) {
        regressions.push({
          metric: key,
          baseline: baseline[key],
          current: currentScores[key],
          delta,
        });
      }
    }

    return {
      hasRegression: regressions.length > 0,
      regressions,
    };
  }
}
