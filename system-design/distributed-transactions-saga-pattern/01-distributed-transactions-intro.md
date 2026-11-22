## Distributed Transactions: Why it's Hard

Maintaining data consistency across multiple independent services or databases is a fundamental challenge in microservices architectures. This is the problem of distributed transactions.

### The Problem

Consider an e-commerce order: it involves deducting money from a customer's account (Payment Service), reserving items (Inventory Service), and updating order status (Order Service). All these operations must either succeed together or fail together.

### Traditional Approach: Two-Phase Commit (2PC)

Historically, `Two-Phase Commit (2PC)` was the go-to solution for distributed transactions in monolithic architectures. It involves a coordinator and multiple participants:

1.  **Prepare Phase:** The coordinator asks all participants to prepare to commit. Participants execute the transaction locally and log their intention to commit (but don't actually commit).
2.  **Commit Phase:** If all participants respond positively, the coordinator instructs them to commit. If any participant fails or responds negatively, the coordinator instructs all to rollback.

### Limitations of 2PC in Microservices

While 2PC ensures Atomicity, Consistency, Isolation, and Durability (ACID), it has severe drawbacks in a distributed, high-throughput microservices environment:

*   **Blocking:** Participants hold resources (locks) for the entire duration of the transaction, leading to potential deadlocks and reduced concurrency.
*   **Single Point of Failure:** The coordinator is a critical bottleneck. If it fails during the commit phase, participants might be left in an uncertain state.
*   **Performance Overhead:** Network latency and coordination messages add significant overhead.
*   **Heterogeneity:** It's difficult to implement 2PC across different database technologies or services that don't natively support it.
*   **Scalability:** The centralized nature of the coordinator limits horizontal scalability.

These limitations make 2PC largely unsuitable for modern, highly distributed systems. We need alternative patterns that embrace eventual consistency and compensate for failures, rather than attempting global ACID transactions. This is where patterns like the **Saga Pattern** come into play.