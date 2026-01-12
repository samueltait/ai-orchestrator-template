/**
 * Circuit Breaker - Prevents cascade failures
 * States: CLOSED (normal) -> OPEN (failing) -> HALF_OPEN (testing)
 */

import type { Provider } from "../core/types";

type CircuitState = "closed" | "open" | "half_open";

interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeMs: number;
  halfOpenRequests: number;
}

interface CircuitStats {
  requests: number;
  errors: number;
  avgLatency: number;
}

export class CircuitBreaker {
  private provider: Provider;
  private config: CircuitBreakerConfig;
  private state: CircuitState = "closed";
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime?: Date;
  private halfOpenAttempts = 0;
  private latencies: number[] = [];
  private totalRequests = 0;
  private totalErrors = 0;

  constructor(provider: Provider, config: CircuitBreakerConfig) {
    this.provider = provider;
    this.config = config;
  }

  canExecute(): boolean {
    switch (this.state) {
      case "closed":
        return true;

      case "open":
        // Check if recovery time has passed
        if (this.lastFailureTime) {
          const timeSinceFailure = Date.now() - this.lastFailureTime.getTime();
          if (timeSinceFailure >= this.config.recoveryTimeMs) {
            this.transitionTo("half_open");
            return true;
          }
        }
        return false;

      case "half_open":
        // Allow limited requests to test recovery
        return this.halfOpenAttempts < this.config.halfOpenRequests;
    }
  }

  recordSuccess(): void {
    this.totalRequests++;

    switch (this.state) {
      case "closed":
        this.failureCount = 0;
        break;

      case "half_open":
        this.halfOpenAttempts++;
        this.successCount++;
        // If enough successes, close the circuit
        if (this.successCount >= this.config.halfOpenRequests) {
          this.transitionTo("closed");
        }
        break;

      case "open":
        // Shouldn't happen, but handle it
        break;
    }
  }

  recordFailure(): void {
    this.totalRequests++;
    this.totalErrors++;
    this.failureCount++;
    this.lastFailureTime = new Date();

    switch (this.state) {
      case "closed":
        if (this.failureCount >= this.config.failureThreshold) {
          this.transitionTo("open");
        }
        break;

      case "half_open":
        // Any failure in half-open state opens the circuit again
        this.transitionTo("open");
        break;

      case "open":
        // Already open, reset failure time
        break;
    }
  }

  recordLatency(latencyMs: number): void {
    this.latencies.push(latencyMs);
    // Keep last 100 latencies
    if (this.latencies.length > 100) {
      this.latencies.shift();
    }
  }

  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;

    switch (newState) {
      case "closed":
        this.failureCount = 0;
        this.successCount = 0;
        this.halfOpenAttempts = 0;
        break;

      case "open":
        this.lastFailureTime = new Date();
        break;

      case "half_open":
        this.successCount = 0;
        this.halfOpenAttempts = 0;
        break;
    }

    // Log state transition
    console.log(
      `[CircuitBreaker] ${this.provider}: ${oldState} -> ${newState}`
    );
  }

  getState(): CircuitState {
    return this.state;
  }

  getStats(): CircuitStats {
    const avgLatency =
      this.latencies.length > 0
        ? this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length
        : 0;

    return {
      requests: this.totalRequests,
      errors: this.totalErrors,
      avgLatency,
    };
  }

  // Manual reset for admin operations
  reset(): void {
    this.transitionTo("closed");
    this.latencies = [];
  }

  // Get time until circuit can be tested again (for open state)
  getTimeUntilRetry(): number | null {
    if (this.state !== "open" || !this.lastFailureTime) {
      return null;
    }
    const elapsed = Date.now() - this.lastFailureTime.getTime();
    return Math.max(0, this.config.recoveryTimeMs - elapsed);
  }
}

/**
 * Circuit Breaker Registry - Manages breakers for all providers
 */
export class CircuitBreakerRegistry {
  private breakers: Map<Provider, CircuitBreaker> = new Map();
  private config: CircuitBreakerConfig;

  constructor(config: CircuitBreakerConfig) {
    this.config = config;
  }

  get(provider: Provider): CircuitBreaker {
    let breaker = this.breakers.get(provider);
    if (!breaker) {
      breaker = new CircuitBreaker(provider, this.config);
      this.breakers.set(provider, breaker);
    }
    return breaker;
  }

  getAllStats(): Record<Provider, CircuitStats & { state: CircuitState }> {
    const stats: Record<string, CircuitStats & { state: CircuitState }> = {};
    for (const [provider, breaker] of this.breakers) {
      stats[provider] = {
        ...breaker.getStats(),
        state: breaker.getState(),
      };
    }
    return stats as Record<Provider, CircuitStats & { state: CircuitState }>;
  }

  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }
}
