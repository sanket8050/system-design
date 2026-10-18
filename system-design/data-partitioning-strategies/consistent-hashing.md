# Consistent Hashing for Dynamic Scaling

The simple modulo hashing approach breaks down when nodes are added or removed, leading to a "cache stampede" or massive data migration. Consistent Hashing is designed to minimize this data movement.

## How it Works
1.  **Hash Ring:** Both data keys and server nodes are hashed onto the same conceptual "ring" (a circular hash space, e.g., 0 to 2^32-1).
2.  **Key Mapping:** To find a key's server, you traverse the ring clockwise from the key's hash value until you hit the first server node. That's the key's assigned server.
3.  **Node Addition/Removal:**
    -   **Add Node:** Only keys between the new node and the next node clockwise are remapped.
    -   **Remove Node:** Only keys on the removed node are remapped to the next node clockwise.
    -   This significantly reduces the number of affected keys (typically 1/N where N is the number of nodes) compared to simple hashing (all keys affected).

## Problem: Uneven Distribution (Hotspots)
If nodes are not evenly distributed on the hash ring, some nodes might receive a disproportionately large number of keys, leading to hotspots.

## Solution: Virtual Nodes (Vnodes)
-   Instead of mapping each physical server to a single point on the ring, map it to multiple points (virtual nodes).
-   Each physical server is responsible for multiple virtual nodes.
-   This improves distribution and load balancing. When a server is added/removed, its virtual nodes are added/removed, spreading the impact more evenly across the ring.
-   Example: A server `S1` might have virtual nodes `S1-v1`, `S1-v2`, `S1-v3` on the ring.

## Use Cases
-   **Distributed Caches:** Memcached, Redis Cluster.
-   **Distributed Databases:** Cassandra, DynamoDB.
-   **Load Balancers:** Distributing requests to backend servers.

## Implementation Considerations
-   **Hash Function:** Needs to be robust and generate a uniform distribution.
-   **Ring Management:** Efficiently adding/removing nodes and finding the next node on the ring (often using a sorted list or balanced tree).
-   **Replication:** Consistent hashing typically determines the primary location, but replication strategies are needed for fault tolerance.

Consistent hashing is a fundamental primitive for building resilient, horizontally scalable distributed systems.
