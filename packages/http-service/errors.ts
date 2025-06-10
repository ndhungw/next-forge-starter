import type { HttpError } from './types';

/**
 * Custom error classes for different HTTP scenarios
 */
export class HttpServiceError extends Error implements HttpError {
  status?: number;
  statusText?: string;
  response?: any;
  config?: any;
  isNetworkError = false;
  isTimeoutError = false;
  isAbortError = false;

  constructor(
    message: string,
    options: {
      status?: number;
      statusText?: string;
      response?: any;
      config?: any;
      isNetworkError?: boolean;
      isTimeoutError?: boolean;
      isAbortError?: boolean;
    } = {}
  ) {
    super(message);
    this.name = 'HttpServiceError';
    this.status = options.status;
    this.statusText = options.statusText;
    this.response = options.response;
    this.config = options.config;
    this.isNetworkError = options.isNetworkError || false;
    this.isTimeoutError = options.isTimeoutError || false;
    this.isAbortError = options.isAbortError || false;
  }
}

export class NetworkError extends HttpServiceError {
  constructor(message = 'Network error occurred') {
    super(message, { isNetworkError: true });
    this.name = 'NetworkError';
  }
}

export class TimeoutError extends HttpServiceError {
  constructor(message = 'Request timeout') {
    super(message, { isTimeoutError: true });
    this.name = 'TimeoutError';
  }
}

export class AbortError extends HttpServiceError {
  constructor(message = 'Request was aborted') {
    super(message, { isAbortError: true });
    this.name = 'AbortError';
  }
}

export class AuthenticationError extends HttpServiceError {
  constructor(message = 'Authentication failed', status = 401) {
    super(message, { status });
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends HttpServiceError {
  constructor(message = 'Authorization failed', status = 403) {
    super(message, { status });
    this.name = 'AuthorizationError';
  }
}

export class ValidationError extends HttpServiceError {
  constructor(message = 'Validation failed', status = 400) {
    super(message, { status });
    this.name = 'ValidationError';
  }
}

export class ServerError extends HttpServiceError {
  constructor(message = 'Server error occurred', status = 500) {
    super(message, { status });
    this.name = 'ServerError';
  }
}

/**
 * Maps HTTP status codes to appropriate error types
 */
export function createHttpError(
  status: number,
  statusText: string,
  response?: any,
  config?: any
): HttpServiceError {
  const message = `HTTP ${status}: ${statusText}`;

  switch (true) {
    case status === 400:
      return new ValidationError(message, status);
    case status === 401:
      return new AuthenticationError(message, status);
    case status === 403:
      return new AuthorizationError(message, status);
    case status >= 400 && status < 500:
      return new HttpServiceError(message, {
        status,
        statusText,
        response,
        config,
      });
    case status >= 500:
      return new ServerError(message, status);
    default:
      return new HttpServiceError(message, {
        status,
        statusText,
        response,
        config,
      });
  }
}
