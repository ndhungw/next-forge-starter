/**
 * Integration tests with real API endpoints
 * These tests make actual HTTP requests and should be run sparingly
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { HttpService } from '../http-service';

// Skip integration tests in CI unless explicitly enabled
const shouldRunIntegrationTests = process.env.RUN_INTEGRATION_TESTS === 'true';

describe.skipIf(!shouldRunIntegrationTests)('Integration Tests', () => {
  let httpService: HttpService;

  beforeAll(() => {
    httpService = new HttpService({
      timeout: 10000, // 10 seconds for real requests
    });
  });

  describe('Public APIs', () => {
    it('should fetch from JSONPlaceholder API', async () => {
      const response = await httpService.get(
        'https://jsonplaceholder.typicode.com/posts/1'
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('id', 1);
      expect(response.data).toHaveProperty('title');
      expect(response.data).toHaveProperty('body');
      expect(response.data).toHaveProperty('userId');
    });

    it('should handle 404 errors gracefully', async () => {
      await expect(
        httpService.get('https://jsonplaceholder.typicode.com/posts/999999')
      ).rejects.toThrow();
    });

    it('should post data to JSONPlaceholder API', async () => {
      const postData = {
        title: 'Integration Test Post',
        body: 'This is a test post from integration tests',
        userId: 1,
      };

      const response = await httpService.post(
        'https://jsonplaceholder.typicode.com/posts',
        postData
      );

      expect(response.status).toBe(201);
      expect(response.data).toMatchObject(postData);
      expect(response.data).toHaveProperty('id');
    });

    it('should handle query parameters correctly', async () => {
      const response = await httpService.get(
        'https://jsonplaceholder.typicode.com/posts',
        {
          params: {
            userId: 1,
            _limit: 5,
          },
        }
      );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data)).toBe(true);
      expect(response.data.length).toBeLessThanOrEqual(5);
      expect(response.data.every((post: any) => post.userId === 1)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle network timeouts', async () => {
      const slowService = new HttpService({ timeout: 100 }); // Very short timeout

      await expect(
        slowService.get('https://httpbin.org/delay/1') // 1 second delay
      ).rejects.toThrow('timeout');
    });

    it('should handle invalid URLs', async () => {
      await expect(httpService.get('invalid-url')).rejects.toThrow();
    });

    it('should handle network errors', async () => {
      await expect(
        httpService.get('https://this-domain-does-not-exist-12345.com')
      ).rejects.toThrow();
    });
  });

  describe('Content Types', () => {
    it('should handle different response content types', async () => {
      // JSON response
      const jsonResponse = await httpService.get('https://httpbin.org/json');
      expect(jsonResponse.data).toBeTypeOf('object');

      // Text response
      const textResponse = await httpService.get(
        'https://httpbin.org/robots.txt'
      );
      expect(textResponse.data).toBeTypeOf('string');
      expect(textResponse.data).toContain('User-agent');
    });

    it('should send different content types', async () => {
      // Send JSON
      const jsonData = { test: 'data', number: 42 };
      const jsonResponse = await httpService.post(
        'https://httpbin.org/post',
        jsonData
      );
      expect(jsonResponse.data.json).toEqual(jsonData);

      // Send form data
      const formData = new FormData();
      formData.append('field1', 'value1');
      formData.append('field2', 'value2');

      const formResponse = await httpService.post(
        'https://httpbin.org/post',
        formData
      );
      expect(formResponse.data.form).toEqual({
        field1: 'value1',
        field2: 'value2',
      });
    });
  });

  describe('Headers and Authentication', () => {
    it('should send custom headers', async () => {
      const customHeaders = {
        'X-Custom-Header': 'test-value',
        'User-Agent': 'HttpService Integration Test',
      };

      const response = await httpService.get('https://httpbin.org/headers', {
        headers: customHeaders,
      });

      expect(response.data.headers['X-Custom-Header']).toBe('test-value');
      expect(response.data.headers['User-Agent']).toBe(
        'HttpService Integration Test'
      );
    });

    it('should handle bearer token authentication', async () => {
      const token = 'test-bearer-token-12345';

      const response = await httpService.get('https://httpbin.org/bearer', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(response.status).toBe(200);
      expect(response.data.authenticated).toBe(true);
      expect(response.data.token).toBe(token);
    });
  });

  describe('Request/Response Size', () => {
    it('should handle large responses', async () => {
      // Generate a large response (1000 posts)
      const response = await httpService.get(
        'https://jsonplaceholder.typicode.com/posts'
      );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data)).toBe(true);
      expect(response.data.length).toBeGreaterThan(50); // Should have many posts
    });

    it('should handle large request bodies', async () => {
      // Create a large object
      const largeData = {
        data: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          name: `Item ${i}`,
          description: `This is item number ${i} in our test data`,
          tags: [`tag${i}`, `category${i % 10}`, 'test'],
        })),
      };

      const response = await httpService.post(
        'https://httpbin.org/post',
        largeData
      );

      expect(response.status).toBe(200);
      expect(response.data.json.data).toHaveLength(1000);
    });
  });

  describe('Redirects', () => {
    it('should follow redirects by default', async () => {
      const response = await httpService.get('https://httpbin.org/redirect/3');

      expect(response.status).toBe(200);
      expect(response.data.url).toContain('httpbin.org/get');
    });

    it('should handle permanent redirects', async () => {
      const response = await httpService.get(
        'https://httpbin.org/redirect-to?url=https://httpbin.org/get&status_code=301'
      );

      expect(response.status).toBe(200);
    });
  });
});
