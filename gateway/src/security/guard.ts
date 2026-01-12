/**
 * Security Guard - PII detection, prompt injection prevention, output sanitization
 */

import type { GatewayRequest, SecurityConfig } from "../core/types";

interface SecurityCheckResult {
  blocked: boolean;
  reason?: string;
  warnings: string[];
  sanitizedRequest?: GatewayRequest;
  piiDetected?: PIIDetection[];
  injectionDetected?: InjectionDetection[];
}

interface PIIDetection {
  type: string;
  pattern: string;
  location: string;
  masked: boolean;
}

interface InjectionDetection {
  type: string;
  pattern: string;
  confidence: number;
}

export class SecurityGuard {
  private config: SecurityConfig;
  private piiPatterns: RegExp[];
  private injectionPatterns: InjectionPattern[];

  constructor(config: SecurityConfig) {
    this.config = config;
    this.piiPatterns = config.piiDetection.patterns.map((p) => new RegExp(p, "gi"));
    this.injectionPatterns = this.initInjectionPatterns();
  }

  private initInjectionPatterns(): InjectionPattern[] {
    return [
      // Direct injection attempts
      {
        pattern: /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?)/i,
        type: "instruction_override",
        confidence: 0.9,
      },
      {
        pattern: /disregard\s+(all\s+)?(previous|prior|system)\s+(instructions?|prompts?)/i,
        type: "instruction_override",
        confidence: 0.9,
      },
      {
        pattern: /forget\s+(everything|all)\s+(you\s+)?(know|learned|were\s+told)/i,
        type: "instruction_override",
        confidence: 0.85,
      },
      // Role manipulation
      {
        pattern: /you\s+are\s+(now\s+)?(a|an)\s+\w+\s+(that|who|which)/i,
        type: "role_manipulation",
        confidence: 0.6,
      },
      {
        pattern: /pretend\s+(you\s+are|to\s+be)\s+(a|an)/i,
        type: "role_manipulation",
        confidence: 0.5,
      },
      // System prompt extraction
      {
        pattern: /what\s+(is|are)\s+your\s+(system\s+)?(instructions?|prompts?|rules?)/i,
        type: "prompt_extraction",
        confidence: 0.7,
      },
      {
        pattern: /show\s+(me\s+)?(your|the)\s+(system\s+)?(prompt|instructions?)/i,
        type: "prompt_extraction",
        confidence: 0.8,
      },
      {
        pattern: /repeat\s+(your|the)\s+(system\s+)?(prompt|instructions?)/i,
        type: "prompt_extraction",
        confidence: 0.85,
      },
      // Jailbreak attempts
      {
        pattern: /\bDAN\b.*\bdo\s+anything\s+now\b/i,
        type: "jailbreak",
        confidence: 0.95,
      },
      {
        pattern: /developer\s+mode\s+(enabled|activated|on)/i,
        type: "jailbreak",
        confidence: 0.8,
      },
      // Delimiter injection
      {
        pattern: /```\s*(system|assistant|user)\s*\n/i,
        type: "delimiter_injection",
        confidence: 0.7,
      },
      {
        pattern: /<\|?(system|assistant|user)\|?>/i,
        type: "delimiter_injection",
        confidence: 0.75,
      },
    ];
  }

  async check(request: GatewayRequest): Promise<SecurityCheckResult> {
    const result: SecurityCheckResult = {
      blocked: false,
      warnings: [],
      piiDetected: [],
      injectionDetected: [],
    };

    // Check PII
    if (this.config.piiDetection.enabled) {
      const piiResult = this.checkPII(request);
      result.piiDetected = piiResult.detections;

      if (piiResult.detections.length > 0) {
        switch (this.config.piiDetection.action) {
          case "block":
            result.blocked = true;
            result.reason = `PII detected: ${piiResult.detections.map((d) => d.type).join(", ")}`;
            return result;

          case "mask":
            result.sanitizedRequest = piiResult.sanitizedRequest;
            result.warnings.push(
              `PII masked: ${piiResult.detections.map((d) => d.type).join(", ")}`
            );
            break;

          case "warn":
            result.warnings.push(
              `PII detected: ${piiResult.detections.map((d) => d.type).join(", ")}`
            );
            break;
        }
      }
    }

    // Check prompt injection
    if (this.config.promptInjection.enabled) {
      const injectionResult = this.checkInjection(request);
      result.injectionDetected = injectionResult;

      if (injectionResult.length > 0) {
        const highConfidence = injectionResult.filter((d) => d.confidence >= 0.7);

        if (highConfidence.length > 0) {
          switch (this.config.promptInjection.action) {
            case "block":
              result.blocked = true;
              result.reason = `Potential prompt injection: ${highConfidence
                .map((d) => d.type)
                .join(", ")}`;
              return result;

            case "warn":
              result.warnings.push(
                `Potential prompt injection detected: ${highConfidence
                  .map((d) => d.type)
                  .join(", ")}`
              );
              break;
          }
        }
      }
    }

    return result;
  }

  private checkPII(request: GatewayRequest): {
    detections: PIIDetection[];
    sanitizedRequest: GatewayRequest;
  } {
    const detections: PIIDetection[] = [];
    const sanitizedMessages = request.messages.map((message, msgIndex) => {
      if (typeof message.content !== "string") {
        // Handle content blocks
        const sanitizedContent = message.content.map((block, blockIndex) => {
          if (block.type === "text" && block.text) {
            const { text, blockDetections } = this.maskPII(
              block.text,
              `message[${msgIndex}].content[${blockIndex}]`
            );
            detections.push(...blockDetections);
            return { ...block, text };
          }
          return block;
        });
        return { ...message, content: sanitizedContent };
      }

      const { text, blockDetections } = this.maskPII(
        message.content,
        `message[${msgIndex}].content`
      );
      detections.push(...blockDetections);
      return { ...message, content: text };
    });

    return {
      detections,
      sanitizedRequest: { ...request, messages: sanitizedMessages },
    };
  }

  private maskPII(
    text: string,
    location: string
  ): { text: string; blockDetections: PIIDetection[] } {
    const blockDetections: PIIDetection[] = [];
    let maskedText = text;

    const piiTypes = ["email", "ssn", "credit_card", "phone"];

    this.piiPatterns.forEach((pattern, index) => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach((match) => {
          blockDetections.push({
            type: piiTypes[index] || "unknown",
            pattern: pattern.source,
            location,
            masked: true,
          });
          // Mask the PII
          maskedText = maskedText.replace(
            match,
            `[${(piiTypes[index] || "PII").toUpperCase()}_REDACTED]`
          );
        });
      }
    });

    return { text: maskedText, blockDetections };
  }

  private checkInjection(request: GatewayRequest): InjectionDetection[] {
    const detections: InjectionDetection[] = [];

    for (const message of request.messages) {
      const content =
        typeof message.content === "string"
          ? message.content
          : message.content.map((b) => b.text || "").join(" ");

      for (const { pattern, type, confidence } of this.injectionPatterns) {
        if (pattern.test(content)) {
          detections.push({
            type,
            pattern: pattern.source,
            confidence,
          });
        }
      }
    }

    return detections;
  }

  // Sanitize output before returning to user
  sanitizeOutput(content: string): { content: string; warnings: string[] } {
    const warnings: string[] = [];
    let sanitized = content;

    if (!this.config.outputSanitization.enabled) {
      return { content, warnings };
    }

    for (const pattern of this.config.outputSanitization.blockedPatterns) {
      const regex = new RegExp(pattern, "gi");
      if (regex.test(sanitized)) {
        sanitized = sanitized.replace(regex, "[REDACTED]");
        warnings.push(`Output contained blocked pattern: ${pattern}`);
      }
    }

    return { content: sanitized, warnings };
  }
}

interface InjectionPattern {
  pattern: RegExp;
  type: string;
  confidence: number;
}

/**
 * Rate Limiter - Per-user and per-project rate limiting
 */
export class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();
  private config: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };

  constructor(config: { requestsPerMinute: number; tokensPerMinute: number }) {
    this.config = config;

    // Cleanup old entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  check(key: string): { allowed: boolean; retryAfterMs?: number } {
    const now = Date.now();
    const entry = this.limits.get(key);

    if (!entry) {
      this.limits.set(key, {
        requests: 1,
        tokens: 0,
        windowStart: now,
      });
      return { allowed: true };
    }

    // Check if window has expired
    if (now - entry.windowStart > 60000) {
      entry.requests = 1;
      entry.tokens = 0;
      entry.windowStart = now;
      return { allowed: true };
    }

    // Check limits
    if (entry.requests >= this.config.requestsPerMinute) {
      const retryAfterMs = 60000 - (now - entry.windowStart);
      return { allowed: false, retryAfterMs };
    }

    entry.requests++;
    return { allowed: true };
  }

  recordTokens(key: string, tokens: number): void {
    const entry = this.limits.get(key);
    if (entry) {
      entry.tokens += tokens;
    }
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.limits) {
      if (now - entry.windowStart > 120000) {
        this.limits.delete(key);
      }
    }
  }
}

interface RateLimitEntry {
  requests: number;
  tokens: number;
  windowStart: number;
}
