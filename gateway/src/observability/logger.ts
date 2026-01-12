/**
 * Structured Logger - JSON and pretty output formats
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LoggingConfig {
  level: LogLevel;
  format: "json" | "pretty";
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const LOG_COLORS: Record<LogLevel, string> = {
  debug: "\x1b[36m", // Cyan
  info: "\x1b[32m", // Green
  warn: "\x1b[33m", // Yellow
  error: "\x1b[31m", // Red
};

const RESET = "\x1b[0m";

export class Logger {
  private config: LoggingConfig;
  private minLevel: number;

  constructor(config: LoggingConfig) {
    this.config = config;
    this.minLevel = LOG_LEVELS[config.level];
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log("debug", message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log("info", message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log("warn", message, context);
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.log("error", message, context);
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (LOG_LEVELS[level] < this.minLevel) return;

    const timestamp = new Date().toISOString();

    if (this.config.format === "json") {
      const logEntry = {
        timestamp,
        level,
        message,
        ...context,
      };
      console.log(JSON.stringify(logEntry));
    } else {
      const color = LOG_COLORS[level];
      const levelStr = level.toUpperCase().padEnd(5);
      const contextStr = context
        ? ` ${Object.entries(context)
            .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
            .join(" ")}`
        : "";

      console.log(
        `${timestamp} ${color}${levelStr}${RESET} ${message}${contextStr}`
      );
    }
  }

  // Create a child logger with additional context
  child(context: Record<string, unknown>): ChildLogger {
    return new ChildLogger(this, context);
  }
}

class ChildLogger {
  private parent: Logger;
  private context: Record<string, unknown>;

  constructor(parent: Logger, context: Record<string, unknown>) {
    this.parent = parent;
    this.context = context;
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.parent.debug(message, { ...this.context, ...context });
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.parent.info(message, { ...this.context, ...context });
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.parent.warn(message, { ...this.context, ...context });
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.parent.error(message, { ...this.context, ...context });
  }
}

/**
 * Audit Logger - Immutable log of all AI interactions
 */
export class AuditLogger {
  private destination: "file" | "stdout" | "remote";
  private path?: string;
  private buffer: AuditEntry[] = [];
  private flushInterval?: ReturnType<typeof setInterval>;

  constructor(config: { destination: "file" | "stdout" | "remote"; path?: string }) {
    this.destination = config.destination;
    this.path = config.path;

    // Flush buffer periodically for file destination
    if (this.destination === "file") {
      this.flushInterval = setInterval(() => this.flush(), 5000);
    }
  }

  log(entry: Omit<AuditEntry, "timestamp" | "id">): void {
    const auditEntry: AuditEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      timestamp: new Date().toISOString(),
      ...entry,
    };

    switch (this.destination) {
      case "stdout":
        console.log(JSON.stringify({ type: "audit", ...auditEntry }));
        break;

      case "file":
        this.buffer.push(auditEntry);
        if (this.buffer.length >= 100) {
          this.flush();
        }
        break;

      case "remote":
        // Send to remote endpoint (async)
        this.sendRemote(auditEntry).catch(console.error);
        break;
    }
  }

  private async flush(): Promise<void> {
    if (this.buffer.length === 0 || !this.path) return;

    const entries = this.buffer.splice(0, this.buffer.length);
    const content = entries.map((e) => JSON.stringify(e)).join("\n") + "\n";

    try {
      // Read existing content and append
      const file = Bun.file(this.path);
      const existing = await file.exists() ? await file.text() : "";
      await Bun.write(this.path, existing + content);
    } catch (err) {
      console.error("Failed to write audit log:", err);
      // Put entries back in buffer
      this.buffer.unshift(...entries);
    }
  }

  private async sendRemote(entry: AuditEntry): Promise<void> {
    // In production, send to audit service
    console.log(JSON.stringify({ type: "audit_remote", ...entry }));
  }

  close(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flush();
  }
}

interface AuditEntry {
  id: string;
  timestamp: string;
  action: "request" | "response" | "error" | "security_event";
  requestId?: string;
  userId?: string;
  provider?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  latencyMs?: number;
  success?: boolean;
  errorMessage?: string;
  securityFlags?: string[];
  metadata?: Record<string, unknown>;
}
