/**
 * Provider Adapters - Unified interface for all LLM providers
 */

import type {
  GatewayRequest,
  ProviderConfig,
  TokenUsage,
  Provider,
} from "./types";

interface CompletionResult {
  content: string;
  usage: TokenUsage;
  toolCalls?: { id: string; name: string; arguments: string }[];
}

export class ProviderAdapter {
  private config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  async complete(request: GatewayRequest, model: string): Promise<CompletionResult> {
    switch (this.config.provider) {
      case "anthropic":
        return this.completeAnthropic(request, model);
      case "openai":
        return this.completeOpenAI(request, model);
      case "gemini":
        return this.completeGemini(request, model);
      case "ollama":
        return this.completeOllama(request, model);
      default:
        throw new Error(`Unknown provider: ${this.config.provider}`);
    }
  }

  private async completeAnthropic(
    request: GatewayRequest,
    model: string
  ): Promise<CompletionResult> {
    const messages = request.messages.filter((m) => m.role !== "system");
    const systemMessage = request.messages.find((m) => m.role === "system");

    const body: Record<string, unknown> = {
      model,
      max_tokens: request.maxTokens || 4096,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    };

    if (systemMessage) {
      body.system = typeof systemMessage.content === "string"
        ? systemMessage.content
        : JSON.stringify(systemMessage.content);
    }

    if (request.temperature !== undefined) {
      body.temperature = request.temperature;
    }

    if (request.tools && request.tools.length > 0) {
      body.tools = request.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema,
      }));
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as {
      content: Array<{ type: string; text?: string; id?: string; name?: string; input?: unknown }>;
      usage: { input_tokens: number; output_tokens: number };
    };

    const textContent = data.content
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("");

    const toolCalls = data.content
      .filter((c) => c.type === "tool_use")
      .map((c) => ({
        id: c.id!,
        name: c.name!,
        arguments: JSON.stringify(c.input),
      }));

    return {
      content: textContent,
      usage: {
        inputTokens: data.usage.input_tokens,
        outputTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens,
      },
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    };
  }

  private async completeOpenAI(
    request: GatewayRequest,
    model: string
  ): Promise<CompletionResult> {
    const body: Record<string, unknown> = {
      model,
      messages: request.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    };

    if (request.maxTokens) {
      body.max_tokens = request.maxTokens;
    }

    if (request.temperature !== undefined) {
      body.temperature = request.temperature;
    }

    if (request.tools && request.tools.length > 0) {
      body.tools = request.tools.map((t) => ({
        type: "function",
        function: {
          name: t.name,
          description: t.description,
          parameters: t.inputSchema,
        },
      }));
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as {
      choices: Array<{
        message: {
          content: string | null;
          tool_calls?: Array<{
            id: string;
            function: { name: string; arguments: string };
          }>;
        };
      }>;
      usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    };

    const choice = data.choices[0];
    const toolCalls = choice?.message.tool_calls?.map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: tc.function.arguments,
    }));

    return {
      content: choice?.message.content || "",
      usage: {
        inputTokens: data.usage.prompt_tokens,
        outputTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      },
      toolCalls,
    };
  }

  private async completeGemini(
    request: GatewayRequest,
    model: string
  ): Promise<CompletionResult> {
    const contents = request.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: typeof m.content === "string" ? m.content : JSON.stringify(m.content) }],
      }));

    const systemMessage = request.messages.find((m) => m.role === "system");
    const systemInstruction = systemMessage
      ? { parts: [{ text: typeof systemMessage.content === "string" ? systemMessage.content : JSON.stringify(systemMessage.content) }] }
      : undefined;

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        maxOutputTokens: request.maxTokens || 4096,
        temperature: request.temperature ?? 0.7,
      },
    };

    if (systemInstruction) {
      body.systemInstruction = systemInstruction;
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.config.apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as {
      candidates: Array<{
        content: { parts: Array<{ text: string }> };
      }>;
      usageMetadata: {
        promptTokenCount: number;
        candidatesTokenCount: number;
        totalTokenCount: number;
      };
    };

    const content = data.candidates[0]?.content.parts
      .map((p) => p.text)
      .join("");

    return {
      content: content || "",
      usage: {
        inputTokens: data.usageMetadata?.promptTokenCount || 0,
        outputTokens: data.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: data.usageMetadata?.totalTokenCount || 0,
      },
    };
  }

  private async completeOllama(
    request: GatewayRequest,
    model: string
  ): Promise<CompletionResult> {
    const baseUrl = this.config.baseUrl || "http://localhost:11434";

    const messages = request.messages.map((m) => ({
      role: m.role,
      content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
    }));

    const body = {
      model,
      messages,
      stream: false,
      options: {
        num_predict: request.maxTokens || 4096,
        temperature: request.temperature ?? 0.7,
      },
    };

    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama API error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as {
      message: { content: string };
      prompt_eval_count?: number;
      eval_count?: number;
    };

    return {
      content: data.message.content,
      usage: {
        inputTokens: data.prompt_eval_count || 0,
        outputTokens: data.eval_count || 0,
        totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
      },
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      switch (this.config.provider) {
        case "anthropic":
          // Simple model list check
          const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": this.config.apiKey,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
              model: "claude-3-5-haiku-20241022",
              max_tokens: 1,
              messages: [{ role: "user", content: "hi" }],
            }),
          });
          return anthropicResponse.ok;

        case "openai":
          const openaiResponse = await fetch("https://api.openai.com/v1/models", {
            headers: { Authorization: `Bearer ${this.config.apiKey}` },
          });
          return openaiResponse.ok;

        case "gemini":
          const geminiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${this.config.apiKey}`
          );
          return geminiResponse.ok;

        case "ollama":
          const ollamaResponse = await fetch(
            `${this.config.baseUrl || "http://localhost:11434"}/api/tags`
          );
          return ollamaResponse.ok;

        default:
          return false;
      }
    } catch {
      return false;
    }
  }

  getProvider(): Provider {
    return this.config.provider;
  }
}
