import { strict as assert } from 'assert';

// Simulates CP vs AP behavior under a network partition
interface Node {
  id: string;
  data: Map<string, string>;
  isOnline: boolean;
}

class CPCluster {
  private nodes: Node[];
  private partitioned = false;

  constructor(nodeCount: number) {
    this.nodes = Array.from({ length: nodeCount }, (_, i) => ({
      id: `node-${i}`,
      data: new Map(),
      isOnline: true,
    }));
  }

  partition() {
    this.partitioned = true;
  }

  write(key: string, value: string): boolean {
    // CP: refuse writes during partition (quorum not reachable)
    if (this.partitioned) {
      console.log('[CP] Partition detected — write rejected to preserve consistency');
      return false;
    }
    this.nodes.forEach(n => n.data.set(key, value));
    return true;
  }

  read(key: string): string | undefined {
    if (this.partitioned) {
      throw new Error('[CP] Partition detected — read rejected');
    }
    return this.nodes[0].data.get(key);
  }
}

class APCluster {
  private nodes: Node[];
  private partitioned = false;

  constructor(nodeCount: number) {
    this.nodes = Array.from({ length: nodeCount }, (_, i) => ({
      id: `node-${i}`,
      data: new Map(),
      isOnline: true,
    }));
  }

  partition() {
    this.partitioned = true;
    // AP: disconnect node 1+ from node 0 (simulate split-brain)
    this.nodes.slice(1).forEach(n => (n.isOnline = false));
  }

  write(key: string, value: string): boolean {
    // AP: write to whichever nodes are reachable
    const reachable = this.nodes.filter(n => n.isOnline);
    reachable.forEach(n => n.data.set(key, value));
    console.log(`[AP] Wrote to ${reachable.length}/${this.nodes.length} nodes (partition-tolerant)`);
    return true; // always succeeds
  }

  read(key: string): string | undefined {
    // Return stale data from first available node
    return this.nodes[0].data.get(key);
  }
}

// Tests
const cp = new CPCluster(3);
cp.write('user:1', 'Alice');
assert.equal(cp.read('user:1'), 'Alice');

cp.partition();
assert.equal(cp.write('user:2', 'Bob'), false, 'CP must reject writes during partition');

const ap = new APCluster(3);
ap.write('user:1', 'Alice');
ap.partition();
assert.equal(ap.write('user:2', 'Bob'), true, 'AP must accept writes during partition');

console.log('CAP theorem simulation tests passed');
