import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as os from 'os';

/**
 * In-process concurrency limiter for CPU-bound canvas renders.
 *
 * WHY this exists — protecting 5000 concurrent users:
 * `@napi-rs/canvas` rendering is synchronous per canvas and blocks the event loop
 * while it runs. If 500 renders hit at once on a 4-core machine, we OOM and the
 * event loop starves → entire API goes unresponsive. This semaphore:
 *   1. Caps running renders to `os.cpus().length` (default — can be overridden via env).
 *   2. Queues waiters; if queue > maxQueueDepth → 503 circuit breaker
 *      (fail fast so the client retries rather than holds a connection for minutes).
 *   3. Tracks metrics for observability (running count, queue depth, totals).
 *
 * When we scale beyond 1 backend instance, swap this for BullMQ. For V1 single-instance
 * on VPS this is enough — S3 cache absorbs 80%+ of traffic after warmup.
 */
@Injectable()
export class RenderSemaphore {
  private readonly logger = new Logger(RenderSemaphore.name);
  private readonly maxConcurrent: number;
  private readonly maxQueueDepth: number;
  private running = 0;
  private queue: Array<() => void> = [];
  // Metrics (for /health or logs)
  private totalAcquired = 0;
  private totalRejected = 0;
  private peakQueueDepth = 0;

  constructor() {
    const cpuCount = os.cpus().length || 2;
    const envMax = parseInt(process.env.RENDER_MAX_CONCURRENT || '', 10);
    const envQueue = parseInt(process.env.RENDER_MAX_QUEUE || '', 10);
    this.maxConcurrent = !isNaN(envMax) && envMax > 0 ? envMax : Math.max(2, cpuCount);
    this.maxQueueDepth = !isNaN(envQueue) && envQueue > 0 ? envQueue : 100;
    this.logger.log(
      `RenderSemaphore initialized: maxConcurrent=${this.maxConcurrent}, maxQueueDepth=${this.maxQueueDepth}`,
    );
  }

  /**
   * Run `fn` under the semaphore.
   * Throws ServiceUnavailableException if queue depth is exceeded.
   */
  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      this.totalAcquired++;
      return await fn();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.running < this.maxConcurrent) {
      this.running++;
      return Promise.resolve();
    }
    if (this.queue.length >= this.maxQueueDepth) {
      this.totalRejected++;
      this.logger.warn(
        `Render queue full (${this.queue.length}/${this.maxQueueDepth}) — rejecting request`,
      );
      throw new ServiceUnavailableException(
        'Hệ thống đang tải cao, vui lòng thử lại sau ít phút',
      );
    }
    return new Promise((resolve) => {
      this.queue.push(resolve);
      this.peakQueueDepth = Math.max(this.peakQueueDepth, this.queue.length);
    });
  }

  private release(): void {
    this.running--;
    const next = this.queue.shift();
    if (next) {
      this.running++;
      next();
    }
  }

  getMetrics() {
    return {
      running: this.running,
      queued: this.queue.length,
      maxConcurrent: this.maxConcurrent,
      maxQueueDepth: this.maxQueueDepth,
      totalAcquired: this.totalAcquired,
      totalRejected: this.totalRejected,
      peakQueueDepth: this.peakQueueDepth,
    };
  }
}
