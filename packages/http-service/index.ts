// Main exports
export { HttpService } from './http-service';

// Types
export type {
  HttpServiceConfig,
  RequestConfig,
  HttpResponse,
  HttpError,
  RequestInterceptor,
  ResponseInterceptor,
  ErrorInterceptor,
  AuthConfig,
  CsrfConfig,
} from './types';

// Error classes
export {
  HttpServiceError,
  NetworkError,
  AbortError,
  createHttpError,
} from './errors';

// Cache
export { HttpCache } from './cache';

// CSRF Protection
export { CsrfManager, createCsrfManager, generateCsrfToken } from './csrf';

// Logger functions
export * as logger from './logger';

// API Helpers
export type { ApiResponse } from './api-helpers';
export {
  createApiResponse,
  extractRequestConfig,
  createNextResponse,
  handleApiError,
  withApiHandler,
  withCors,
} from './api-helpers';

// Testing utilities
export type { MockResponse, MockConfig } from './testing';
export {
  HttpServiceMock,
  createMockHttpService,
  testUtils,
} from './testing';

// Throttling and queuing
export type { QueueConfig, QueuedRequest } from './throttling';
export {
  RequestQueue,
  ConnectionPool,
  Throttler,
  throttle,
} from './throttling';

// Plugin system
export type { Plugin, PluginHooks } from './plugins';
export {
  PluginManager,
  loggingPlugin,
  requestIdPlugin,
  performancePlugin,
  CircuitBreakerPlugin,
  createCircuitBreakerPlugin,
} from './plugins';

// Middleware
export type { MiddlewareConfig } from './middleware';
export {
  HttpServiceMiddleware,
  createHttpServiceMiddleware,
  httpServiceMatcher,
  extractRequestInfo,
  createEnvironmentMiddleware,
} from './middleware';

// Utilities
export {
  isDevelopment,
  buildURL,
  mergeHeaders,
  headersToObject,
  sleep,
  calculateBackoff,
  parseResponse,
  serializeBody,
  getContentType,
} from './utils';

// Create default instance
import { HttpService } from './http-service';
export const httpService = new HttpService();

// Export default instance
export default httpService;
