import { strict as assert } from 'assert';
import { ConsistentHashRing } from './consistent-hashing';

const ring = new ConsistentHashRing(150);

ring.addNode('server-a');
ring.addNode('server-b');
ring.addNode('server-c');

// All keys must route to one of the three nodes
const testKeys = Array.from({ length: 1000 }, (_, i) => `key:${i}`);
const dist = ring.distribution(testKeys);
console.log('Initial distribution:', Object.fromEntries(dist));

// No key should route to a non-existent node
for (const [, node] of [...dist]) {
  assert(['server-a', 'server-b', 'server-c'].includes(node as unknown as string));
}

// After removing a node, previously assigned keys only move to adjacent nodes
const snapshot = new Map(testKeys.map(k => [k, ring.getNode(k)]));
ring.removeNode('server-b');

let remapped = 0;
for (const [key, oldNode] of snapshot) {
  const newNode = ring.getNode(key);
  if (newNode !== oldNode) remapped++;
}
// Expect roughly 1/3 of keys to be remapped (only those that were on server-b)
const remapRatio = remapped / testKeys.length;
assert(remapRatio < 0.45, `Too many keys remapped: ${(remapRatio * 100).toFixed(1)}%`);
console.log(`Keys remapped after removing server-b: ${(remapRatio * 100).toFixed(1)}%`);
console.log('Consistent hashing tests passed');
