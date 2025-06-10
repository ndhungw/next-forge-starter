/**
 * Performance benchmarks for HTTP Service
 * Run with: npm run benchmark
 */
import { performance } from 'node:perf_hooks';
import { logger } from '../logger';
import { HttpServiceMock } from '../testing';

interface BenchmarkResult {
  name: string;
  iterations: number;
  totalTime: number;
  averageTime: number;
  opsPerSecond: number;
  minTime: number;
  maxTime: number;
}

class Benchmark {
  async run(
    name: string,
    fn: () => Promise<any>,
    iterations = 1000
  ): Promise<BenchmarkResult> {
    const times: number[] = [];

    logger.log(`\nRunning ${name} benchmark (${iterations} iterations)...`);

    // Warmup
    for (let i = 0; i < 10; i++) {
      await fn();
    }

    // Actual benchmark
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await fn();
      const end = performance.now();
      times.push(end - start);

      if (i % 100 === 0) {
        process.stdout.write(
          `\rProgress: ${Math.round((i / iterations) * 100)}%`
        );
      }
    }

    logger.log('\rCompleted!');

    const totalTime = times.reduce((sum, time) => sum + time, 0);
    const averageTime = totalTime / iterations;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const opsPerSecond = 1000 / averageTime;

    return {
      name,
      iterations,
      totalTime,
      averageTime,
      opsPerSecond,
      minTime,
      maxTime,
    };
  }

  printResults(results: BenchmarkResult[]) {
    logger.log('\n=== BENCHMARK RESULTS ===\n');

    for (const result of results) {
      logger.log(`${result.name}:`);
      logger.log(`  Iterations: ${result.iterations}`);
      logger.log(`  Total time: ${result.totalTime.toFixed(2)}ms`);
      logger.log(`  Average time: ${result.averageTime.toFixed(3)}ms`);
      logger.log(`  Ops/second: ${result.opsPerSecond.toFixed(0)}`);
      logger.log(`  Min time: ${result.minTime.toFixed(3)}ms`);
      logger.log(`  Max time: ${result.maxTime.toFixed(3)}ms`);
      logger.log('');
    }
  }
}

async function runBenchmarks() {
  const benchmark = new Benchmark();
  const results: BenchmarkResult[] = [];

  // Setup mock service
  const mockService = new HttpServiceMock();
  mockService.mockGet('/api/test', { data: { id: 1, name: 'Test' } });
  mockService.mockPost('/api/test', { data: { id: 2, name: 'Created' } });

  logger.log('Starting HTTP Service Performance Benchmarks...');

  // Benchmark 1: Basic GET requests
  results.push(
    await benchmark.run(
      'Basic GET Request (Mock)',
      async () => {
        await mockService.get('/api/test');
      },
      1000
    )
  );

  // Benchmark 2: POST requests with JSON body
  results.push(
    await benchmark.run(
      'POST Request with JSON (Mock)',
      async () => {
        await mockService.post('/api/test', {
          name: 'Test User',
          email: 'test@example.com',
        });
      },
      1000
    )
  );

  // Benchmark 3: Requests with query parameters
  results.push(
    await benchmark.run(
      'GET with Query Parameters (Mock)',
      async () => {
        await mockService.get('/api/test', {
          params: {
            page: 1,
            limit: 10,
            sort: 'name',
            filter: 'active',
          },
        });
      },
      1000
    )
  );

  // Benchmark 4: URL building performance
  results.push(
    await benchmark.run(
      'URL Building',
      async () => {
        const { buildURL } = await import('../utils');
        buildURL('https://api.example.com/users', {
          page: 1,
          limit: 10,
          search: 'john doe',
          active: true,
          sort: 'created_at',
        });
      },
      10000
    )
  );

  // Benchmark 5: Header merging
  results.push(
    await benchmark.run(
      'Header Merging',
      async () => {
        const { mergeHeaders } = await import('../utils');
        mergeHeaders(
          { 'Content-Type': 'application/json', Accept: 'application/json' },
          { Authorization: 'Bearer token123', 'X-Custom': 'value' },
          new Headers({ 'User-Agent': 'Test/1.0' })
        );
      },
      10000
    )
  );

  // Benchmark 6: Cache operations
  const cacheConfig = {
    enableCache: true,
    cacheTimeout: 300000,
  };

  // Warm up cache
  const mockCacheService = new HttpServiceMock(cacheConfig);
  mockCacheService.mockGet('/api/cached', { data: { cached: true } });

  // First call to populate cache
  await mockCacheService.get('/api/cached');

  results.push(
    await benchmark.run(
      'Cache Hit Performance',
      async () => {
        await mockCacheService.get('/api/cached');
      },
      5000
    )
  );

  // Benchmark 7: JSON serialization/deserialization
  const largeObject = {
    users: Array.from({ length: 100 }, (_, i) => ({
      id: i,
      name: `User ${i}`,
      email: `user${i}@example.com`,
      profile: {
        age: 20 + (i % 50),
        preferences: {
          theme: i % 2 === 0 ? 'dark' : 'light',
          notifications: true,
          language: 'en',
        },
      },
      metadata: {
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        tags: [`tag${i}`, `category${i % 10}`],
      },
    })),
  };

  const largeMockService = new HttpServiceMock();
  largeMockService.mockPost('/api/bulk', { data: { success: true } });

  results.push(
    await benchmark.run(
      'Large Object Serialization',
      async () => {
        await largeMockService.post('/api/bulk', largeObject);
      },
      500
    )
  );

  // Benchmark 8: Multiple concurrent requests
  const concurrentMockService = new HttpServiceMock();
  for (let i = 0; i < 10; i++) {
    concurrentMockService.mockGet(`/api/item/${i}`, {
      data: { id: i, name: `Item ${i}` },
    });
  }

  results.push(
    await benchmark.run(
      'Concurrent Requests (10 parallel)',
      async () => {
        const promises = Array.from({ length: 10 }, (_, i) =>
          concurrentMockService.get(`/api/item/${i}`)
        );
        await Promise.all(promises);
      },
      200
    )
  );

  // Benchmark 9: Request with large headers
  const headerMockService = new HttpServiceMock();
  headerMockService.mockGet('/api/headers', { data: { success: true } });

  const largeHeaders = Array.from({ length: 50 }, (_, i) => [
    `X-Custom-${i}`,
    `value-${i}`,
  ]).reduce(
    (acc, [key, value]) => {
      acc[key] = value;
      return acc;
    },
    {} as Record<string, string>
  );

  results.push(
    await benchmark.run(
      'Request with Many Headers',
      async () => {
        await headerMockService.get('/api/headers', {
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer token123',
            'User-Agent': 'HttpService/1.0',
            ...largeHeaders,
          },
        });
      },
      1000
    )
  );

  // Benchmark 10: Memory usage test
  logger.log('\nMemory usage before cleanup:');
  const memoryBefore = process.memoryUsage();
  logger.log(`RSS: ${(memoryBefore.rss / 1024 / 1024).toFixed(2)} MB`);
  logger.log(
    `Heap Used: ${(memoryBefore.heapUsed / 1024 / 1024).toFixed(2)} MB`
  );
  logger.log(
    `Heap Total: ${(memoryBefore.heapTotal / 1024 / 1024).toFixed(2)} MB`
  );

  // Force garbage collection if available
  if (global.gc) {
    global.gc();
    logger.log('Memory usage after GC:');
    const memoryAfter = process.memoryUsage();
    logger.log(`RSS: ${(memoryAfter.rss / 1024 / 1024).toFixed(2)} MB`);
    logger.log(
      `Heap Used: ${(memoryAfter.heapUsed / 1024 / 1024).toFixed(2)} MB`
    );
    logger.log(
      `Heap Total: ${(memoryAfter.heapTotal / 1024 / 1024).toFixed(2)} MB`
    );
  }

  // Print all results
  benchmark.printResults(results);

  // Performance analysis
  logger.log('=== PERFORMANCE ANALYSIS ===\n');

  const getResult = results.find((r) => r.name.includes('Basic GET'));
  const postResult = results.find((r) => r.name.includes('POST Request'));
  const urlResult = results.find((r) => r.name.includes('URL Building'));
  const cacheResult = results.find((r) => r.name.includes('Cache Hit'));

  if (getResult && postResult) {
    logger.log(
      `GET vs POST performance: GET is ${(postResult.averageTime / getResult.averageTime).toFixed(2)}x faster`
    );
  }

  if (urlResult) {
    logger.log(
      `URL building: ${urlResult.opsPerSecond.toFixed(0)} operations/second`
    );
  }

  if (cacheResult && getResult) {
    logger.log(
      `Cache performance: ${(getResult.averageTime / cacheResult.averageTime).toFixed(2)}x faster than network`
    );
  }

  // Performance recommendations
  logger.log('\n=== RECOMMENDATIONS ===\n');

  if (getResult && getResult.averageTime > 1) {
    logger.log(
      '⚠️  GET requests are slower than expected. Consider optimizing request processing.'
    );
  }

  if (urlResult && urlResult.averageTime > 0.1) {
    logger.log(
      '⚠️  URL building is slower than expected. Consider caching or optimizing parameter handling.'
    );
  }

  if (cacheResult && cacheResult.averageTime > 0.01) {
    logger.log(
      '⚠️  Cache hits are slower than expected. Consider optimizing cache implementation.'
    );
  }

  logger.log('✅ Benchmarks completed successfully!');
}

// Run benchmarks if this file is executed directly
if (require.main === module) {
  runBenchmarks().catch(logger.error);
}

export { runBenchmarks, Benchmark };
