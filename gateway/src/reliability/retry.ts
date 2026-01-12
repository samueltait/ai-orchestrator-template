/**
 * Retry Handler - Exponential backoff with jitter
 */

import type { ReliabilityConfig } from "../core/types";

interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  backoffMultiplier?: number;
  maxDelayMs?: number;
  retryableErrors?: string[];
}

export class RetryHandler {
  private config: ReliabilityConfig;

  constructor(config: ReliabilityConfig) {
    this.config = config;
  }

  async execute<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const maxAttempts = options.maxAttempts ?? this.config.retryAttempts;
    const baseDelayMs = options.baseDelayMs ?? this.config.retryDelayMs;
    const backoffMultiplier =
      options.backoffMultiplier ?? this.config.retryBackoffMultiplier;
    const maxDelayMs = options.maxDelayMs ?? 30000;
    const retryableErrors = options.retryableErrors ?? [
      "rate_limit",
      "timeout",
      "server_error",
      "overloaded",
      "429",
      "500",
      "502",
      "503",
      "504",
    ];

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Add timeout wrapper
        const result = await this.withTimeout(
          fn(),
          this.config.timeout.requestMs
        );
        return result;
      } catch (error) {
        lastError = error as Error;
        const errorMessage = lastError.message.toLowerCase();

        // Check if error is retryable
        const isRetryable = retryableErrors.some(
          (e) =>
            errorMessage.includes(e.toLowerCase()) ||
            errorMessage.includes(e)
        );

        if (!isRetryable || attempt === maxAttempts) {
          throw lastError;
        }

        // Calculate delay with exponential backoff and jitter
        const exponentialDelay =
          baseDelayMs * Math.pow(backoffMultiplier, attempt - 1);
        const jitter = Math.random() * 0.3 * exponentialDelay; // 30% jitter
        const delay = Math.min(exponentialDelay + jitter, maxDelayMs);

        console.log(
          `[Retry] Attempt ${attempt}/${maxAttempts} failed: ${lastError.message}. Retrying in ${Math.round(delay)}ms`
        );

        await this.sleep(delay);
      }
    }

    throw lastError || new Error("Retry failed with unknown error");
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout>;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Request timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([promise, timeoutPromise]);
      clearTimeout(timeoutId!);
      return result;
    } catch (error) {
      clearTimeout(timeoutId!);
      throw error;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Deduplication handler - Prevents duplicate in-flight requests
 */
export class RequestDeduplicator {
  private inFlight: Map<string, Promise<unknown>> = new Map();

  async dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
    // Check if request is already in flight
    const existing = this.inFlight.get(key);
    if (existing) {
      return existing as Promise<T>;
    }

    // Execute and store the promise
    const promise = fn().finally(() => {
      this.inFlight.delete(key);
    });

    this.inFlight.set(key, promise);
    return promise;
  }

  // Generate deduplication key from request
  static generateKey(request: {
    messages: Array<{ role: string; content: unknown }>;
    model?: string;
  }): string {
    const lastMessage = request.messages[request.messages.length - 1];
    const content =
      typeof lastMessage?.content === "string"
        ? lastMessage.content
        : JSON.stringify(lastMessage?.content);

    return `${request.model || "default"}_${hashString(content)}`;
  }
}

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}
