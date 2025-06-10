import { HttpService } from './http-service';
/**
 * Mock and testing utilities for HTTP service
 */
import type { HttpResponse, RequestConfig } from './types';
import { buildURL, serializeBody } from './utils';

export interface MockResponse<T = any> {
  data: T;
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  delay?: number;
}

export interface MockConfig {
  url: string | RegExp;
  method?: string;
  response: MockResponse | ((config: RequestConfig) => MockResponse);
  times?: number; // How many times this mock should be used
}

/**
 * HTTP Service Mock for testing
 */
export class HttpServiceMock extends HttpService {
  private mocks: MockConfig[] = [];
  private callHistory: RequestConfig[] = [];

  /**
   * Add a mock response
   */
  mock(config: MockConfig): this {
    this.mocks.push({
      ...config,
      times: config.times || Number.POSITIVE_INFINITY,
    });
    return this;
  }

  /**
   * Mock a GET request
   */
  mockGet<T>(url: string | RegExp, response: MockResponse<T>): this {
    return this.mock({ url, method: 'GET', response });
  }

  /**
   * Mock a POST request
   */
  mockPost<T>(url: string | RegExp, response: MockResponse<T>): this {
    return this.mock({ url, method: 'POST', response });
  }

  /**
   * Mock a PUT request
   */
  mockPut<T>(url: string | RegExp, response: MockResponse<T>): this {
    return this.mock({ url, method: 'PUT', response });
  }

  /**
   * Mock a DELETE request
   */
  mockDelete<T>(url: string | RegExp, response: MockResponse<T>): this {
    return this.mock({ url, method: 'DELETE', response });
  }

  /**
   * Clear all mocks
   */
  clearMocks(): this {
    this.mocks = [];
    return this;
  }

  /**
   * Clear call history
   */
  clearHistory(): this {
    this.callHistory = [];
    return this;
  }

  /**
   * Get call history
   */
  getCallHistory(): RequestConfig[] {
    return [...this.callHistory];
  }

  /**
   * Reset call history
   */
  resetHistory(): void {
    this.callHistory = [];
  }

  /**
   * Check if a request was made
   */
  wasCalled(url?: string | RegExp, method?: string): boolean {
    return this.callHistory.some((call) => {
      const urlMatch = !url || this.matchUrl(call.url || '', url);
      const methodMatch = !method || call.method === method;
      return urlMatch && methodMatch;
    });
  }

  /**
   * Process request config for recording
   */
  private processRequestConfig(
    url: string,
    config?: RequestConfig
  ): RequestConfig {
    // Process the URL with parameters
    const fullURL = buildURL(url, config?.params);

    // Process the body from data
    const body = config?.data ? serializeBody(config.data) : config?.body;

    // Combine url and config into a single config object
    return {
      ...config,
      url: fullURL,
      body,
    };
  }

  /**
   * Override the request method to use mocks
   */
  async request<T = unknown>(
    url: string,
    config?: RequestConfig
  ): Promise<HttpResponse<T>> {
    const fullConfig = this.processRequestConfig(url, config);

    // Record the call with processed values
    this.callHistory.push({ ...fullConfig });

    // Find matching mock (use original url for matching)
    const mockIndex = this.mocks.findIndex((mock) => {
      const urlMatch = this.matchUrl(url, mock.url);
      const methodMatch = !mock.method || mock.method === fullConfig.method;
      return urlMatch && methodMatch && (mock.times || 0) > 0;
    });

    if (mockIndex >= 0) {
      const mock = this.mocks[mockIndex];

      // Decrease times counter
      if (mock.times !== Number.POSITIVE_INFINITY) {
        mock.times = (mock.times || 1) - 1;
        if (mock.times <= 0) {
          this.mocks.splice(mockIndex, 1);
        }
      }

      // Get response
      const mockResponse =
        typeof mock.response === 'function'
          ? mock.response(fullConfig)
          : mock.response;

      // Add delay if specified
      if (mockResponse.delay) {
        await new Promise((resolve) => setTimeout(resolve, mockResponse.delay));
      }

      return {
        data: mockResponse.data,
        status: mockResponse.status || 200,
        statusText: mockResponse.statusText || 'OK',
        headers: new Headers(mockResponse.headers || {}),
        config: fullConfig,
      };
    }

    // If no mock found, throw an error (or optionally fall back to real request)
    throw new Error(
      `No mock found for ${fullConfig.method || 'GET'} ${fullConfig.url}`
    );
  }

  private matchUrl(url: string, pattern: string | RegExp): boolean {
    if (typeof pattern === 'string') {
      return url === pattern || url.includes(pattern);
    }
    return pattern.test(url);
  }
}

/**
 * Create a mock HTTP service instance
 */
export function createMockHttpService(): HttpServiceMock {
  return new HttpServiceMock();
}

/**
 * Test utilities
 */
export const testUtils = {
  /**
   * Create a mock response
   */
  mockResponse: <T>(
    data: T,
    options?: Partial<MockResponse<T>>
  ): MockResponse<T> => ({
    data,
    status: 200,
    statusText: 'OK',
    ...options,
  }),

  /**
   * Create an error response
   */
  mockError: (message: string, status = 500): MockResponse => ({
    data: { error: message },
    status,
    statusText: 'Error',
  }),

  /**
   * Create a delayed response
   */
  mockDelayed: <T>(data: T, delay: number): MockResponse<T> => ({
    data,
    delay,
  }),
};
