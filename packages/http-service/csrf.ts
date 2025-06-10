/**
 * CSRF (Cross-Site Request Forgery) protection utilities
 */

export interface CsrfConfig {
  enabled: boolean;
  tokenHeader?: string;
  tokenName?: string;
  getToken?: () => string | Promise<string>;
  validateToken?: (token: string) => boolean | Promise<boolean>;
}

export interface CsrfToken {
  value: string;
  expires?: number;
}

/**
 * CSRF Protection Manager
 */
export class CsrfManager {
  private config: Required<CsrfConfig>;
  private cachedToken: CsrfToken | null = null;

  constructor(config: CsrfConfig) {
    this.config = {
      enabled: config.enabled,
      tokenHeader: config.tokenHeader || 'X-CSRF-Token',
      tokenName: config.tokenName || 'csrf_token',
      getToken: config.getToken || this.getDefaultToken.bind(this),
      validateToken:
        config.validateToken || this.validateDefaultToken.bind(this),
    };
  }

  /**
   * Get CSRF token from various sources
   */
  private async getDefaultToken(): Promise<string> {
    // Try to get from meta tag first
    if (typeof document !== 'undefined') {
      const metaTag = document.querySelector<HTMLMetaElement>(
        `meta[name="${this.config.tokenName}"]`
      );
      if (metaTag?.content) {
        return metaTag.content;
      }

      // Try to get from cookie
      const cookies = document.cookie.split(';');
      for (const cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === this.config.tokenName && value) {
          return decodeURIComponent(value);
        }
      }
    }

    // Try to fetch from server
    try {
      const response = await fetch('/api/csrf-token', {
        method: 'GET',
        credentials: 'same-origin',
      });

      if (response.ok) {
        const data = await response.json();
        return data.token || data.csrfToken || '';
      }
    } catch (error) {
      console.warn('Failed to fetch CSRF token:', error);
    }

    return '';
  }

  /**
   * Basic token validation
   */
  private async validateDefaultToken(token: string): Promise<boolean> {
    return token.length > 0 && /^[a-zA-Z0-9_-]+$/.test(token);
  }

  /**
   * Get current CSRF token
   */
  async getToken(): Promise<string | null> {
    if (!this.config.enabled) {
      return null;
    }

    // Return cached token if still valid
    if (this.cachedToken && this.isTokenValid(this.cachedToken)) {
      return this.cachedToken.value;
    }

    try {
      const token = await this.config.getToken();
      if (token && (await this.config.validateToken(token))) {
        this.cachedToken = {
          value: token,
          expires: Date.now() + 30 * 60 * 1000, // 30 minutes
        };
        return token;
      }
    } catch (error) {
      console.warn('Failed to get CSRF token:', error);
    }

    return null;
  }

  /**
   * Check if cached token is still valid
   */
  private isTokenValid(token: CsrfToken): boolean {
    return token.expires ? Date.now() < token.expires : true;
  }

  /**
   * Clear cached token
   */
  clearToken(): void {
    this.cachedToken = null;
  }

  /**
   * Check if CSRF protection is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Get the header name for CSRF token
   */
  getHeaderName(): string {
    return this.config.tokenHeader;
  }

  /**
   * Add CSRF token to headers
   */
  async addTokenToHeaders(headers: Headers): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const token = await this.getToken();
    if (token) {
      headers.set(this.config.tokenHeader, token);
    }
  }

  /**
   * Check if request needs CSRF protection
   */
  needsProtection(method: string): boolean {
    if (!this.config.enabled) {
      return false;
    }

    // CSRF protection is typically needed for state-changing methods
    const protectedMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
    return protectedMethods.includes(method.toUpperCase());
  }
}

/**
 * Create a CSRF manager with default configuration
 */
export function createCsrfManager(
  config: Partial<CsrfConfig> = {}
): CsrfManager {
  return new CsrfManager({
    enabled: true,
    ...config,
  });
}

/**
 * Utility to generate a random CSRF token
 */
export function generateCsrfToken(length = 32): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let result = '';

  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    // Use secure random in browser/Node.js
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    for (const byte of array) {
      result += chars[byte % chars.length];
    }
  } else {
    // Fallback for environments without crypto
    for (let i = 0; i < length; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
  }

  return result;
}
