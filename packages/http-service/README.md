# HTTP Service API Documentation

🚀 A powerful, type-safe HTTP client library designed specifically for Next.js applications. Features built-in caching, authentication, retries, CSRF protection, and comprehensive error handling.

## ✨ Features

- 🔥 **Type-Safe**: Full TypeScript support with intelligent type inference
- 🚀 **Performance**: Built-in caching and request deduplication
- 🔐 **Security**: CSRF protection and secure authentication handling
- 🔄 **Resilient**: Automatic retries with exponential backoff
- 📊 **Interceptors**: Request/response/error interceptors for custom logic
- 🧪 **Testing**: Comprehensive testing utilities and mocks
- 📱 **Next.js Ready**: Optimized for server-side rendering and API routes
- 🎯 **Developer Experience**: Intuitive API with excellent error messages

## 📚 Documentation

**👋 New to HTTP Service?** Choose your learning path:

| Experience Level | Recommended Guide | What You'll Learn |
|------------------|-------------------|-------------------|
| 🟢 **Beginner** | [📚 Beginner's Guide](BEGINNER_GUIDE.md) | Complete tutorial from basics to real-world examples |
| 🟡 **Intermediate** | [💡 Examples](EXAMPLES.md) | Practical patterns and use cases |
| 🔵 **Advanced** | [📖 Quick Reference](QUICK_REFERENCE.md) | Condensed API reference |
| 🔄 **Migrating** | [🔄 Migration Guide](MIGRATION.md) | Switch from fetch(), axios, etc. |
| 🧪 **Testing** | [🧪 Testing Guide](TESTING.md) | Testing patterns and mocks |

**📋 Complete Documentation:**
- **📚 [Documentation Overview](OVERVIEW.md)** - Find the right docs for your needs
- **📋 [API Reference](#api-reference)** - Complete API documentation (below)

## 📦 Installation

```bash
npm install @repo/http-service
# or
yarn add @repo/http-service
# or
pnpm add @repo/http-service
```

## 🚀 Quick Start

### ⚡ 30-Second Start (Copy & Paste)

```typescript
import { httpService } from '@repo/http-service';

// Simple GET request
const response = await httpService.get('/api/users');
console.log(response.data);

// POST request with data
const newUser = await httpService.post('/api/users', {
  name: 'John Doe',
  email: 'john@example.com'
});
```

### 🎯 Need More Help?

- **Never made an API call before?** → [📚 Beginner's Guide](BEGINNER_GUIDE.md)
- **Want to see real examples?** → [💡 Examples](EXAMPLES.md)
- **Coming from axios/fetch?** → [🔄 Migration Guide](MIGRATION.md)
- **Ready to dive deep?** → Continue reading below ⬇️

## 📖 Table of Contents

- [Configuration](#configuration)
- [Basic Usage](#basic-usage)
- [Advanced Features](#advanced-features)
- [API Reference](#api-reference)
- [Migration Guide](#migration-guide)

## Configuration

### Basic Configuration

```typescript
import { HttpService } from '@repo/http-service';

const api = new HttpService({
  baseURL: 'https://api.example.com',
  timeout: 10000,
  defaultHeaders: {
    'Authorization': 'Bearer your-token',
    'Content-Type': 'application/json'
  }
});
```

### Environment-based Configuration

```typescript
const api = new HttpService({
  baseURL: process.env.NODE_ENV === 'production' 
    ? 'https://api.example.com'
    : 'http://localhost:3000/api',
  
  // Different configurations per environment
  retry: {
    attempts: process.env.NODE_ENV === 'production' ? 3 : 1,
    delay: 1000
  }
});
```

## Basic Usage

### HTTP Methods

```typescript
// GET request
const users = await httpService.get('/users');

// POST request
const newUser = await httpService.post('/users', {
  name: 'Jane Doe',
  email: 'jane@example.com'
});

// PUT request
const updatedUser = await httpService.put('/users/1', {
  name: 'Jane Smith'
});

// DELETE request
await httpService.delete('/users/1');

// PATCH request
const partialUpdate = await httpService.patch('/users/1', {
  email: 'jane.smith@example.com'
});
```

### Query Parameters

```typescript
// Using params option
const users = await httpService.get('/users', {
  params: {
    page: 1,
    limit: 10,
    search: 'john'
  }
});
// Makes request to: /users?page=1&limit=10&search=john

// Manual URL construction
const response = await httpService.get('/users?active=true&role=admin');
```

### Request Headers

```typescript
// Per-request headers
const response = await httpService.get('/users', {
  headers: {
    'Authorization': 'Bearer token123',
    'X-Custom-Header': 'value'
  }
});

// Headers in POST requests
await httpService.post('/users', userData, {
  headers: {
    'Content-Type': 'application/json',
    'X-API-Version': '2.0'
  }
});
```

## Advanced Features

### Caching

```typescript
// Enable caching for GET requests
const api = new HttpService({
  cache: {
    enabled: true,
    defaultTTL: 300000, // 5 minutes
    maxSize: 100
  }
});

// Cache specific request
const response = await api.get('/users', {
  cache: {
    ttl: 600000, // 10 minutes
    key: 'users-list' // Custom cache key
  }
});
```

### Request/Response Interceptors

```typescript
// Request interceptor
api.addRequestInterceptor((config) => {
  // Add timestamp to all requests
  config.headers = {
    ...config.headers,
    'X-Timestamp': Date.now().toString()
  };
  return config;
});

// Response interceptor
api.addResponseInterceptor((response) => {
  // Log all responses
  console.log(`Response: ${response.status} ${response.statusText}`);
  return response;
});

// Error interceptor
api.addErrorInterceptor((error) => {
  // Handle authentication errors
  if (error.status === 401) {
    // Redirect to login
    window.location.href = '/login';
  }
  throw error;
});
```

### Authentication

```typescript
const api = new HttpService({
  auth: {
    type: 'bearer',
    token: () => localStorage.getItem('access_token'),
    refreshToken: async () => {
      // Refresh token logic
      const response = await fetch('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ 
          refreshToken: localStorage.getItem('refresh_token') 
        })
      });
      const data = await response.json();
      localStorage.setItem('access_token', data.accessToken);
      return data.accessToken;
    }
  }
});
```

### Retry Logic

```typescript
const api = new HttpService({
  retry: {
    attempts: 3,
    delay: 1000,
    backoff: 'exponential',
    retryCondition: (error) => {
      // Retry on network errors and 5xx status codes
      return error.isNetworkError || (error.status >= 500 && error.status < 600);
    }
  }
});
```

### Request Queuing and Throttling

```typescript
import { RequestQueue, Throttler } from '@repo/http-service';

// Create a request queue
const queue = new RequestQueue({
  maxConcurrent: 5,
  requestsPerSecond: 10,
  priorityFn: (config) => config.urgent ? 1 : 0
});

// Create a throttler
const throttler = new Throttler({
  requestsPerSecond: 5,
  burstSize: 10
});

const api = new HttpService({
  queue,
  throttler
});
```

### Plugin System

```typescript
import { PluginManager, loggingPlugin, performancePlugin } from '@repo/http-service';

const pluginManager = new PluginManager();
pluginManager.use(loggingPlugin);
pluginManager.use(performancePlugin);

const api = new HttpService({
  plugins: pluginManager
});
```

### Next.js Integration

#### API Route Helpers

```typescript
// pages/api/users.ts or app/api/users/route.ts
import { createApiResponse, handleApiError, withApiHandler } from '@repo/http-service';

export const GET = withApiHandler(async (request) => {
  try {
    const users = await getUsersFromDatabase();
    return createApiResponse(users, {
      message: 'Users retrieved successfully'
    });
  } catch (error) {
    return handleApiError(error);
  }
});
```

#### Middleware Integration

```typescript
// middleware.ts
import { createHttpServiceMiddleware } from '@repo/http-service';

export const middleware = createHttpServiceMiddleware({
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
  },
  cors: {
    origin: ['https://yourapp.com'],
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  },
  logging: {
    enabled: true,
    level: 'info'
  }
});

export const config = {
  matcher: '/api/:path*'
};
```

## API Reference

### HttpService Class

#### Constructor

```typescript
new HttpService(config?: HttpServiceConfig)
```

#### Methods

##### HTTP Methods
- `get<T>(url: string, config?: RequestConfig): Promise<HttpResponse<T>>`
- `post<T>(url: string, data?: any, config?: RequestConfig): Promise<HttpResponse<T>>`
- `put<T>(url: string, data?: any, config?: RequestConfig): Promise<HttpResponse<T>>`
- `delete<T>(url: string, config?: RequestConfig): Promise<HttpResponse<T>>`
- `patch<T>(url: string, data?: any, config?: RequestConfig): Promise<HttpResponse<T>>`
- `head(url: string, config?: RequestConfig): Promise<HttpResponse<void>>`
- `options(url: string, config?: RequestConfig): Promise<HttpResponse<void>>`

##### Configuration
- `setBaseURL(baseURL: string): void`
- `setDefaultHeaders(headers: Record<string, string>): void`
- `setTimeout(timeout: number): void`

##### Interceptors
- `addRequestInterceptor(interceptor: RequestInterceptor): void`
- `addResponseInterceptor(interceptor: ResponseInterceptor): void`
- `addErrorInterceptor(interceptor: ErrorInterceptor): void`

### Types

#### HttpServiceConfig

```typescript
interface HttpServiceConfig {
  baseURL?: string;
  timeout?: number;
  defaultHeaders?: Record<string, string>;
  auth?: AuthConfig;
  retry?: RetryConfig;
  cache?: CacheConfig;
  security?: SecurityConfig;
  plugins?: PluginManager;
  queue?: RequestQueue;
  throttler?: Throttler;
}
```

#### RequestConfig

```typescript
interface RequestConfig {
  method?: string;
  url?: string;
  params?: Record<string, any>;
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  signal?: AbortSignal;
  cache?: {
    ttl?: number;
    key?: string;
  };
}
```

#### HttpResponse

```typescript
interface HttpResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  config: RequestConfig;
}
```

## Examples

### Real-world Example: User Management API

```typescript
import { HttpService } from '@repo/http-service';

class UserService {
  private api: HttpService;

  constructor() {
    this.api = new HttpService({
      baseURL: '/api',
      defaultHeaders: {
        'Content-Type': 'application/json'
      },
      retry: {
        attempts: 3,
        delay: 1000
      },
      cache: {
        enabled: true,
        defaultTTL: 300000 // 5 minutes
      }
    });

    // Add auth interceptor
    this.api.addRequestInterceptor((config) => {
      const token = localStorage.getItem('authToken');
      if (token) {
        config.headers = {
          ...config.headers,
          'Authorization': `Bearer ${token}`
        };
      }
      return config;
    });
  }

  async getUsers(page = 1, limit = 10) {
    return this.api.get('/users', {
      params: { page, limit },
      cache: { key: `users-${page}-${limit}` }
    });
  }

  async createUser(userData: CreateUserData) {
    return this.api.post('/users', userData);
  }

  async updateUser(id: number, userData: UpdateUserData) {
    return this.api.put(`/users/${id}`, userData);
  }

  async deleteUser(id: number) {
    return this.api.delete(`/users/${id}`);
  }

  async uploadAvatar(userId: number, file: File) {
    const formData = new FormData();
    formData.append('avatar', file);

    return this.api.post(`/users/${userId}/avatar`, formData, {
      headers: {
        // Don't set Content-Type for FormData
        'Content-Type': undefined
      }
    });
  }
}

// Usage
const userService = new UserService();

// Get users with caching
const users = await userService.getUsers(1, 20);

// Create new user
const newUser = await userService.createUser({
  name: 'John Doe',
  email: 'john@example.com'
});
```

### File Upload Example

```typescript
async function uploadFiles(files: FileList) {
  const formData = new FormData();
  
  for (let i = 0; i < files.length; i++) {
    formData.append('files', files[i]);
  }

  const response = await httpService.post('/upload', formData, {
    headers: {
      // Browser will set correct Content-Type with boundary
      'Content-Type': undefined
    },
    timeout: 60000 // 1 minute for large files
  });

  return response.data;
}
```

### Streaming Example

```typescript
async function downloadLargeFile(url: string) {
  const response = await fetch(url); // Use native fetch for streaming
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const reader = response.body?.getReader();
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader!.read();
    
    if (done) break;
    
    chunks.push(value);
    
    // Update progress
    const totalSize = response.headers.get('content-length');
    if (totalSize) {
      const downloaded = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const progress = (downloaded / parseInt(totalSize)) * 100;
      console.log(`Download progress: ${progress.toFixed(2)}%`);
    }
  }

  return new Blob(chunks);
}
```

## Migration Guide

### From Fetch

```typescript
// Before (native fetch)
const response = await fetch('/api/users', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify(userData)
});

if (!response.ok) {
  throw new Error(`HTTP error! status: ${response.status}`);
}

const data = await response.json();

// After (HttpService)
const response = await httpService.post('/api/users', userData, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
// Error handling and JSON parsing are automatic
const data = response.data;
```

### From Axios

```typescript
// Before (Axios)
import axios from 'axios';

const api = axios.create({
  baseURL: 'https://api.example.com',
  timeout: 10000
});

api.interceptors.request.use(config => {
  config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const response = await api.get('/users');

// After (HttpService)
import { HttpService } from '@repo/http-service';

const api = new HttpService({
  baseURL: 'https://api.example.com',
  timeout: 10000
});

api.addRequestInterceptor(config => {
  config.headers = { ...config.headers, Authorization: `Bearer ${token}` };
  return config;
});

const response = await api.get('/users');
```

## Best Practices

1. **Use a single instance per API**: Create one HttpService instance per API you're consuming
2. **Implement proper error handling**: Use error interceptors for global error handling
3. **Cache strategically**: Cache read-only data that doesn't change frequently
4. **Use request cancellation**: Cancel requests when components unmount
5. **Configure timeouts**: Set appropriate timeouts for different types of requests
6. **Handle retries carefully**: Only retry safe operations (GET, PUT, DELETE)
7. **Monitor performance**: Use the performance plugin to track request metrics

## Troubleshooting

### Common Issues

1. **CORS errors**: Configure CORS properly on your server
2. **Request timeouts**: Increase timeout for slow endpoints
3. **Memory leaks**: Always clean up interceptors and cancel requests
4. **Authentication loops**: Implement proper token refresh logic

### Debug Mode

```typescript
const api = new HttpService({
  // Enable debug logging
  plugins: new PluginManager().use(loggingPlugin)
});
```

## Contributing

See the [Contributing Guide](CONTRIBUTING.md) for information on how to contribute to this project.

## License

MIT License - see [LICENSE](LICENSE) file for details.
