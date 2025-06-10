/**
 * Request queuing and throttling capabilities
 */
import type { HttpResponse, RequestConfig } from './types';

export interface QueueConfig {
  maxConcurrent?: number; // Maximum concurrent requests
  maxQueueSize?: number; // Maximum queue size
  requestsPerSecond?: number; // Rate limiting
  priorityFn?: (config: RequestConfig) => number; // Priority function
}

export interface QueuedRequest<T = any> {
  config: RequestConfig;
  resolve: (value: HttpResponse<T>) => void;
  reject: (reason: any) => void;
  priority: number;
  timestamp: number;
}

/**
 * Request queue manager with throttling
 */
export class RequestQueue {
  private queue: QueuedRequest[] = [];
  private activeRequests = 0;
  private config: Required<QueueConfig>;
  private lastRequestTime = 0;

  constructor(config: QueueConfig = {}) {
    this.config = {
      maxConcurrent: config.maxConcurrent || 6,
      maxQueueSize: config.maxQueueSize || 100,
      requestsPerSecond: config.requestsPerSecond || 10,
      priorityFn: config.priorityFn || (() => 0),
    };
  }

  /**
   * Add request to queue
   */
  async enqueue<T>(
    config: RequestConfig,
    executor: (config: RequestConfig) => Promise<HttpResponse<T>>
  ): Promise<HttpResponse<T>> {
    // Check queue size limit
    if (this.queue.length >= this.config.maxQueueSize) {
      throw new Error('Request queue is full');
    }

    return new Promise<HttpResponse<T>>((resolve, reject) => {
      const queuedRequest: QueuedRequest<T> = {
        config,
        resolve,
        reject,
        priority: this.config.priorityFn(config),
        timestamp: Date.now(),
      };

      this.queue.push(queuedRequest);
      this.sortQueue();
      this.processQueue(executor);
    });
  }

  /**
   * Process the queue
   */
  private async processQueue<T>(
    executor: (config: RequestConfig) => Promise<HttpResponse<T>>
  ): Promise<void> {
    // Check if we can process more requests
    if (
      this.activeRequests >= this.config.maxConcurrent ||
      this.queue.length === 0
    ) {
      return;
    }

    // Rate limiting check
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minInterval = 1000 / this.config.requestsPerSecond;

    if (timeSinceLastRequest < minInterval) {
      // Schedule next processing after the required interval
      setTimeout(
        () => this.processQueue(executor),
        minInterval - timeSinceLastRequest
      );
      return;
    }

    // Get next request from queue
    const queuedRequest = this.queue.shift();
    if (!queuedRequest) {
      return;
    }

    this.activeRequests++;
    this.lastRequestTime = now;

    try {
      const response = await executor(queuedRequest.config);
      queuedRequest.resolve(response);
    } catch (error) {
      queuedRequest.reject(error);
    } finally {
      this.activeRequests--;
      // Process next request
      setImmediate(() => this.processQueue(executor));
    }
  }

  /**
   * Sort queue by priority (higher priority first)
   */
  private sortQueue(): void {
    this.queue.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get queue status
   */
  getStatus(): {
    queueLength: number;
    activeRequests: number;
    maxConcurrent: number;
  } {
    return {
      queueLength: this.queue.length,
      activeRequests: this.activeRequests,
      maxConcurrent: this.config.maxConcurrent,
    };
  }

  /**
   * Clear the queue
   */
  clear(): void {
    // Reject all pending requests
    for (const request of this.queue) {
      request.reject(new Error('Queue cleared'));
    }
    this.queue = [];
  }
}

/**
 * Connection pool for managing multiple HTTP services
 */
export class ConnectionPool {
  private pools = new Map<string, RequestQueue>();
  private defaultConfig: QueueConfig;

  constructor(defaultConfig: QueueConfig = {}) {
    this.defaultConfig = defaultConfig;
  }

  /**
   * Get or create a queue for a specific host
   */
  getQueue(host: string, config?: QueueConfig): RequestQueue {
    if (!this.pools.has(host)) {
      this.pools.set(
        host,
        new RequestQueue({ ...this.defaultConfig, ...config })
      );
    }
    const queue = this.pools.get(host);
    // This should never be undefined as we just set it if it didn't exist
    if (!queue) {
      throw new Error(`Failed to get queue for host: ${host}`);
    }
    return queue;
  }

  /**
   * Get pool status for all hosts
   */
  getStatus(): Record<string, ReturnType<RequestQueue['getStatus']>> {
    const status: Record<string, ReturnType<RequestQueue['getStatus']>> = {};
    for (const [host, queue] of this.pools) {
      status[host] = queue.getStatus();
    }
    return status;
  }

  /**
   * Clear all pools
   */
  clearAll(): void {
    for (const queue of this.pools.values()) {
      queue.clear();
    }
    this.pools.clear();
  }
}

/**
 * Throttling utilities
 */
export class Throttler {
  private lastExecution = 0;
  private timeout: NodeJS.Timeout | null = null;
  private delay: number;

  constructor(delay: number) {
    this.delay = delay;
  }

  /**
   * Throttle a function execution
   */
  throttle<T extends (...args: any[]) => any>(fn: T): T {
    return ((...args: any[]) => {
      const now = Date.now();
      const timeSinceLastExecution = now - this.lastExecution;

      if (timeSinceLastExecution >= this.delay) {
        this.lastExecution = now;
        return fn(...args);
      }

      // Clear existing timeout
      if (this.timeout) {
        clearTimeout(this.timeout);
      }

      // Schedule execution
      return new Promise((resolve) => {
        this.timeout = setTimeout(() => {
          this.lastExecution = Date.now();
          resolve(fn(...args));
        }, this.delay - timeSinceLastExecution);
      });
    }) as T;
  }
}

/**
 * Create a throttled version of a function
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): T {
  const throttler = new Throttler(delay);
  return throttler.throttle(fn);
}
