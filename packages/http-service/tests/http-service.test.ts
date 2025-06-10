/**
 * Unit tests for HttpService core functionality
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpServiceError, NetworkError } from '../errors';
import { HttpService } from '../http-service';
import type { HttpServiceConfig } from '../types';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('HttpService', () => {
  let httpService: HttpService;

  beforeEach(() => {
    httpService = new HttpService();
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic HTTP Methods', () => {
    it('should make GET request', async () => {
      const mockResponse = { data: 'test' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(mockResponse),
      });

      const response = await httpService.get('/api/test');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({
          method: 'GET',
        })
      );
      expect(response.data).toEqual(mockResponse);
      expect(response.status).toBe(200);
    });

    it('should make POST request with body', async () => {
      const requestBody = { name: 'test' };
      const mockResponse = { id: 1, ...requestBody };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        statusText: 'Created',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(mockResponse),
      });

      const response = await httpService.post('/api/users', requestBody);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/users',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(requestBody),
          headers: expect.any(Headers),
        })
      );

      // Check that the content-type header was set correctly
      const callArgs = mockFetch.mock.calls[0];
      const headers = callArgs[1].headers as Headers;
      expect(headers.get('content-type')).toBe('application/json');
      expect(response.data).toEqual(mockResponse);
      expect(response.status).toBe(201);
    });

    it('should make PUT request', async () => {
      const requestBody = { id: 1, name: 'updated' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(requestBody),
      });

      const response = await httpService.put('/api/users/1', requestBody);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/users/1',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(requestBody),
        })
      );
      expect(response.data).toEqual(requestBody);
    });

    it('should make DELETE request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        statusText: 'No Content',
        headers: new Headers(),
        text: () => Promise.resolve(''),
      });

      const response = await httpService.delete('/api/users/1');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/users/1',
        expect.objectContaining({
          method: 'DELETE',
        })
      );
      expect(response.status).toBe(204);
    });
  });

  describe('Configuration', () => {
    it('should use base URL', async () => {
      const config: HttpServiceConfig = {
        baseURL: 'https://api.example.com',
      };
      httpService = new HttpService(config);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({}),
      });

      await httpService.get('/users');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/users',
        expect.any(Object)
      );
    });

    it('should use default headers', async () => {
      const config: HttpServiceConfig = {
        headers: {
          Authorization: 'Bearer token123',
          'X-Custom': 'value',
        },
      };
      httpService = new HttpService(config);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({}),
      });

      await httpService.get('/users');

      expect(mockFetch).toHaveBeenCalledWith(
        '/users',
        expect.objectContaining({
          headers: expect.any(Headers),
        })
      );

      // Check that the headers were set correctly
      const callArgs = mockFetch.mock.calls[0];
      const headers = callArgs[1].headers as Headers;
      expect(headers.get('Authorization')).toBe('Bearer token123');
      expect(headers.get('X-Custom')).toBe('value');
    });

    it('should handle timeout', async () => {
      const config: HttpServiceConfig = {
        timeout: 100, // Short timeout for test
      };
      httpService = new HttpService(config);

      // Mock fetch to simulate timeout abort behavior
      mockFetch.mockImplementationOnce(
        (_url, options) =>
          new Promise((_, reject) => {
            // Simulate the abort signal being triggered
            const signal = options?.signal as AbortSignal;
            if (signal) {
              signal.addEventListener('abort', () => {
                reject(
                  new DOMException('The operation was aborted.', 'AbortError')
                );
              });
            }

            // Never resolve normally - let timeout trigger abort
            // The setTimeout is not needed as we're relying on the AbortController timeout
          })
      );

      await expect(httpService.get('/users')).rejects.toThrow(
        'Request timeout'
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle HTTP errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ error: 'User not found' }),
      });

      await expect(httpService.get('/users/999')).rejects.toThrow(
        HttpServiceError
      );
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(httpService.get('/users')).rejects.toThrow(NetworkError);
    });

    it('should handle JSON parsing errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.reject(new Error('Invalid JSON')),
        text: () => Promise.resolve('invalid json'),
      });

      const response = await httpService.get('/users');
      expect(response.data).toBe('invalid json');
    });
  });

  describe('Interceptors', () => {
    it('should apply request interceptors', async () => {
      const requestInterceptor = vi.fn((config) => ({
        ...config,
        headers: { ...config.headers, 'X-Intercepted': 'true' },
      }));

      httpService.addRequestInterceptor(requestInterceptor);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({}),
      });

      await httpService.get('/users');

      expect(requestInterceptor).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledWith(
        '/users',
        expect.objectContaining({
          headers: expect.any(Headers),
        })
      );

      // Check that the intercepted header was set
      const callArgs = mockFetch.mock.calls[0];
      const headers = callArgs[1].headers as Headers;
      expect(headers.get('X-Intercepted')).toBe('true');
    });

    it('should apply response interceptors', async () => {
      const responseInterceptor = vi.fn((response) => ({
        ...response,
        data: { ...response.data, intercepted: true },
      }));

      httpService.addResponseInterceptor(responseInterceptor);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ original: true }),
      });

      const response = await httpService.get('/users');

      expect(responseInterceptor).toHaveBeenCalled();
      expect(response.data).toEqual({ original: true, intercepted: true });
    });
  });

  describe('Request Cancellation', () => {
    it('should cancel requests with AbortController', async () => {
      const abortController = new AbortController();

      // Mock fetch to simulate user abort behavior
      mockFetch.mockImplementationOnce(
        (_url, options) =>
          new Promise((_, reject) => {
            const signal = options?.signal as AbortSignal;
            if (signal) {
              // Check if already aborted
              if (signal.aborted) {
                reject(
                  new DOMException('The operation was aborted.', 'AbortError')
                );
                return;
              }

              signal.addEventListener('abort', () => {
                reject(
                  new DOMException('The operation was aborted.', 'AbortError')
                );
              });
            }
          })
      );

      // Abort the request immediately
      abortController.abort();

      await expect(
        httpService.get('/users', { signal: abortController.signal })
      ).rejects.toThrow('Request aborted by user');
    });
  });
});
