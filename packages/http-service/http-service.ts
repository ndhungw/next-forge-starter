import { HttpCache } from './cache';
import { CsrfManager } from './csrf';
import {
  AbortError,
  HttpServiceError,
  NetworkError,
  createHttpError,
} from './errors';
import { logger } from './logger';
import type {
  AuthConfig,
  ErrorInterceptor,
  HttpError,
  HttpResponse,
  HttpServiceConfig,
  RequestConfig,
  RequestInterceptor,
  ResponseInterceptor,
} from './types';
import {
  buildURL,
  calculateBackoff,
  getContentType,
  isDevelopment,
  mergeHeaders,
  parseResponse,
  serializeBody,
  sleep,
} from './utils';

// Regex constants to avoid performance issues
const TRAILING_SLASH_REGEX = /\/$/;
const LEADING_SLASH_REGEX = /^\//;

/**
 * Advanced HTTP service for Next.js applications
 * Provides interceptors, caching, retries, and more
 */
export class HttpService {
  private config: Required<HttpServiceConfig>;
  private cache: HttpCache;
  private requestInterceptors: RequestInterceptor[] = [];
  private responseInterceptors: ResponseInterceptor[] = [];
  private errorInterceptors: ErrorInterceptor[] = [];
  private authConfig?: AuthConfig;
  private csrfManager?: CsrfManager;
  private pendingRequests = new Map<string, Promise<HttpResponse>>();

  constructor(config: HttpServiceConfig = {}) {
    this.config = {
      baseURL: config.baseURL || '',
      timeout: config.timeout || 30000,
      headers: config.headers || {},
      retries: config.retries || 3,
      retryDelay: config.retryDelay || 1000,
      enableCache: config.enableCache ?? true,
      cacheTimeout: config.cacheTimeout || 300000, // 5 minutes
      enableDeduplication: config.enableDeduplication ?? true,
      csrf: config.csrf || { enabled: false },
    };

    this.cache = new HttpCache();

    // Initialize CSRF manager if enabled
    if (this.config.csrf.enabled) {
      this.csrfManager = new CsrfManager(this.config.csrf);
    }

    // Clean cache periodically
    if (this.config.enableCache) {
      setInterval(() => this.cache.cleanup(), 60000); // Every minute
    }
  }

  /**
   * Configure authentication
   */
  setAuth(authConfig: AuthConfig): void {
    this.authConfig = authConfig;
  }

  /**
   * Add request interceptor
   */
  addRequestInterceptor(interceptor: RequestInterceptor): () => void {
    this.requestInterceptors.push(interceptor);
    return () => {
      const index = this.requestInterceptors.indexOf(interceptor);
      if (index > -1) {
        this.requestInterceptors.splice(index, 1);
      }
    };
  }

  /**
   * Add response interceptor
   */
  addResponseInterceptor(interceptor: ResponseInterceptor): () => void {
    this.responseInterceptors.push(interceptor);
    return () => {
      const index = this.responseInterceptors.indexOf(interceptor);
      if (index > -1) {
        this.responseInterceptors.splice(index, 1);
      }
    };
  }

  /**
   * Add error interceptor
   */
  addErrorInterceptor(interceptor: ErrorInterceptor): () => void {
    this.errorInterceptors.push(interceptor);
    return () => {
      const index = this.errorInterceptors.indexOf(interceptor);
      if (index > -1) {
        this.errorInterceptors.splice(index, 1);
      }
    };
  }

  /**
   * Create request URL
   */
  private createURL(
    url: string,
    params?: Record<string, string | number | boolean>
  ): string {
    let fullURL = url;

    // Add base URL if it's a relative URL
    if (this.config.baseURL && !url.startsWith('http')) {
      const baseURL = this.config.baseURL.replace(TRAILING_SLASH_REGEX, '');
      const cleanUrl = url.replace(LEADING_SLASH_REGEX, '');
      fullURL = `${baseURL}/${cleanUrl}`;
    }

    return buildURL(fullURL, params);
  }

  /**
   * Apply request interceptors
   */
  private async applyRequestInterceptors(
    config: RequestConfig
  ): Promise<RequestConfig> {
    let finalConfig = { ...config };

    for (const interceptor of this.requestInterceptors) {
      finalConfig = await interceptor(finalConfig);
    }

    return finalConfig;
  }

  /**
   * Apply response interceptors
   */
  private async applyResponseInterceptors<T>(
    response: HttpResponse<T>
  ): Promise<HttpResponse<T>> {
    let finalResponse = response;

    for (const interceptor of this.responseInterceptors) {
      finalResponse = (await interceptor(finalResponse)) as HttpResponse<T>;
    }

    return finalResponse;
  }

  /**
   * Apply error interceptors
   */
  private async applyErrorInterceptors(error: HttpError): Promise<HttpError> {
    let finalError = error;

    for (const interceptor of this.errorInterceptors) {
      finalError = await interceptor(finalError);
    }

    return finalError;
  }

  /**
   * Get authentication token
   */
  private async getAuthToken(): Promise<string | null> {
    if (!this.authConfig?.getToken) {
      return null;
    }

    try {
      return await this.authConfig.getToken();
    } catch (error) {
      if (isDevelopment()) {
        logger.warn('Failed to get auth token:', error);
      }
      return null;
    }
  }

  /**
   * Handle token refresh
   */
  private async refreshAuthToken(): Promise<string | null> {
    if (!this.authConfig?.refreshToken) {
      return null;
    }

    try {
      const newToken = await this.authConfig.refreshToken();
      this.authConfig.onTokenRefresh?.(newToken);
      return newToken;
    } catch (error) {
      this.authConfig.onAuthError?.(error as HttpError);
      return null;
    }
  }

  /**
   * Prepare request headers
   */
  private async prepareHeaders(config: RequestConfig): Promise<Headers> {
    const headers = mergeHeaders(this.config.headers, config.headers);

    // Add auth token
    if (!config.skipAuth) {
      const token = await this.getAuthToken();
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
    }

    // Add CSRF token for protected methods
    if (!config.skipCsrf && this.csrfManager) {
      const method = config.method || 'GET';
      if (this.csrfManager.needsProtection(method)) {
        await this.csrfManager.addTokenToHeaders(headers);
      }
    }

    // Add content type for body requests
    if (config.data && !headers.has('Content-Type')) {
      const contentType = getContentType(config.data);
      if (contentType) {
        headers.set('Content-Type', contentType);
      }
    }

    return headers;
  }

  /**
   * Create cache key for request
   */
  private createCacheKey(url: string, config: RequestConfig): string {
    const method = config.method || 'GET';
    const body = config.data ? JSON.stringify(config.data) : '';
    return `${method}:${url}:${body}`;
  }

  /**
   * Make the actual HTTP request
   */
  private async executeRequest<T = unknown>(
    url: string,
    config: RequestConfig,
    headers: Headers
  ): Promise<HttpResponse<T>> {
    const timeout = config.timeout || this.config.timeout;

    // Create AbortController for timeout if user didn't provide one
    const shouldCreateTimeoutController = !config.signal;
    const timeoutController = shouldCreateTimeoutController
      ? new AbortController()
      : undefined;

    // Track if timeout was triggered by us
    let timeoutTriggered = false;
    const timeoutId =
      shouldCreateTimeoutController && timeoutController
        ? setTimeout(() => {
            timeoutTriggered = true;
            timeoutController.abort();
          }, timeout)
        : undefined;

    // Use user's signal or our timeout controller
    const signal = config.signal || timeoutController?.signal;

    // Store timeout flag in config for error handling
    (config as any)._timeoutTriggered = () => timeoutTriggered;

    try {
      const body = config.data ? serializeBody(config.data) : config.body;

      const requestInit: RequestInit = {
        ...config,
        headers,
        body,
        signal,
      };

      // Make the request
      const response = await fetch(url, requestInit);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Check if response is ok
      if (!response.ok) {
        throw createHttpError(
          response.status,
          response.statusText,
          response,
          config
        );
      }

      // Parse response
      const data = await parseResponse<T>(response);

      return {
        data,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        config,
      };
    } catch (error) {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Handle AbortError with proper timeout detection
      if (error instanceof DOMException && error.name === 'AbortError') {
        const errorMessage = this.determineAbortErrorMessage(
          timeoutTriggered,
          config
        );
        throw new AbortError(errorMessage);
      }

      throw error;
    }
  }

  /**
   * Determine the appropriate error message for AbortError
   */
  private determineAbortErrorMessage(
    timeoutTriggered: boolean,
    config: RequestConfig
  ): string {
    if (timeoutTriggered) {
      return 'Request timeout';
    }

    if (config.signal?.aborted) {
      return 'Request aborted by user';
    }

    return 'Request timeout';
  }

  /**
   * Handle request with auth retry
   */
  private async makeRequestWithAuth<T = unknown>(
    url: string,
    config: RequestConfig,
    attempt = 0
  ): Promise<HttpResponse<T>> {
    try {
      const headers = await this.prepareHeaders(config);
      return await this.executeRequest<T>(url, config, headers);
    } catch (error) {
      // Handle auth errors with token refresh
      if (
        error instanceof HttpServiceError &&
        error.status === 401 &&
        !config.skipAuth &&
        attempt === 0
      ) {
        const newToken = await this.refreshAuthToken();
        if (newToken) {
          // Retry with new token
          return this.makeRequestWithAuth(url, config, attempt + 1);
        }
      }
      throw error;
    }
  }

  /**
   * Make HTTP request with retries
   */
  private async makeRequest<T = unknown>(
    url: string,
    config: RequestConfig,
    attempt = 0
  ): Promise<HttpResponse<T>> {
    const retries = config.retries ?? this.config.retries;

    try {
      return await this.makeRequestWithAuth<T>(url, config, 0);
    } catch (error) {
      const processedError = await this.handleRequestError(error, config);

      // Retry logic
      if (attempt < retries && this.shouldRetry(processedError)) {
        const delay = calculateBackoff(
          attempt,
          config.retryDelay || this.config.retryDelay
        );
        await sleep(delay);
        return this.makeRequest(url, config, attempt + 1);
      }

      throw processedError;
    }
  }

  /**
   * Handle and transform request errors
   */
  private async handleRequestError(
    error: unknown,
    config: RequestConfig
  ): Promise<HttpError> {
    // AbortError is already handled in executeRequest, so this shouldn't reach here
    // But keep it as a fallback
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new AbortError('Request aborted');
    }

    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new NetworkError('Network error occurred');
    }

    // Handle generic Error objects that might be network related
    if (
      error instanceof Error &&
      (error.message.includes('Network') ||
        error.message.includes('network') ||
        error.message.includes('fetch'))
    ) {
      throw new NetworkError(error.message);
    }

    // Wrap unknown errors
    const httpError = this.wrapError(error, config);

    // Apply error interceptors
    return await this.applyErrorInterceptors(httpError);
  }

  /**
   * Wrap errors in appropriate HttpError type
   */
  private wrapError(error: unknown, config: RequestConfig): HttpError {
    if (error instanceof HttpServiceError) {
      return error;
    }

    return new HttpServiceError(
      error instanceof Error ? error.message : 'Unknown error occurred',
      { config }
    );
  }

  /**
   * Determine if request should be retried
   */
  private shouldRetry(error: HttpError): boolean {
    // Don't retry client errors (4xx)
    if (error.status && error.status >= 400 && error.status < 500) {
      return false;
    }

    // Retry network errors, timeouts, and server errors (5xx)
    return Boolean(
      error.isNetworkError ||
        error.isTimeoutError ||
        (error.status && error.status >= 500)
    );
  }

  /**
   * Check cache for GET requests
   */
  private getCachedResponse<T>(
    fullURL: string,
    processedConfig: RequestConfig
  ): HttpResponse<T> | null {
    if (
      !this.config.enableCache ||
      processedConfig.skipCache ||
      (processedConfig.method && processedConfig.method !== 'GET')
    ) {
      return null;
    }

    const cached = this.cache.get<T>(fullURL, processedConfig);
    if (cached) {
      if (isDevelopment()) {
        logger.log('🟢 Cache hit:', fullURL);
      }

      return {
        data: cached,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        config: processedConfig,
      };
    }

    return null;
  }

  /**
   * Handle request deduplication
   */
  private getDeduplicatedRequest<T>(
    cacheKey: string,
    fullURL: string
  ): Promise<HttpResponse<T>> | null {
    if (
      !this.config.enableDeduplication ||
      !this.pendingRequests.has(cacheKey)
    ) {
      return null;
    }

    if (isDevelopment()) {
      // eslint-disable-next-line no-console
      logger.log('🟡 Request deduplicated:', fullURL);
    }

    const request = this.pendingRequests.get(cacheKey);
    return request as Promise<HttpResponse<T>>;
  }

  /**
   * Cache successful responses
   */
  private cacheResponse<T>(
    fullURL: string,
    response: HttpResponse<T>,
    processedConfig: RequestConfig
  ): void {
    if (
      this.config.enableCache &&
      !processedConfig.skipCache &&
      (!processedConfig.method || processedConfig.method === 'GET')
    ) {
      const cacheTimeout =
        processedConfig.cacheTimeout || this.config.cacheTimeout;
      this.cache.set(fullURL, response.data, processedConfig, cacheTimeout);
    }
  }

  /**
   * Main request method
   */
  async request<T = unknown>(
    url: string,
    config: RequestConfig = {}
  ): Promise<HttpResponse<T>> {
    // Apply request interceptors
    const processedConfig = await this.applyRequestInterceptors(config);

    // Build full URL
    const fullURL = this.createURL(url, processedConfig.params);

    // Check cache for GET requests
    const cachedResponse = this.getCachedResponse<T>(fullURL, processedConfig);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Request deduplication
    const cacheKey = this.createCacheKey(fullURL, processedConfig);
    const deduplicatedRequest = this.getDeduplicatedRequest<T>(
      cacheKey,
      fullURL
    );
    if (deduplicatedRequest) {
      return deduplicatedRequest;
    }

    // Make request
    const requestPromise = this.makeRequest<T>(fullURL, processedConfig);

    // Store pending request for deduplication
    if (this.config.enableDeduplication) {
      this.pendingRequests.set(cacheKey, requestPromise);
    }

    try {
      const response = await requestPromise;

      // Apply response interceptors
      const processedResponse = await this.applyResponseInterceptors(response);

      // Cache successful GET responses
      this.cacheResponse(fullURL, processedResponse, processedConfig);

      // Log in development
      if (isDevelopment()) {
        // eslint-disable-next-line no-console
        logger.log(
          `🟢 ${processedConfig.method || 'GET'} ${fullURL}`,
          processedResponse
        );
      }

      return processedResponse;
    } finally {
      // Remove from pending requests
      if (this.config.enableDeduplication) {
        this.pendingRequests.delete(cacheKey);
      }
    }
  }

  // Convenience methods
  get<T = unknown>(
    url: string,
    config: Omit<RequestConfig, 'method'> = {}
  ): Promise<HttpResponse<T>> {
    return this.request<T>(url, { ...config, method: 'GET' });
  }

  post<T = unknown>(
    url: string,
    data?: unknown,
    config: Omit<RequestConfig, 'method' | 'data'> = {}
  ): Promise<HttpResponse<T>> {
    return this.request<T>(url, { ...config, method: 'POST', data });
  }

  put<T = unknown>(
    url: string,
    data?: unknown,
    config: Omit<RequestConfig, 'method' | 'data'> = {}
  ): Promise<HttpResponse<T>> {
    return this.request<T>(url, { ...config, method: 'PUT', data });
  }

  patch<T = unknown>(
    url: string,
    data?: unknown,
    config: Omit<RequestConfig, 'method' | 'data'> = {}
  ): Promise<HttpResponse<T>> {
    return this.request<T>(url, { ...config, method: 'PATCH', data });
  }

  delete<T = unknown>(
    url: string,
    config: Omit<RequestConfig, 'method'> = {}
  ): Promise<HttpResponse<T>> {
    return this.request<T>(url, { ...config, method: 'DELETE' });
  }

  head<T = unknown>(
    url: string,
    config: Omit<RequestConfig, 'method'> = {}
  ): Promise<HttpResponse<T>> {
    return this.request<T>(url, { ...config, method: 'HEAD' });
  }

  options<T = unknown>(
    url: string,
    config: Omit<RequestConfig, 'method'> = {}
  ): Promise<HttpResponse<T>> {
    return this.request<T>(url, { ...config, method: 'OPTIONS' });
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  getCacheSize(): number {
    return this.cache.size;
  }

  /**
   * Create a new instance with extended config
   */
  create(config: HttpServiceConfig = {}): HttpService {
    const mergedConfig = {
      ...this.config,
      ...config,
      headers: { ...this.config.headers, ...config.headers },
    };

    const instance = new HttpService(mergedConfig);

    // Copy interceptors
    instance.requestInterceptors = [...this.requestInterceptors];
    instance.responseInterceptors = [...this.responseInterceptors];
    instance.errorInterceptors = [...this.errorInterceptors];

    // Copy auth config
    if (this.authConfig) {
      instance.setAuth(this.authConfig);
    }

    return instance;
  }
}

// Create default instance
export const httpService = new HttpService();
