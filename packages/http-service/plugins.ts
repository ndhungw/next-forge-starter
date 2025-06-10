/**
 * Plugin system for HTTP service extensibility
 */
import type { HttpService } from './http-service';
import { logger } from './logger';
import type { HttpError, HttpResponse, RequestConfig } from './types';

export interface Plugin {
  name: string;
  version?: string;
  install: (service: HttpService) => void | Promise<void>;
  uninstall?: (service: HttpService) => void | Promise<void>;
}

export interface PluginHooks {
  beforeRequest?: (
    config: RequestConfig
  ) => RequestConfig | Promise<RequestConfig>;
  afterResponse?: <T>(
    response: HttpResponse<T>
  ) => HttpResponse<T> | Promise<HttpResponse<T>>;
  onError?: (error: HttpError) => HttpError | Promise<HttpError>;
  onRetry?: (attempt: number, error: HttpError) => boolean | Promise<boolean>;
}

/**
 * Plugin manager for HTTP service
 */
export class PluginManager {
  private plugins = new Map<string, Plugin>();
  private hooks: PluginHooks = {};

  /**
   * Install a plugin
   */
  async install(plugin: Plugin, service: HttpService): Promise<void> {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin "${plugin.name}" is already installed`);
    }

    this.plugins.set(plugin.name, plugin);
    await plugin.install(service);
  }

  /**
   * Uninstall a plugin
   */
  async uninstall(pluginName: string, service: HttpService): Promise<void> {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      throw new Error(`Plugin "${pluginName}" is not installed`);
    }

    if (plugin.uninstall) {
      await plugin.uninstall(service);
    }

    this.plugins.delete(pluginName);
  }

  /**
   * Register a hook
   */
  registerHook<K extends keyof PluginHooks>(
    hookName: K,
    handler: NonNullable<PluginHooks[K]>
  ): void {
    this.hooks[hookName] = handler;
  }

  /**
   * Execute beforeRequest hooks
   */
  async executeBeforeRequest(config: RequestConfig): Promise<RequestConfig> {
    if (this.hooks.beforeRequest) {
      return await this.hooks.beforeRequest(config);
    }
    return config;
  }

  /**
   * Execute afterResponse hooks
   */
  async executeAfterResponse<T>(
    response: HttpResponse<T>
  ): Promise<HttpResponse<T>> {
    if (this.hooks.afterResponse) {
      return await this.hooks.afterResponse(response);
    }
    return response;
  }

  /**
   * Execute onError hooks
   */
  async executeOnError(error: HttpError): Promise<HttpError> {
    if (this.hooks.onError) {
      return await this.hooks.onError(error);
    }
    return error;
  }

  /**
   * Execute onRetry hooks
   */
  async executeOnRetry(attempt: number, error: HttpError): Promise<boolean> {
    if (this.hooks.onRetry) {
      return await this.hooks.onRetry(attempt, error);
    }
    return true; // Default: allow retry
  }

  /**
   * Get installed plugins
   */
  getInstalledPlugins(): string[] {
    return Array.from(this.plugins.keys());
  }

  /**
   * Check if plugin is installed
   */
  isInstalled(pluginName: string): boolean {
    return this.plugins.has(pluginName);
  }
}

/**
 * Built-in plugins
 */

/**
 * Logging plugin
 */
export const loggingPlugin: Plugin = {
  name: 'logging',
  version: '1.0.0',
  install: (service: HttpService) => {
    service.addRequestInterceptor((config) => {
      logger.log(`🔵 ${config.method || 'GET'} ${config.url}`);
      return config;
    });

    service.addResponseInterceptor((response) => {
      logger.log(
        `🟢 ${response.status} ${response.config.method || 'GET'} ${response.config.url}`
      );
      return response;
    });

    service.addErrorInterceptor((error) => {
      logger.error(
        `🔴 ${error.status || 'ERR'} ${error.config?.method || 'GET'} ${error.config?.url}`
      );
      return error;
    });
  },
};

/**
 * Request ID plugin
 */
export const requestIdPlugin: Plugin = {
  name: 'request-id',
  version: '1.0.0',
  install: (service: HttpService) => {
    service.addRequestInterceptor((config) => {
      const headers = { ...config.headers };
      (headers as any)['X-Request-ID'] =
        `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      return { ...config, headers };
    });
  },
};

/**
 * Performance monitoring plugin
 */
export const performancePlugin: Plugin = {
  name: 'performance',
  version: '1.0.0',
  install: (service: HttpService) => {
    const timings = new Map<string, number>();

    service.addRequestInterceptor((config) => {
      const key = `${config.method || 'GET'} ${config.url}`;
      timings.set(key, Date.now());
      return config;
    });

    service.addResponseInterceptor((response) => {
      const key = `${response.config.method || 'GET'} ${response.config.url}`;
      const startTime = timings.get(key);
      if (startTime) {
        const duration = Date.now() - startTime;
        logger.log(`⏱️ ${key} took ${duration}ms`);
        timings.delete(key);
      }
      return response;
    });

    service.addErrorInterceptor((error) => {
      const key = `${error.config?.method || 'GET'} ${error.config?.url}`;
      const startTime = timings.get(key);
      if (startTime) {
        const duration = Date.now() - startTime;
        logger.log(`⏱️ ${key} failed after ${duration}ms`);
        timings.delete(key);
      }
      return error;
    });
  },
};

/**
 * Circuit breaker plugin
 */
export class CircuitBreakerPlugin implements Plugin {
  name = 'circuit-breaker';
  version = '1.0.0';

  private failureCount = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private threshold: number;
  private timeout: number;

  constructor(
    threshold = 5,
    timeout = 60000 // 1 minute
  ) {
    this.threshold = threshold;
    this.timeout = timeout;
  }

  install(service: HttpService): void {
    service.addRequestInterceptor((config) => {
      if (this.state === 'OPEN') {
        if (Date.now() - this.lastFailureTime < this.timeout) {
          throw new Error('Circuit breaker is OPEN');
        }
        this.state = 'HALF_OPEN';
      }
      return config;
    });

    service.addResponseInterceptor((response) => {
      if (this.state === 'HALF_OPEN') {
        this.reset();
      }
      return response;
    });

    service.addErrorInterceptor((error) => {
      this.recordFailure();
      return error;
    });
  }

  private recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
    }
  }

  private reset(): void {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  getState(): string {
    return this.state;
  }
}

/**
 * Create a circuit breaker plugin
 */
export function createCircuitBreakerPlugin(
  threshold = 5,
  timeout = 60000
): CircuitBreakerPlugin {
  return new CircuitBreakerPlugin(threshold, timeout);
}
