/**
 * Async Job Queue - Handle burst traffic and background processing
 */

import { nanoid } from "nanoid";
import type { GatewayRequest, GatewayResponse } from "../core/types";

type JobStatus = "pending" | "processing" | "completed" | "failed" | "cancelled";

interface Job {
  id: string;
  request: GatewayRequest;
  status: JobStatus;
  priority: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  result?: GatewayResponse;
  error?: string;
  retries: number;
  maxRetries: number;
  webhookUrl?: string;
  metadata?: Record<string, unknown>;
}

interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  avgWaitTimeMs: number;
  avgProcessingTimeMs: number;
}

export class JobQueue {
  private jobs: Map<string, Job> = new Map();
  private queue: string[] = []; // Job IDs in priority order
  private processing: Set<string> = new Set();
  private maxConcurrency: number;
  private processor?: (request: GatewayRequest) => Promise<GatewayResponse>;
  private isRunning = false;
  private waitTimes: number[] = [];
  private processingTimes: number[] = [];

  constructor(options: { maxConcurrency?: number } = {}) {
    this.maxConcurrency = options.maxConcurrency || 10;
  }

  setProcessor(processor: (request: GatewayRequest) => Promise<GatewayResponse>): void {
    this.processor = processor;
  }

  // Submit a job to the queue
  async submit(
    request: GatewayRequest,
    options: {
      priority?: number;
      maxRetries?: number;
      webhookUrl?: string;
      metadata?: Record<string, unknown>;
    } = {}
  ): Promise<string> {
    const job: Job = {
      id: `job_${nanoid(12)}`,
      request,
      status: "pending",
      priority: options.priority || 0,
      createdAt: new Date(),
      retries: 0,
      maxRetries: options.maxRetries || 3,
      webhookUrl: options.webhookUrl,
      metadata: options.metadata,
    };

    this.jobs.set(job.id, job);
    this.insertByPriority(job.id, job.priority);

    // Start processing if not running
    if (!this.isRunning) {
      this.startProcessing();
    }

    return job.id;
  }

  // Get job status
  getJob(jobId: string): Job | null {
    return this.jobs.get(jobId) || null;
  }

  // Wait for job to complete
  async waitForJob(
    jobId: string,
    timeoutMs: number = 300000
  ): Promise<GatewayResponse | null> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const job = this.jobs.get(jobId);
      if (!job) return null;

      if (job.status === "completed" && job.result) {
        return job.result;
      }

      if (job.status === "failed") {
        throw new Error(job.error || "Job failed");
      }

      if (job.status === "cancelled") {
        throw new Error("Job cancelled");
      }

      // Poll every 100ms
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new Error("Job timeout");
  }

  // Cancel a job
  cancel(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== "pending") {
      return false;
    }

    job.status = "cancelled";
    this.queue = this.queue.filter((id) => id !== jobId);
    return true;
  }

  // Get queue statistics
  getStats(): QueueStats {
    let pending = 0;
    let processing = 0;
    let completed = 0;
    let failed = 0;

    for (const job of this.jobs.values()) {
      switch (job.status) {
        case "pending":
          pending++;
          break;
        case "processing":
          processing++;
          break;
        case "completed":
          completed++;
          break;
        case "failed":
          failed++;
          break;
      }
    }

    return {
      pending,
      processing,
      completed,
      failed,
      avgWaitTimeMs: this.average(this.waitTimes),
      avgProcessingTimeMs: this.average(this.processingTimes),
    };
  }

  // Start background processing
  private startProcessing(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.processLoop();
  }

  private async processLoop(): Promise<void> {
    while (this.queue.length > 0 || this.processing.size > 0) {
      // Process up to maxConcurrency jobs
      while (
        this.queue.length > 0 &&
        this.processing.size < this.maxConcurrency
      ) {
        const jobId = this.queue.shift();
        if (jobId) {
          this.processJob(jobId);
        }
      }

      // Wait a bit before checking again
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    this.isRunning = false;
  }

  private async processJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job || !this.processor) return;

    this.processing.add(jobId);
    job.status = "processing";
    job.startedAt = new Date();

    // Record wait time
    const waitTime = job.startedAt.getTime() - job.createdAt.getTime();
    this.waitTimes.push(waitTime);
    if (this.waitTimes.length > 1000) this.waitTimes.shift();

    try {
      const result = await this.processor(job.request);
      job.status = "completed";
      job.result = result;
      job.completedAt = new Date();

      // Record processing time
      const processingTime = job.completedAt.getTime() - job.startedAt.getTime();
      this.processingTimes.push(processingTime);
      if (this.processingTimes.length > 1000) this.processingTimes.shift();

      // Send webhook if configured
      if (job.webhookUrl) {
        this.sendWebhook(job.webhookUrl, {
          jobId: job.id,
          status: "completed",
          result,
        });
      }
    } catch (error) {
      job.retries++;
      const err = error as Error;

      if (job.retries < job.maxRetries) {
        // Retry with exponential backoff
        job.status = "pending";
        const delay = Math.pow(2, job.retries) * 1000;
        setTimeout(() => {
          this.insertByPriority(job.id, job.priority);
        }, delay);
      } else {
        job.status = "failed";
        job.error = err.message;
        job.completedAt = new Date();

        // Send failure webhook
        if (job.webhookUrl) {
          this.sendWebhook(job.webhookUrl, {
            jobId: job.id,
            status: "failed",
            error: err.message,
          });
        }
      }
    } finally {
      this.processing.delete(jobId);
    }
  }

  private insertByPriority(jobId: string, priority: number): void {
    // Higher priority jobs go first
    let insertIndex = this.queue.length;
    for (let i = 0; i < this.queue.length; i++) {
      const existingJob = this.jobs.get(this.queue[i]!);
      if (existingJob && existingJob.priority < priority) {
        insertIndex = i;
        break;
      }
    }
    this.queue.splice(insertIndex, 0, jobId);
  }

  private async sendWebhook(
    url: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    try {
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error("Failed to send webhook:", err);
    }
  }

  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  // Cleanup old completed/failed jobs
  cleanup(maxAgeMs: number = 3600000): number {
    const cutoff = Date.now() - maxAgeMs;
    let removed = 0;

    for (const [id, job] of this.jobs) {
      if (
        (job.status === "completed" || job.status === "failed") &&
        job.completedAt &&
        job.completedAt.getTime() < cutoff
      ) {
        this.jobs.delete(id);
        removed++;
      }
    }

    return removed;
  }
}

/**
 * Request Batcher - Batch similar requests for efficiency
 */
export class RequestBatcher {
  private batches: Map<string, BatchedRequest[]> = new Map();
  private batchSize: number;
  private batchTimeoutMs: number;
  private timeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();

  constructor(options: { batchSize?: number; batchTimeoutMs?: number } = {}) {
    this.batchSize = options.batchSize || 10;
    this.batchTimeoutMs = options.batchTimeoutMs || 100;
  }

  async add(
    batchKey: string,
    request: GatewayRequest,
    processor: (requests: GatewayRequest[]) => Promise<GatewayResponse[]>
  ): Promise<GatewayResponse> {
    return new Promise((resolve, reject) => {
      const batchedRequest: BatchedRequest = {
        request,
        resolve,
        reject,
      };

      let batch = this.batches.get(batchKey);
      if (!batch) {
        batch = [];
        this.batches.set(batchKey, batch);
      }

      batch.push(batchedRequest);

      // Process immediately if batch is full
      if (batch.length >= this.batchSize) {
        this.processBatch(batchKey, processor);
      } else {
        // Set timeout for partial batch
        if (!this.timeouts.has(batchKey)) {
          const timeout = setTimeout(() => {
            this.processBatch(batchKey, processor);
          }, this.batchTimeoutMs);
          this.timeouts.set(batchKey, timeout);
        }
      }
    });
  }

  private async processBatch(
    batchKey: string,
    processor: (requests: GatewayRequest[]) => Promise<GatewayResponse[]>
  ): Promise<void> {
    const batch = this.batches.get(batchKey);
    if (!batch || batch.length === 0) return;

    // Clear timeout
    const timeout = this.timeouts.get(batchKey);
    if (timeout) {
      clearTimeout(timeout);
      this.timeouts.delete(batchKey);
    }

    // Clear batch
    this.batches.delete(batchKey);

    try {
      const requests = batch.map((b) => b.request);
      const responses = await processor(requests);

      // Resolve each request
      for (let i = 0; i < batch.length; i++) {
        if (responses[i]) {
          batch[i]!.resolve(responses[i]!);
        } else {
          batch[i]!.reject(new Error("Missing response in batch"));
        }
      }
    } catch (error) {
      // Reject all requests in batch
      for (const request of batch) {
        request.reject(error);
      }
    }
  }
}

interface BatchedRequest {
  request: GatewayRequest;
  resolve: (response: GatewayResponse) => void;
  reject: (error: unknown) => void;
}
