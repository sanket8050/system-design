/**
 * Day 28: Eventual Consistency Simulation
 *
 * This minimal example simulates a distributed key-value store with eventual consistency.
 * We have multiple "nodes" that hold a copy of a value. Updates propagate with a delay,
 * and reads might initially see stale data until all nodes converge.
 *
 * This is NOT a production-ready system; it's purely for illustrating the concept.
 */

class Node {
  private data: Map<string, string> = new Map();
  private nodeId: string;
  private replicaNodes: Node[] = [];

  constructor(nodeId: string) {
    this.nodeId = nodeId;
    console.log(`Node ${this.nodeId} initialized.`);
  }

  /**
   * Registers other nodes as replicas to simulate a distributed system.
   * In a real system, this would involve network discovery.
   */
  public registerReplicas(replicas: Node[]): void {
    this.replicaNodes = replicas.filter(node => node.nodeId !== this.nodeId);
  }

  /**
   * Simulates a write operation. Updates local data and asynchronously propagates to replicas.
   * In a real system, this would involve network requests and potential retries.
   */
  public write(key: string, value: string): void {
    console.log(`[${this.nodeId}] Writing "${value}" to key "${key}"`);
    this.data.set(key, value);
    this.propagateUpdate(key, value);
  }

  /**
   * Simulates a read operation. Returns the local value for the key.
   */
  public read(key: string): string | undefined {
    const value = this.data.get(key);
    console.log(`[${this.nodeId}] Reading key "${key}": "${value || 'undefined'}"`);
    return value;
  }

  /**
   * Internal method to simulate asynchronous propagation of updates to replicas.
   * Adds a small random delay to mimic network latency.
   */
  private propagateUpdate(key: string, value: string): void {
    this.replicaNodes.forEach(replica => {
      const delay = Math.random() * 500 + 100; // 100-600ms delay
      setTimeout(() => {
        console.log(`[${this.nodeId}] -> [${replica.nodeId}] Propagating update for "${key}" to "${value}" (delay: ${delay.toFixed(0)}ms)`);
        replica.receiveUpdate(key, value);
      }, delay);
    });
  }

  /**
   * Internal method for a node to receive an update from another node.
   */
  public receiveUpdate(key: string, value: string): void {
    const currentValue = this.data.get(key);
    if (currentValue === value) {
      // console.log(`[${this.nodeId}] Received redundant update for "${key}" -> "${value}". No change.`);
      return;
    }
    console.log(`[${this.nodeId}] Received update for "${key}": "${currentValue || 'undefined'}" -> "${value}"`);
    this.data.set(key, value);
  }
}

// --- Simulation Setup ---
const nodeA = new Node('A');
const nodeB = new Node('B');
const nodeC = new Node('C');

const allNodes = [nodeA, nodeB, nodeC];
nodeA.registerReplicas([nodeB, nodeC]);
nodeB.registerReplicas([nodeA, nodeC]);
nodeC.registerReplicas([nodeA, nodeB]);

console.log('\n--- Initial State ---');
nodeA.read('userCount'); // undefined
nodeB.read('userCount'); // undefined
nodeC.read('userCount'); // undefined

console.log('\n--- Scenario 1: Write from Node A, then immediate reads ---');
nodeA.write('userCount', '100');

// Immediate reads will show divergence
setTimeout(() => {
  console.log('\n--- Reads shortly after write (expect divergence) ---');
  nodeA.read('userCount'); // Should be 100
  nodeB.read('userCount'); // Might be undefined or 100, depending on propagation speed
  nodeC.read('userCount'); // Might be undefined or 100
}, 50); // Very short delay

// Wait for propagation to complete (eventual consistency)
setTimeout(() => {
  console.log('\n--- Reads after propagation (expect convergence) ---');
  nodeA.read('userCount'); // Should be 100
  nodeB.read('userCount'); // Should be 100
  nodeC.read('userCount'); // Should be 100
}, 1000); // Sufficient delay for all propagation

console.log('\n--- Scenario 2: Concurrent writes (simulating conflict) ---');
// In a real eventual consistent system, conflict resolution (e.g., Last Write Wins, CRDTs) would be needed.
// Here, the last received update simply wins.
setTimeout(() => {
  nodeB.write('productViews', '500');
  nodeC.write('productViews', '550'); // This write happens shortly after B's, might overwrite B's or be overwritten by B's depending on network.

  setTimeout(() => {
    console.log('\n--- Reads after concurrent writes (expect last one to win, eventually) ---');
    nodeA.read('productViews');
    nodeB.read('productViews');
    nodeC.read('productViews');
  }, 1500); // Sufficient delay for propagation
}, 2000); // Start concurrent writes after previous scenario is done
