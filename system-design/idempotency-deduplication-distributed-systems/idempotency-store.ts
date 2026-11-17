/**
 * Represents the state of an idempotent operation.
 * - 'PENDING': Operation has started but not yet completed.
 * - 'COMPLETED': Operation finished successfully, result stored.
 * - 'FAILED': Operation failed, result (error) stored.
 */
export type IdempotencyStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

/**
 * Data structure for an idempotency record.
 * Stores the outcome of an operation associated with an idempotency key.
 */
export interface IdempotencyRecord {
  status: IdempotencyStatus;
  responseStatusCode?: number;
  responseHeaders?: Record<string, string>;
  responseBody?: any;
  error?: any; // Store error details if status is FAILED
  createdAt: number; // Timestamp of creation
  expiresAt: number; // Timestamp for expiration (TTL)
}

/**
 * Interface for an Idempotency Store.
 * This abstract interface defines the contract for storing and retrieving idempotency records.
 * Implementations could use Redis, a dedicated database table, or an in-memory map for testing.
 */
export interface IdempotencyStore {
  /**
   * Retrieves an idempotency record by its key.
   * @param key The unique idempotency key.
   * @returns The IdempotencyRecord if found, otherwise undefined.
   */
  get(key: string): Promise<IdempotencyRecord | undefined>;

  /**
   * Sets an idempotency record, typically when an operation starts or completes.
   * @param key The unique idempotency key.
   * @param record The IdempotencyRecord to store.
   * @param ttlSeconds Time-to-live for the record in seconds.
   */
  set(key: string, record: IdempotencyRecord, ttlSeconds: number): Promise<void>;

  /**
   * Deletes an idempotency record by its key.
   * @param key The unique idempotency key.
   */
  delete(key: string): Promise<void>;
}

/**
 * A simple in-memory implementation of IdempotencyStore for demonstration and testing.
 * NOT suitable for production as it does not persist data across restarts and is not distributed.
 */
export class InMemoryIdempotencyStore implements IdempotencyStore {
  private store = new Map<string, IdempotencyRecord>();
  private cleanupInterval: NodeJS.Timeout | undefined;

  constructor(cleanupIntervalMs: number = 60 * 1000) {
    this.cleanupInterval = setInterval(() => this.cleanupExpiredRecords(), cleanupIntervalMs);
    console.log(`[InMemoryIdempotencyStore] Initialized with cleanup interval: ${cleanupIntervalMs / 1000}s`);
  }

  async get(key: string): Promise<IdempotencyRecord | undefined> {
    const record = this.store.get(key);
    if (record && record.expiresAt < Date.now()) {
      // Record has expired, clean it up and return undefined
      this.store.delete(key);
      return undefined;
    }
    return record;
  }

  async set(key: string, record: IdempotencyRecord, ttlSeconds: number): Promise<void> {
    const now = Date.now();
    const expiresAt = now + ttlSeconds * 1000;
    this.store.set(key, { ...record, createdAt: now, expiresAt });
    console.log(`[InMemoryIdempotencyStore] Set key '${key}' with status '${record.status}'. Expires in ${ttlSeconds}s.`);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
    console.log(`[InMemoryIdempotencyStore] Deleted key '${key}'.`);
  }

  private cleanupExpiredRecords() {
    const now = Date.now();
    let cleanedCount = 0;
    for (const [key, record] of this.store.entries()) {
      if (record.expiresAt < now) {
        this.store.delete(key);
        cleanedCount++;
      }
    }
    if (cleanedCount > 0) {
      console.log(`[InMemoryIdempotencyStore] Cleaned up ${cleanedCount} expired records.`);
    }
  }

  /**
   * Call this to stop the cleanup interval when the store is no longer needed.
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
      console.log('[InMemoryIdempotencyStore] Destroyed.');
    }
  }
}
