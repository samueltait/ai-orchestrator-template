/**
 * Redis Semantic Cache - Distributed caching for multi-instance deployments
 * Uses Redis for storage and real embeddings for semantic matching
 */

import type { GatewayRequest, CacheConfig } from "../core/types";
import { EmbeddingProvider } from "./embeddings";

interface RedisCacheEntry {
  embedding: number[];
  response: string;
  createdAt: number;
  hits: number;
  model?: string;
  provider?: string;
}

interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
}

export class DistributedRedisCache {
  private config: CacheConfig;
  private redis: RedisClient;
  private embeddings: EmbeddingProvider;
  private stats: { hits: number; misses: number };
  private keyPrefix = "llm_cache:";
  private embeddingKeyPrefix = "llm_embed:";
  private indexKey = "llm_cache_index";

  constructor(config: CacheConfig, embeddings?: EmbeddingProvider) {
    this.config = config;
    this.redis = new RedisClient(config.redisUrl || "redis://localhost:6379");
    this.embeddings = embeddings || new EmbeddingProvider();
    this.stats = { hits: 0, misses: 0 };
  }

  async connect(): Promise<void> {
    await this.redis.connect();
  }

  async disconnect(): Promise<void> {
    await this.redis.disconnect();
  }

  async get(request: GatewayRequest): Promise<string | null> {
    if (!this.config.enabled) return null;

    const queryText = this.extractQueryText(request);
    const queryEmbedding = await this.embeddings.embed(queryText);

    // Get all cache keys from index
    const keys = await this.redis.smembers(this.indexKey);

    let bestMatch: { key: string; response: string; similarity: number } | null = null;

    // Check each cached entry for similarity
    for (const key of keys) {
      const entryJson = await this.redis.get(key);
      if (!entryJson) {
        // Clean up stale index entry
        await this.redis.srem(this.indexKey, key);
        continue;
      }

      try {
        const entry: RedisCacheEntry = JSON.parse(entryJson);

        // Check TTL
        if (Date.now() - entry.createdAt > this.config.ttlSeconds * 1000) {
          await this.redis.del(key);
          await this.redis.srem(this.indexKey, key);
          continue;
        }

        const similarity = this.cosineSimilarity(queryEmbedding, entry.embedding);

        if (
          similarity >= this.config.semanticSimilarityThreshold &&
          (!bestMatch || similarity > bestMatch.similarity)
        ) {
          bestMatch = { key, response: entry.response, similarity };
        }
      } catch {
        // Invalid entry, remove it
        await this.redis.del(key);
        await this.redis.srem(this.indexKey, key);
      }
    }

    if (bestMatch) {
      this.stats.hits++;
      // Update hit count
      const entryJson = await this.redis.get(bestMatch.key);
      if (entryJson) {
        const entry: RedisCacheEntry = JSON.parse(entryJson);
        entry.hits++;
        await this.redis.set(bestMatch.key, JSON.stringify(entry));
      }
      return bestMatch.response;
    }

    this.stats.misses++;
    return null;
  }

  async set(request: GatewayRequest, response: string): Promise<void> {
    if (!this.config.enabled) return;

    // Check size limit
    const currentSize = await this.redis.scard(this.indexKey);
    if (currentSize >= this.config.maxSize) {
      await this.evictLRU();
    }

    const queryText = this.extractQueryText(request);
    const embedding = await this.embeddings.embed(queryText);
    const key = `${this.keyPrefix}${this.generateKey(queryText)}`;

    const entry: RedisCacheEntry = {
      embedding,
      response,
      createdAt: Date.now(),
      hits: 0,
      model: request.model,
      provider: request.provider,
    };

    await this.redis.set(key, JSON.stringify(entry));
    await this.redis.sadd(this.indexKey, key);

    // Set TTL on the key itself
    await this.redis.expire(key, this.config.ttlSeconds);
  }

  async getStats(): Promise<CacheStats> {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? this.stats.hits / total : 0,
    };
  }

  private extractQueryText(request: GatewayRequest): string {
    const userMessages = request.messages.filter((m) => m.role === "user");
    const lastMessage = userMessages[userMessages.length - 1];

    if (!lastMessage) return "";

    if (typeof lastMessage.content === "string") {
      return lastMessage.content;
    }

    return lastMessage.content
      .filter((block) => block.type === "text")
      .map((block) => block.text || "")
      .join(" ");
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i]! * b[i]!;
      magnitudeA += a[i]! * a[i]!;
      magnitudeB += b[i]! * b[i]!;
    }

    const magnitude = Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB);
    return magnitude > 0 ? dotProduct / magnitude : 0;
  }

  private generateKey(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return `${Math.abs(hash).toString(36)}_${Date.now()}`;
  }

  private async evictLRU(): Promise<void> {
    const keys = await this.redis.smembers(this.indexKey);

    let oldestKey: string | null = null;
    let lowestScore = Infinity;

    for (const key of keys) {
      const entryJson = await this.redis.get(key);
      if (!entryJson) continue;

      try {
        const entry: RedisCacheEntry = JSON.parse(entryJson);
        const age = Date.now() - entry.createdAt;
        const score = entry.hits / (age / 1000 + 1);

        if (score < lowestScore) {
          lowestScore = score;
          oldestKey = key;
        }
      } catch {
        // Remove invalid entries
        await this.redis.del(key);
        await this.redis.srem(this.indexKey, key);
      }
    }

    if (oldestKey) {
      await this.redis.del(oldestKey);
      await this.redis.srem(this.indexKey, oldestKey);
    }
  }

  async clear(): Promise<void> {
    const keys = await this.redis.smembers(this.indexKey);
    for (const key of keys) {
      await this.redis.del(key);
    }
    await this.redis.del(this.indexKey);
    this.stats = { hits: 0, misses: 0 };
  }

  async size(): Promise<number> {
    return await this.redis.scard(this.indexKey);
  }
}

/**
 * Redis Client wrapper - Uses ioredis under the hood
 */
class RedisClient {
  private url: string;
  private client: Redis | null = null;

  constructor(url: string) {
    this.url = url;
  }

  async connect(): Promise<void> {
    const { default: Redis } = await import("ioredis");
    this.client = new Redis(this.url);

    // Wait for connection
    await new Promise<void>((resolve, reject) => {
      this.client!.on("ready", resolve);
      this.client!.on("error", reject);
    });
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.client) throw new Error("Redis not connected");
    return this.client.get(key);
  }

  async set(key: string, value: string): Promise<void> {
    if (!this.client) throw new Error("Redis not connected");
    await this.client.set(key, value);
  }

  async del(key: string): Promise<void> {
    if (!this.client) throw new Error("Redis not connected");
    await this.client.del(key);
  }

  async expire(key: string, seconds: number): Promise<void> {
    if (!this.client) throw new Error("Redis not connected");
    await this.client.expire(key, seconds);
  }

  async sadd(key: string, member: string): Promise<void> {
    if (!this.client) throw new Error("Redis not connected");
    await this.client.sadd(key, member);
  }

  async srem(key: string, member: string): Promise<void> {
    if (!this.client) throw new Error("Redis not connected");
    await this.client.srem(key, member);
  }

  async smembers(key: string): Promise<string[]> {
    if (!this.client) throw new Error("Redis not connected");
    return this.client.smembers(key);
  }

  async scard(key: string): Promise<number> {
    if (!this.client) throw new Error("Redis not connected");
    return this.client.scard(key);
  }
}

// Type for ioredis
type Redis = import("ioredis").default;
