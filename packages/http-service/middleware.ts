/**
 * Next.js middleware integration for HTTP service
 */
import { type NextRequest, NextResponse } from 'next/server';
import { logger } from './logger';

/**
 * Configuration options for HTTP service middleware
 */
export interface MiddlewareConfig {
  /** Enable request/response logging */
  enableLogging?: boolean;
  /** Enable CORS headers */
  enableCors?: boolean;
  /** Enable rate limiting */
  enableRateLimit?: boolean;
  /** Rate limiting configuration */
  rateLimitConfig?: {
    /** Time window in milliseconds */
    windowMs: number;
    /** Maximum requests per window */
    maxRequests: number;
  };
  /** CORS configuration */
  corsConfig?: {
    /** Allowed origins */
    origin?: string | string[];
    /** Allowed HTTP methods */
    methods?: string[];
    /** Allowed headers */
    headers?: string[];
  };
}

/**
 * Rate limit record for tracking requests per client
 */
interface RateLimitRecord {
  /** Number of requests made in current window */
  count: number;
  /** Timestamp when the window resets */
  resetTime: number;
}

/**
 * Rate limiter for middleware
 */
class RateLimiter {
  private requests = new Map<string, RateLimitRecord>();
  private windowMs: number;
  private maxRequests: number;

  constructor(windowMs: number, maxRequests: number) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  isAllowed(identifier: string): boolean {
    const now = Date.now();
    const record = this.requests.get(identifier);

    if (!record || now > record.resetTime) {
      // Reset or create new record
      this.requests.set(identifier, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      return true;
    }

    if (record.count >= this.maxRequests) {
      return false;
    }

    record.count++;
    return true;
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.requests.entries()) {
      if (now > record.resetTime) {
        this.requests.delete(key);
      }
    }
  }
}

/**
 * HTTP service middleware for Next.js
 */
export class HttpServiceMiddleware {
  private rateLimiter?: RateLimiter;
  private config: Required<MiddlewareConfig>;

  constructor(config: MiddlewareConfig = {}) {
    // Provide complete default configuration
    this.config = {
      enableLogging: config.enableLogging ?? true,
      enableCors: config.enableCors ?? true,
      enableRateLimit: config.enableRateLimit ?? false,
      rateLimitConfig: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 100,
        ...config.rateLimitConfig,
      },
      corsConfig: {
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        headers: ['Content-Type', 'Authorization'],
        ...config.corsConfig,
      },
    };

    if (this.config.enableRateLimit && this.config.rateLimitConfig) {
      this.rateLimiter = new RateLimiter(
        this.config.rateLimitConfig.windowMs,
        this.config.rateLimitConfig.maxRequests
      );
    }

    // Cleanup rate limiter periodically
    if (this.rateLimiter) {
      setInterval(() => {
        if (this.rateLimiter) {
          this.rateLimiter.cleanup();
        }
      }, 60000); // Every minute
    }
  }

  /**
   * Process request through middleware
   */

  // biome-ignore lint/suspicious/useAwait: Middleware function signature requires async
  async process(request: NextRequest): Promise<NextResponse | null> {
    // Logging
    if (this.config.enableLogging) {
      logger.log(`🔵 ${request.method} ${request.url}`);
    }

    // Rate limiting
    if (this.config.enableRateLimit && this.rateLimiter) {
      const identifier = this.getClientIdentifier(request);
      if (!this.rateLimiter.isAllowed(identifier)) {
        return new NextResponse('Too Many Requests', { status: 429 });
      }
    }

    // CORS preflight
    if (this.config.enableCors && request.method === 'OPTIONS') {
      return this.createCorsResponse();
    }

    return null; // Continue processing
  }

  /**
   * Process response through middleware
   */
  processResponse(response: NextResponse, request: NextRequest): NextResponse {
    // Add CORS headers
    if (this.config.enableCors) {
      this.addCorsHeaders(response);
    }

    // Logging
    if (this.config.enableLogging) {
      logger.log(`🟢 ${response.status} ${request.method} ${request.url}`);
    }

    return response;
  }

  /**
   * Create CORS preflight response
   */
  private createCorsResponse(): NextResponse {
    const response = new NextResponse(null, { status: 200 });
    this.addCorsHeaders(response);
    return response;
  }

  /**
   * Add CORS headers to response
   */
  private addCorsHeaders(response: NextResponse): void {
    const corsConfig = this.config.corsConfig;

    response.headers.set(
      'Access-Control-Allow-Origin',
      Array.isArray(corsConfig.origin)
        ? corsConfig.origin.join(',')
        : corsConfig.origin || '*'
    );

    response.headers.set(
      'Access-Control-Allow-Methods',
      corsConfig.methods?.join(',') || 'GET,POST,PUT,DELETE,OPTIONS'
    );

    response.headers.set(
      'Access-Control-Allow-Headers',
      corsConfig.headers?.join(',') || 'Content-Type,Authorization'
    );
  }

  /**
   * Get client identifier for rate limiting
   */
  private getClientIdentifier(request: NextRequest): string {
    // Try to get IP from various headers
    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const remoteAddr = request.headers.get('remote-addr');

    return forwardedFor?.split(',')[0] || realIp || remoteAddr || 'unknown';
  }
}

/**
 * Create middleware function for Next.js
 */
export function createHttpServiceMiddleware(config?: MiddlewareConfig) {
  const middleware = new HttpServiceMiddleware(config);

  return async (request: NextRequest): Promise<NextResponse> => {
    const middlewareResponse = await middleware.process(request);

    if (middlewareResponse) {
      return middlewareResponse;
    }

    // Continue to the next handler
    const response = NextResponse.next();
    return middleware.processResponse(response, request);
  };
}

/**
 * Matcher configuration for Next.js middleware
 */
export const httpServiceMatcher = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};

interface RequestInfo {
  url: string;
  method: string;
  headers: Record<string, string>;
  searchParams: Record<string, string>;
}

/**
 * Utility to extract request info in middleware
 */
export function extractRequestInfo(request: NextRequest): RequestInfo {
  const headers: Record<string, string> = {};
  for (const [key, value] of request.headers.entries()) {
    headers[key] = value;
  }

  const searchParams: Record<string, string> = {};
  for (const [key, value] of request.nextUrl.searchParams.entries()) {
    searchParams[key] = value;
  }

  return {
    url: request.url,
    method: request.method,
    headers,
    searchParams,
  };
}

/**
 * Middleware factory for different environments
 */
export function createEnvironmentMiddleware(
  environment: 'development' | 'production'
) {
  const config: MiddlewareConfig = {
    enableLogging: environment === 'development',
    enableCors: true,
    enableRateLimit: environment === 'production',
    rateLimitConfig: {
      windowMs: environment === 'production' ? 15 * 60 * 1000 : 60 * 1000,
      maxRequests: environment === 'production' ? 100 : 1000,
    },
  };

  return createHttpServiceMiddleware(config);
}
