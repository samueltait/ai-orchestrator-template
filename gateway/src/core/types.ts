/**
 * Core Types for LLM Gateway
 * Defines the unified interface for all LLM providers
 */

export type Provider = "anthropic" | "openai" | "gemini" | "ollama";

export type ModelTier = "premium" | "standard" | "economy";

export interface ModelConfig {
  provider: Provider;
  model: string;
  tier: ModelTier;
  maxTokens: number;
  costPer1kInput: number;
  costPer1kOutput: number;
  latencyP50Ms: number;
  latencyP95Ms: number;
  capabilities: ModelCapability[];
}

export type ModelCapability =
  | "reasoning"
  | "coding"
  | "creative"
  | "vision"
  | "function_calling"
  | "long_context"
  | "fast"
  | "cheap";

export interface GatewayRequest {
  id: string;
  messages: Message[];
  model?: string;
  provider?: Provider;
  maxTokens?: number;
  temperature?: number;
  tools?: Tool[];
  stream?: boolean;
  metadata?: RequestMetadata;
  routing?: RoutingPreferences;
}

export interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string | ContentBlock[];
  name?: string;
  toolCallId?: string;
}

export interface ContentBlock {
  type: "text" | "image" | "tool_use" | "tool_result";
  text?: string;
  source?: ImageSource;
  id?: string;
  name?: string;
  input?: unknown;
  content?: string;
}

export interface ImageSource {
  type: "base64" | "url";
  mediaType: string;
  data: string;
}

export interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface RequestMetadata {
  userId?: string;
  projectId?: string;
  featureId?: string;
  sessionId?: string;
  tags?: string[];
  budget?: BudgetConstraints;
}

export interface BudgetConstraints {
  maxCostUsd?: number;
  maxLatencyMs?: number;
  maxTokens?: number;
}

export interface RoutingPreferences {
  strategy?: RoutingStrategy;
  preferredProviders?: Provider[];
  excludeProviders?: Provider[];
  requiredCapabilities?: ModelCapability[];
  fallbackEnabled?: boolean;
  cacheEnabled?: boolean;
}

export type RoutingStrategy =
  | "cost_optimized"
  | "latency_optimized"
  | "quality_optimized"
  | "balanced";

export interface GatewayResponse {
  id: string;
  requestId: string;
  provider: Provider;
  model: string;
  content: string;
  toolCalls?: ToolCall[];
  usage: TokenUsage;
  latencyMs: number;
  cached: boolean;
  cost: CostBreakdown;
  metadata: ResponseMetadata;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface CostBreakdown {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  currency: "USD";
}

export interface ResponseMetadata {
  routingDecision: RoutingDecision;
  cacheStatus: CacheStatus;
  retryCount: number;
  traceId: string;
  spanId: string;
}

export interface RoutingDecision {
  strategy: RoutingStrategy;
  selectedModel: string;
  selectedProvider: Provider;
  reason: string;
  alternativesConsidered: string[];
  complexityScore?: number;
}

export interface CacheStatus {
  hit: boolean;
  key?: string;
  ttlSeconds?: number;
  similarity?: number;
}

export interface ProviderHealth {
  provider: Provider;
  healthy: boolean;
  latencyMs: number;
  errorRate: number;
  lastCheck: Date;
  consecutiveFailures: number;
}

export interface CircuitBreakerState {
  provider: Provider;
  state: "closed" | "open" | "half_open";
  failureCount: number;
  lastFailure?: Date;
  nextRetry?: Date;
}

export interface GatewayConfig {
  providers: ProviderConfig[];
  routing: RoutingConfig;
  cache: CacheConfig;
  reliability: ReliabilityConfig;
  observability: ObservabilityConfig;
  security: SecurityConfig;
  cost: CostConfig;
}

export interface ProviderConfig {
  provider: Provider;
  apiKey: string;
  baseUrl?: string;
  models: ModelConfig[];
  enabled: boolean;
  weight: number;
  rateLimit?: RateLimitConfig;
}

export interface RateLimitConfig {
  requestsPerMinute: number;
  tokensPerMinute: number;
}

export interface RoutingConfig {
  defaultStrategy: RoutingStrategy;
  complexityThresholds: {
    simple: number;
    medium: number;
    complex: number;
  };
  modelMapping: Record<string, ModelConfig>;
}

export interface CacheConfig {
  enabled: boolean;
  type: "memory" | "redis";
  redisUrl?: string;
  ttlSeconds: number;
  maxSize: number;
  semanticSimilarityThreshold: number;
}

export interface ReliabilityConfig {
  retryAttempts: number;
  retryDelayMs: number;
  retryBackoffMultiplier: number;
  circuitBreaker: {
    failureThreshold: number;
    recoveryTimeMs: number;
    halfOpenRequests: number;
  };
  timeout: {
    requestMs: number;
    streamMs: number;
  };
}

export interface ObservabilityConfig {
  tracing: {
    enabled: boolean;
    serviceName: string;
    exporterUrl?: string;
  };
  metrics: {
    enabled: boolean;
    prefix: string;
  };
  logging: {
    level: "debug" | "info" | "warn" | "error";
    format: "json" | "pretty";
  };
}

export interface SecurityConfig {
  piiDetection: {
    enabled: boolean;
    action: "mask" | "block" | "warn";
    patterns: string[];
  };
  promptInjection: {
    enabled: boolean;
    action: "block" | "warn";
  };
  outputSanitization: {
    enabled: boolean;
    blockedPatterns: string[];
  };
  auditLog: {
    enabled: boolean;
    destination: "file" | "stdout" | "remote";
    path?: string;
  };
}

export interface CostConfig {
  budgets: {
    daily?: number;
    weekly?: number;
    monthly?: number;
    perRequest?: number;
  };
  alerts: {
    enabled: boolean;
    thresholds: number[];
    webhookUrl?: string;
  };
  tracking: {
    byUser: boolean;
    byProject: boolean;
    byFeature: boolean;
  };
}

export interface EvalResult {
  id: string;
  requestId: string;
  scores: {
    relevance: number;
    coherence: number;
    accuracy: number;
    helpfulness: number;
    safety: number;
  };
  feedback?: string;
  evaluator: "llm" | "human" | "automated";
  timestamp: Date;
}

export interface ABTestConfig {
  id: string;
  name: string;
  variants: ABVariant[];
  trafficSplit: number[];
  metrics: string[];
  startDate: Date;
  endDate?: Date;
}

export interface ABVariant {
  id: string;
  name: string;
  promptTemplate?: string;
  model?: string;
  parameters?: Record<string, unknown>;
}
