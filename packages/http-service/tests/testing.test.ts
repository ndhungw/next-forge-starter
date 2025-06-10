/**
 * Unit tests for testing utilities
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  type HttpServiceMock,
  createMockHttpService,
  testUtils,
} from '../testing';

// Regex patterns for tests
const USER_ID_PATTERN = /\/api\/users\/\d+/;

describe('Testing Utilities', () => {
  let mockService: HttpServiceMock;

  beforeEach(() => {
    mockService = createMockHttpService();
  });

  describe('HttpServiceMock', () => {
    it('should mock GET requests', async () => {
      const mockData = { id: 1, name: 'John Doe' };
      mockService.mockGet('/api/users/1', { data: mockData });

      const response = await mockService.get('/api/users/1');
      expect(response.data).toEqual(mockData);
      expect(response.status).toBe(200);
    });

    it('should mock POST requests', async () => {
      const mockData = { id: 2, name: 'Jane Doe' };
      mockService.mockPost('/api/users', { data: mockData, status: 201 });

      const response = await mockService.post('/api/users', {
        name: 'Jane Doe',
      });
      expect(response.data).toEqual(mockData);
      expect(response.status).toBe(201);
    });

    it('should mock PUT requests', async () => {
      const mockData = { id: 1, name: 'John Updated' };
      mockService.mockPut('/api/users/1', { data: mockData });

      const response = await mockService.put('/api/users/1', {
        name: 'John Updated',
      });
      expect(response.data).toEqual(mockData);
    });

    it('should mock DELETE requests', async () => {
      mockService.mockDelete('/api/users/1', { data: null, status: 204 });

      const response = await mockService.delete('/api/users/1');
      expect(response.status).toBe(204);
    });

    it('should support regex URL patterns', async () => {
      mockService.mockGet(USER_ID_PATTERN, { data: { id: 'any' } });

      const response1 = await mockService.get('/api/users/1');
      const response2 = await mockService.get('/api/users/999');

      expect(response1.data).toEqual({ id: 'any' });
      expect(response2.data).toEqual({ id: 'any' });
    });

    it('should support dynamic response functions', async () => {
      mockService.mock({
        url: '/api/users',
        method: 'GET',
        response: (config) => ({
          data: {
            method: config.method,
            url: config.url,
            timestamp: Date.now(),
          },
        }),
      });

      const response = await mockService.get<{
        method: string;
        url: string;
        timestamp: number;
      }>('/api/users');
      expect(response.data.method).toBe('GET');
      expect(response.data.url).toBe('/api/users');
      expect(typeof response.data.timestamp).toBe('number');
    });

    it('should track call history', async () => {
      mockService.mockGet('/api/users', { data: [] });
      mockService.mockPost('/api/users', { data: { id: 1 } });

      await mockService.get('/api/users');
      await mockService.post('/api/users', { name: 'Test' });

      const history = mockService.getCallHistory();
      expect(history).toHaveLength(2);
      expect(history[0].method).toBe('GET');
      expect(history[0].url).toBe('/api/users');
      expect(history[1].method).toBe('POST');
      expect(history[1].url).toBe('/api/users');
    });

    it('should support limited-use mocks', async () => {
      mockService.mock({
        url: '/api/users',
        method: 'GET',
        response: { data: { count: 1 } },
        times: 1,
      });

      // First call should work
      const response1 = await mockService.get('/api/users');
      expect(response1.data).toEqual({ count: 1 });

      // Second call should fail (no matching mock)
      await expect(mockService.get('/api/users')).rejects.toThrow();
    });

    it('should simulate network delays', async () => {
      const delay = 100;
      mockService.mockGet('/api/users', {
        data: { id: 1 },
        delay,
      });

      const start = Date.now();
      await mockService.get('/api/users');
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(delay - 10); // Allow small variance
    });

    it('should clear mocks', () => {
      mockService.mockGet('/api/users', { data: [] });

      mockService.clearMocks();

      // Should fail since mock was cleared
      expect(mockService.get('/api/users')).rejects.toThrow();
    });

    it('should reset call history', async () => {
      mockService.mockGet('/api/users', { data: [] });

      await mockService.get('/api/users');
      expect(mockService.getCallHistory()).toHaveLength(1);

      mockService.resetHistory();
      expect(mockService.getCallHistory()).toHaveLength(0);
    });
  });

  describe('testUtils', () => {
    it('should create mock responses', () => {
      const data = { id: 1, name: 'Test' };
      const mockResponse = testUtils.mockResponse(data);

      expect(mockResponse).toEqual({
        data,
        status: 200,
        statusText: 'OK',
      });
    });

    it('should create mock responses with options', () => {
      const data = { id: 1 };
      const mockResponse = testUtils.mockResponse(data, {
        status: 201,
        statusText: 'Created',
        headers: { Location: '/api/users/1' },
      });

      expect(mockResponse).toEqual({
        data,
        status: 201,
        statusText: 'Created',
        headers: { Location: '/api/users/1' },
      });
    });

    it('should create error responses', () => {
      const errorResponse = testUtils.mockError('Not found', 404);

      expect(errorResponse).toEqual({
        data: { error: 'Not found' },
        status: 404,
        statusText: 'Error',
      });
    });

    it('should create delayed responses', () => {
      const data = { id: 1 };
      const delay = 500;
      const mockResponse = testUtils.mockDelayed(data, delay);

      expect(mockResponse).toEqual({
        data,
        delay,
      });
    });
  });

  describe('Async Verification', () => {
    it('should verify async request patterns', async () => {
      mockService.mockGet('/api/users', { data: [] });
      mockService.mockPost('/api/users', { data: { id: 1 } });

      // Simulate a service that fetches then creates
      await mockService.get('/api/users');
      await mockService.post('/api/users', { name: 'Test' });

      const calls = mockService.getCallHistory();
      expect(calls).toHaveLength(2);
      expect(calls[0].method).toBe('GET');
      expect(calls[1].method).toBe('POST');
      expect(calls[1].body).toEqual(JSON.stringify({ name: 'Test' }));
    });

    it('should verify request was called with specific parameters', async () => {
      mockService.mockGet('/api/users', { data: [] });

      await mockService.get('/api/users', {
        params: { page: 1, limit: 10 },
      });

      const calls = mockService.getCallHistory();
      expect(calls[0].url).toContain('page=1');
      expect(calls[0].url).toContain('limit=10');
    });

    it('should verify request headers', async () => {
      mockService.mockPost('/api/users', { data: { id: 1 } });

      await mockService.post(
        '/api/users',
        { name: 'Test' },
        {
          headers: { Authorization: 'Bearer token123' },
        }
      );

      const calls = mockService.getCallHistory();
      expect(calls[0].headers).toEqual(
        expect.objectContaining({
          Authorization: 'Bearer token123',
        })
      );
    });
  });
});
