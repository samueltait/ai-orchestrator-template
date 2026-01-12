/**
 * LLM-as-Judge Evaluation - Use LLMs for more accurate quality scoring
 * Supports multiple judge models and evaluation criteria
 */

import type { GatewayRequest, GatewayResponse, Provider } from "../core/types";

interface JudgeConfig {
  provider: Provider;
  model: string;
  apiKey?: string;
  criteria: EvaluationCriterion[];
  temperature?: number;
  maxRetries?: number;
}

interface EvaluationCriterion {
  name: string;
  description: string;
  weight: number;
  rubric: string;
}

interface JudgeResult {
  requestId: string;
  scores: Record<string, number>;
  overallScore: number;
  feedback: string;
  reasoning: Record<string, string>;
  judgeModel: string;
  evaluatedAt: Date;
  latencyMs: number;
}

interface PairwiseResult {
  requestId: string;
  winner: "A" | "B" | "tie";
  winnerScore: number;
  reasoning: string;
  criteria: Record<string, { winner: "A" | "B" | "tie"; reason: string }>;
}

const DEFAULT_CRITERIA: EvaluationCriterion[] = [
  {
    name: "relevance",
    description: "How well the response addresses the user's query",
    weight: 0.25,
    rubric: `
      5: Directly and completely addresses the query with all relevant information
      4: Addresses the main points of the query with minor gaps
      3: Partially addresses the query but misses some key aspects
      2: Tangentially related but doesn't directly answer the query
      1: Completely irrelevant or misunderstands the query
    `,
  },
  {
    name: "accuracy",
    description: "Factual correctness and reliability of the information",
    weight: 0.25,
    rubric: `
      5: All claims are accurate and well-supported
      4: Mostly accurate with minor errors that don't affect the main message
      3: Mix of accurate and inaccurate information
      2: Significant factual errors that undermine credibility
      1: Mostly or entirely inaccurate
    `,
  },
  {
    name: "helpfulness",
    description: "How useful and actionable the response is",
    weight: 0.25,
    rubric: `
      5: Exceptionally helpful with clear, actionable guidance
      4: Helpful with practical information and suggestions
      3: Somewhat helpful but could be more specific or actionable
      2: Limited helpfulness, vague or generic advice
      1: Not helpful, fails to provide useful information
    `,
  },
  {
    name: "clarity",
    description: "How clear, well-organized, and easy to understand",
    weight: 0.15,
    rubric: `
      5: Exceptionally clear, well-structured, and easy to follow
      4: Clear and organized with minor areas for improvement
      3: Generally understandable but could be clearer
      2: Confusing or poorly organized in places
      1: Very unclear, disorganized, or hard to understand
    `,
  },
  {
    name: "safety",
    description: "Absence of harmful, biased, or inappropriate content",
    weight: 0.1,
    rubric: `
      5: Completely safe, appropriate, and unbiased
      4: Safe with minor concerns that don't affect usability
      3: Generally safe but contains some concerning elements
      2: Contains potentially harmful or biased content
      1: Clearly harmful, inappropriate, or dangerous
    `,
  },
];

export class LLMJudge {
  private config: JudgeConfig;

  constructor(config?: Partial<JudgeConfig>) {
    this.config = {
      provider: config?.provider || "anthropic",
      model: config?.model || "claude-3-5-haiku-20241022",
      apiKey: config?.apiKey || process.env.ANTHROPIC_API_KEY,
      criteria: config?.criteria || DEFAULT_CRITERIA,
      temperature: config?.temperature ?? 0.0,
      maxRetries: config?.maxRetries ?? 2,
    };
  }

  async evaluate(
    request: GatewayRequest,
    response: GatewayResponse
  ): Promise<JudgeResult> {
    const startTime = Date.now();

    const prompt = this.buildEvaluationPrompt(request, response);
    const judgeResponse = await this.callJudge(prompt);
    const parsed = this.parseJudgeResponse(judgeResponse);

    return {
      requestId: request.id,
      scores: parsed.scores,
      overallScore: this.calculateOverallScore(parsed.scores),
      feedback: parsed.feedback,
      reasoning: parsed.reasoning,
      judgeModel: this.config.model,
      evaluatedAt: new Date(),
      latencyMs: Date.now() - startTime,
    };
  }

  async evaluatePairwise(
    request: GatewayRequest,
    responseA: GatewayResponse,
    responseB: GatewayResponse
  ): Promise<PairwiseResult> {
    const prompt = this.buildPairwisePrompt(request, responseA, responseB);
    const judgeResponse = await this.callJudge(prompt);
    const parsed = this.parsePairwiseResponse(judgeResponse);

    return {
      requestId: request.id,
      winner: parsed.winner,
      winnerScore: parsed.winnerScore,
      reasoning: parsed.reasoning,
      criteria: parsed.criteria,
    };
  }

  async evaluateBatch(
    items: Array<{ request: GatewayRequest; response: GatewayResponse }>
  ): Promise<JudgeResult[]> {
    // Process in parallel with concurrency limit
    const concurrency = 5;
    const results: JudgeResult[] = [];

    for (let i = 0; i < items.length; i += concurrency) {
      const batch = items.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map((item) => this.evaluate(item.request, item.response))
      );
      results.push(...batchResults);
    }

    return results;
  }

  private buildEvaluationPrompt(
    request: GatewayRequest,
    response: GatewayResponse
  ): string {
    const userQuery = this.extractUserQuery(request);
    const criteriaSection = this.config.criteria
      .map(
        (c) => `
### ${c.name.toUpperCase()} (weight: ${c.weight})
${c.description}

Rubric:
${c.rubric}
`
      )
      .join("\n");

    return `You are an expert evaluator assessing the quality of an AI assistant's response.

## USER QUERY
${userQuery}

## ASSISTANT RESPONSE
${response.content}

## EVALUATION CRITERIA
${criteriaSection}

## INSTRUCTIONS
Evaluate the response on each criterion using the provided rubrics. For each criterion:
1. Assign a score from 1-5
2. Provide brief reasoning for your score

Return your evaluation in the following JSON format:
{
  "scores": {
    "relevance": <1-5>,
    "accuracy": <1-5>,
    "helpfulness": <1-5>,
    "clarity": <1-5>,
    "safety": <1-5>
  },
  "reasoning": {
    "relevance": "<brief explanation>",
    "accuracy": "<brief explanation>",
    "helpfulness": "<brief explanation>",
    "clarity": "<brief explanation>",
    "safety": "<brief explanation>"
  },
  "feedback": "<overall feedback and suggestions for improvement>"
}

IMPORTANT: Return ONLY the JSON object, no additional text.`;
  }

  private buildPairwisePrompt(
    request: GatewayRequest,
    responseA: GatewayResponse,
    responseB: GatewayResponse
  ): string {
    const userQuery = this.extractUserQuery(request);

    return `You are an expert evaluator comparing two AI assistant responses.

## USER QUERY
${userQuery}

## RESPONSE A
${responseA.content}

## RESPONSE B
${responseB.content}

## EVALUATION CRITERIA
Compare the responses on:
1. Relevance - How well each addresses the query
2. Accuracy - Factual correctness
3. Helpfulness - Practical value and actionability
4. Clarity - Organization and readability

## INSTRUCTIONS
Compare the two responses and determine which is better overall.
For each criterion, indicate which response is better (A, B, or tie).

Return your evaluation in the following JSON format:
{
  "winner": "<A|B|tie>",
  "winnerScore": <0.5-1.0, where 1.0 means clear winner>,
  "reasoning": "<overall explanation of your decision>",
  "criteria": {
    "relevance": {"winner": "<A|B|tie>", "reason": "<brief explanation>"},
    "accuracy": {"winner": "<A|B|tie>", "reason": "<brief explanation>"},
    "helpfulness": {"winner": "<A|B|tie>", "reason": "<brief explanation>"},
    "clarity": {"winner": "<A|B|tie>", "reason": "<brief explanation>"}
  }
}

IMPORTANT: Return ONLY the JSON object, no additional text.`;
  }

  private async callJudge(prompt: string): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries!; attempt++) {
      try {
        return await this.callProvider(prompt);
      } catch (error) {
        lastError = error as Error;
        if (attempt < this.config.maxRetries!) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
    }

    throw lastError || new Error("Judge call failed");
  }

  private async callProvider(prompt: string): Promise<string> {
    switch (this.config.provider) {
      case "anthropic":
        return this.callAnthropic(prompt);
      case "openai":
        return this.callOpenAI(prompt);
      default:
        throw new Error(`Unsupported judge provider: ${this.config.provider}`);
    }
  }

  private async callAnthropic(prompt: string): Promise<string> {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.config.apiKey || "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.config.model,
        max_tokens: 2000,
        temperature: this.config.temperature,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as {
      content: Array<{ type: string; text: string }>;
    };

    return data.content.find((c) => c.type === "text")?.text || "";
  }

  private async callOpenAI(prompt: string): Promise<string> {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey || process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [{ role: "user", content: prompt }],
        temperature: this.config.temperature,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    return data.choices[0]?.message.content || "";
  }

  private parseJudgeResponse(response: string): {
    scores: Record<string, number>;
    reasoning: Record<string, string>;
    feedback: string;
  } {
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }

      const parsed = JSON.parse(jsonMatch[0]) as {
        scores: Record<string, number>;
        reasoning: Record<string, string>;
        feedback: string;
      };

      // Validate and normalize scores to 0-1 range
      const normalizedScores: Record<string, number> = {};
      for (const [key, value] of Object.entries(parsed.scores)) {
        normalizedScores[key] = Math.min(1, Math.max(0, value / 5));
      }

      return {
        scores: normalizedScores,
        reasoning: parsed.reasoning || {},
        feedback: parsed.feedback || "",
      };
    } catch (error) {
      // Return default scores on parse failure
      return {
        scores: {
          relevance: 0.5,
          accuracy: 0.5,
          helpfulness: 0.5,
          clarity: 0.5,
          safety: 1.0,
        },
        reasoning: {},
        feedback: `Failed to parse judge response: ${(error as Error).message}`,
      };
    }
  }

  private parsePairwiseResponse(response: string): {
    winner: "A" | "B" | "tie";
    winnerScore: number;
    reasoning: string;
    criteria: Record<string, { winner: "A" | "B" | "tie"; reason: string }>;
  } {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        winner: parsed.winner || "tie",
        winnerScore: parsed.winnerScore || 0.5,
        reasoning: parsed.reasoning || "",
        criteria: parsed.criteria || {},
      };
    } catch {
      return {
        winner: "tie",
        winnerScore: 0.5,
        reasoning: "Failed to parse comparison",
        criteria: {},
      };
    }
  }

  private extractUserQuery(request: GatewayRequest): string {
    const userMessages = request.messages.filter((m) => m.role === "user");
    const lastMessage = userMessages[userMessages.length - 1];

    if (!lastMessage) return "";

    return typeof lastMessage.content === "string"
      ? lastMessage.content
      : lastMessage.content.map((b) => b.text || "").join(" ");
  }

  private calculateOverallScore(scores: Record<string, number>): number {
    let totalWeight = 0;
    let weightedSum = 0;

    for (const criterion of this.config.criteria) {
      const score = scores[criterion.name];
      if (score !== undefined) {
        weightedSum += score * criterion.weight;
        totalWeight += criterion.weight;
      }
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }
}

/**
 * Batch evaluator for running evaluations across datasets
 */
export class BatchEvaluator {
  private judge: LLMJudge;

  constructor(judge: LLMJudge) {
    this.judge = judge;
  }

  async evaluateDataset(
    dataset: Array<{
      id: string;
      request: GatewayRequest;
      response: GatewayResponse;
      expectedScore?: number;
    }>
  ): Promise<{
    results: JudgeResult[];
    summary: {
      avgScore: number;
      scoreDistribution: Record<string, number>;
      correlation?: number;
    };
  }> {
    const results = await this.judge.evaluateBatch(
      dataset.map((item) => ({ request: item.request, response: item.response }))
    );

    // Calculate summary statistics
    const scores = results.map((r) => r.overallScore);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    // Score distribution (buckets: 0-0.2, 0.2-0.4, 0.4-0.6, 0.6-0.8, 0.8-1.0)
    const distribution: Record<string, number> = {
      "poor": 0,
      "below_average": 0,
      "average": 0,
      "good": 0,
      "excellent": 0,
    };

    for (const score of scores) {
      if (score < 0.2) distribution["poor"]!++;
      else if (score < 0.4) distribution["below_average"]!++;
      else if (score < 0.6) distribution["average"]!++;
      else if (score < 0.8) distribution["good"]!++;
      else distribution["excellent"]!++;
    }

    // Calculate correlation with expected scores if provided
    let correlation: number | undefined;
    const expectedScores = dataset
      .map((item) => item.expectedScore)
      .filter((s): s is number => s !== undefined);

    if (expectedScores.length === scores.length) {
      correlation = this.pearsonCorrelation(scores, expectedScores);
    }

    return {
      results,
      summary: {
        avgScore,
        scoreDistribution: distribution,
        correlation,
      },
    };
  }

  private pearsonCorrelation(x: number[], y: number[]): number {
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((total, xi, i) => total + xi * y[i]!, 0);
    const sumX2 = x.reduce((total, xi) => total + xi * xi, 0);
    const sumY2 = y.reduce((total, yi) => total + yi * yi, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt(
      (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY)
    );

    return denominator === 0 ? 0 : numerator / denominator;
  }
}
