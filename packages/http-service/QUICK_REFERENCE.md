# 📖 HTTP Service - Quick Reference

A condensed reference for developers who want to quickly understand the HTTP Service API.

## 🚀 Installation & Basic Setup

```bash
npm install @repo/http-service
```

```typescript
import { httpService, HttpService } from '@repo/http-service';

// Use default instance
const users = await httpService.get('/api/users');

// Create custom instance
const api = new HttpService({
  baseURL: 'https://api.example.com',
  timeout: 10000,
  headers: { 'Authorization': 'Bearer token' },
  retries: 3,
  enableCache: true
});
```

## 🔗 HTTP Methods

```typescript
// GET
const response = await api.get<User[]>('/users', { params: { page: 1 } });

// POST
const user = await api.post<User>('/users', { name: 'John', email: 'john@example.com' });

// PUT
const updated = await api.put<User>('/users/123', { name: 'Jane' });

// PATCH
const patched = await api.patch<User>('/users/123', { status: 'active' });

// DELETE
await api.delete('/users/123');

// HEAD & OPTIONS
const head = await api.head('/users');
const options = await api.options('/users');
```

## ⚙️ Configuration Options

```typescript
interface HttpServiceConfig {
  baseURL?: string;                    // Base URL for all requests
  timeout?: number;                    // Request timeout in ms (default: 30000)
  headers?: Record<string, string>;    // Default headers
  retries?: number;                    // Number of retry attempts (default: 3)
  retryDelay?: number;                 // Delay between retries in ms (default: 1000)
  enableCache?: boolean;               // Enable response caching (default: true)
  cacheTimeout?: number;               // Cache TTL in ms (default: 300000)
  enableDeduplication?: boolean;       // Deduplicate identical requests (default: true)
  csrf?: {                            // CSRF protection
    enabled: boolean;
    tokenUrl?: string;
    headerName?: string;
  };
}
```

## 📦 Request Configuration

```typescript
interface RequestConfig {
  method?: string;
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean>;
  data?: any;                         // Request body
  timeout?: number;
  retries?: number;
  skipCache?: boolean;
  skipAuth?: boolean;
  skipCsrf?: boolean;
  signal?: AbortSignal;              // For request cancellation
}

// Example usage
const response = await api.get('/users', {
  params: { page: 1, limit: 10 },
  headers: { 'X-Custom': 'value' },
  timeout: 5000,
  skipCache: true
});
```

## 🔌 Interceptors

```typescript
// Request interceptor
const removeInterceptor = api.addRequestInterceptor(async (config) => {
  // Modify request before sending
  config.headers = { ...config.headers, 'X-Timestamp': Date.now().toString() };
  return config;
});

// Response interceptor
api.addResponseInterceptor(async (response) => {
  // Process response data
  console.log('Response received:', response.status);
  return response;
});

// Error interceptor
api.addErrorInterceptor(async (error) => {
  // Handle errors globally
  if (error.status === 401) {
    // Redirect to login
    window.location.href = '/login';
  }
  return error;
});

// Remove interceptor
removeInterceptor();
```

## 🔐 Authentication

```typescript
// Setup authentication
api.setAuth({
  getToken: async () => {
    return localStorage.getItem('auth_token');
  },
  refreshToken: async () => {
    const response = await fetch('/api/auth/refresh');
    const { token } = await response.json();
    localStorage.setItem('auth_token', token);
    return token;
  },
  onTokenRefresh: (newToken) => {
    console.log('Token refreshed');
  },
  onAuthError: (error) => {
    console.error('Auth error:', error);
    // Redirect to login
  }
});

// Skip auth for specific requests
await api.get('/public/data', { skipAuth: true });
```

## 💾 Caching

```typescript
// Cache is enabled by default for GET requests
const users = await api.get('/users'); // Cached for 5 minutes

// Custom cache timeout
const posts = await api.get('/posts', { 
  cacheTimeout: 600000 // 10 minutes
});

// Skip cache
const liveData = await api.get('/live-data', { skipCache: true });

// Clear cache
api.clearCache();

// Get cache size
const size = api.getCacheSize();
```

## 🚫 Request Cancellation

```typescript
// Using AbortController
const controller = new AbortController();

try {
  const response = await api.get('/slow-endpoint', {
    signal: controller.signal
  });
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('Request was cancelled');
  }
}

// Cancel the request
controller.abort();
```

## 🛡️ CSRF Protection

```typescript
const api = new HttpService({
  csrf: {
    enabled: true,
    tokenUrl: '/api/csrf-token',  // Where to get CSRF token
    headerName: 'X-CSRF-Token'    // Header name for token
  }
});

// CSRF token automatically included in POST/PUT/PATCH/DELETE requests
await api.post('/users', userData); // CSRF token added automatically

// Skip CSRF for specific requests
await api.post('/public/subscribe', data, { skipCsrf: true });
```

## 🧪 Testing

```typescript
import { createMockHttpService, testUtils } from '@repo/http-service/testing';

// Create mock service
const mockApi = createMockHttpService();

// Setup mocks
mockApi.mockGet('/users', { data: [{ id: 1, name: 'John' }] });
mockApi.mockPost('/users', { data: { id: 2, name: 'Jane' }, status: 201 });

// Mock with functions
mockApi.mock({
  url: '/dynamic',
  method: 'GET',
  response: (config) => ({
    data: { timestamp: Date.now(), url: config.url }
  })
});

// Verify calls
const calls = mockApi.getCallHistory();
expect(calls).toHaveLength(1);
expect(calls[0].method).toBe('GET');

// Test utilities
const mockResponse = testUtils.mockResponse({ id: 1 });
const errorResponse = testUtils.mockError('Not found', 404);
const delayedResponse = testUtils.mockDelayed({ data: 'slow' }, 1000);
```

## 🔧 Utility Functions

```typescript
import { 
  buildURL, 
  mergeHeaders, 
  calculateBackoff, 
  parseResponse,
  serializeBody 
} from '@repo/http-service/utils';

// Build URL with parameters
const url = buildURL('https://api.example.com/users', { 
  page: 1, 
  limit: 10 
});
// Result: "https://api.example.com/users?page=1&limit=10"

// Merge headers
const headers = mergeHeaders(
  { 'Content-Type': 'application/json' },
  { 'Authorization': 'Bearer token' }
);

// Calculate exponential backoff
const delay = calculateBackoff(2, 1000); // 4000ms for attempt 2
```

## 🚨 Error Handling

```typescript
import { HttpServiceError, NetworkError, AbortError } from '@repo/http-service';

try {
  const response = await api.get('/users');
} catch (error) {
  if (error instanceof HttpServiceError) {
    console.log('HTTP Error:', error.status, error.message);
    console.log('Response:', error.response);
  } else if (error instanceof NetworkError) {
    console.log('Network Error:', error.message);
  } else if (error instanceof AbortError) {
    console.log('Request cancelled:', error.message);
  }
  
  // Error properties
  console.log('Is network error?', error.isNetworkError);
  console.log('Is timeout error?', error.isTimeoutError);
  console.log('Status code:', error.status);
  console.log('Request config:', error.config);
}
```

## 📊 Performance Monitoring

```typescript
// Built-in performance logging (development only)
// Check browser console for request timing logs

// Manual performance tracking
const start = performance.now();
const response = await api.get('/users');
const duration = performance.now() - start;
console.log(`Request took ${duration}ms`);

// Cache performance
const cacheSize = api.getCacheSize();
console.log(`Cache contains ${cacheSize} entries`);
```

## 🔗 Next.js Integration

```typescript
// API route handler
// pages/api/users.ts
import { httpService } from '@repo/http-service';

export default async function handler(req, res) {
  try {
    const users = await httpService.get(`${process.env.EXTERNAL_API}/users`);
    res.status(200).json(users.data);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
}

// Server-side rendering
// pages/users.tsx
export async function getServerSideProps() {
  try {
    const users = await httpService.get('/api/users');
    return { props: { users: users.data } };
  } catch (error) {
    return { props: { users: [], error: error.message } };
  }
}

// Client-side with SWR
import useSWR from 'swr';

const fetcher = (url: string) => httpService.get(url).then(res => res.data);

function UsersList() {
  const { data, error, isLoading } = useSWR('/api/users', fetcher);
  
  if (error) return <div>Failed to load</div>;
  if (isLoading) return <div>Loading...</div>;
  
  return <div>{/* Render users */}</div>;
}
```

## 🎯 Best Practices

1. **Use TypeScript**: Leverage type safety with generics
   ```typescript
   const users = await api.get<User[]>('/users');
   ```

2. **Create service classes**: Organize API calls
   ```typescript
   class UserService {
     private static api = new HttpService({ baseURL: '/api' });
     
     static async getAll() {
       return this.api.get<User[]>('/users');
     }
   }
   ```

3. **Handle errors gracefully**: Always wrap API calls in try-catch
4. **Use environment variables**: Configure baseURL and other settings
5. **Leverage caching**: Enable caching for read-heavy operations
6. **Mock for testing**: Use testing utilities for reliable tests
7. **Monitor performance**: Use browser dev tools to check request timing
