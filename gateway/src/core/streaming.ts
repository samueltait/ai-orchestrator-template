/**
 * Streaming Support - First-token latency optimization
 * Provides streaming responses from all providers
 */

import type { GatewayRequest, Provider, ProviderConfig, TokenUsage } from "./types";

export interface StreamChunk {
  type: "text" | "tool_call" | "done" | "error";
  content?: string;
  toolCall?: {
    id: string;
    name: string;
    arguments: string;
  };
  error?: string;
  usage?: TokenUsage;
  finishReason?: string;
}

export interface StreamMetrics {
  firstTokenMs: number;
  totalMs: number;
  tokensPerSecond: number;
  totalTokens: number;
}

export type StreamCallback = (chunk: StreamChunk) => void;

export class StreamingProvider {
  private config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  async *stream(
    request: GatewayRequest,
    model: string
  ): AsyncGenerator<StreamChunk, StreamMetrics, undefined> {
    const startTime = Date.now();
    let firstTokenTime: number | null = null;
    let totalTokens = 0;

    try {
      switch (this.config.provider) {
        case "anthropic":
          yield* this.streamAnthropic(request, model, (time) => {
            if (!firstTokenTime) firstTokenTime = time;
          });
          break;
        case "openai":
          yield* this.streamOpenAI(request, model, (time) => {
            if (!firstTokenTime) firstTokenTime = time;
          });
          break;
        case "gemini":
          yield* this.streamGemini(request, model, (time) => {
            if (!firstTokenTime) firstTokenTime = time;
          });
          break;
        case "ollama":
          yield* this.streamOllama(request, model, (time) => {
            if (!firstTokenTime) firstTokenTime = time;
          });
          break;
        default:
          throw new Error(`Streaming not supported for ${this.config.provider}`);
      }
    } catch (error) {
      yield {
        type: "error",
        error: (error as Error).message,
      };
    }

    const totalMs = Date.now() - startTime;

    return {
      firstTokenMs: firstTokenTime ? firstTokenTime - startTime : totalMs,
      totalMs,
      tokensPerSecond: totalMs > 0 ? (totalTokens / totalMs) * 1000 : 0,
      totalTokens,
    };
  }

  private async *streamAnthropic(
    request: GatewayRequest,
    model: string,
    onFirstToken: (time: number) => void
  ): AsyncGenerator<StreamChunk> {
    const messages = request.messages.filter((m) => m.role !== "system");
    const systemMessage = request.messages.find((m) => m.role === "system");

    const body: Record<string, unknown> = {
      model,
      max_tokens: request.maxTokens || 4096,
      stream: true,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    };

    if (systemMessage) {
      body.system =
        typeof systemMessage.content === "string"
          ? systemMessage.content
          : JSON.stringify(systemMessage.content);
    }

    if (request.temperature !== undefined) {
      body.temperature = request.temperature;
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
      throw new Error(`Anthropic streaming error: ${response.status} - ${error}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";
    let firstToken = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const event = JSON.parse(data) as {
              type: string;
              delta?: { type: string; text?: string };
              message?: { usage: { input_tokens: number; output_tokens: number } };
            };

            if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
              if (!firstToken) {
                onFirstToken(Date.now());
                firstToken = true;
              }
              yield { type: "text", content: event.delta.text };
            } else if (event.type === "message_stop") {
              yield { type: "done" };
            } else if (event.type === "message_delta" && event.message?.usage) {
              yield {
                type: "done",
                usage: {
                  inputTokens: event.message.usage.input_tokens,
                  outputTokens: event.message.usage.output_tokens,
                  totalTokens:
                    event.message.usage.input_tokens + event.message.usage.output_tokens,
                },
              };
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }
  }

  private async *streamOpenAI(
    request: GatewayRequest,
    model: string,
    onFirstToken: (time: number) => void
  ): AsyncGenerator<StreamChunk> {
    const body: Record<string, unknown> = {
      model,
      stream: true,
      stream_options: { include_usage: true },
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
      throw new Error(`OpenAI streaming error: ${response.status} - ${error}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";
    let firstToken = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") {
            yield { type: "done" };
            continue;
          }

          try {
            const event = JSON.parse(data) as {
              choices?: Array<{
                delta?: { content?: string; tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }> };
                finish_reason?: string;
              }>;
              usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
            };

            const choice = event.choices?.[0];
            if (choice?.delta?.content) {
              if (!firstToken) {
                onFirstToken(Date.now());
                firstToken = true;
              }
              yield { type: "text", content: choice.delta.content };
            }

            if (choice?.delta?.tool_calls) {
              for (const tc of choice.delta.tool_calls) {
                yield {
                  type: "tool_call",
                  toolCall: {
                    id: tc.id,
                    name: tc.function.name,
                    arguments: tc.function.arguments,
                  },
                };
              }
            }

            if (event.usage) {
              yield {
                type: "done",
                usage: {
                  inputTokens: event.usage.prompt_tokens,
                  outputTokens: event.usage.completion_tokens,
                  totalTokens: event.usage.total_tokens,
                },
              };
            }

            if (choice?.finish_reason) {
              yield { type: "done", finishReason: choice.finish_reason };
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }
  }

  private async *streamGemini(
    request: GatewayRequest,
    model: string,
    onFirstToken: (time: number) => void
  ): AsyncGenerator<StreamChunk> {
    const contents = request.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [
          {
            text:
              typeof m.content === "string" ? m.content : JSON.stringify(m.content),
          },
        ],
      }));

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${this.config.apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        generationConfig: {
          maxOutputTokens: request.maxTokens || 4096,
          temperature: request.temperature ?? 0.7,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini streaming error: ${response.status} - ${error}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";
    let firstToken = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const event = JSON.parse(line.slice(6)) as {
              candidates?: Array<{
                content?: { parts?: Array<{ text?: string }> };
                finishReason?: string;
              }>;
              usageMetadata?: {
                promptTokenCount: number;
                candidatesTokenCount: number;
                totalTokenCount: number;
              };
            };

            const candidate = event.candidates?.[0];
            const text = candidate?.content?.parts?.[0]?.text;

            if (text) {
              if (!firstToken) {
                onFirstToken(Date.now());
                firstToken = true;
              }
              yield { type: "text", content: text };
            }

            if (candidate?.finishReason) {
              yield { type: "done", finishReason: candidate.finishReason };
            }

            if (event.usageMetadata) {
              yield {
                type: "done",
                usage: {
                  inputTokens: event.usageMetadata.promptTokenCount,
                  outputTokens: event.usageMetadata.candidatesTokenCount,
                  totalTokens: event.usageMetadata.totalTokenCount,
                },
              };
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }
  }

  private async *streamOllama(
    request: GatewayRequest,
    model: string,
    onFirstToken: (time: number) => void
  ): AsyncGenerator<StreamChunk> {
    const baseUrl = this.config.baseUrl || "http://localhost:11434";

    const messages = request.messages.map((m) => ({
      role: m.role,
      content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
    }));

    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        options: {
          num_predict: request.maxTokens || 4096,
          temperature: request.temperature ?? 0.7,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama streaming error: ${response.status} - ${error}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";
    let firstToken = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const event = JSON.parse(line) as {
            message?: { content?: string };
            done?: boolean;
            prompt_eval_count?: number;
            eval_count?: number;
          };

          if (event.message?.content) {
            if (!firstToken) {
              onFirstToken(Date.now());
              firstToken = true;
            }
            yield { type: "text", content: event.message.content };
          }

          if (event.done) {
            yield {
              type: "done",
              usage: {
                inputTokens: event.prompt_eval_count || 0,
                outputTokens: event.eval_count || 0,
                totalTokens: (event.prompt_eval_count || 0) + (event.eval_count || 0),
              },
            };
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }
  }
}

/**
 * Stream aggregator - Collects stream chunks into full response
 */
export async function collectStream(
  stream: AsyncGenerator<StreamChunk, StreamMetrics, undefined>
): Promise<{
  content: string;
  toolCalls: Array<{ id: string; name: string; arguments: string }>;
  usage?: TokenUsage;
  metrics: StreamMetrics;
}> {
  let content = "";
  const toolCalls: Array<{ id: string; name: string; arguments: string }> = [];
  let usage: TokenUsage | undefined;

  let result = await stream.next();

  while (!result.done) {
    const chunk = result.value;

    if (chunk.type === "text" && chunk.content) {
      content += chunk.content;
    } else if (chunk.type === "tool_call" && chunk.toolCall) {
      toolCalls.push(chunk.toolCall);
    } else if (chunk.type === "done" && chunk.usage) {
      usage = chunk.usage;
    }

    result = await stream.next();
  }

  return {
    content,
    toolCalls,
    usage,
    metrics: result.value,
  };
}

/**
 * Stream callback wrapper - Converts async generator to callback-based
 */
export async function streamWithCallback(
  stream: AsyncGenerator<StreamChunk, StreamMetrics, undefined>,
  callback: StreamCallback
): Promise<StreamMetrics> {
  let result = await stream.next();

  while (!result.done) {
    callback(result.value);
    result = await stream.next();
  }

  return result.value;
}
