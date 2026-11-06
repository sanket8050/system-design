/**
 * Day 28: Distributed Counter with Strong Consistency (Conceptual)
 *
 * This example simulates a distributed counter aiming for strong consistency.
 * Instead of direct node-to-node updates like in eventual consistency,
 * updates here go through a "coordinator" (or a leader in a consensus protocol).
 * This coordinator ensures that all updates are applied in a strict, agreed-upon order
 * before acknowledging the write.
 *
 * This is a highly simplified model and does NOT implement a full consensus protocol
 * like Raft or Paxos. It serves to illustrate the *concept* of centralized coordination
 * for strong consistency and its associated overhead.
 */

class StrongConsistentNode {
  private data: Map<string, number> = new Map();
  private nodeId: string;

  constructor(nodeId: string) {
    this.nodeId = nodeId;
    console.log(`StrongConsistentNode ${this.nodeId} initialized.`);
  }

  public read(key: string): number {
    const value = this.data.get(key) || 0;
    console.log(`[${this.nodeId}] Reading key "${key}": ${value}`);
    return value;
  }

  /**
   * Internal method for the coordinator to instruct this node to update its state.
   * This represents an agreed-upon, ordered update.
   */
  public applyUpdate(key: string, value: number): void {
    console.log(`[${this.nodeId}] Applying update for "${key}": ${this.data.get(key) || 0} -> ${value}`);
    this.data.set(key, value);
  }
}

class Coordinator {
  private nodes: StrongConsistentNode[];
  private currentCounterValue: number = 0; // The authoritative state
  private pendingOperations: Array<() => Promise<void>> = []; // Queue for sequential processing
  private isProcessing: boolean = false;

  constructor(nodes: StrongConsistentNode[]) {
    this.nodes = nodes;
    console.log(`Coordinator initialized with ${nodes.length} nodes.`);
  }

  /**
   * Simulates a client requesting to increment the counter.
   * This request is queued and processed sequentially to ensure strong consistency.
   */
  public async incrementCounter(clientId: string): Promise<number> {
    const operationId = `${clientId}-${Date.now()}`;
    console.log(`[Coordinator] Client ${clientId} requested increment (${operationId}). Queuing...`);

    return new Promise(resolve => {
      this.pendingOperations.push(async () => {
        console.log(`[Coordinator] Processing increment for ${clientId} (${operationId}).`);
        const oldValue = this.currentCounterValue;
        const newValue = oldValue + 1;

        // Simulate "consensus" or "replication" step:
        // In a real system (Raft/Paxos), this involves leader proposing, followers logging,
        // and leader committing after quorum. Here, we directly instruct all nodes.
        const updatePromises = this.nodes.map(node =>
          new Promise<void>(res => {
            const delay = Math.random() * 200 + 50; // Simulate network latency
            setTimeout(() => {
              node.applyUpdate('globalCounter', newValue);
              res();
            }, delay);
          })
        );

        await Promise.all(updatePromises); // Wait for all nodes to acknowledge update

        this.currentCounterValue = newValue;
        console.log(`[Coordinator] Increment for ${clientId} (${operationId}) committed. New value: ${newValue}`);
        resolve(newValue);
      });

      this.processQueue(); // Start/continue processing the queue
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) return; // Already processing

    this.isProcessing = true;
    while (this.pendingOperations.length > 0) {
      const operation = this.pendingOperations.shift();
      if (operation) {
        await operation();
      }
    }
    this.isProcessing = false;
    console.log('[Coordinator] All pending operations processed.');
  }

  /**
   * Allows reading the current authoritative value from the coordinator.
   * In a linearizable system, reads might also go through a quorum or the leader.
   */
  public getAuthoritativeCounter(): number {
    console.log(`[Coordinator] Authoritative counter value: ${this.currentCounterValue}`);
    return this.currentCounterValue;
  }
}

// --- Simulation Setup ---
const nodeX = new StrongConsistentNode('X');
const nodeY = new StrongConsistentNode('Y');
const nodeZ = new StrongConsistentNode('Z');

const coordinator = new Coordinator([nodeX, nodeY, nodeZ]);

console.log('\n--- Initial State ---');
nodeX.read('globalCounter'); // 0
coordinator.getAuthoritativeCounter(); // 0

console.log('\n--- Scenario 1: Single client increments ---');
(async () => {
  await coordinator.incrementCounter('Client1');
  console.log('\n--- After Client1 increment ---');
  nodeX.read('globalCounter'); // Should be 1
  nodeY.read('globalCounter'); // Should be 1
  nodeZ.read('globalCounter'); // Should be 1
  coordinator.getAuthoritativeCounter(); // Should be 1
})();

console.log('\n--- Scenario 2: Multiple clients concurrently increment ---');
setTimeout(async () => {
  console.log('\n--- Initiating concurrent increments ---');
  const promises = [
    coordinator.incrementCounter('ClientA'),
    coordinator.incrementCounter('ClientB'),
    coordinator.incrementCounter('ClientC'),
  ];

  // Because the coordinator processes sequentially, the final value will be correct.
  // The clients might experience higher latency for their requests.
  await Promise.all(promises);

  console.log('\n--- After concurrent increments ---');
  nodeX.read('globalCounter'); // Should be 1 + 3 = 4
  nodeY.read('globalCounter'); // Should be 4
  nodeZ.read('globalCounter'); // Should be 4
  coordinator.getAuthoritativeCounter(); // Should be 4
}, 2000); // Start after previous scenario
