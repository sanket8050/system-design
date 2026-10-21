### Day 12: Consistency Models in Distributed Systems

Today's deep dive is into the critical world of consistency models in distributed systems. This is fundamental to understanding how data behaves across multiple nodes and what guarantees applications can expect.

#### 1. CAP Theorem Refresher

Before diving into consistency models, a quick recap of the CAP theorem is essential. In a distributed data store, you can only pick two of the following three guarantees:

*   **Consistency (C):** All clients see the same data at the same time, regardless of which node they connect to. After a write, any subsequent read must return that write or a more recent write.
*   **Availability (A):** Every request receives a response, without guarantee that it contains the most recent version of the information.
*   **Partition Tolerance (P):** The system continues to operate despite arbitrary message loss or failure of parts of the system (network partitions).

In real-world distributed systems, **Partition Tolerance (P)** is a given. Network failures *will* happen. This means you are always forced to choose between **Consistency (C)** and **Availability (A)** during a network partition.

#### 2. System Consistency vs. Data Consistency

It's important to distinguish:

*   **System Consistency:** Refers to the behavior of a distributed system as a whole, specifically how updates are propagated and observed across nodes. This is what we're focusing on.
*   **Data Consistency:** Often refers to ACID properties (Atomicity, Consistency, Isolation, Durability) in a single database context, ensuring data integrity within a transaction. While related, system consistency deals with the *observability* of state changes across distributed components.

#### 3. Types of Consistency Models

Consistency models broadly fall into two categories:

##### a. Strong Consistency

These models provide the strongest guarantees, making a distributed system behave as if it were a single, non-distributed system. All observers see operations in the same order, and reads always return the most recent write. This comes at a cost (performance, availability during partitions).

*   **Linearizability:** The strongest guarantee. Operations appear to execute instantaneously and atomically in some global order. A read operation will always return the value of the most recent successful write operation.
*   **Sequential Consistency:** A slightly weaker form. Operations are not necessarily ordered by real-time, but all processes see all operations in the same sequential order. Operations from a single process appear in program order.

##### b. Weak / Eventual Consistency

These models relax the strong consistency guarantees to achieve higher availability and partition tolerance. Updates might not be immediately visible to all clients, but they *eventually* propagate throughout the system.

*   **Eventual Consistency:** The most common weak model. If no new updates are made to a given data item, eventually all accesses to that item will return the last updated value. There's no guarantee on *when* "eventually" is.
*   **Read-your-writes:** A client that performs a write operation is guaranteed to see that write (or a more recent one) in subsequent reads.
*   **Monotonic Reads:** If a client performs a read operation, any subsequent read operations by *that same client* will never see an older version of the data than the one it previously read.
*   **Causal Consistency:** If process A causes process B, then process B's writes must be seen after process A's writes. Operations that are causally related are seen in the same order by all processes.

#### 4. Trade-offs

Choosing a consistency model involves significant trade-offs:

*   **Performance:** Strong consistency often requires more coordination (e.g., distributed locks, consensus protocols), leading to higher latency and lower throughput.
*   **Complexity:** Implementing and managing strongly consistent systems is inherently more complex.
*   **Availability/Partition Tolerance:** Strong consistency often means sacrificing availability during network partitions (CP systems). Weak consistency prioritizes availability (AP systems).
*   **Data Staleness:** Weakly consistent systems inherently allow for temporary data staleness, which applications must be designed to tolerate.

Understanding these models is crucial for designing resilient and performant distributed applications. Next, we'll simulate an eventually consistent scenario.