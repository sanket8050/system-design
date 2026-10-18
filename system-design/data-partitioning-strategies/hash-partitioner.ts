/**
 * hash-partitioner.ts
 *
 * A basic hash-based partitioner for distributing data across a fixed number of nodes.
 * This is a simple modulo hash and does not account for node additions/removals gracefully.
 * For dynamic scaling, consistent hashing is preferred.
 */

class SimpleHashPartitioner<T> {
  private numPartitions: number;

  constructor(numPartitions: number) {
    if (numPartitions <= 0) {
      throw new Error("Number of partitions must be greater than 0.");
    }
    this.numPartitions = numPartitions;
  }

  /**
   * Determines the partition index for a given key.
   * Uses a simple string hash function (djb2) and then modulo arithmetic.
   * @param key The key to partition (e.g., user ID, product ID).
   * @returns The index of the partition where the key should reside.
   */
  public getPartitionIndex(key: T): number {
    const keyString = String(key); // Ensure key is a string for hashing
    let hash = 5381; // djb2 hash initial value
    for (let i = 0; i < keyString.length; i++) {
      hash = (hash * 33) ^ keyString.charCodeAt(i);
    }
    return Math.abs(hash % this.numPartitions);
  }

  /**
   * Example usage:
   */
  public static runExample() {
    console.log("--- Simple Hash Partitioner Example ---");
    const partitioner = new SimpleHashPartitioner<string>(5); // 5 partitions

    const keys = ["user-123", "product-abc", "order-xyz", "user-456", "product-def", "order-111", "user-789"];

    keys.forEach(key => {
      const partition = partitioner.getPartitionIndex(key);
      console.log(`Key: "${key}" -> Partition: ${partition}`);
    });

    // What happens if we add a node?
    // If numPartitions changes, almost all keys will map to new partitions,
    // requiring massive data rebalancing. This is the problem consistent hashing solves.
    console.log("\nNote: Adding/removing partitions with simple hashing causes complete remapping.");
  }
}

// To run the example:
SimpleHashPartitioner.runExample();
