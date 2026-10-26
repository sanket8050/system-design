## Two-Phase Commit (2PC)

2PC is a **blocking** atomic commitment protocol used to ensure all participants in a distributed transaction either commit or abort the transaction. It's designed to provide **strong consistency**.

### How it works

2PC involves a **coordinator** (or transaction manager) and multiple **participants** (resource managers, e.g., databases or services).

**Phase 1: Prepare Phase (Voting Phase)**

1.  **Coordinator sends `prepare`**: The coordinator sends a `prepare` message to all participants, indicating the start of a distributed transaction.
2.  **Participants execute and vote**: Each participant executes the transaction locally up to the point of committing. It acquires all necessary locks and logs the transaction's actions to stable storage (e.g., a write-ahead log). It then replies with either:
    *   `VOTE_COMMIT`: "I'm ready to commit, and I guarantee I can commit if asked."
    *   `VOTE_ABORT`: "I cannot commit this transaction."

**Phase 2: Commit Phase (Decision Phase)**

1.  **Coordinator collects votes**: The coordinator waits for all participants to respond.
2.  **Decision**: 
    *   If **all** participants voted `VOTE_COMMIT`, the coordinator sends a `GLOBAL_COMMIT` message to all participants.
    *   If **any** participant voted `VOTE_ABORT` (or if a timeout occurs), the coordinator sends a `GLOBAL_ABORT` message to all participants.
3.  **Participants finalize**: Each participant receives the global decision:
    *   If `GLOBAL_COMMIT`, the participant commits its local transaction and releases resources/locks.
    *   If `GLOBAL_ABORT`, the participant rolls back its local transaction and releases resources/locks.
4.  **Acknowledgment**: Participants send an acknowledgment to the coordinator.

### Pros

*   **Atomic Consistency**: Guarantees all or nothing. If the coordinator commits, all participants commit.
*   **Simpler Logic**: Conceptually easier to understand than eventual consistency models.

### Cons

*   **Blocking**: Participants hold locks on resources during both phases. If the coordinator fails *after* participants have prepared but *before* sending the global decision, participants remain blocked indefinitely, holding locks. This is the **"coordinator single point of failure"** problem.
*   **Performance Bottleneck**: High latency due to multiple network round trips and synchronous blocking operations.
*   **Scalability Issues**: Not well-suited for highly distributed, high-throughput microservices due to blocking nature and overhead.
*   **Heterogeneous Systems**: Difficult to implement across different technologies (e.g., a relational DB and a NoSQL DB) unless they specifically support XA transactions.

### When to use?

Typically found in traditional distributed database systems or enterprise application servers (like JBoss, WebSphere) that provide XA transaction support. Less common in modern, cloud-native microservices architectures due to its blocking nature and performance implications. For microservices, the Saga pattern is generally preferred.