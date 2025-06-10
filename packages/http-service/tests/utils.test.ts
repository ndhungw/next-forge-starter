/**
 * Unit tests for utility functions
 */
import { describe, expect, it } from 'vitest';
import {
  buildURL,
  calculateBackoff,
  getContentType,
  mergeHeaders,
  parseResponse,
  serializeBody,
  sleep,
} from '../utils';

describe('Utils', () => {
  describe('buildURL', () => {
    it('should build URL without parameters', () => {
      const url = buildURL('https://api.example.com/users');
      expect(url).toBe('https://api.example.com/users');
    });

    it('should build URL with parameters', () => {
      const url = buildURL('https://api.example.com/users', {
        page: 1,
        limit: 10,
        search: 'john',
      });
      expect(url).toBe(
        'https://api.example.com/users?page=1&limit=10&search=john'
      );
    });

    it('should handle existing query parameters', () => {
      const url = buildURL('https://api.example.com/users?existing=true', {
        page: 1,
      });
      expect(url).toBe('https://api.example.com/users?existing=true&page=1');
    });

    it('should encode special characters', () => {
      const url = buildURL('https://api.example.com/search', {
        q: 'hello world!',
      });
      expect(url).toBe('https://api.example.com/search?q=hello%20world!');
    });

    it('should skip undefined/null values', () => {
      const url = buildURL('https://api.example.com/users', {
        page: 1,
        search: undefined,
        filter: null,
      });
      expect(url).toBe('https://api.example.com/users?page=1');
    });
  });

  describe('mergeHeaders', () => {
    it('should merge plain objects', () => {
      const merged = mergeHeaders(
        { 'Content-Type': 'application/json' },
        { Authorization: 'Bearer token' }
      );
      expect(merged).toBeInstanceOf(Headers);
      expect(merged.get('Content-Type')).toBe('application/json');
      expect(merged.get('Authorization')).toBe('Bearer token');
    });

    it('should merge Headers objects', () => {
      const headers1 = new Headers({ 'Content-Type': 'application/json' });
      const headers2 = new Headers({ Authorization: 'Bearer token' });

      const merged = mergeHeaders(headers1, headers2);
      expect(merged).toBeInstanceOf(Headers);
      expect(merged.get('Content-Type')).toBe('application/json');
      expect(merged.get('Authorization')).toBe('Bearer token');
    });

    it('should handle mixed types', () => {
      const headers1 = { 'Content-Type': 'application/json' };
      const headers2 = new Headers({ Authorization: 'Bearer token' });

      const merged = mergeHeaders(headers1, headers2);
      expect(merged).toBeInstanceOf(Headers);
      expect(merged.get('Content-Type')).toBe('application/json');
      expect(merged.get('Authorization')).toBe('Bearer token');
    });

    it('should override duplicate keys', () => {
      const merged = mergeHeaders(
        { 'Content-Type': 'application/json' },
        { 'Content-Type': 'text/plain' }
      );
      expect(merged).toBeInstanceOf(Headers);
      expect(merged.get('Content-Type')).toBe('text/plain');
    });

    it('should handle undefined inputs', () => {
      const merged = mergeHeaders(
        { 'Content-Type': 'application/json' },
        undefined
      );
      expect(merged).toBeInstanceOf(Headers);
      expect(merged.get('Content-Type')).toBe('application/json');
    });
  });

  describe('calculateBackoff', () => {
    it('should calculate exponential backoff', () => {
      expect(calculateBackoff(0)).toBe(1000);
      expect(calculateBackoff(1)).toBe(2000);
      expect(calculateBackoff(2)).toBe(4000);
      expect(calculateBackoff(3)).toBe(8000);
    });

    it('should respect maximum backoff', () => {
      expect(calculateBackoff(10)).toBeLessThanOrEqual(30000);
    });

    it('should add jitter', () => {
      const backoff1 = calculateBackoff(1);
      const backoff2 = calculateBackoff(1);
      // With jitter, they might be different
      expect(backoff1).toBeGreaterThan(0);
      expect(backoff2).toBeGreaterThan(0);
    });
  });

  describe('parseResponse', () => {
    it('should parse JSON response', async () => {
      const mockResponse = {
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ data: 'test' }),
      } as Response;

      const result = await parseResponse(mockResponse);
      expect(result).toEqual({ data: 'test' });
    });

    it('should parse text response', async () => {
      const mockResponse = {
        headers: new Headers({ 'content-type': 'text/plain' }),
        text: () => Promise.resolve('Hello World'),
      } as Response;

      const result = await parseResponse(mockResponse);
      expect(result).toBe('Hello World');
    });

    it('should handle blob response', async () => {
      const mockBlob = new Blob(['test'], { type: 'application/octet-stream' });
      const mockResponse = {
        headers: new Headers({ 'content-type': 'application/octet-stream' }),
        blob: () => Promise.resolve(mockBlob),
      } as Response;

      const result = await parseResponse(mockResponse);
      expect(result).toBe(mockBlob);
    });

    it('should fallback to text on JSON parse error', async () => {
      const mockResponse = {
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.reject(new Error('Invalid JSON')),
        text: () => Promise.resolve('invalid json'),
      } as Response;

      const result = await parseResponse(mockResponse);
      expect(result).toBe('invalid json');
    });
  });

  describe('serializeBody', () => {
    it('should serialize object to JSON', () => {
      const body = { name: 'test', age: 25 };
      const result = serializeBody(body);
      expect(result).toBe(JSON.stringify(body));
    });

    it('should return string as-is', () => {
      const body = 'plain text';
      const result = serializeBody(body);
      expect(result).toBe('plain text');
    });

    it('should return FormData as-is', () => {
      const formData = new FormData();
      formData.append('key', 'value');
      const result = serializeBody(formData);
      expect(result).toBe(formData);
    });

    it('should return URLSearchParams as-is', () => {
      const params = new URLSearchParams('key=value');
      const result = serializeBody(params);
      expect(result).toBe(params);
    });

    it('should handle null/undefined', () => {
      expect(serializeBody(null)).toBeNull();
      expect(serializeBody(undefined)).toBeUndefined();
    });
  });

  describe('getContentType', () => {
    it('should return JSON content type for objects', () => {
      const contentType = getContentType({ key: 'value' });
      expect(contentType).toBe('application/json');
    });

    it('should return form content type for FormData', () => {
      const formData = new FormData();
      const contentType = getContentType(formData);
      expect(contentType).toBe('multipart/form-data');
    });

    it('should return URL encoded content type for URLSearchParams', () => {
      const params = new URLSearchParams();
      const contentType = getContentType(params);
      expect(contentType).toBe('application/x-www-form-urlencoded');
    });

    it('should return text content type for strings', () => {
      const contentType = getContentType('plain text');
      expect(contentType).toBe('text/plain');
    });

    it('should return undefined for null/undefined', () => {
      expect(getContentType(null)).toBeUndefined();
      expect(getContentType(undefined)).toBeUndefined();
    });
  });

  describe('sleep', () => {
    it('should resolve after specified delay', async () => {
      const start = Date.now();
      await sleep(100);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(90); // Allow some variance
      expect(elapsed).toBeLessThan(150);
    });
  });
});
