/**
 * Embedding Provider - Real embeddings from OpenAI, Ollama, or local
 * Replaces hash-based similarity with proper vector embeddings
 */

export type EmbeddingModel =
  | "text-embedding-3-small"
  | "text-embedding-3-large"
  | "text-embedding-ada-002"
  | "nomic-embed-text"
  | "mxbai-embed-large"
  | "all-minilm"
  | "local";

interface EmbeddingConfig {
  provider: "openai" | "ollama" | "local";
  model: EmbeddingModel;
  apiKey?: string;
  baseUrl?: string;
  dimensions?: number;
  cacheEmbeddings?: boolean;
}

export class EmbeddingProvider {
  private config: EmbeddingConfig;
  private cache: Map<string, number[]>;
  private maxCacheSize = 10000;

  constructor(config?: Partial<EmbeddingConfig>) {
    this.config = {
      provider: config?.provider || "local",
      model: config?.model || "local",
      apiKey: config?.apiKey || process.env.OPENAI_API_KEY,
      baseUrl: config?.baseUrl || "http://localhost:11434",
      dimensions: config?.dimensions || 384,
      cacheEmbeddings: config?.cacheEmbeddings ?? true,
    };
    this.cache = new Map();
  }

  async embed(text: string): Promise<number[]> {
    // Check cache
    if (this.config.cacheEmbeddings) {
      const cached = this.cache.get(text);
      if (cached) return cached;
    }

    let embedding: number[];

    switch (this.config.provider) {
      case "openai":
        embedding = await this.embedOpenAI(text);
        break;
      case "ollama":
        embedding = await this.embedOllama(text);
        break;
      case "local":
      default:
        embedding = this.embedLocal(text);
        break;
    }

    // Cache the embedding
    if (this.config.cacheEmbeddings) {
      this.cache.set(text, embedding);
      if (this.cache.size > this.maxCacheSize) {
        // Remove oldest entry
        const firstKey = this.cache.keys().next().value;
        if (firstKey) this.cache.delete(firstKey);
      }
    }

    return embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    // For OpenAI, we can batch embed
    if (this.config.provider === "openai") {
      return this.embedOpenAIBatch(texts);
    }

    // For others, embed one by one
    return Promise.all(texts.map((text) => this.embed(text)));
  }

  private async embedOpenAI(text: string): Promise<number[]> {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        input: text,
        dimensions: this.config.dimensions,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI embedding error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as {
      data: Array<{ embedding: number[] }>;
    };

    return data.data[0]?.embedding || [];
  }

  private async embedOpenAIBatch(texts: string[]): Promise<number[][]> {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        input: texts,
        dimensions: this.config.dimensions,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI embedding error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as {
      data: Array<{ embedding: number[]; index: number }>;
    };

    // Sort by index to maintain order
    const sorted = data.data.sort((a, b) => a.index - b.index);
    return sorted.map((item) => item.embedding);
  }

  private async embedOllama(text: string): Promise<number[]> {
    const baseUrl = this.config.baseUrl || "http://localhost:11434";

    const response = await fetch(`${baseUrl}/api/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.config.model,
        prompt: text,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama embedding error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as {
      embedding: number[];
    };

    return data.embedding;
  }

  private embedLocal(text: string): number[] {
    // Local hash-based embedding for development/fallback
    const dimensions = this.config.dimensions || 384;
    const embedding = new Array(dimensions).fill(0);
    const normalized = text.toLowerCase().trim();

    // Character-level features
    for (let i = 0; i < normalized.length; i++) {
      const charCode = normalized.charCodeAt(i);
      embedding[i % dimensions] += charCode / 255;
      embedding[(i * 7) % dimensions] += Math.sin(charCode);
      embedding[(i * 13) % dimensions] += Math.cos(charCode * 0.1);
    }

    // Word-level features
    const words = normalized.split(/\s+/);
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      if (!word) continue;
      const hash = this.hashString(word);
      embedding[(hash * 3) % dimensions] += 1;
      embedding[(hash * 5) % dimensions] += word.length / 10;
    }

    // N-gram features
    for (let i = 0; i < normalized.length - 2; i++) {
      const trigram = normalized.substring(i, i + 3);
      const hash = this.hashString(trigram);
      embedding[(hash * 11) % dimensions] += 0.5;
    }

    // Normalize to unit vector
    const magnitude = Math.sqrt(
      embedding.reduce((sum, val) => sum + val * val, 0)
    );
    return embedding.map((val) => (magnitude > 0 ? val / magnitude : 0));
  }

  private hashString(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 33) ^ str.charCodeAt(i);
    }
    return Math.abs(hash);
  }

  // Utility: compute cosine similarity between two embeddings
  static cosineSimilarity(a: number[], b: number[]): number {
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

  // Utility: find most similar embedding from a list
  static findMostSimilar(
    query: number[],
    candidates: { id: string; embedding: number[] }[],
    threshold = 0.8
  ): { id: string; similarity: number } | null {
    let best: { id: string; similarity: number } | null = null;

    for (const candidate of candidates) {
      const similarity = this.cosineSimilarity(query, candidate.embedding);
      if (similarity >= threshold && (!best || similarity > best.similarity)) {
        best = { id: candidate.id, similarity };
      }
    }

    return best;
  }

  clearCache(): void {
    this.cache.clear();
  }

  getCacheSize(): number {
    return this.cache.size;
  }
}

/**
 * Factory function for creating embedding providers
 */
export function createEmbeddingProvider(
  type: "openai" | "ollama" | "local" = "local",
  options: Partial<EmbeddingConfig> = {}
): EmbeddingProvider {
  switch (type) {
    case "openai":
      return new EmbeddingProvider({
        provider: "openai",
        model: options.model || "text-embedding-3-small",
        apiKey: options.apiKey || process.env.OPENAI_API_KEY,
        dimensions: options.dimensions || 1536,
        ...options,
      });

    case "ollama":
      return new EmbeddingProvider({
        provider: "ollama",
        model: options.model || "nomic-embed-text",
        baseUrl: options.baseUrl || "http://localhost:11434",
        dimensions: options.dimensions || 768,
        ...options,
      });

    case "local":
    default:
      return new EmbeddingProvider({
        provider: "local",
        model: "local",
        dimensions: options.dimensions || 384,
        ...options,
      });
  }
}
