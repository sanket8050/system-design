import { strict as assert } from 'assert';
import {
  RoundRobinBalancer,
  WeightedRoundRobinBalancer,
  LeastConnectionsBalancer,
  IpHashBalancer,
  BackendServer,
} from './load-balancing';

const servers: BackendServer[] = [
  { id: 'a', weight: 1, activeConnections: 5, isHealthy: true },
  { id: 'b', weight: 3, activeConnections: 2, isHealthy: true },
  { id: 'c', weight: 1, activeConnections: 8, isHealthy: false },
];

// Round Robin only picks healthy servers
const rr = new RoundRobinBalancer();
const rrResults = Array.from({ length: 4 }, () => rr.select(servers)!.id);
assert(rrResults.every(id => id !== 'c'), 'Round robin must skip unhealthy servers');

// Weighted Round Robin — server B (weight 3) should be picked more often
const wrr = new WeightedRoundRobinBalancer();
const wrrResults = Array.from({ length: 10 }, () => wrr.select(servers)!.id);
const bCount = wrrResults.filter(id => id === 'b').length;
assert(bCount > 3, `Weighted RR should favour server B, got ${bCount}/10`);

// Least Connections picks B (fewest connections = 2)
const lc = new LeastConnectionsBalancer();
assert.equal(lc.select(servers)!.id, 'b');

// IP Hash — same IP always routes to the same server
const ipHash = new IpHashBalancer();
const ip = '192.168.1.42';
const firstPick = ipHash.select(servers, ip)!.id;
for (let i = 0; i < 5; i++) {
  assert.equal(ipHash.select(servers, ip)!.id, firstPick, 'IP hash must be sticky');
}

console.log('All load balancing algorithm tests passed');
