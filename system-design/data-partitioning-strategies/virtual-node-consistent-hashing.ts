/**
 * virtual-node-consistent-hashing.ts
 *
 * An advanced implementation of Consistent Hashing using virtual nodes (vnodes).
 * This approach improves load distribution and minimizes data remapping when
 * nodes are added or removed from the system.
 */

import { createHash } from 'crypto'; // Node.js built-in crypto module for hashing

// Represents a physical node in the distributed system
interface PhysicalNode {
  id: string; // Unique identifier for the node (e.g., IP address, hostname)
}

class ConsistentHashRing {
  private ring: Map<number, string> = new Map(); // Hash -> Node ID
  private sortedHashes: number[] = []; // Sorted list of hash points on the ring
  private nodeMap: Map<string, PhysicalNode> = new Map(); // Node ID -> PhysicalNode object
  private numVirtualNodes: number;

  constructor(numVirtualNodes: number = 100) {
    if (numVirtualNodes <= 0) {
      throw new Error("Number of virtual nodes must be greater than 0.");
    }
    this.numVirtualNodes = numVirtualNodes;
  }

  /**
   * Generates a numeric hash for a given string.
   * Using SHA1 for better distribution than simple string hashing.
   */
  private hashKey(key: string): number {
    const hash = createHash('sha1').update(key).digest('hex');
    // Convert hex hash to a 32-bit integer for ring placement
    // Take the first 8 characters (32 bits) of the hex string
    return parseInt(hash.substring(0, 8), 16);
  }

  /**
   * Adds a physical node to the consistent hash ring with its virtual nodes.
   * @param node The physical node to add.
   */
  public addNode(node: PhysicalNode): void {
    if (this.nodeMap.has(node.id)) {
      console.warn(`Node ${node.id} already exists.`);
      return;
    }

    this.nodeMap.set(node.id, node);
    for (let i = 0; i < this.numVirtualNodes; i++) {
      const virtualNodeKey = `${node.id}-vnode-${i}`;
      const hash = this.hashKey(virtualNodeKey);
      this.ring.set(hash, node.id);
      this.sortedHashes.push(hash);
    }
    this.sortedHashes.sort((a, b) => a - b); // Keep the ring sorted
    console.log(`Added node: ${node.id} with ${this.numVirtualNodes} vnodes. Total vnodes: ${this.ring.size}`);
  }

  /**
   * Removes a physical node and its virtual nodes from the consistent hash ring.
   * @param nodeId The ID of the node to remove.
   */
  public removeNode(nodeId: string): void {
    if (!this.nodeMap.has(nodeId)) {
      console.warn(`Node ${nodeId} not found.`);
      return;
    }

    this.nodeMap.delete(nodeId);
    const hashesToRemove: number[] = [];
    this.ring.forEach((id, hash) => {
      if (id === nodeId) {
        hashesToRemove.push(hash);
      }
    });

    hashesToRemove.forEach(hash => this.ring.delete(hash));
    this.sortedHashes = this.sortedHashes.filter(hash => !hashesToRemove.includes(hash));
    console.log(`Removed node: ${nodeId}. Total vnodes: ${this.ring.size}`);
  }

  /**
   * Finds the physical node responsible for a given data key.
   * Traverses the hash ring clockwise from the key's hash.
   * @param dataKey The key to locate on the ring.
   * @returns The ID of the physical node responsible for the key, or undefined if no nodes are present.
   */
  public getNodeForKey(dataKey: string): string | undefined {
    if (this.ring.size === 0) {
      return undefined;
    }

    const keyHash = this.hashKey(dataKey);

    // Find the first virtual node (hash point) on the ring that is greater than or equal to the key's hash
    const index = this.binarySearch(this.sortedHashes, keyHash);
    const vnodeHash = this.sortedHashes[index % this.sortedHashes.length]; // Wrap around for the ring

    return this.ring.get(vnodeHash);
  }

  /**
   * Performs a binary search to find the index of the smallest element >= target.
   * If all elements are smaller, returns 0 (wraps around for the ring logic).
   */
  private binarySearch(arr: number[], target: number): number {
    let low = 0;
    let high = arr.length - 1;
    let result = 0; // Default to the first element (wraps around)

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (arr[mid] >= target) {
        result = mid;
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }
    return result;
  }

  /**
   * Example usage:
   */
  public static runExample() {
    console.log("\n--- Consistent Hashing with Virtual Nodes Example ---");
    const ring = new ConsistentHashRing(20); // 20 virtual nodes per physical node

    const nodeA: PhysicalNode = { id: "node-A" };
    const nodeB: PhysicalNode = { id: "node-B" };
    const nodeC: PhysicalNode = { id: "node-C" };

    ring.addNode(nodeA);
    ring.addNode(nodeB);
    ring.addNode(nodeC);

    const keys = ["user-1", "product-abc", "order-xyz", "user-2", "item-def", "cart-123", "invoice-456", "data-789"];

    console.log("\nInitial key distribution:");
    keys.forEach(key => {
      console.log(`Key "${key}" -> Node: ${ring.getNodeForKey(key)}`);
    });

    // Simulate adding a new node
    console.log("\n--- Adding Node D ---");
    const nodeD: PhysicalNode = { id: "node-D" };
    ring.addNode(nodeD);

    console.log("\nKey distribution after adding Node D:");
    keys.forEach(key => {
      console.log(`Key "${key}" -> Node: ${ring.getNodeForKey(key)}`);
    });
    // Observe that only a fraction of keys should have moved to Node D or other nodes.

    // Simulate removing a node
    console.log("\n--- Removing Node B ---");
    ring.removeNode(nodeB.id);

    console.log("\nKey distribution after removing Node B:");
    keys.forEach(key => {
      console.log(`Key "${key}" -> Node: ${ring.getNodeForKey(key)}`);
    });
    // Keys previously on Node B should now be distributed among the remaining nodes.
  }
}

// To run the example:
ConsistentHashRing.runExample();
