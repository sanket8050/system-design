# CAP Theorem

The CAP theorem states that a distributed system can only guarantee two of three properties simultaneously:

- **Consistency (C)** – Every read returns the most recent write or an error.
- **Availability (A)** – Every request receives a non-error response (not necessarily the most recent data).
- **Partition Tolerance (P)** – The system continues operating despite arbitrary message drops between nodes.

## Why Partition Tolerance Is Non-Negotiable

In any real-world distributed system, network partitions *will* happen. A dropped packet, a flaky switch, or a data-center failover can split nodes. Choosing to sacrifice P means choosing a single-node system, which is not "distributed" at all.

The real trade-off is **CP vs. AP**:

| System | Choice | Example |
|--------|--------|---------|
| HBase, Zookeeper | CP | Returns error during partition |
| Cassandra, DynamoDB | AP | Returns stale data during partition |
| PostgreSQL (single) | CA | Not partition-tolerant by design |

## Practical Implications

```
Scenario: Two nodes A and B get partitioned.
- CP system: A refuses writes → strong consistency preserved
- AP system: A accepts writes → eventual consistency, possible conflicts
```

## PACELC Extension

CAP only covers partition behaviour. PACELC extends this:

> If partitioned (P): choose A or C.
> Else (E): choose Latency (L) or Consistency (C).

DynamoDB is PA/EL — prefers availability and low latency over strong consistency everywhere.

## When to Choose What

- **Banking, ledgers, inventory** → CP (strong consistency is worth the latency)
- **Social feeds, caches, shopping carts** → AP (availability wins, eventual consistency is fine)
- **Collaborative editors** → AP with conflict resolution (CRDT/OT)
