/**
 * Unit tests for HTTP cache functionality
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpCache } from '../cache';

describe('HttpCache', () => {
  let cache: HttpCache;

  beforeEach(() => {
    cache = new HttpCache();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Basic Operations', () => {
    it('should store and retrieve values', () => {
      const key = 'test-key';
      const data = { message: 'Hello World' };

      cache.set(key, data);
      const retrieved = cache.get(key);

      expect(retrieved).toEqual(data);
    });

    it('should return undefined for non-existent keys', () => {
      const result = cache.get('non-existent');
      expect(result).toBeUndefined();
    });

    it('should check if key exists', () => {
      const key = 'test-key';

      expect(cache.has(key)).toBe(false);

      cache.set(key, 'data');
      expect(cache.has(key)).toBe(true);
    });

    it('should delete entries', () => {
      const key = 'test-key';

      cache.set(key, 'data');
      expect(cache.has(key)).toBe(true);

      cache.delete(key);
      expect(cache.has(key)).toBe(false);
    });

    it('should clear all entries', () => {
      cache.set('key1', 'data1');
      cache.set('key2', 'data2');

      expect(cache.has('key1')).toBe(true);
      expect(cache.has('key2')).toBe(true);

      cache.clear();

      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key2')).toBe(false);
    });
  });

  describe('TTL (Time To Live)', () => {
    it('should expire entries after TTL', () => {
      const key = 'test-key';
      const data = 'test-data';
      const ttl = 1000; // 1 second

      cache.set(key, data, ttl);
      expect(cache.get(key)).toBe(data);

      // Fast-forward time by 1.5 seconds
      vi.advanceTimersByTime(1500);

      expect(cache.get(key)).toBeUndefined();
      expect(cache.has(key)).toBe(false);
    });

    it('should not expire entries without TTL', () => {
      const key = 'test-key';
      const data = 'test-data';

      cache.set(key, data);

      // Fast-forward time significantly
      vi.advanceTimersByTime(10000);

      expect(cache.get(key)).toBe(data);
    });

    it('should update TTL on subsequent sets', () => {
      const key = 'test-key';
      const ttl = 1000;

      cache.set(key, 'data1', ttl);

      // Fast-forward by half the TTL
      vi.advanceTimersByTime(500);

      // Update with new TTL
      cache.set(key, 'data2', ttl);

      // Fast-forward by another 750ms (1250ms total, but TTL was reset)
      vi.advanceTimersByTime(750);

      expect(cache.get(key)).toBe('data2');

      // Fast-forward another 300ms (1550ms total, should expire now)
      vi.advanceTimersByTime(300);

      expect(cache.get(key)).toBeUndefined();
    });
  });

  describe('Size Limits', () => {
    it('should respect maximum cache size', () => {
      const maxSize = 3;
      cache = new HttpCache({ maxSize });

      // Fill cache to capacity
      cache.set('key1', 'data1');
      cache.set('key2', 'data2');
      cache.set('key3', 'data3');

      expect(cache.has('key1')).toBe(true);
      expect(cache.has('key2')).toBe(true);
      expect(cache.has('key3')).toBe(true);

      // Add one more - should evict the oldest (LRU)
      cache.set('key4', 'data4');

      expect(cache.has('key1')).toBe(false); // Evicted
      expect(cache.has('key2')).toBe(true);
      expect(cache.has('key3')).toBe(true);
      expect(cache.has('key4')).toBe(true);
    });

    it('should update LRU order on access', () => {
      const maxSize = 3;
      cache = new HttpCache({ maxSize });

      cache.set('key1', 'data1');
      cache.set('key2', 'data2');
      cache.set('key3', 'data3');

      // Access key1 to make it most recently used
      cache.get('key1');

      // Add key4 - should evict key2 (now least recently used)
      cache.set('key4', 'data4');

      expect(cache.has('key1')).toBe(true); // Still there (was accessed)
      expect(cache.has('key2')).toBe(false); // Evicted
      expect(cache.has('key3')).toBe(true);
      expect(cache.has('key4')).toBe(true);
    });
  });

  describe('Cache Key Generation', () => {
    it('should generate consistent cache keys', () => {
      const config1 = {
        url: 'https://api.example.com/users',
        method: 'GET',
        headers: { Authorization: 'Bearer token' },
      };

      const config2 = {
        url: 'https://api.example.com/users',
        method: 'GET',
        headers: { Authorization: 'Bearer token' },
      };

      const key1 = cache.generateKey(config1);
      const key2 = cache.generateKey(config2);

      expect(key1).toBe(key2);
    });

    it('should generate different keys for different configs', () => {
      const config1 = {
        url: 'https://api.example.com/users',
        method: 'GET',
      };

      const config2 = {
        url: 'https://api.example.com/posts',
        method: 'GET',
      };

      const key1 = cache.generateKey(config1);
      const key2 = cache.generateKey(config2);

      expect(key1).not.toBe(key2);
    });

    it('should include relevant config properties in key', () => {
      const config = {
        url: 'https://api.example.com/users',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'test' }),
      };

      const key = cache.generateKey(config);

      expect(key).toContain('POST');
      expect(key).toContain('users');
    });
  });

  describe('Cleanup', () => {
    it('should automatically clean up expired entries', () => {
      const cleanupInterval = 1000;
      cache = new HttpCache({ cleanupInterval });

      const ttl = 500;
      cache.set('key1', 'data1', ttl);
      cache.set('key2', 'data2', ttl);

      expect(cache.has('key1')).toBe(true);
      expect(cache.has('key2')).toBe(true);

      // Fast-forward past TTL but before cleanup
      vi.advanceTimersByTime(750);

      // Entries should be logically expired but still in cache
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();

      // Fast-forward to trigger cleanup
      vi.advanceTimersByTime(500);

      // Now entries should be physically removed
      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key2')).toBe(false);
    });
  });
});
