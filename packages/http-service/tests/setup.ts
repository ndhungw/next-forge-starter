/**
 * Test setup file for HTTP Service tests
 */
import { afterEach, beforeAll } from 'vitest';

// Mock global fetch if not available
beforeAll(() => {
  if (!global.fetch) {
    global.fetch = vi.fn();
  }

  if (!global.Headers) {
    global.Headers = class Headers {
      private headers: Record<string, string> = {};

      constructor(init?: HeadersInit) {
        if (init) {
          if (init instanceof Headers) {
            for (const [key, value] of init.entries()) {
              this.headers[key.toLowerCase()] = value;
            }
          } else if (Array.isArray(init)) {
            for (const [key, value] of init) {
              this.headers[key.toLowerCase()] = value;
            }
          } else {
            for (const [key, value] of Object.entries(init)) {
              this.headers[key.toLowerCase()] = value;
            }
          }
        }
      }

      get(name: string): string | null {
        return this.headers[name.toLowerCase()] || null;
      }

      set(name: string, value: string): void {
        this.headers[name.toLowerCase()] = value;
      }

      has(name: string): boolean {
        return name.toLowerCase() in this.headers;
      }

      delete(name: string): void {
        delete this.headers[name.toLowerCase()];
      }

      *entries(): IterableIterator<[string, string]> {
        for (const [key, value] of Object.entries(this.headers)) {
          yield [key, value];
        }
      }

      keys(): IterableIterator<string> {
        return Object.keys(this.headers)[Symbol.iterator]();
      }

      values(): IterableIterator<string> {
        return Object.values(this.headers)[Symbol.iterator]();
      }

      [Symbol.iterator](): IterableIterator<[string, string]> {
        return this.entries();
      }
    };
  }

  if (!global.AbortController) {
    global.AbortController = class AbortController {
      signal: AbortSignal;

      constructor() {
        this.signal = {
          aborted: false,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        } as any;
      }

      abort(): void {
        this.signal.aborted = true;
      }
    };
  }

  if (!global.DOMException) {
    global.DOMException = class DOMException extends Error {
      name: string;

      constructor(message?: string, name?: string) {
        super(message);
        this.name = name || 'DOMException';
      }
    };
  }
});

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks();
});
