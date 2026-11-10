import * as crypto from 'crypto';

// Consistent hashing ring with virtual nodes
// Used in: Cassandra, DynamoDB, Memcached, CDN routing

interface RingNode {
  id: string;
  virtualKey: number; // position on ring [0, 2^32)
}

export class ConsistentHashRing {
  private ring: RingNode[] = [];
  private nodeMap = new Map<string, string[]>(); // nodeName -> virtualKeys
  private readonly virtualNodeCount: number;

  constructor(virtualNodes = 150) {
    this.virtualNodeCount = virtualNodes;
  }

  private hash(key: string): number {
    const buf = crypto.createHash('md5').update(key).digest();
    return buf.readUInt32BE(0);
  }

  addNode(name: string): void {
    const virtualKeys: string[] = [];
    for (let i = 0; i < this.virtualNodeCount; i++) {
      const virtualKey = `${name}:vn${i}`;
      virtualKeys.push(virtualKey);
      this.ring.push({ id: name, virtualKey: this.hash(virtualKey) });
    }
    this.nodeMap.set(name, virtualKeys);
    this.ring.sort((a, b) => a.virtualKey - b.virtualKey);
  }

  removeNode(name: string): void {
    const keys = this.nodeMap.get(name) || [];
    const keySet = new Set(keys.map(k => this.hash(k)));
    this.ring = this.ring.filter(n => !keySet.has(n.virtualKey));
    this.nodeMap.delete(name);
  }

  getNode(key: string): string | null {
    if (this.ring.length === 0) return null;
    const h = this.hash(key);
    // Binary search for first node with virtualKey >= h
    let lo = 0, hi = this.ring.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.ring[mid].virtualKey < h) lo = mid + 1;
      else hi = mid;
    }
    // Wrap around if h is past the last node
    if (this.ring[lo].virtualKey < h) lo = 0;
    return this.ring[lo].id;
  }

  // Returns the distribution of keys across nodes
  distribution(sampleKeys: string[]): Map<string, number> {
    const counts = new Map<string, number>();
    for (const key of sampleKeys) {
      const node = this.getNode(key) ?? 'none';
      counts.set(node, (counts.get(node) ?? 0) + 1);
    }
    return counts;
  }
}
