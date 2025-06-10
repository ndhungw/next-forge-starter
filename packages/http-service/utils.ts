/**
 * Utility functions for HTTP service
 */

/**
 * Check if we're running on the server side
 */
export function isServer(): boolean {
  return typeof window === 'undefined';
}

/**
 * Check if we're running in development mode
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Build URL with query parameters
 */
export function buildURL(
  url: string,
  params?: Record<string, string | number | boolean>
): string {
  if (!params || Object.keys(params).length === 0) {
    return url;
  }

  // Build query string manually to ensure proper percent-encoding
  const queryParams: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    // Skip null and undefined values
    if (value === null || value === undefined) {
      continue;
    }
    // Use encodeURIComponent for proper percent-encoding
    queryParams.push(
      `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`
    );
  }

  if (queryParams.length === 0) {
    return url;
  }

  const separator = url.includes('?') ? '&' : '?';
  return url + separator + queryParams.join('&');
}

/**
 * Process a single headers object and add to merged headers
 */
function processHeaders(headers: HeadersInit, merged: Headers): void {
  if (headers instanceof Headers) {
    for (const [key, value] of headers) {
      merged.set(key, value);
    }
  } else if (Array.isArray(headers)) {
    for (const [key, value] of headers) {
      merged.set(key, value);
    }
  } else {
    for (const [key, value] of Object.entries(headers)) {
      merged.set(key, value);
    }
  }
}

/**
 * Merge headers objects
 */
export function mergeHeaders(
  ...headersList: (HeadersInit | undefined)[]
): Headers {
  const merged = new Headers();

  for (const headers of headersList) {
    if (!headers) {
      continue;
    }
    processHeaders(headers, merged);
  }

  return merged;
}

/**
 * Convert Headers object to plain object (for testing)
 */
export function headersToObject(headers: Headers): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const [key, value] of headers.entries()) {
    obj[key] = value;
  }
  return obj;
}

/**
 * Sleep utility for retry delays
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay
 */
export function calculateBackoff(attempt: number, baseDelay = 1000): number {
  return Math.min(baseDelay * 2 ** attempt, 30000); // Max 30 seconds
}

/**
 * Check if response is JSON
 */
export function isJsonResponse(response: Response): boolean {
  const contentType = response.headers.get('content-type');
  return contentType?.includes('application/json') || false;
}

/**
 * Parse response body based on content type
 */
export async function parseResponse<T = unknown>(
  response: Response
): Promise<T> {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch {
      // Fallback to text on JSON parse error
      return response.text() as T;
    }
  }

  if (contentType.includes('text/')) {
    return response.text() as T;
  }

  if (
    contentType.includes('application/octet-stream') ||
    contentType.includes('image/') ||
    contentType.includes('video/') ||
    contentType.includes('audio/')
  ) {
    return response.blob() as T;
  }

  // Default to text
  return response.text() as T;
}

/**
 * Serialize request body
 */
export function serializeBody(
  data: unknown
): string | FormData | URLSearchParams | null | undefined {
  if (data === null) {
    return null;
  }

  if (data === undefined) {
    return undefined;
  }

  if (typeof data === 'string') {
    return data;
  }

  if (data instanceof FormData || data instanceof URLSearchParams) {
    return data;
  }

  // Default to JSON
  return JSON.stringify(data);
}

/**
 * Get appropriate content type for body
 */
export function getContentType(data: unknown): string | undefined {
  if (data === null || data === undefined) {
    return undefined;
  }

  if (data instanceof FormData) {
    return 'multipart/form-data';
  }

  if (data instanceof URLSearchParams) {
    return 'application/x-www-form-urlencoded';
  }

  if (typeof data === 'string') {
    return 'text/plain';
  }

  // Default to JSON
  return 'application/json';
}
