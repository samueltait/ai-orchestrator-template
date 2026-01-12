/**
 * Cost Tracker - Real-time cost tracking and budget management
 */

import type { CostConfig, RequestMetadata, Provider, TokenUsage } from "../core/types";

interface CostEntry {
  requestId: string;
  provider: Provider;
  model: string;
  inputTokens: number;
  outputTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
  timestamp: Date;
  userId?: string;
  projectId?: string;
  featureId?: string;
}

interface CostStats {
  daily: number;
  weekly: number;
  monthly: number;
}

interface CostBreakdown {
  byProvider: Record<string, number>;
  byModel: Record<string, number>;
  byUser: Record<string, number>;
  byProject: Record<string, number>;
  byFeature: Record<string, number>;
}

export class CostTracker {
  private config: CostConfig;
  private entries: CostEntry[] = [];
  private dailyTotal = 0;
  private weeklyTotal = 0;
  private monthlyTotal = 0;
  private lastResetDay: number;
  private lastResetWeek: number;
  private lastResetMonth: number;
  private alertsSent: Set<string> = new Set();

  constructor(config: CostConfig) {
    this.config = config;
    const now = new Date();
    this.lastResetDay = now.getDate();
    this.lastResetWeek = this.getWeekNumber(now);
    this.lastResetMonth = now.getMonth();

    // Reset counters periodically
    setInterval(() => this.checkReset(), 60000);
  }

  async track(data: {
    requestId: string;
    provider: Provider;
    model: string;
    usage: TokenUsage;
    metadata?: RequestMetadata;
  }): Promise<void> {
    const costs = this.calculateCost(data.provider, data.model, data.usage);

    const entry: CostEntry = {
      requestId: data.requestId,
      provider: data.provider,
      model: data.model,
      inputTokens: data.usage.inputTokens,
      outputTokens: data.usage.outputTokens,
      inputCost: costs.inputCost,
      outputCost: costs.outputCost,
      totalCost: costs.totalCost,
      timestamp: new Date(),
      userId: data.metadata?.userId,
      projectId: data.metadata?.projectId,
      featureId: data.metadata?.featureId,
    };

    this.entries.push(entry);
    this.dailyTotal += entry.totalCost;
    this.weeklyTotal += entry.totalCost;
    this.monthlyTotal += entry.totalCost;

    // Keep last 10000 entries
    if (this.entries.length > 10000) {
      this.entries.shift();
    }

    // Check alerts
    this.checkAlerts();
  }

  async checkBudget(metadata?: RequestMetadata): Promise<boolean> {
    const budgets = this.config.budgets;

    // Check daily budget
    if (budgets.daily && this.dailyTotal >= budgets.daily) {
      return false;
    }

    // Check weekly budget
    if (budgets.weekly && this.weeklyTotal >= budgets.weekly) {
      return false;
    }

    // Check monthly budget
    if (budgets.monthly && this.monthlyTotal >= budgets.monthly) {
      return false;
    }

    // Check per-request budget
    if (budgets.perRequest && metadata?.budget?.maxCostUsd) {
      if (metadata.budget.maxCostUsd > budgets.perRequest) {
        return false;
      }
    }

    return true;
  }

  async getStats(): Promise<CostStats> {
    return {
      daily: this.dailyTotal,
      weekly: this.weeklyTotal,
      monthly: this.monthlyTotal,
    };
  }

  async getBreakdown(timeRange: "day" | "week" | "month" = "day"): Promise<CostBreakdown> {
    const now = new Date();
    let cutoff: Date;

    switch (timeRange) {
      case "day":
        cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "week":
        cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }

    const filteredEntries = this.entries.filter((e) => e.timestamp >= cutoff);

    const breakdown: CostBreakdown = {
      byProvider: {},
      byModel: {},
      byUser: {},
      byProject: {},
      byFeature: {},
    };

    for (const entry of filteredEntries) {
      // By provider
      breakdown.byProvider[entry.provider] =
        (breakdown.byProvider[entry.provider] || 0) + entry.totalCost;

      // By model
      breakdown.byModel[entry.model] =
        (breakdown.byModel[entry.model] || 0) + entry.totalCost;

      // By user
      if (entry.userId && this.config.tracking.byUser) {
        breakdown.byUser[entry.userId] =
          (breakdown.byUser[entry.userId] || 0) + entry.totalCost;
      }

      // By project
      if (entry.projectId && this.config.tracking.byProject) {
        breakdown.byProject[entry.projectId] =
          (breakdown.byProject[entry.projectId] || 0) + entry.totalCost;
      }

      // By feature
      if (entry.featureId && this.config.tracking.byFeature) {
        breakdown.byFeature[entry.featureId] =
          (breakdown.byFeature[entry.featureId] || 0) + entry.totalCost;
      }
    }

    return breakdown;
  }

  private calculateCost(
    provider: Provider,
    model: string,
    usage: TokenUsage
  ): { inputCost: number; outputCost: number; totalCost: number } {
    // Cost per 1k tokens (approximate, update with actual pricing)
    const pricing: Record<string, { input: number; output: number }> = {
      // Anthropic
      "claude-sonnet-4-20250514": { input: 0.003, output: 0.015 },
      "claude-3-5-sonnet-20241022": { input: 0.003, output: 0.015 },
      "claude-3-5-haiku-20241022": { input: 0.0008, output: 0.004 },
      // OpenAI
      "gpt-4o": { input: 0.0025, output: 0.01 },
      "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
      "gpt-4-turbo": { input: 0.01, output: 0.03 },
      // Gemini
      "gemini-2.0-flash": { input: 0.000075, output: 0.0003 },
      "gemini-1.5-pro": { input: 0.00125, output: 0.005 },
      // Ollama (free/local)
      "llama3.2": { input: 0, output: 0 },
    };

    const modelPricing = pricing[model] || { input: 0.001, output: 0.002 };

    const inputCost = (usage.inputTokens / 1000) * modelPricing.input;
    const outputCost = (usage.outputTokens / 1000) * modelPricing.output;

    return {
      inputCost,
      outputCost,
      totalCost: inputCost + outputCost,
    };
  }

  private checkAlerts(): void {
    if (!this.config.alerts.enabled) return;

    const budgets = this.config.budgets;

    for (const threshold of this.config.alerts.thresholds) {
      // Daily alerts
      if (budgets.daily) {
        const alertKey = `daily_${threshold}`;
        if (
          this.dailyTotal >= budgets.daily * threshold &&
          !this.alertsSent.has(alertKey)
        ) {
          this.sendAlert("daily", threshold, this.dailyTotal, budgets.daily);
          this.alertsSent.add(alertKey);
        }
      }

      // Weekly alerts
      if (budgets.weekly) {
        const alertKey = `weekly_${threshold}`;
        if (
          this.weeklyTotal >= budgets.weekly * threshold &&
          !this.alertsSent.has(alertKey)
        ) {
          this.sendAlert("weekly", threshold, this.weeklyTotal, budgets.weekly);
          this.alertsSent.add(alertKey);
        }
      }

      // Monthly alerts
      if (budgets.monthly) {
        const alertKey = `monthly_${threshold}`;
        if (
          this.monthlyTotal >= budgets.monthly * threshold &&
          !this.alertsSent.has(alertKey)
        ) {
          this.sendAlert("monthly", threshold, this.monthlyTotal, budgets.monthly);
          this.alertsSent.add(alertKey);
        }
      }
    }
  }

  private async sendAlert(
    period: string,
    threshold: number,
    current: number,
    budget: number
  ): Promise<void> {
    const message = {
      type: "cost_alert",
      period,
      threshold: `${(threshold * 100).toFixed(0)}%`,
      current: `$${current.toFixed(4)}`,
      budget: `$${budget.toFixed(2)}`,
      timestamp: new Date().toISOString(),
    };

    console.log(JSON.stringify(message));

    // Send to webhook if configured
    if (this.config.alerts.webhookUrl) {
      try {
        await fetch(this.config.alerts.webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(message),
        });
      } catch (err) {
        console.error("Failed to send cost alert:", err);
      }
    }
  }

  private checkReset(): void {
    const now = new Date();

    // Reset daily
    if (now.getDate() !== this.lastResetDay) {
      this.dailyTotal = 0;
      this.lastResetDay = now.getDate();
      this.alertsSent = new Set(
        [...this.alertsSent].filter((k) => !k.startsWith("daily_"))
      );
    }

    // Reset weekly
    const currentWeek = this.getWeekNumber(now);
    if (currentWeek !== this.lastResetWeek) {
      this.weeklyTotal = 0;
      this.lastResetWeek = currentWeek;
      this.alertsSent = new Set(
        [...this.alertsSent].filter((k) => !k.startsWith("weekly_"))
      );
    }

    // Reset monthly
    if (now.getMonth() !== this.lastResetMonth) {
      this.monthlyTotal = 0;
      this.lastResetMonth = now.getMonth();
      this.alertsSent = new Set(
        [...this.alertsSent].filter((k) => !k.startsWith("monthly_"))
      );
    }
  }

  private getWeekNumber(date: Date): number {
    const d = new Date(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
    );
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }

  // Export data for analysis
  exportData(format: "json" | "csv" = "json"): string {
    if (format === "csv") {
      const headers = [
        "timestamp",
        "requestId",
        "provider",
        "model",
        "inputTokens",
        "outputTokens",
        "totalCost",
        "userId",
        "projectId",
      ];
      const rows = this.entries.map((e) =>
        [
          e.timestamp.toISOString(),
          e.requestId,
          e.provider,
          e.model,
          e.inputTokens,
          e.outputTokens,
          e.totalCost.toFixed(6),
          e.userId || "",
          e.projectId || "",
        ].join(",")
      );
      return [headers.join(","), ...rows].join("\n");
    }

    return JSON.stringify(this.entries, null, 2);
  }
}
