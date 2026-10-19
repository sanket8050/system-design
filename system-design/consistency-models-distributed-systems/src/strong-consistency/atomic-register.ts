import { DistributedKeyValueStore } from '../data-store/interfaces';

/**
 * A conceptual implementation of an Atomic Register, providing Linearizable consistency.
 * In a real distributed system, this would involve a consensus protocol (e.g., Raft, Paxos)
 * to ensure that all operations appear to occur at a single, instantaneous point in time
 * across all replicas. This class simulates that behavior within a single process for demonstration.
 *
 * Key properties of an Atomic Register:
 * - **Linearizability**: Any read operation returns the value written by the latest completed write operation.
 *   If operation A completes before operation B begins, then A's effects must be visible to B.
 * - **Atomicity**: Writes are all-or-nothing. Either the write completes successfully and is visible,
 *   or it fails and leaves the previous state intact.
 *
 * This simplified version uses a simple Map, assuming a single-process context, to illustrate the API.
 * The `simulateNetworkDelay` helps to highlight the *potential* need for coordination in a real system.
 */
export class AtomicRegister<T> implements DistributedKeyValueStore<T> {
  private store: Map<string, T> = new Map();
  private static readonly NETWORK_DELAY_MS = 50;

  constructor() {
    console.log('AtomicRegister initialized (simulating linearizable key-value store)');
  }

  private async simulateNetworkDelay(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, AtomicRegister.NETWORK_DELAY_MS));
  }

  /**
   * Simulates a linearizable put operation.
   * In a real system, this would involve a consensus protocol (e.g., Raft leader) to ensure
   * the write is committed and visible across a majority of replicas before acknowledging.
   */
  public async put(key: string, value: T): Promise<void> {
    await this.simulateNetworkDelay(); // Simulate network and consensus latency
    console.log(`[AtomicRegister] PUT: key='${key}', value='${JSON.stringify(value)}'`);
    this.store.set(key, value);
    // In a real system, this is where a consensus protocol would ensure global visibility.
    // We're simulating immediate global visibility in this single-process model.
  }

  /**
   * Simulates a linearizable get operation.
   * In a real system, this would involve reading from a replica and potentially verifying
   * its recency or coordinating with the leader to ensure the latest value is returned.
   */
  public async get(key: string): Promise<T | undefined> {
    await this.simulateNetworkDelay(); // Simulate network latency
    const value = this.store.get(key);
    console.log(`[AtomicRegister] GET: key='${key}', value='${JSON.stringify(value)}'`);
    return value;
  }

  public async clear(): Promise<void> {
    this.store.clear();
    console.log('[AtomicRegister] Store cleared.');
  }
}

// Example Usage (conceptual, not runnable in isolation without a test runner or main function)
async function runAtomicRegisterExample() {
  const register = new AtomicRegister<string>();

  // Client 1 writes 'value1' to 'key1'
  await register.put('key1', 'value1');

  // Client 2 reads 'key1'. Due to linearizability, it *must* see 'value1'.
  const read1 = await register.get('key1');
  console.log(`Client 2 reads: ${read1}`); // Expected: 'value1'

  // Client 3 writes 'value2' to 'key1' *after* Client 1's write completes.
  await register.put('key1', 'value2');

  // Client 4 reads 'key1'. Due to linearizability, it *must* see 'value2'.
  const read2 = await register.get('key1');
  console.log(`Client 4 reads: ${read2}`); // Expected: 'value2'

  // Demonstrate that a read always gets the latest committed value
  const p1 = register.put('counter', '0');
  const p2 = register.get('counter'); // This read might happen concurrently with p1, but must see '0' or undefined based on timing.
  const p3 = register.put('counter', '1');
  const p4 = register.get('counter'); // This read must see '1' if p3 completes before it starts.

  await Promise.all([p1, p2, p3, p4]);

  console.log(`Final counter value: ${await register.get('counter')}`); // Expected: '1'
}

// Uncomment to run example if this were a script
// runAtomicRegisterExample();
