## Distributed Transactions: The Hard Problem

Maintaining data consistency across multiple independent services or databases is a core challenge in distributed systems. This is what we call a **distributed transaction**.

### Why it's hard

Traditional ACID properties (Atomicity, Consistency, Isolation, Durability) are typically guaranteed by a single transactional resource manager (e.g., a relational database). In a microservices architecture, operations often span multiple services, each with its own database. Achieving atomicity across these boundaries is non-trivial.

*   **Partial Failures**: What happens if one service commits its part of the transaction but another fails before completing its own? Data becomes inconsistent.
*   **Network Latency**: Increased communication overhead between services.
*   **Concurrency**: Managing concurrent access to distributed resources.
*   **Heterogeneity**: Services might use different database technologies or data stores.

### The Need for Patterns

Directly extending single-database ACID guarantees to a distributed environment is usually impractical due to performance and availability concerns (think CAP theorem). Instead, we rely on specific patterns to manage consistency, often trading strong immediate consistency for eventual consistency and higher availability/scalability.

Today, we'll dive into two prominent patterns: **Two-Phase Commit (2PC)** and the **Saga Pattern**.