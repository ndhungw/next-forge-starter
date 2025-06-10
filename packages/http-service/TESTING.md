# HTTP Service Testing Documentation

## Overview

This document explains the testing structure, patterns, and conventions used in the HTTP service package. The test suite is designed to provide comprehensive coverage of all functionality, from individual utility functions to complete request/response cycles.

## Test Folder Structure

```
packages/http-service/tests/
├── utils.test.ts          # Tests for utility functions
├── cache.test.ts          # Tests for caching functionality  
├── http-service.test.ts   # Tests for main HttpService class
├── testing.test.ts        # Tests for testing utilities (mock/stub)
└── integration.test.ts    # Integration tests with real endpoints
```

## Test File Breakdown

### 1. **`utils.test.ts`** - Utility Function Tests

Tests all the helper functions used throughout the HTTP service:

#### **Functions Tested:**
- **`buildURL`** - URL construction with parameters and base URL handling
- **`mergeHeaders`** - Header merging logic with precedence rules
- **`calculateBackoff`** - Exponential backoff calculations for retries
- **`parseResponse`** - Response parsing (JSON, text, blob, ArrayBuffer)
- **`serializeBody`** - Request body serialization for different data types
- **`getContentType`** - Content type detection based on data type
- **`sleep`** - Async delay utility for testing and retries

#### **Test Categories:**
- Happy path scenarios
- Edge cases (null, undefined, empty values)
- Error conditions
- Type validation
- Performance considerations

### 2. **`cache.test.ts`** - Caching System Tests

Tests the HTTP cache functionality:

#### **Features Tested:**
- **Cache Key Generation** - Unique key creation based on URL, method, and body
- **TTL (Time To Live)** - Cache expiration and cleanup
- **Cache Size Limits** - Maximum entries and eviction policies
- **Cache Hit/Miss** - Retrieval scenarios and cache effectiveness
- **Cache Invalidation** - Manual and automatic cache clearing
- **Memory Management** - Preventing memory leaks

#### **Scenarios:**
```typescript
describe('HttpCache', () => {
  it('should cache responses with TTL', () => {
    // Test caching with expiration
  });
  
  it('should evict oldest entries when size limit reached', () => {
    // Test LRU eviction policy
  });
});
```

### 3. **`http-service.test.ts`** - Main Service Tests

Tests the core HttpService class functionality:

#### **Core Features:**
- **HTTP Methods** - GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS
- **Request/Response Interceptors** - Middleware functionality
- **Error Handling** - Custom error types and error interceptors
- **Authentication** - Token management and refresh logic
- **Request Deduplication** - Preventing duplicate concurrent requests
- **Configuration Merging** - Service instance configuration
- **Security Features** - CSRF protection, request signing

#### **Test Structure:**
```typescript
describe('HttpService', () => {
  describe('HTTP Methods', () => {
    it('should make GET requests', async () => {
      // Test GET functionality
    });
  });
  
  describe('Interceptors', () => {
    it('should apply request interceptors', async () => {
      // Test interceptor chain
    });
  });
});
```

### 4. **`testing.test.ts`** - Mock/Stub Tests

Tests the testing utilities themselves (meta-tests):

#### **Mock Features:**
- **HttpServiceMock** - Mock implementation of HttpService
- **Request/Response Stubbing** - Predefined responses for testing
- **History Tracking** - Recording requests made during tests
- **Error Simulation** - Testing error scenarios
- **Async Behavior** - Testing timing and async operations

#### **Usage Examples:**
```typescript
describe('HttpServiceMock', () => {
  it('should track request history', () => {
    const mock = new HttpServiceMock();
    mock.get('/api/users');
    expect(mock.getHistory()).toHaveLength(1);
  });
});
```

### 5. **`integration.test.ts`** - End-to-End Tests

Tests real HTTP interactions with external services:

#### **Integration Scenarios:**
- **Real API Calls** - Testing against actual endpoints
- **Network Conditions** - Timeout, slow responses, network errors
- **Authentication Flows** - Complete auth workflows
- **Retry Logic** - Real retry scenarios with backoff
- **Cache Behavior** - Caching with real responses
- **Error Recovery** - Handling various HTTP error codes

#### **Environment Setup:**
```typescript
describe('Integration Tests', () => {
  beforeAll(() => {
    // Setup test environment
    // Configure test endpoints
  });
  
  it('should handle real API responses', async () => {
    // Test with actual HTTP calls
  });
});
```

## Test Structure Pattern

Each test file follows the **Arrange-Act-Assert (AAA)** pattern:

```typescript
describe('ModuleName', () => {
  describe('functionName', () => {
    it('should do something specific', () => {
      // Arrange - Setup test data and conditions
      const input = setupTestData();
      const expectedOutput = { /* expected result */ };
      
      // Act - Execute the function under test
      const result = functionUnderTest(input);
      
      // Assert - Verify the result
      expect(result).toBe(expectedOutput);
    });
    
    it('should handle edge cases', () => {
      // Test error conditions, null/undefined, boundary values
      expect(() => functionUnderTest(null)).toThrow();
      expect(functionUnderTest(undefined)).toBeUndefined();
    });
  });
});
```

## Test Categories

### **Unit Tests**
- **Purpose**: Test individual functions in isolation
- **Characteristics**:
  - Mock external dependencies
  - Fast execution (< 1ms per test)
  - High code coverage (aim for 90%+)
  - Deterministic results
  - No network calls

### **Integration Tests**
- **Purpose**: Test multiple components working together
- **Characteristics**:
  - Real HTTP calls (with proper test endpoints)
  - Slower execution (100ms+ per test)
  - Test real-world scenarios
  - May require test environment setup
  - Can be flaky due to network dependencies

### **Mock/Stub Tests**
- **Purpose**: Test the testing utilities themselves
- **Characteristics**:
  - Ensure mocks behave correctly
  - Validate test infrastructure
  - Test edge cases in mock behavior
  - Verify mock state management

## Test Configuration

### **Test Runner: Vitest**

Configuration features:
- **TypeScript Support** - Native TS compilation
- **ES Modules** - Modern module system support
- **Mock Capabilities** - Built-in mocking utilities
- **Async/Await Testing** - Promise-based test support
- **Custom Matchers** - Extended assertion library
- **Watch Mode** - Auto-rerun on file changes
- **Coverage Reports** - Code coverage analysis

### **Test Environment Setup**

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    environment: 'jsdom', // For DOM APIs
    globals: true,        // Global test functions
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      reporter: ['text', 'html'],
      threshold: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    }
  }
});
```

## Running Tests

### **Commands**
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- utils.test.ts

# Run tests matching pattern
npm test -- --grep "should handle errors"
```

### **Test Scripts**
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui"
  }
}
```

## Best Practices

### **Test Naming**
- **Descriptive**: `should return user data when valid ID provided`
- **Behavior-focused**: Test what the function should do, not how
- **Consistent**: Use the same naming pattern throughout

### **Test Organization**
- **Group related tests**: Use `describe` blocks effectively
- **One assertion per test**: Keep tests focused
- **Setup and teardown**: Use `beforeEach`/`afterEach` for common setup

### **Mock Strategy**
- **Mock external dependencies**: Don't test third-party code
- **Use real objects when possible**: Avoid over-mocking
- **Verify mock interactions**: Ensure mocks are called correctly

### **Error Testing**
```typescript
it('should throw ValidationError for invalid input', () => {
  expect(() => validateInput(null))
    .toThrow(ValidationError);
});
```

### **Async Testing**
```typescript
it('should handle async operations', async () => {
  const result = await asyncFunction();
  expect(result).toBeDefined();
});
```

## Coverage Goals

### **Target Coverage**
- **Statements**: 90%+
- **Branches**: 85%+
- **Functions**: 95%+
- **Lines**: 90%+

### **Coverage Exclusions**
- Type definitions
- Configuration files
- Test utilities
- Error handling for "impossible" scenarios

## Continuous Integration

### **CI Pipeline**
1. **Install Dependencies**
2. **Run Linting**
3. **Run Type Checking**
4. **Run Unit Tests**
5. **Run Integration Tests**
6. **Generate Coverage Report**
7. **Upload Coverage to Service**

### **Quality Gates**
- All tests must pass
- Coverage thresholds must be met
- No linting errors
- No type errors

This comprehensive testing approach ensures the HTTP service is reliable, maintainable, and performs correctly across all supported scenarios and environments.
