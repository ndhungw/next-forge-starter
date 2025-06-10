# 🔄 Migration Guide

This guide helps you migrate to HTTP Service from other HTTP clients or upgrade from previous versions.

## 🚀 From fetch()

### Before (Raw fetch)

```typescript
// ❌ Lots of boilerplate
async function getUsers() {
  const response = await fetch('https://api.example.com/users', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer token123'
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data;
}

async function createUser(userData) {
  const response = await fetch('https://api.example.com/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer token123'
    },
    body: JSON.stringify(userData)
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
}
```

### After (HTTP Service)

```typescript
// ✅ Clean and simple
import { HttpService } from '@repo/http-service';

const api = new HttpService({
  baseURL: 'https://api.example.com',
  headers: {
    'Authorization': 'Bearer token123'
  }
});

async function getUsers() {
  const response = await api.get('/users');
  return response.data; // Error handling is automatic
}

async function createUser(userData) {
  const response = await api.post('/users', userData);
  return response.data; // JSON parsing is automatic
}
```

## 🔄 From axios

### Before (axios)

```typescript
import axios from 'axios';

const axiosInstance = axios.create({
  baseURL: 'https://api.example.com',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor
axiosInstance.interceptors.request.use(
  (config) => {
    config.headers.Authorization = `Bearer ${getToken()}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle auth error
    }
    return Promise.reject(error);
  }
);

// Usage
const users = await axiosInstance.get('/users');
const newUser = await axiosInstance.post('/users', userData);
```

### After (HTTP Service)

```typescript
import { HttpService } from '@repo/http-service';

const api = new HttpService({
  baseURL: 'https://api.example.com',
  timeout: 10000
});

// Authentication setup
api.setAuth({
  getToken: () => getToken(),
  onAuthError: (error) => {
    // Handle auth error
  }
});

// Request interceptor
api.addRequestInterceptor((config) => {
  // Modify config
  return config;
});

// Error interceptor
api.addErrorInterceptor((error) => {
  if (error.status === 401) {
    // Handle auth error
  }
  return error;
});

// Usage (identical to axios)
const users = await api.get('/users');
const newUser = await api.post('/users', userData);
```

### Key Differences from axios

| Feature | axios | HTTP Service |
|---------|-------|--------------|
| **TypeScript** | Basic support | Full type safety with generics |
| **Caching** | Manual implementation | Built-in with TTL |
| **Retries** | Manual implementation | Built-in with exponential backoff |
| **Authentication** | Manual interceptors | Built-in auth handling with refresh |
| **CSRF Protection** | Manual implementation | Built-in |
| **Request Deduplication** | Not available | Built-in |
| **Testing** | Custom mocks needed | Built-in testing utilities |
| **Next.js Integration** | Basic | Optimized for SSR and API routes |

## 🔄 From SWR/React Query

### Before (SWR)

```typescript
import useSWR from 'swr';

const fetcher = (url) => fetch(url).then(res => res.json());

function UsersList() {
  const { data, error, isLoading } = useSWR('/api/users', fetcher);
  
  if (error) return <div>Failed to load</div>;
  if (isLoading) return <div>Loading...</div>;
  
  return <div>{/* render data */}</div>;
}
```

### After (HTTP Service + SWR)

```typescript
import useSWR from 'swr';
import { httpService } from '@repo/http-service';

// Better fetcher with proper error handling and typing
const fetcher = (url: string) => httpService.get<User[]>(url).then(res => res.data);

function UsersList() {
  const { data, error, isLoading } = useSWR('/api/users', fetcher);
  
  if (error) return <div>Failed to load</div>;
  if (isLoading) return <div>Loading...</div>;
  
  return <div>{/* render data with full TypeScript support */}</div>;
}
```

**Benefits of using HTTP Service with SWR:**
- ✅ Built-in caching works alongside SWR
- ✅ Automatic retries reduce SWR error states
- ✅ Better error handling and typing
- ✅ CSRF protection for mutations

## 📦 Package.json Updates

### Remove old dependencies

```json
{
  "dependencies": {
    // Remove these if migrating
    "axios": "^1.x.x",           // ❌ Remove
    "node-fetch": "^3.x.x",     // ❌ Remove
    "cross-fetch": "^3.x.x",    // ❌ Remove
    "isomorphic-fetch": "^3.x.x" // ❌ Remove
  }
}
```

### Add HTTP Service

```json
{
  "dependencies": {
    "@repo/http-service": "^1.0.0"  // ✅ Add
  }
}
```

## 🔧 Configuration Migration

### Environment Variables

Update your environment variables:

```bash
# Before
AXIOS_BASE_URL=https://api.example.com
API_TIMEOUT=10000

# After
NEXT_PUBLIC_API_URL=https://api.example.com
# Timeout is configured in code
```

### Next.js Configuration

If you were configuring global fetch:

```typescript
// Before - next.config.js
module.exports = {
  env: {
    API_URL: process.env.API_URL,
  }
};

// After - Use HTTP Service configuration
// No global configuration needed
```

## 🧪 Testing Migration

### Before (Manual mocks)

```typescript
// Mock fetch
global.fetch = jest.fn();

test('should fetch users', async () => {
  fetch.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve([{ id: 1, name: 'John' }])
  });

  const users = await getUsers();
  expect(users).toEqual([{ id: 1, name: 'John' }]);
});
```

### After (HTTP Service testing utilities)

```typescript
import { createMockHttpService } from '@repo/http-service/testing';

test('should fetch users', async () => {
  const mockApi = createMockHttpService();
  mockApi.mockGet('/users', { 
    data: [{ id: 1, name: 'John' }] 
  });

  const users = await getUsers(); // Uses mock automatically
  expect(users).toEqual([{ id: 1, name: 'John' }]);
});
```

## 🚨 Common Migration Issues

### 1. Response Data Access

```typescript
// ❌ Wrong - axios style
const users = response; // axios returns data directly in .data

// ✅ Correct - HTTP Service
const users = response.data; // HTTP Service wraps response
```

### 2. Error Handling

```typescript
// ❌ Wrong - axios style
try {
  const response = await api.get('/users');
} catch (error) {
  console.log(error.response.status); // axios error structure
}

// ✅ Correct - HTTP Service
try {
  const response = await api.get('/users');
} catch (error) {
  console.log(error.status); // Direct status access
  console.log(error.response); // Full response available
}
```

### 3. Request Configuration

```typescript
// ❌ Wrong - axios style
await api.get('/users', {
  headers: { 'Custom': 'value' }
});

// ✅ Correct - HTTP Service (same as axios)
await api.get('/users', {
  headers: { 'Custom': 'value' }
});
```

### 4. Base URL Changes

```typescript
// ❌ Wrong - changing baseURL at runtime
api.defaults.baseURL = 'https://new-api.com';

// ✅ Correct - create new instance
const newApi = api.create({
  baseURL: 'https://new-api.com'
});
```

## ⚡ Performance Improvements

After migrating, you'll get these performance benefits automatically:

1. **Caching**: GET requests are cached by default
2. **Deduplication**: Identical requests are deduplicated
3. **Retries**: Failed requests retry automatically
4. **Connection Pooling**: Efficient connection management
5. **Compression**: Automatic request/response compression

## 🎯 Migration Checklist

- [ ] Install `@repo/http-service`
- [ ] Remove old HTTP client dependencies
- [ ] Update import statements
- [ ] Migrate instance configuration
- [ ] Update request/response handling
- [ ] Migrate interceptors to HTTP Service equivalents
- [ ] Update error handling
- [ ] Migrate tests to use HTTP Service testing utilities
- [ ] Update environment variables
- [ ] Test authentication flows
- [ ] Verify caching behavior
- [ ] Update documentation

## 🆘 Need Help?

If you encounter issues during migration:

1. Check the [Beginner's Guide](BEGINNER_GUIDE.md) for basic usage
2. Review [Examples](EXAMPLES.md) for common patterns
3. Look at the [API Reference](README.md#api-reference) for specific methods
4. Check the error messages - HTTP Service provides helpful error information

## 📈 Gradual Migration

You can migrate gradually by using HTTP Service alongside your existing client:

```typescript
// Keep using axios for some endpoints
import axios from 'axios';
// Start using HTTP Service for new endpoints
import { httpService } from '@repo/http-service';

// Gradually migrate endpoints one by one
const users = await httpService.get('/api/users'); // New
const posts = await axios.get('/api/posts');       // Legacy
```

This allows you to migrate at your own pace while ensuring everything works correctly.
