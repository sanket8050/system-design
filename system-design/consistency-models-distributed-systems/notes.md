# Consistency Models in Distributed Systems

Understanding consistency models is crucial for building resilient and performant distributed systems. It's not just about "eventual vs strong"; there's a spectrum, and choosing the right model impacts system complexity, user experience, and operational overhead.

## The CAP Theorem (Briefly)

You can't have Consistency, Availability, and Partition Tolerance all at once. In a distributed system, partitions *will* happen. So, you're always choosing between Consistency (C) and Availability (A) when a partition occurs. This is why strict strong consistency is hard and often expensive.

## Strong Consistency

Ensures that every read operation returns the most recent write operation's result, or an error. If a write completes, all subsequent reads must see that write.

### Types:

1.  **Linearizability:** The strongest form. Operations appear to execute atomically and in a single, total order, respecting their real-time ordering. If operation A completes before operation B begins, then B must see the effects of A.
    *   **Pros:** Easiest for developers to reason about. Predictable behavior.
    *   **Cons:** High latency, low availability during partitions, complex to implement (e.g., distributed consensus protocols like Paxos/Raft).
    *   **Use Cases:** Banking transactions, leader election, critical state management.
    *   **Examples:** Distributed relational databases (with 2PC/3PC), Zookeeper, etcd.

2.  **Sequential Consistency:** Less strict than linearizability. Operations from a single client appear to execute in program order, and all operations (from all clients) appear to execute in *some* sequential order. The global order doesn't necessarily match real-time.
    *   **Pros:** Easier to implement than linearizability, still provides strong guarantees from a client's perspective.
    *   **Cons:** Can still be slow due to coordination.
    *   **Use Cases:** Often sufficient for many transactional systems where real-time order isn't strictly necessary across all clients, but individual client's operations must be ordered.

## Eventual Consistency (and its forms)

Guarantees that if no new writes occur on a given data item, eventually all reads will return the last written value. The system converges over time.

### Types (often layered to provide stronger guarantees):

1.  **Eventual Consistency (Base):** The core idea. Reads might return stale data for a period after a write.
    *   **Pros:** High availability, low latency, high scalability.
    *   **Cons:** Developers must handle stale reads. Complex to reason about if not managed.
    *   **Use Cases:** Social media feeds, DNS, IoT sensor data.
    *   **Examples:** Cassandra, DynamoDB (default for most operations), S3.

2.  **Read-your-writes consistency:** After a client performs a write, subsequent reads by *that same client* are guaranteed to see that write. Other clients might still see stale data.
    *   **How to achieve:** Route subsequent reads from the same client to the node that processed the write, or use a version token passed from write to read.
    *   **Use Cases:** User updating their profile and seeing the change immediately.

3.  **Monotonic reads consistency:** If a client reads a value, subsequent reads by *that same client* will never see an older version of the value. You don't "go backward" in time.
    *   **How to achieve:** Sticky sessions (always route to the same replica), or track the last read version and ensure subsequent reads are from a replica at least as up-to-date.
    *   **Use Cases:** Reading a news feed; you don't want to see articles disappear and reappear.

4.  **Causal consistency:** If process A causes process B, then process B must see the effects of A. This is a partial ordering, where causally related operations are seen in order by all clients, but concurrently unrelated operations might be seen in different orders.
    *   **How to achieve:** Version vectors (vector clocks) are commonly used to track causal dependencies.
    *   **Use Cases:** Collaborative editing, message boards where replies depend on previous messages.

## Practical Trade-offs & Engineering Choices

*   **Default to Eventual:** For most internet-scale applications, eventual consistency (with some stronger guarantees like read-your-writes) is the default choice due to scalability and availability needs.
*   **Strong for Critical Paths:** Use strong consistency only for parts of your system that genuinely require it (e.g., financial transactions, unique ID generation, critical state updates).
*   **Hybrid Approaches:** It's common to use different consistency models for different parts of an application (e.g., strong for user account balances, eventual for user profile data).
*   **Mitigation:** When using eventual consistency, design your system and UI to account for potential staleness. Inform users, use loading states, or implement specific stronger guarantees (like read-your-writes) when needed.

As engineers, we don't always implement these from scratch. We choose databases and services that offer these guarantees and understand their implications.
