/**
 * Next.js API route integration helpers
 */
import type { NextRequest } from 'next/server';
import type { RequestConfig } from './types';

/**
 * Helper to create a consistent API response format
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
    statusCode?: number;
  };
  meta?: {
    timestamp: string;
    requestId?: string;
  };
}

/**
 * Create a standardized API response
 */
export function createApiResponse<T>(
  data?: T,
  error?: { message: string; code?: string; statusCode?: number }
): ApiResponse<T> {
  return {
    success: !error,
    data: error ? undefined : data,
    error,
    meta: {
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Extract request configuration from Next.js API route request
 */
export function extractRequestConfig(
  request: NextRequest
): Partial<RequestConfig> {
  const headers: Record<string, string> = {};

  // Convert Headers to plain object
  for (const [key, value] of request.headers.entries()) {
    headers[key] = value;
  }

  return {
    method: request.method as any,
    headers,
    url: request.url,
  };
}

/**
 * Create Next.js Response from API response
 */
export function createNextResponse<T>(
  apiResponse: ApiResponse<T>,
  statusCode = 200
): Response {
  const status = apiResponse.error?.statusCode || statusCode;

  return new Response(JSON.stringify(apiResponse), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Error handler for API routes
 */
export function handleApiError(error: unknown): ApiResponse {
  if (error instanceof Error) {
    return createApiResponse(undefined, {
      message: error.message,
      code: error.name,
      statusCode: 500,
    });
  }

  return createApiResponse(undefined, {
    message: 'An unknown error occurred',
    code: 'UNKNOWN_ERROR',
    statusCode: 500,
  });
}

/**
 * API route wrapper with error handling
 */
export function withApiHandler<T = any>(
  handler: (request: NextRequest) => Promise<ApiResponse<T>>
) {
  return async (request: NextRequest): Promise<Response> => {
    try {
      const result = await handler(request);
      return createNextResponse(result);
    } catch (error) {
      const errorResponse = handleApiError(error);
      return createNextResponse(errorResponse, 500);
    }
  };
}

/**
 * CORS helper for API routes
 */
export function withCors(
  response: Response,
  options?: {
    origin?: string | string[];
    methods?: string[];
    headers?: string[];
  }
): Response {
  const headers = new Headers(response.headers);

  const origin = options?.origin || '*';
  const methods = options?.methods || [
    'GET',
    'POST',
    'PUT',
    'DELETE',
    'OPTIONS',
  ];
  const allowedHeaders = options?.headers || ['Content-Type', 'Authorization'];

  headers.set(
    'Access-Control-Allow-Origin',
    Array.isArray(origin) ? origin.join(',') : origin
  );
  headers.set('Access-Control-Allow-Methods', methods.join(','));
  headers.set('Access-Control-Allow-Headers', allowedHeaders.join(','));

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
