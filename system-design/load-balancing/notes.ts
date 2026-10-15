// Load balancing algorithm implementations
// Used by: Nginx, HAProxy, AWS ALB, Envoy

export interface BackendServer {
  id: string;
  weight: number;
  activeConnections: number;
  isHealthy: boolean;
}

// Round Robin — simple cyclic distribution
export class RoundRobinBalancer {
  private index = 0;

  select(servers: BackendServer[]): BackendServer | null {
    const healthy = servers.filter(s => s.isHealthy);
    if (healthy.length === 0) return null;
    const server = healthy[this.index % healthy.length];
    this.index = (this.index + 1) % healthy.length;
    return server;
  }
}

// Weighted Round Robin — favours higher-capacity servers
export class WeightedRoundRobinBalancer {
  private currentWeights: Map<string, number> = new Map();

  select(servers: BackendServer[]): BackendServer | null {
    const healthy = servers.filter(s => s.isHealthy);
    if (healthy.length === 0) return null;

    for (const s of healthy) {
      this.currentWeights.set(s.id, (this.currentWeights.get(s.id) ?? 0) + s.weight);
    }

    let best: BackendServer | null = null;
    let bestWeight = -Infinity;
    for (const s of healthy) {
      const w = this.currentWeights.get(s.id) ?? 0;
      if (w > bestWeight) { bestWeight = w; best = s; }
    }

    if (best) {
      const totalWeight = healthy.reduce((sum, s) => sum + s.weight, 0);
      this.currentWeights.set(best.id, (this.currentWeights.get(best.id) ?? 0) - totalWeight);
    }
    return best;
  }
}

// Least Connections — routes to server with fewest active connections
export class LeastConnectionsBalancer {
  select(servers: BackendServer[]): BackendServer | null {
    const healthy = servers.filter(s => s.isHealthy);
    if (healthy.length === 0) return null;
    return healthy.reduce((min, s) => s.activeConnections < min.activeConnections ? s : min);
  }
}

// IP Hash — ensures same client always hits the same server (sticky sessions)
export class IpHashBalancer {
  private simpleHash(ip: string): number {
    return ip.split('.').reduce((acc, octet) => acc * 31 + parseInt(octet, 10), 0);
  }

  select(servers: BackendServer[], clientIp: string): BackendServer | null {
    const healthy = servers.filter(s => s.isHealthy);
    if (healthy.length === 0) return null;
    const index = Math.abs(this.simpleHash(clientIp)) % healthy.length;
    return healthy[index];
  }
}
