/**
 * Type definitions for the HTTP service
 */

export interface HttpServiceConfig {
  baseURL?: string;
  timeout?: number;
  headers?: Record<string, string>;
  retries?: number;
  retryDelay?: number;
  enableCache?: boolean;
  cacheTimeout?: number;
  enableDeduplication?: boolean;
  csrf?: CsrfConfig;
}

export interface RequestConfig extends RequestInit {
  url?: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  skipAuth?: boolean;
  skipCache?: boolean;
  skipCsrf?: boolean;
  cacheTimeout?: number;
  params?: Record<string, string | number | boolean>;
  data?: unknown;
}

export interface HttpResponse<T = unknown> {
  data: T;
  status: number;
  statusText: string;
  headers: Headers;
  config: RequestConfig;
}

export interface HttpError extends Error {
  status?: number;
  statusText?: string;
  response?: HttpResponse;
  config?: RequestConfig;
  isNetworkError: boolean;
  isTimeoutError: boolean;
  isAbortError: boolean;
}

export type RequestInterceptor = (
  config: RequestConfig
) => RequestConfig | Promise<RequestConfig>;

export type ResponseInterceptor<T = unknown> = (
  response: HttpResponse<T>
) => HttpResponse<T> | Promise<HttpResponse<T>>;

export type ErrorInterceptor = (
  error: HttpError
) => HttpError | Promise<HttpError>;

export interface AuthConfig {
  getToken?: () => string | Promise<string>;
  refreshToken?: () => Promise<string>;
  onTokenRefresh?: (token: string) => void;
  onAuthError?: (error: HttpError) => void;
}

export type HttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'HEAD'
  | 'OPTIONS';

export interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
  ttl: number;
  lastAccessed?: number;
}

export interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  retryCondition?: (error: HttpError) => boolean;
}

export interface CsrfConfig {
  enabled: boolean;
  tokenHeader?: string;
  tokenName?: string;
  getToken?: () => string | Promise<string>;
  validateToken?: (token: string) => boolean | Promise<boolean>;
}
