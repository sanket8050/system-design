## Strong Consistency Patterns

Strong consistency models provide the strongest guarantees regarding data visibility and ordering. They simplify application logic by making a distributed system behave like a single, centralized system.

### 1. Linearizability (Atomic Consistency)

*   **Definition**: The strongest single-object consistency model. It guarantees that operations appear to execute instantaneously at some point between their invocation and response. If operation A completes before operation B begins, then A's effects must be visible to B.
*   **Analogy**: Like a single, global lock on the data. All operations happen in a total, global order, and any read operation returns the value written by the latest completed write operation.
*   **Pros**: Easiest for developers to reason about. Guarantees fresh data.
*   **Cons**: High latency due to coordination overhead (e.g., Paxos, Raft). Reduced availability during network partitions or node failures.
*   **Use Cases**: Critical financial transactions, unique ID generation, leader election, distributed locks.

### 2. Sequential Consistency

*   **Definition**: A weaker form of strong consistency than linearizability. It guarantees that the result of any execution is the same as if the operations of all processes were executed in some sequential order, and the operations of each individual process appear in this sequence in the order specified by its program.
*   **Key Difference from Linearizability**: Sequential consistency does not require that the global order of operations respects real-time ordering. An operation completing "before" another in real-time might appear to happen "after" it in the global sequential order, as long as each client's *own* operations are ordered correctly.
*   **Pros**: Simpler to implement than linearizability, potentially better performance.
*   **Cons**: Still complex to achieve in practice. Can be harder to reason about across different clients due to the lack of real-time ordering guarantee.
*   **Use Cases**: Less common for general-purpose databases, more for specific concurrent programming contexts.

### Implementation Notes:

Achieving strong consistency typically involves consensus protocols (like Paxos or Raft) to ensure all replicas agree on the order of operations and to commit writes atomically across a majority of nodes. This adds significant overhead and complexity.