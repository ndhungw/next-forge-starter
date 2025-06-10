/**
 * Logger utilities for the HTTP service
 */

const isDev =
  typeof process !== 'undefined' && process.env.NODE_ENV === 'development';

function log(message: string, ...args: unknown[]): void {
  if (isDev && typeof window !== 'undefined') {
    // In development, we can use console for debugging
    // This is acceptable as it's controlled and conditional
    // biome-ignore lint/suspicious/noConsoleLog: <explanation>
    // biome-ignore lint/suspicious/noConsole: <explanation>
    console.log(`[HttpService] ${message}`, ...args);
  }
}

function warn(message: string, ...args: unknown[]): void {
  if (isDev && typeof window !== 'undefined') {
    // biome-ignore lint/suspicious/noConsole: <explanation>
    console.warn(`[HttpService] ${message}`, ...args);
  }
}

function error(message: string, ...args: unknown[]): void {
  if (isDev && typeof window !== 'undefined') {
    // biome-ignore lint/suspicious/noConsole: <explanation>
    console.error(`[HttpService] ${message}`, ...args);
  }
}

export const logger = {
  log,
  warn,
  error,
};
