/** @format */

/**
 * Abstract storage interface that all storage connectors must implement.
 * This decouples the application from any specific storage mechanism.
 */
export interface StorageConnector {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/**
 * Concrete storage connector backed by the browser's localStorage.
 * All keys are prefixed with the string passed to the constructor,
 * ensuring no collisions with other consumers of localStorage.
 */
export class LocalStorageConnector implements StorageConnector {
  constructor(private readonly prefix: string) {}

  getItem(key: string): string | null {
    return localStorage.getItem(this.prefix + key)
  }

  setItem(key: string, value: string): void {
    localStorage.setItem(this.prefix + key, value)
  }

  removeItem(key: string): void {
    localStorage.removeItem(this.prefix + key)
  }
}
