import type { CacheEntry, RequestConfig } from './types';

/**
 * Simple in-memory cache for HTTP requests
 */
export class HttpCache {
  private cache = new Map<string, CacheEntry>();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes
  private maxSize = 100; // Maximum number of entries

  constructor(options?: { defaultTTL?: number; maxSize?: number }) {
    if (options?.defaultTTL) this.defaultTTL = options.defaultTTL;
    if (options?.maxSize) this.maxSize = options.maxSize;
  }

  /**
   * Generate cache key from URL and options
   */
  generateKey(config: RequestConfig): string {
    const method = config.method || 'GET';
    const url = config.url || '';
    const body = config.data ? JSON.stringify(config.data) : '';
    const headers = config.headers ? JSON.stringify(config.headers) : '';
    return `${method}:${url}:${body}:${headers}`;
  }

  /**
   * Generate cache key from URL and options (legacy support)
   */
  private generateKeyLegacy(url: string, options?: RequestInit): string {
    const method = options?.method || 'GET';
    const body = options?.body ? JSON.stringify(options.body) : '';
    return `${method}:${url}:${body}`;
  }

  /**
   * Get cached response if valid (by key)
   */
  get<T = unknown>(key: string): T | undefined;
  /**
   * Get cached response if valid (by URL and options)
   */
  get<T = unknown>(url: string, options?: RequestInit): T | undefined;
  get<T = unknown>(keyOrUrl: string, options?: RequestInit): T | undefined {
    const key =
      options !== undefined
        ? this.generateKeyLegacy(keyOrUrl, options)
        : keyOrUrl;
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    // Check if cache is still valid
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    // Update access time for LRU and re-insert to update Map order
    entry.lastAccessed = now;
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.data as T;
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean;
  has(url: string, options?: RequestInit): boolean;
  has(keyOrUrl: string, options?: RequestInit): boolean {
    const key =
      options !== undefined
        ? this.generateKeyLegacy(keyOrUrl, options)
        : keyOrUrl;
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    // Check if cache is still valid
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Set cache entry (by key)
   */
  set<T = unknown>(key: string, data: T, ttl?: number): void;
  /**
   * Set cache entry (by URL and options)
   */
  set<T = unknown>(
    url: string,
    data: T,
    options?: RequestInit,
    ttl?: number
  ): void;
  set<T = unknown>(
    keyOrUrl: string,
    data: T,
    optionsOrTtl?: RequestInit | number,
    ttl = this.defaultTTL
  ): void {
    let key: string;
    let finalTtl: number;

    if (typeof optionsOrTtl === 'number' || optionsOrTtl === undefined) {
      // Called with key and ttl
      key = keyOrUrl;
      finalTtl = optionsOrTtl || this.defaultTTL;
    } else {
      // Called with URL, data, options, ttl
      key = this.generateKeyLegacy(keyOrUrl, optionsOrTtl);
      finalTtl = ttl;
    }

    // Ensure we don't exceed max size
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      ttl: finalTtl,
      lastAccessed: now,
    });
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let oldestKey: string | undefined;
    let oldestTime = Number.POSITIVE_INFINITY;

    for (const [key, entry] of this.cache.entries()) {
      const accessTime = entry.lastAccessed || entry.timestamp;
      if (accessTime < oldestTime) {
        oldestTime = accessTime;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Delete cache entry by key
   */
  delete(key: string): boolean;
  /**
   * Delete cache entry by URL and options
   */
  delete(url: string, options: RequestInit): boolean;
  delete(keyOrUrl: string, options?: RequestInit): boolean {
    if (options !== undefined) {
      const key = this.generateKeyLegacy(keyOrUrl, options);
      return this.cache.delete(key);
    }
    return this.cache.delete(keyOrUrl);
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Clean expired entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache size
   */
  get size(): number {
    return this.cache.size;
  }
}
