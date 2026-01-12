/**
 * Context Manager - Token counting, compression, and memory management
 */

import type { GatewayRequest, Message } from "../core/types";

interface ContextStats {
  totalTokens: number;
  systemTokens: number;
  userTokens: number;
  assistantTokens: number;
  compressionRatio: number;
}

interface ConversationMemory {
  sessionId: string;
  messages: Message[];
  summary?: string;
  lastAccessed: Date;
  totalTokens: number;
}

export class ContextManager {
  private memories: Map<string, ConversationMemory> = new Map();
  private maxMemories = 1000;
  private maxTokensPerMemory = 100000;

  // Estimate token count for text
  estimateTokens(text: string): number {
    // Rough approximation: 1 token ≈ 4 characters for English
    // More accurate: use tiktoken or cl100k_base tokenizer
    return Math.ceil(text.length / 4);
  }

  // Get context stats for a request
  getContextStats(request: GatewayRequest): ContextStats {
    let systemTokens = 0;
    let userTokens = 0;
    let assistantTokens = 0;

    for (const message of request.messages) {
      const content =
        typeof message.content === "string"
          ? message.content
          : message.content.map((b) => b.text || "").join("");

      const tokens = this.estimateTokens(content);

      switch (message.role) {
        case "system":
          systemTokens += tokens;
          break;
        case "user":
          userTokens += tokens;
          break;
        case "assistant":
          assistantTokens += tokens;
          break;
      }
    }

    const totalTokens = systemTokens + userTokens + assistantTokens;

    return {
      totalTokens,
      systemTokens,
      userTokens,
      assistantTokens,
      compressionRatio: 1.0,
    };
  }

  // Compress context to fit within token limit
  compressContext(
    request: GatewayRequest,
    maxTokens: number
  ): { request: GatewayRequest; stats: ContextStats } {
    const originalStats = this.getContextStats(request);

    if (originalStats.totalTokens <= maxTokens) {
      return { request, stats: originalStats };
    }

    // Strategy 1: Truncate older messages (keep system and recent)
    const systemMessage = request.messages.find((m) => m.role === "system");
    const nonSystemMessages = request.messages.filter((m) => m.role !== "system");

    const systemTokens = systemMessage
      ? this.estimateTokens(
          typeof systemMessage.content === "string"
            ? systemMessage.content
            : systemMessage.content.map((b) => b.text || "").join("")
        )
      : 0;

    const availableTokens = maxTokens - systemTokens;

    // Keep messages from the end until we hit the limit
    const keptMessages: Message[] = [];
    let currentTokens = 0;

    for (let i = nonSystemMessages.length - 1; i >= 0; i--) {
      const msg = nonSystemMessages[i]!;
      const content =
        typeof msg.content === "string"
          ? msg.content
          : msg.content.map((b) => b.text || "").join("");
      const msgTokens = this.estimateTokens(content);

      if (currentTokens + msgTokens <= availableTokens) {
        keptMessages.unshift(msg);
        currentTokens += msgTokens;
      } else {
        break;
      }
    }

    // Build compressed request
    const compressedMessages: Message[] = [];
    if (systemMessage) {
      compressedMessages.push(systemMessage);
    }

    // Add summary of truncated messages if significant content was removed
    const truncatedCount = nonSystemMessages.length - keptMessages.length;
    if (truncatedCount > 2) {
      compressedMessages.push({
        role: "system",
        content: `[Context: ${truncatedCount} earlier messages summarized. The conversation covered various topics before the messages shown below.]`,
      });
    }

    compressedMessages.push(...keptMessages);

    const compressedRequest = {
      ...request,
      messages: compressedMessages,
    };

    const newStats = this.getContextStats(compressedRequest);
    newStats.compressionRatio =
      originalStats.totalTokens / newStats.totalTokens;

    return { request: compressedRequest, stats: newStats };
  }

  // Summarize context for long conversations
  async summarizeContext(messages: Message[]): Promise<string> {
    // In production, call an LLM to summarize
    // Here we use a simple extractive approach

    const keyPoints: string[] = [];

    for (const msg of messages) {
      const content =
        typeof msg.content === "string"
          ? msg.content
          : msg.content.map((b) => b.text || "").join("");

      // Extract key sentences (first sentence of each message)
      const firstSentence = content.split(/[.!?]/)[0];
      if (firstSentence && firstSentence.length > 20) {
        keyPoints.push(`${msg.role}: ${firstSentence}`);
      }
    }

    return keyPoints.slice(0, 10).join("\n");
  }

  // Memory management for long-running sessions
  saveMemory(sessionId: string, messages: Message[]): void {
    const totalTokens = messages.reduce((sum, m) => {
      const content =
        typeof m.content === "string"
          ? m.content
          : m.content.map((b) => b.text || "").join("");
      return sum + this.estimateTokens(content);
    }, 0);

    this.memories.set(sessionId, {
      sessionId,
      messages,
      lastAccessed: new Date(),
      totalTokens,
    });

    // Evict old memories if over limit
    if (this.memories.size > this.maxMemories) {
      this.evictOldestMemory();
    }
  }

  loadMemory(sessionId: string): Message[] | null {
    const memory = this.memories.get(sessionId);
    if (!memory) return null;

    memory.lastAccessed = new Date();
    return memory.messages;
  }

  async loadMemoryWithSummary(
    sessionId: string,
    maxTokens: number
  ): Promise<{ messages: Message[]; summarized: boolean }> {
    const memory = this.memories.get(sessionId);
    if (!memory) {
      return { messages: [], summarized: false };
    }

    memory.lastAccessed = new Date();

    if (memory.totalTokens <= maxTokens) {
      return { messages: memory.messages, summarized: false };
    }

    // Compress if over limit
    const compressed = this.compressContext(
      { id: sessionId, messages: memory.messages },
      maxTokens
    );

    return { messages: compressed.request.messages, summarized: true };
  }

  clearMemory(sessionId: string): void {
    this.memories.delete(sessionId);
  }

  private evictOldestMemory(): void {
    let oldest: ConversationMemory | null = null;
    let oldestTime = Infinity;

    for (const memory of this.memories.values()) {
      const time = memory.lastAccessed.getTime();
      if (time < oldestTime) {
        oldestTime = time;
        oldest = memory;
      }
    }

    if (oldest) {
      this.memories.delete(oldest.sessionId);
    }
  }

  // Get memory stats
  getMemoryStats(): {
    totalSessions: number;
    totalTokens: number;
    avgTokensPerSession: number;
  } {
    let totalTokens = 0;
    for (const memory of this.memories.values()) {
      totalTokens += memory.totalTokens;
    }

    return {
      totalSessions: this.memories.size,
      totalTokens,
      avgTokensPerSession:
        this.memories.size > 0 ? totalTokens / this.memories.size : 0,
    };
  }
}

/**
 * Token Counter - More accurate token counting using character classes
 */
export class TokenCounter {
  // Approximate token counts for different content types
  countTokens(content: string): number {
    // Split on whitespace and punctuation
    const tokens = content.split(/[\s.,!?;:'"()\[\]{}]+/).filter((t) => t.length > 0);

    let count = 0;
    for (const token of tokens) {
      // Most words are 1-2 tokens
      if (token.length <= 4) {
        count += 1;
      } else if (token.length <= 8) {
        count += Math.ceil(token.length / 4);
      } else {
        // Longer words/technical terms
        count += Math.ceil(token.length / 3);
      }
    }

    // Account for whitespace and punctuation tokens
    const punctuation = (content.match(/[.,!?;:'"()\[\]{}]/g) || []).length;
    count += Math.ceil(punctuation / 2);

    return count;
  }

  // Count tokens for structured content
  countStructuredContent(messages: Message[]): {
    total: number;
    byRole: Record<string, number>;
  } {
    const byRole: Record<string, number> = {
      system: 0,
      user: 0,
      assistant: 0,
      tool: 0,
    };

    for (const message of messages) {
      const content =
        typeof message.content === "string"
          ? message.content
          : message.content.map((b) => b.text || JSON.stringify(b)).join("");

      const tokens = this.countTokens(content);
      byRole[message.role] = (byRole[message.role] || 0) + tokens;

      // Add overhead for role markers
      byRole[message.role] += 4;
    }

    const total = Object.values(byRole).reduce((sum, v) => sum + v, 0);

    return { total, byRole };
  }
}
