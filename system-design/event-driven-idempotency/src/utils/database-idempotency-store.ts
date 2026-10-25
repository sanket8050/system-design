import { IdempotencyKey } from '../types/payment-events';

/**
 * Represents the possible statuses of an idempotent operation.
 */
export enum IdempotencyStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

/**
 * Represents a record in the idempotency store.
 */
interface IdempotencyRecord {
  key: IdempotencyKey;
  status: IdempotencyStatus;
  result: any; // Stored result of the operation (e.g., API response, event payload)
  createdAt: string;
  updatedAt: string;
  expiresAt?: string; // For TTL management
  context?: Record<string, any>; // Additional context about the operation
}

/**
 * A simplified in-memory database-like store for idempotency keys.
 * In a real application, this would be backed by a persistent database (e.g., PostgreSQL, Redis).
 * It simulates atomic operations for demonstration purposes.
 */
export class IdempotencyStore {
  private store: Map<IdempotencyKey, IdempotencyRecord>;

  constructor() {
    this.store = new Map();
  }

  /**
   * Retrieves an idempotency record by its key.
   * @param key The idempotency key.
   * @returns The record if found, otherwise undefined.
   */
  public async get(key: IdempotencyKey): Promise<IdempotencyRecord | undefined> {
    console.log(`[IdempotencyStore] Checking for key: ${key}`);
    const record = this.store.get(key);
    if (record && record.expiresAt && new Date(record.expiresAt) < new Date()) {
      console.log(`[IdempotencyStore] Key ${key} expired. Deleting.`);
      this.store.delete(key);
      return undefined;
    }
    return record;
  }

  /**
   * Creates or updates an idempotency record to a pending state.
   * This should ideally be part of a transaction with the main business logic.
   * @param key The idempotency key.
   * @param status The initial status (typically PENDING).
   * @param result The initial result (typically null).
   * @param context Additional context to store.
   */
  public async set(
    key: IdempotencyKey,
    status: IdempotencyStatus,
    result: any,
    ...contextArgs: any[]
  ): Promise<void> {
    const now = new Date().toISOString();
    const context: Record<string, any> = {};
    if (contextArgs.length > 0) {
      context.path = contextArgs[0];
      context.method = contextArgs[1];
      // Add more context as needed
    }

    const record: IdempotencyRecord = {
      key,
      status,
      result,
      createdAt: now,
      updatedAt: now,
      context
    };
    this.store.set(key, record);
    console.log(`[IdempotencyStore] Key ${key} set to ${status}.`);
  }

  /**
   * Updates an existing idempotency record with a new status and result.
   * @param key The idempotency key.
   * @param status The new status (COMPLETED or FAILED).
   * @param result The final result of the operation.
   * @param ttlSeconds Optional time-to-live for the record in seconds.
   */
  public async update(
    key: IdempotencyKey,
    status: IdempotencyStatus,
    result: any,
    ttlSeconds?: number
  ): Promise<void> {
    const record = this.store.get(key);
    if (!record) {
      console.warn(`[IdempotencyStore] Attempted to update non-existent key: ${key}`);
      return;
    }

    record.status = status;
    record.result = result;
    record.updatedAt = new Date().toISOString();
    if (ttlSeconds) {
      const expiryDate = new Date();
      expiryDate.setSeconds(expiryDate.getSeconds() + ttlSeconds);
      record.expiresAt = expiryDate.toISOString();
    }
    this.store.set(key, record);
    console.log(`[IdempotencyStore] Key ${key} updated to ${status}.`);
  }

  /**
   * Clears all records from the store (for testing/cleanup).
   */
  public async clear(): Promise<void> {
    this.store.clear();
    console.log('[IdempotencyStore] All records cleared.');
  }

  /**
   * Returns all records (for debugging).
   */
  public getAllRecords(): Record<IdempotencyKey, IdempotencyRecord> {
    const records: Record<IdempotencyKey, IdempotencyRecord> = {};
    this.store.forEach((value, key) => {
      records[key] = value;
    });
    return records;
  }
}
