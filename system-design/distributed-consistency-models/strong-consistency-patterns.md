# Day 28: Strong Consistency Patterns & Trade-offs

Building on our overview, let's dive into achieving strong consistency and why it's a beast in distributed systems.

## Linearizability (The Strongest)
*   **Definition:** The most intuitive and strongest form of consistency. It guarantees that operations appear to execute atomically and instantaneously at some point between their invocation and response, and in a total order consistent with the real-time order of operations.
*   **Analogy:** Imagine a single, non-distributed database. All operations happen one after another, and everyone sees the same state at the same time.
*   **Key Property:** If operation `A` completes before operation `B` begins (in real-time), then `A` must appear to happen before `B` in the system's history.
*   **How it's achieved:** Typically requires a single point of coordination or a consensus protocol (like Raft or Paxos) across a quorum of nodes for every write and sometimes for reads.
*   **Examples:** etcd, Zookeeper, Google Spanner (with TrueTime).
*   **Trade-offs:** High latency (due to coordination), reduced availability during partitions (must choose C over A). If the coordinator fails, the system might become unavailable until a new one is elected.

## Sequential Consistency
*   **Definition:** A weaker form of strong consistency than linearizability. It guarantees that all operations appear to execute in some sequential order, and all processes observe the same sequential order of operations. However, this order doesn't necessarily have to match the real-time order of operations.
*   **Analogy:** Imagine multiple people writing in separate notebooks, then periodically merging them. Everyone agrees on *an* order of events, but that order might not perfectly reflect who wrote what first in real-time.
*   **Key Property:** Operations from a *single client* must appear in program order. Different clients might see different interleavings, but *all* clients must agree on *one* global interleaving.
*   **How it's achieved:** Often via replicated state machines where all replicas process operations in the same order (e.g., through a message queue or a primary-backup setup).
*   **Trade-offs:** Less restrictive than linearizability, potentially better performance, but still complex to implement and manage.

## Practical Implications & When to Use
*   **Linearizability:** Critical for scenarios where strict ordering and data integrity are paramount:
    *   Financial transactions (e.g., bank balances)
    *   Leader election in distributed systems
    *   Configuration management (e.g., etcd for Kubernetes)
    *   Unique ID generation
*   **Sequential Consistency:** Suitable when the global order matters, but real-time ordering isn't strictly necessary:
    *   Many distributed database transactions (if not using linearizability)
    *   Replicated logs
*   **Eventual Consistency:** When high availability and low latency are prioritized over immediate data freshness:
    *   Social media feeds
    *   Shopping cart (temporarily inconsistent is acceptable)
    *   User profiles, cached data

## The Cost of Strong Consistency
Achieving strong consistency in a distributed system means:
1.  **More Coordination:** Every write often requires communication with a majority of nodes (a quorum) to ensure agreement. This adds network round trips.
2.  **Higher Latency:** Due to the coordination overhead.
3.  **Lower Availability:** During network partitions, if a quorum cannot be formed, the system must halt operations (choosing C over A).
4.  **Increased Complexity:** Implementing and maintaining consensus protocols is notoriously difficult and error-prone.

Next, we'll try to conceptualize a strongly consistent distributed counter to highlight some of these costs.
