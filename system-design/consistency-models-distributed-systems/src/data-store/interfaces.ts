/**
 * Represents a basic interface for a distributed key-value store.
 * This interface defines the fundamental operations of putting (writing) and getting (reading) data.
 * In a real distributed system, these operations would involve network communication, consensus protocols,
 * and handling of replicas.
 */
export interface DistributedKeyValueStore<T> {
  /**
   * Puts a value associated with a key into the store.
   * This operation should ideally return a promise that resolves when the write is acknowledged
   * by a sufficient number of replicas, depending on the consistency model in use.
   * @param key The unique key for the data.
   * @param value The data to store.
   * @returns A promise that resolves when the put operation is complete.
   */
  put(key: string, value: T): Promise<void>;

  /**
   * Retrieves the value associated with a key from the store.
   * The value returned will depend on the consistency model and the state of the replicas.
   * @param key The unique key for the data.
   * @returns A promise that resolves with the retrieved value, or `undefined` if not found.
   */
  get(key: string): Promise<T | undefined>;
}

/**
 * Represents a basic interface for a distributed counter.
 * This is a common primitive used in distributed systems where atomic increments are needed.
 */
export interface DistributedCounter {
  /**
   * Increments the counter by a specified amount.
   * @param amount The value to increment by (default is 1).
   * @returns A promise that resolves with the new value of the counter after the increment.
   */
  increment(amount?: number): Promise<number>;

  /**
   * Gets the current value of the counter.
   * @returns A promise that resolves with the current value of the counter.
   */
  getValue(): Promise<number>;
}
