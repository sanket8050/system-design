import { DistributedCounter } from '../data-store/interfaces';

/**
 * Implements a Grow-only Counter (G-Counter) CRDT.
 * A G-Counter is a state-based CRDT that only allows increments. It can never decrement.
 * Each replica maintains its own set of counts, one for each contributing node.
 * To get the total value, all local counts are summed.
 *
 * Properties:
 * - **Commutative**: The order of operations does not affect the final state.
 * - **Associative**: Grouping of operations does not affect the final state.
 * - **Idempotent**: Applying an operation multiple times has the same effect as applying it once.
 *
 * This allows replicas to update independently and then merge their states by taking the maximum
 * value for each node's contribution across all merged states.
 */
export class GCounter implements DistributedCounter {
  // A map where keys are node IDs and values are their respective counts.
  // This represents the local state of the counter for this specific replica.
  private counts: Map<string, number>;
  private nodeId: string;

  constructor(nodeId: string, initialCounts?: Map<string, number>) {
    this.nodeId = nodeId;
    this.counts = initialCounts || new Map<string, number>();
    // Ensure this node's count is initialized to 0 if not present
    if (!this.counts.has(this.nodeId)) {
      this.counts.set(this.nodeId, 0);
    }
    console.log(`GCounter initialized for node '${this.nodeId}'. Initial state: ${JSON.stringify(Object.fromEntries(this.counts))}`);
  }

  /**
   * Increments the counter by a specified amount for this node.
   * The increment is applied locally without requiring coordination.
   * @param amount The value to increment by (default is 1).
   * @returns A promise that resolves with the new value of the counter after the increment.
   */
  public async increment(amount: number = 1): Promise<number> {
    if (amount < 0) {
      throw new Error('GCounter can only be incremented.');
    }
    const currentCount = this.counts.get(this.nodeId) || 0;
    this.counts.set(this.nodeId, currentCount + amount);
    console.log(`[${this.nodeId}] Incremented by ${amount}. Local state: ${JSON.stringify(Object.fromEntries(this.counts))}`);
    return this.getValue();
  }

  /**
   * Gets the total value of the counter by summing all individual node counts.
   * @returns A promise that resolves with the current total value of the counter.
   */
  public async getValue(): Promise<number> {
    let total = 0;
    for (const count of this.counts.values()) {
      total += count;
    }
    return total;
  }

  /**
   * Returns the internal state of the G-Counter (nodeId -> count map).
   * This state can be sent to other replicas for merging.
   */
  public getState(): Map<string, number> {
    return new Map(this.counts);
  }

  /**
   * Merges the state of another G-Counter into this one.
   * For each node, the merged count is the maximum of the counts from both states.
   * @param otherState The state (Map<string, number>) of another G-Counter.
   */
  public merge(otherState: Map<string, number>): void {
    let changed = false;
    for (const [nodeId, otherCount] of otherState.entries()) {
      const localCount = this.counts.get(nodeId) || 0;
      if (otherCount > localCount) {
        this.counts.set(nodeId, otherCount);
        changed = true;
      }
    }
    if (changed) {
      console.log(`[${this.nodeId}] Merged. New local state: ${JSON.stringify(Object.fromEntries(this.counts))}`);
    } else {
      console.log(`[${this.nodeId}] No changes after merge.`);
    }
  }
}

// Example Usage (conceptual)
async function runGCounterExample() {
  console.log('--- G-Counter CRDT Example ---');

  const counterA = new GCounter('nodeA');
  const counterB = new GCounter('nodeB');
  const counterC = new GCounter('nodeC');

  // Simulate independent increments
  await counterA.increment(5);
  await counterB.increment(3);
  await counterA.increment(2);

  console.log(`\nInitial values before merge:`);
  console.log(`Node A total: ${await counterA.getValue()}`); // Expected: 7
  console.log(`Node B total: ${await counterB.getValue()}`); // Expected: 3
  console.log(`Node C total: ${await counterC.getValue()}`); // Expected: 0

  // Simulate network partition or delay, then merge
  console.log('\n--- Merging states ---');
  // A sends its state to B
  counterB.merge(counterA.getState());
  // B sends its state to A
  counterA.merge(counterB.getState());
  // A sends its state to C
  counterC.merge(counterA.getState());

  // All nodes should now have the same, converged state
  console.log(`\nValues after first merge round:`);
  console.log(`Node A total: ${await counterA.getValue()}`); // Expected: 10
  console.log(`Node B total: ${await counterB.getValue()}`); // Expected: 10
  console.log(`Node C total: ${await counterC.getValue()}`); // Expected: 10

  // Simulate further independent increments
  await counterB.increment(4);
  await counterC.increment(1);

  console.log(`\nValues after second round of increments (before merge):`);
  console.log(`Node A total: ${await counterA.getValue()}`); // Expected: 10
  console.log(`Node B total: ${await counterB.getValue()}`); // Expected: 14
  console.log(`Node C total: ${await counterC.getValue()}`); // Expected: 11

  // Simulate another merge round (e.g., gossip protocol)
  console.log('\n--- Second merge round ---');
  counterA.merge(counterB.getState());
  counterA.merge(counterC.getState());
  counterB.merge(counterA.getState());
  counterB.merge(counterC.getState());
  counterC.merge(counterA.getState());
  counterC.merge(counterB.getState());

  console.log(`\nFinal values after full convergence:`);
  console.log(`Node A total: ${await counterA.getValue()}`); // Expected: 15
  console.log(`Node B total: ${await counterB.getValue()}`); // Expected: 15
  console.log(`Node C total: ${await counterC.getValue()}`); // Expected: 15

  // Verify internal states are identical
  console.log(`\nNode A state: ${JSON.stringify(Object.fromEntries(counterA.getState()))}`);
  console.log(`Node B state: ${JSON.stringify(Object.fromEntries(counterB.getState()))}`);
  console.log(`Node C state: ${JSON.stringify(Object.fromEntries(counterC.getState()))}`);
  // Expected: {"nodeA":7,"nodeB":7,"nodeC":1}
  // (7 from A initial, 7 from B after 4 increment, 1 from C initial)
  // Wait, let's trace this carefully: A:7, B:7+4=11, C:1. Merge should be max(A_counts, B_counts, C_counts)
  // A: {nodeA: 7}, B: {nodeB: 3}, C: {nodeC: 0}
  // Merge 1: A: {nodeA: 7, nodeB: 3}, B: {nodeA: 7, nodeB: 3}, C: {nodeA: 7, nodeB: 3, nodeC: 0}
  // After inc: A: {nodeA: 7, nodeB: 3}, B: {nodeA: 7, nodeB: 3, nodeB: 4=7}, C: {nodeA: 7, nodeB: 3, nodeC: 1}
  // The issue is that `increment` updates *only* `this.nodeId`'s count. So B incrementing its value to 7 means its state becomes {nodeA: 7, nodeB: 7} not {nodeA: 7, nodeB: 3, nodeB: 4=7}
  // Let's re-evaluate the expected final state.
  // counterA: { 'nodeA': 7 }
  // counterB: { 'nodeB': 3 }
  // counterC: { 'nodeC': 0 }

  // After merge round 1:
  // counterA: { 'nodeA': 7, 'nodeB': 3, 'nodeC': 0 }
  // counterB: { 'nodeA': 7, 'nodeB': 3, 'nodeC': 0 }
  // counterC: { 'nodeA': 7, 'nodeB': 3, 'nodeC': 0 }
  // All total: 10

  // After further increments:
  // counterA: { 'nodeA': 7, 'nodeB': 3, 'nodeC': 0 } (no change for A)
  // counterB: { 'nodeA': 7, 'nodeB': 3+4=7, 'nodeC': 0 } (B's own count updated)
  // counterC: { 'nodeA': 7, 'nodeB': 3, 'nodeC': 0+1=1 } (C's own count updated)
  // Totals: A:10, B:14, C:11

  // After merge round 2:
  // Each node merges with the other two. The 'max' rule applies.
  // Final counts will be: nodeA: max(7,7,7)=7, nodeB: max(3,7,3)=7, nodeC: max(0,0,1)=1
  // Total: 7+7+1 = 15. This is correct.

}

// Uncomment to run example if this were a script
runGCounterExample();
