/**
 * range-partitioner.ts
 *
 * A simple range-based partitioner for distributing data.
 * This strategy assigns data to partitions based on a contiguous range of values for the partitioning key.
 * It's straightforward but can suffer from hotspots if data distribution isn't uniform or if ranges are poorly chosen.
 */

interface RangePartitionConfig {
  partitionId: number;
  startKey: number; // Inclusive
  endKey: number;   // Exclusive
}

class RangePartitioner {
  private partitions: RangePartitionConfig[];

  constructor(partitionConfigs: RangePartitionConfig[]) {
    // Sort partitions by startKey for efficient lookup and validation
    this.partitions = [...partitionConfigs].sort((a, b) => a.startKey - b.startKey);

    // Basic validation for overlapping or gaps (can be more robust)
    for (let i = 0; i < this.partitions.length - 1; i++) {
      if (this.partitions[i].endKey > this.partitions[i + 1].startKey) {
        console.warn(`Warning: Overlapping ranges detected between partition ${this.partitions[i].partitionId} and ${this.partitions[i+1].partitionId}`);
      }
      if (this.partitions[i].endKey < this.partitions[i + 1].startKey) {
        console.warn(`Warning: Gap detected between partition ${this.partitions[i].partitionId} and ${this.partitions[i+1].partitionId}`);
      }
    }
  }

  /**
   * Determines the partition ID for a given numeric key.
   * @param key The numeric key to partition (e.g., timestamp, numerical ID).
   * @returns The partition ID, or -1 if no partition matches the key.
   */
  public getPartitionId(key: number): number {
    for (const partition of this.partitions) {
      if (key >= partition.startKey && key < partition.endKey) {
        return partition.partitionId;
      }
    }
    return -1; // Key does not fall into any defined range
  }

  /**
   * Example usage:
   */
  public static runExample() {
    console.log("\n--- Range Partitioner Example ---");
    const partitionConfigs: RangePartitionConfig[] = [
      { partitionId: 0, startKey: 0, endKey: 100 },
      { partitionId: 1, startKey: 100, endKey: 200 },
      { partitionId: 2, startKey: 200, endKey: 300 },
      { partitionId: 3, startKey: 300, endKey: 400 },
    ];

    const partitioner = new RangePartitioner(partitionConfigs);

    const keys = [50, 150, 250, 350, 99, 100, 200, 299, 300, 399, -10, 450];

    keys.forEach(key => {
      const partition = partitioner.getPartitionId(key);
      console.log(`Key: ${key} -> Partition: ${partition === -1 ? "N/A" : partition}`);
    });

    console.log("\nNote: Range partitioning is prone to hotspots if certain ranges receive more data/traffic.");
  }
}

// To run the example:
RangePartitioner.runExample();
