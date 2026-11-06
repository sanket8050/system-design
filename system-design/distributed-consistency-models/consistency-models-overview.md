# Day 28: Distributed System Consistency Models

Today we're diving into consistency models, a core challenge in distributed systems. It's easy to get lost in the jargon, but the fundamental trade-offs are crucial for designing robust services.

## The CAP Theorem (Quick Recap)
You know this: **Consistency**, **Availability**, **Partition Tolerance**. In a distributed system, you can pick at most two.
*   **Consistency (C):** All nodes see the same data at the same time. A read always returns the most recent write.
*   **Availability (A):** Every request receives a response, without guarantee that it contains the most recent version of the information.
*   **Partition Tolerance (P):** The system continues to operate despite arbitrary message loss or failure of parts of the system.

In reality, network partitions *will* happen. So, distributed systems *must* be Partition Tolerant (P). This means we're left choosing between C and A during a partition.

## Why Consistency is Hard
*   **Network Latency:** Updates take time to propagate across nodes.
*   **Node Failures:** Nodes can crash, leading to data inconsistencies if not handled.
*   **Concurrency:** Multiple clients updating the same data simultaneously.

## Types of Consistency
We broadly categorize consistency models into two camps:

### 1. Strong Consistency
*   **Definition:** After a write operation completes, any subsequent read operation is guaranteed to return that write's value (or a more recent value). It's like working with a single, non-distributed database.
*   **Examples:** Linearizability, Sequential Consistency.
*   **Pros:** Simpler mental model for developers, strong data integrity guarantees.
*   **Cons:** Higher latency, lower availability during partitions, complex to implement (often requires consensus protocols like Raft/Paxos).

### 2. Eventual Consistency
*   **Definition:** If no new updates are made to a given data item, eventually all reads of that item will return the last updated value. There's a period where different nodes might show different values.
*   **Examples:** DynamoDB, Cassandra, S3 (some operations).
*   **Pros:** High availability, low latency, scales well.
*   **Cons:** Developers need to handle potential stale reads, conflict resolution strategies are required.

Next, we'll look at a simple simulation of eventual consistency to grasp the implications.
