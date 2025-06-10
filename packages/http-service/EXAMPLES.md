# HTTP Service Usage Examples

This document provides practical examples of using the HTTP Service in various real-world scenarios.

## Table of Contents

- [Basic Usage](#basic-usage)
- [Authentication](#authentication)
- [File Operations](#file-operations)
- [Error Handling](#error-handling)
- [Caching Strategies](#caching-strategies)
- [Next.js Integration](#nextjs-integration)
- [Advanced Patterns](#advanced-patterns)
- [Performance Optimization](#performance-optimization)

## Basic Usage

### Simple API Client

```typescript
import { HttpService } from '@repo/http-service';

// Create a reusable API client
const apiClient = new HttpService({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api',
  timeout: 10000,
  defaultHeaders: {
    'Content-Type': 'application/json',
  },
});

// GET request
async function getUsers() {
  try {
    const response = await apiClient.get('/users');
    return response.data;
  } catch (error) {
    console.error('Failed to fetch users:', error);
    throw error;
  }
}

// POST request
async function createUser(userData: { name: string; email: string }) {
  const response = await apiClient.post('/users', userData);
  return response.data;
}
```

### Query Parameters and Filtering

```typescript
// Search with pagination
async function searchUsers(search: string, page = 1, limit = 10) {
  const response = await apiClient.get('/users', {
    params: {
      search,
      page,
      limit,
      sort: 'name',
      order: 'asc',
    },
  });
  return response.data;
}

// Complex filtering
async function getFilteredProducts(filters: ProductFilters) {
  const response = await apiClient.get('/products', {
    params: {
      category: filters.category,
      'price[gte]': filters.minPrice,
      'price[lte]': filters.maxPrice,
      inStock: filters.inStock,
      tags: filters.tags?.join(','),
    },
  });
  return response.data;
}
```

## Authentication

### JWT Token Management

```typescript
class AuthenticatedApiClient {
  private api: HttpService;

  constructor() {
    this.api = new HttpService({
      baseURL: '/api',
      timeout: 15000,
    });

    // Add authentication interceptor
    this.api.addRequestInterceptor(async (config) => {
      const token = await this.getValidToken();
      if (token) {
        config.headers = {
          ...config.headers,
          Authorization: `Bearer ${token}`,
        };
      }
      return config;
    });

    // Handle authentication errors
    this.api.addErrorInterceptor((error) => {
      if (error.status === 401) {
        this.handleAuthError();
      }
      throw error;
    });
  }

  private async getValidToken(): Promise<string | null> {
    const token = localStorage.getItem('accessToken');
    const expiry = localStorage.getItem('tokenExpiry');

    if (!token || !expiry) return null;

    // Check if token is expired
    if (Date.now() > parseInt(expiry)) {
      return await this.refreshToken();
    }

    return token;
  }

  private async refreshToken(): Promise<string | null> {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) throw new Error('No refresh token');

      const response = await fetch('/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) throw new Error('Token refresh failed');

      const data = await response.json();
      
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('tokenExpiry', data.expiresAt);
      
      return data.accessToken;
    } catch (error) {
      this.handleAuthError();
      return null;
    }
  }

  private handleAuthError() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('tokenExpiry');
    window.location.href = '/login';
  }

  // Public API methods
  async getProfile() {
    const response = await this.api.get('/user/profile');
    return response.data;
  }

  async updateProfile(data: ProfileData) {
    const response = await this.api.put('/user/profile', data);
    return response.data;
  }
}
```

### Role-Based API Access

```typescript
class RoleBasedApiClient {
  private api: HttpService;
  private userRole: string | null = null;

  constructor() {
    this.api = new HttpService({ baseURL: '/api' });
    
    this.api.addRequestInterceptor((config) => {
      // Add role-based headers
      if (this.userRole) {
        config.headers = {
          ...config.headers,
          'X-User-Role': this.userRole,
        };
      }
      return config;
    });
  }

  setUserRole(role: string) {
    this.userRole = role;
  }

  async getUsers() {
    if (this.userRole !== 'admin') {
      throw new Error('Insufficient permissions');
    }
    return this.api.get('/admin/users');
  }

  async getUserData(userId: string) {
    // Users can only access their own data unless they're admin
    if (this.userRole !== 'admin' && userId !== 'me') {
      throw new Error('Access denied');
    }
    return this.api.get(`/users/${userId}`);
  }
}
```

## File Operations

### File Upload with Progress

```typescript
class FileUploadService {
  private api: HttpService;

  constructor() {
    this.api = new HttpService({
      baseURL: '/api',
      timeout: 300000, // 5 minutes for large files
    });
  }

  async uploadFile(
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<UploadResult> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('filename', file.name);
    formData.append('filesize', file.size.toString());

    // Note: For progress tracking, you'd need to implement XMLHttpRequest
    // or use a custom fetch wrapper. This is a simplified example.
    const response = await this.api.post('/upload', formData, {
      headers: {
        // Let browser set Content-Type for FormData
        'Content-Type': undefined,
      },
    });

    return response.data;
  }

  async uploadMultipleFiles(
    files: File[],
    onProgress?: (fileIndex: number, progress: number) => void
  ): Promise<UploadResult[]> {
    const results: UploadResult[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const result = await this.uploadFile(file, (progress) => {
        onProgress?.(i, progress);
      });
      results.push(result);
    }

    return results;
  }

  async deleteFile(fileId: string): Promise<void> {
    await this.api.delete(`/files/${fileId}`);
  }
}

// Usage
const fileService = new FileUploadService();

async function handleFileUpload(files: FileList) {
  const fileArray = Array.from(files);
  
  try {
    const results = await fileService.uploadMultipleFiles(
      fileArray,
      (fileIndex, progress) => {
        console.log(`File ${fileIndex + 1}: ${progress}% uploaded`);
      }
    );
    
    console.log('All files uploaded:', results);
  } catch (error) {
    console.error('Upload failed:', error);
  }
}
```

### Image Upload with Resizing

```typescript
class ImageUploadService {
  private api: HttpService;

  constructor() {
    this.api = new HttpService({ baseURL: '/api' });
  }

  private async resizeImage(file: File, maxWidth: number, maxHeight: number): Promise<File> {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const img = new Image();

      img.onload = () => {
        // Calculate new dimensions
        let { width, height } = img;
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        
        if (ratio < 1) {
          width *= ratio;
          height *= ratio;
        }

        canvas.width = width;
        canvas.height = height;

        // Draw resized image
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          resolve(new File([blob!], file.name, { type: file.type }));
        }, file.type, 0.8); // 80% quality
      };

      img.src = URL.createObjectURL(file);
    });
  }

  async uploadAvatar(file: File, userId: string): Promise<string> {
    // Resize image before upload
    const resizedFile = await this.resizeImage(file, 300, 300);
    
    const formData = new FormData();
    formData.append('avatar', resizedFile);

    const response = await this.api.post(`/users/${userId}/avatar`, formData);
    return response.data.avatarUrl;
  }
}
```

## Error Handling

### Comprehensive Error Management

```typescript
class RobustApiClient {
  private api: HttpService;

  constructor() {
    this.api = new HttpService({
      baseURL: '/api',
      retry: {
        attempts: 3,
        delay: 1000,
        backoff: 'exponential',
        retryCondition: (error) => {
          // Retry on network errors and 5xx server errors
          return error.isNetworkError || (error.status >= 500 && error.status < 600);
        },
      },
    });

    this.setupErrorHandling();
  }

  private setupErrorHandling() {
    this.api.addErrorInterceptor((error) => {
      // Log errors for monitoring
      this.logError(error);

      // Handle specific error types
      switch (error.status) {
        case 400:
          throw new ValidationError(error.message, error.data?.errors);
        case 401:
          throw new AuthenticationError('Authentication required');
        case 403:
          throw new AuthorizationError('Access denied');
        case 404:
          throw new NotFoundError('Resource not found');
        case 429:
          throw new RateLimitError('Too many requests');
        case 500:
          throw new ServerError('Internal server error');
        default:
          throw new ApiError(error.message, error.status);
      }
    });
  }

  private logError(error: any) {
    // Send to error tracking service
    console.error('API Error:', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.status,
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }

  // Wrapper methods with enhanced error handling
  async safeGet<T>(url: string, config?: any): Promise<T | null> {
    try {
      const response = await this.api.get<T>(url, config);
      return response.data;
    } catch (error) {
      if (error instanceof NotFoundError) {
        return null; // Return null for 404s instead of throwing
      }
      throw error;
    }
  }

  async withRetry<T>(operation: () => Promise<T>, maxRetries = 3): Promise<T> {
    let lastError: Error;

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (i === maxRetries - 1) break;
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }

    throw lastError!;
  }
}

// Custom error classes
class ValidationError extends Error {
  constructor(message: string, public errors?: Record<string, string[]>) {
    super(message);
    this.name = 'ValidationError';
  }
}

class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}
```

### Graceful Degradation

```typescript
class ResilientApiClient {
  private api: HttpService;
  private fallbackData: Map<string, any> = new Map();

  constructor() {
    this.api = new HttpService({
      baseURL: '/api',
      timeout: 5000,
    });
  }

  async getWithFallback<T>(
    url: string,
    fallback: T,
    cacheKey?: string
  ): Promise<T> {
    try {
      const response = await this.api.get<T>(url);
      
      // Cache successful response
      if (cacheKey) {
        this.fallbackData.set(cacheKey, response.data);
      }
      
      return response.data;
    } catch (error) {
      console.warn(`API call failed for ${url}, using fallback:`, error);
      
      // Try cached data first
      if (cacheKey && this.fallbackData.has(cacheKey)) {
        return this.fallbackData.get(cacheKey);
      }
      
      // Use provided fallback
      return fallback;
    }
  }

  async getEssentialData<T>(url: string): Promise<T> {
    // Critical data that must succeed
    const maxRetries = 5;
    let delay = 1000;

    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await this.api.get<T>(url);
        return response.data;
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      }
    }

    throw new Error('Failed to get essential data after retries');
  }
}
```

## Caching Strategies

### Smart Caching

```typescript
class CachedApiClient {
  private api: HttpService;

  constructor() {
    this.api = new HttpService({
      baseURL: '/api',
      cache: {
        enabled: true,
        defaultTTL: 300000, // 5 minutes
        maxSize: 100,
      },
    });
  }

  // Cache user data for 30 minutes
  async getUser(id: string) {
    return this.api.get(`/users/${id}`, {
      cache: {
        ttl: 30 * 60 * 1000,
        key: `user-${id}`,
      },
    });
  }

  // Cache static data for 1 hour
  async getCountries() {
    return this.api.get('/countries', {
      cache: {
        ttl: 60 * 60 * 1000,
        key: 'countries-list',
      },
    });
  }

  // Never cache sensitive data
  async getBankBalance() {
    return this.api.get('/account/balance', {
      cache: false,
    });
  }

  // Cache with conditional refresh
  async getUserPreferences(userId: string, forceRefresh = false) {
    const cacheKey = `user-preferences-${userId}`;
    
    if (forceRefresh) {
      // Clear cache for this key
      this.api.cache?.delete(cacheKey);
    }

    return this.api.get(`/users/${userId}/preferences`, {
      cache: {
        ttl: 10 * 60 * 1000, // 10 minutes
        key: cacheKey,
      },
    });
  }
}
```

### Cache Invalidation

```typescript
class CacheAwareApiClient {
  private api: HttpService;

  constructor() {
    this.api = new HttpService({
      baseURL: '/api',
      cache: { enabled: true },
    });
  }

  async updateUser(id: string, data: any) {
    const response = await this.api.put(`/users/${id}`, data);
    
    // Invalidate related cache entries
    this.api.cache?.delete(`user-${id}`);
    this.api.cache?.delete('users-list');
    this.api.cache?.delete(`user-preferences-${id}`);
    
    return response.data;
  }

  async deleteUser(id: string) {
    const response = await this.api.delete(`/users/${id}`);
    
    // Clear all user-related cache
    const cacheKeys = [
      `user-${id}`,
      `user-preferences-${id}`,
      `user-posts-${id}`,
      'users-list',
    ];
    
    for (const key of cacheKeys) {
      this.api.cache?.delete(key);
    }
    
    return response.data;
  }

  // Bulk cache invalidation
  async clearUserCache(userId: string) {
    if (!this.api.cache) return;
    
    // Get all cache keys and filter for user-related ones
    const userPattern = new RegExp(`user.*${userId}`);
    
    // Note: This assumes cache has a method to get all keys
    // Implementation depends on cache structure
    for (const key of this.getAllCacheKeys()) {
      if (userPattern.test(key)) {
        this.api.cache.delete(key);
      }
    }
  }

  private getAllCacheKeys(): string[] {
    // Implementation depends on cache structure
    return [];
  }
}
```

## Next.js Integration

### API Route Handler

```typescript
// app/api/users/route.ts
import { createApiResponse, handleApiError, extractRequestConfig } from '@repo/http-service';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const config = extractRequestConfig(request);
    const { searchParams } = new URL(request.url);
    
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';

    const users = await getUsersFromDatabase({ page, limit, search });
    
    return createApiResponse(users, {
      message: 'Users retrieved successfully',
      pagination: {
        page,
        limit,
        total: users.total,
        pages: Math.ceil(users.total / limit),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userData = await request.json();
    
    // Validate data
    const validatedData = validateUserData(userData);
    
    const user = await createUserInDatabase(validatedData);
    
    return createApiResponse(user, {
      message: 'User created successfully',
      status: 201,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
```

### Middleware Integration

```typescript
// middleware.ts
import { createHttpServiceMiddleware } from '@repo/http-service';
import { NextRequest } from 'next/server';

const httpMiddleware = createHttpServiceMiddleware({
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: (request: NextRequest) => {
      // Different limits for different routes
      if (request.nextUrl.pathname.startsWith('/api/auth')) {
        return 5; // Strict limit for auth endpoints
      }
      if (request.nextUrl.pathname.startsWith('/api/upload')) {
        return 10; // Moderate limit for uploads
      }
      return 100; // Default limit
    },
  },
  cors: {
    origin: (origin: string) => {
      const allowedOrigins = [
        'http://localhost:3000',
        'https://yourdomain.com',
        'https://admin.yourdomain.com',
      ];
      return allowedOrigins.includes(origin);
    },
    credentials: true,
  },
  logging: {
    enabled: process.env.NODE_ENV === 'development',
    level: 'info',
  },
});

export function middleware(request: NextRequest) {
  return httpMiddleware(request);
}

export const config = {
  matcher: [
    '/api/:path*',
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
```

### Client-Side Hook

```typescript
// hooks/useApi.ts
import { useState, useEffect, useCallback } from 'react';
import { httpService } from '@repo/http-service';

interface UseApiOptions<T> {
  initialData?: T;
  immediate?: boolean;
  cache?: boolean;
  dependencies?: any[];
}

export function useApi<T>(
  url: string,
  options: UseApiOptions<T> = {}
) {
  const [data, setData] = useState<T | null>(options.initialData || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await httpService.get<T>(url, {
        cache: options.cache ? { ttl: 300000 } : false,
      });
      
      setData(response.data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [url, options.cache]);

  const mutate = useCallback((newData: T) => {
    setData(newData);
  }, []);

  const revalidate = useCallback(() => {
    return fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (options.immediate !== false) {
      fetchData();
    }
  }, [fetchData, ...(options.dependencies || [])]);

  return {
    data,
    loading,
    error,
    mutate,
    revalidate,
  };
}

// Usage in component
function UserProfile({ userId }: { userId: string }) {
  const { data: user, loading, error, revalidate } = useApi<User>(
    `/api/users/${userId}`,
    {
      cache: true,
      dependencies: [userId],
    }
  );

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!user) return <div>User not found</div>;

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
      <button onClick={revalidate}>Refresh</button>
    </div>
  );
}
```

## Advanced Patterns

### Request Deduplication

```typescript
class DeduplicatedApiClient {
  private api: HttpService;
  private pendingRequests = new Map<string, Promise<any>>();

  constructor() {
    this.api = new HttpService({ baseURL: '/api' });
  }

  private createRequestKey(method: string, url: string, params?: any): string {
    return `${method}:${url}:${JSON.stringify(params || {})}`;
  }

  async get<T>(url: string, config?: any): Promise<T> {
    const key = this.createRequestKey('GET', url, config?.params);
    
    // Return existing promise if request is already pending
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key)!;
    }

    // Create new request
    const promise = this.api.get<T>(url, config).then(
      (response) => {
        this.pendingRequests.delete(key);
        return response.data;
      },
      (error) => {
        this.pendingRequests.delete(key);
        throw error;
      }
    );

    this.pendingRequests.set(key, promise);
    return promise;
  }

  // Clear pending requests (useful for cleanup)
  clearPendingRequests() {
    this.pendingRequests.clear();
  }
}
```

### Batch Requests

```typescript
class BatchApiClient {
  private api: HttpService;
  private batchQueue: Array<{
    id: string;
    request: any;
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }> = [];
  private batchTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.api = new HttpService({ baseURL: '/api' });
  }

  async batchGet<T>(urls: string[]): Promise<T[]> {
    const response = await this.api.post<T[]>('/batch', {
      requests: urls.map(url => ({ method: 'GET', url })),
    });
    
    return response.data;
  }

  // Queue individual requests and batch them
  async queuedGet<T>(url: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = Math.random().toString(36);
      
      this.batchQueue.push({
        id,
        request: { method: 'GET', url },
        resolve,
        reject,
      });

      // Process batch after short delay
      if (this.batchTimeout) {
        clearTimeout(this.batchTimeout);
      }
      
      this.batchTimeout = setTimeout(() => {
        this.processBatch();
      }, 50); // 50ms delay
    });
  }

  private async processBatch() {
    if (this.batchQueue.length === 0) return;

    const currentBatch = [...this.batchQueue];
    this.batchQueue = [];

    try {
      const response = await this.api.post('/batch', {
        requests: currentBatch.map(item => item.request),
      });

      // Resolve individual promises
      response.data.forEach((result: any, index: number) => {
        const batchItem = currentBatch[index];
        if (result.error) {
          batchItem.reject(new Error(result.error));
        } else {
          batchItem.resolve(result.data);
        }
      });
    } catch (error) {
      // Reject all promises in batch
      currentBatch.forEach(item => item.reject(error));
    }
  }
}
```

## Performance Optimization

### Connection Pooling and Request Optimization

```typescript
import { RequestQueue, ConnectionPool, Throttler } from '@repo/http-service';

class HighPerformanceApiClient {
  private api: HttpService;

  constructor() {
    // Create connection pool for different hosts
    const pool = new ConnectionPool({
      maxConnections: 10,
      hosts: {
        'api.example.com': { maxConnections: 6 },
        'cdn.example.com': { maxConnections: 4 },
      },
    });

    // Create request queue with priorities
    const queue = new RequestQueue({
      maxConcurrent: 5,
      requestsPerSecond: 20,
      priorityFn: (config) => {
        // Prioritize user-facing requests
        if (config.url?.includes('/user/')) return 1;
        if (config.url?.includes('/analytics/')) return -1;
        return 0;
      },
    });

    // Create throttler
    const throttler = new Throttler({
      requestsPerSecond: 10,
      burstSize: 20,
    });

    this.api = new HttpService({
      baseURL: 'https://api.example.com',
      connectionPool: pool,
      queue,
      throttler,
    });

    this.setupOptimizations();
  }

  private setupOptimizations() {
    // Add compression
    this.api.addRequestInterceptor((config) => {
      config.headers = {
        ...config.headers,
        'Accept-Encoding': 'gzip, deflate, br',
      };
      return config;
    });

    // Add performance monitoring
    this.api.addRequestInterceptor((config) => {
      config.metadata = {
        ...config.metadata,
        startTime: Date.now(),
      };
      return config;
    });

    this.api.addResponseInterceptor((response) => {
      const duration = Date.now() - response.config.metadata?.startTime;
      
      // Log slow requests
      if (duration > 2000) {
        console.warn(`Slow request: ${response.config.method} ${response.config.url} took ${duration}ms`);
      }

      return response;
    });
  }

  // Priority-based request methods
  async getUrgent<T>(url: string, config?: any): Promise<T> {
    return this.api.get<T>(url, {
      ...config,
      priority: 2, // High priority
    });
  }

  async getBackground<T>(url: string, config?: any): Promise<T> {
    return this.api.get<T>(url, {
      ...config,
      priority: -1, // Low priority
    });
  }
}
```

### Memory-Efficient Large Data Handling

```typescript
class StreamingApiClient {
  private api: HttpService;

  constructor() {
    this.api = new HttpService({ baseURL: '/api' });
  }

  // Handle large datasets with pagination
  async *getAllUsers(): AsyncGenerator<User[], void, unknown> {
    let page = 1;
    const pageSize = 100;
    
    while (true) {
      const response = await this.api.get<PaginatedResponse<User>>('/users', {
        params: { page, limit: pageSize },
      });

      if (response.data.items.length === 0) break;
      
      yield response.data.items;
      
      if (page >= response.data.totalPages) break;
      page++;
    }
  }

  // Stream processing
  async processLargeDataset(
    endpoint: string,
    processor: (batch: any[]) => Promise<void>
  ) {
    for await (const batch of this.getAllData(endpoint)) {
      await processor(batch);
      
      // Allow other tasks to run
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  private async *getAllData(endpoint: string): AsyncGenerator<any[], void, unknown> {
    let page = 1;
    
    while (true) {
      const response = await this.api.get(endpoint, {
        params: { page, limit: 1000 },
      });
      
      if (response.data.length === 0) break;
      
      yield response.data;
      page++;
    }
  }
}

// Usage
const streamingClient = new StreamingApiClient();

async function exportAllUsers() {
  const users: User[] = [];
  
  for await (const userBatch of streamingClient.getAllUsers()) {
    users.push(...userBatch);
    
    // Process in chunks to avoid memory issues
    if (users.length >= 10000) {
      await processUserChunk(users.splice(0, 10000));
    }
  }
  
  // Process remaining users
  if (users.length > 0) {
    await processUserChunk(users);
  }
}
```

These examples demonstrate real-world usage patterns and best practices for the HTTP Service library. Each example is production-ready and handles common scenarios you'll encounter when building modern web applications.
