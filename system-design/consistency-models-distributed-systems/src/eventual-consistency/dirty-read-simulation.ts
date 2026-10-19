import { DistributedKeyValueStore } from '../data-store/interfaces';

/**
 * A conceptual implementation of an Eventually Consistent Key-Value Store.
 * This simulation demonstrates how different clients might see different (stale) data
 * due to propagation delays, which is characteristic of eventual consistency.
 *
 * In a real-world eventual consistency system (e.g., DynamoDB, Cassandra),
 * writes are acknowledged quickly, but propagation to all replicas takes time.
 * Reads might hit any replica, potentially returning a stale value.
 */
export class EventuallyConsistentStore<T> implements DistributedKeyValueStore<T> {
  private replicas: Map<string, T>[] = [];
  private numReplicas: number;
  private propagationDelayMs: number;

  constructor(numReplicas: number, propagationDelayMs: number) {
    this.numReplicas = numReplicas;
    this.propagationDelayMs = propagationDelayMs;
    for (let i = 0; i < numReplicas; i++) {
      this.replicas.push(new Map<string, T>());
    }
    console.log(`EventuallyConsistentStore initialized with ${numReplicas} replicas and ${propagationDelayMs}ms propagation delay.`);
  }

  /**
   * Simulates a write operation. The write is immediately visible to one replica,
   * and then asynchronously propagated to others after a delay.
   */
  public async put(key: string, value: T): Promise<void> {
    console.log(`[EC Store] Client writes: key='${key}', value='${JSON.stringify(value)}'`);
    // Write to the 'primary' replica immediately
    this.replicas[0].set(key, value);

    // Asynchronously propagate to other replicas
    for (let i = 1; i < this.numReplicas; i++) {
      const replicaIndex = i;
      setTimeout(() => {
        this.replicas[replicaIndex].set(key, value);
        console.log(`[EC Store] Propagated '${key}' to replica ${replicaIndex} (value: ${JSON.stringify(value)})`);
      }, this.propagationDelayMs * replicaIndex);
    }
    // Acknowledge the write quickly, before full propagation
    return Promise.resolve();
  }

  /**
   * Simulates a read operation. A random replica is chosen to serve the read,
   * potentially returning a stale value.
   */
  public async get(key: string): Promise<T | undefined> {
    // Simulate network delay for read
    await new Promise(resolve => setTimeout(resolve, Math.random() * 20));

    const randomReplicaIndex = Math.floor(Math.random() * this.numReplicas);
    const value = this.replicas[randomReplicaIndex].get(key);
    console.log(`[EC Store] Client reads '${key}' from replica ${randomReplicaIndex}: ${JSON.stringify(value)}`);
    return value;
  }

  public async clear(): Promise<void> {
    this.replicas.forEach(r => r.clear());
    console.log('[EC Store] All replicas cleared.');
  }
}

// Example Usage to demonstrate dirty reads and eventual consistency
async function runEventuallyConsistentExample() {
  const store = new EventuallyConsistentStore<string>(3, 100);

  // Client 1 writes 'initial' to 'user_status'
  await store.put('user_status', 'online');
  await new Promise(resolve => setTimeout(resolve, 10)); // Small delay for logs to align

  // Client 2 tries to read immediately. Might get undefined or 'online' if lucky.
  console.log('\n--- Client 2 reads (might be stale) ---');
  let statusC2 = await store.get('user_status');
  console.log(`Client 2: User status is ${statusC2}`); // Could be 'online' or undefined

  await new Promise(resolve => setTimeout(resolve, 50)); // Wait a bit, some propagation might have happened

  // Client 3 writes 'away' to 'user_status'
  await store.put('user_status', 'away');
  await new Promise(resolve => setTimeout(resolve, 10));

  // Client 2 reads again. Still might be 'online', 'away', or undefined.
  console.log('\n--- Client 2 reads again (might be stale or new) ---');
  statusC2 = await store.get('user_status');
  console.log(`Client 2: User status is ${statusC2}`); // Could be 'online', 'away', or undefined

  // Wait for all propagations to complete
  console.log('\n--- Waiting for full propagation... ---');
  await new Promise(resolve => setTimeout(resolve, store['numReplicas'] * store['propagationDelayMs'] + 50));

  // After full propagation, all clients should eventually see 'away'
  console.log('\n--- After full propagation, all reads should be consistent ---');
  for (let i = 0; i < 3; i++) {
    const finalStatus = await store.get('user_status');
    console.log(`Client ${i + 4}: User status is ${finalStatus}`); // Should eventually be 'away'
  }

  await store.clear();
}

// Uncomment to run example if this were a script
runEventuallyConsistentExample();
