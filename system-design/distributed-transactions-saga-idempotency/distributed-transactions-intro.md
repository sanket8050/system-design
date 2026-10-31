## Distributed Transactions: Challenges & Approaches

Handling transactions across multiple services in a microservices architecture is inherently complex. The traditional ACID properties (Atomicity, Consistency, Isolation, Durability) that relational databases provide for single-node transactions break down when operations span multiple independent services.

### The Problem with 2PC (Two-Phase Commit)

While 2PC offers strong consistency by ensuring all participants commit or abort, it comes with significant drawbacks in a distributed system:

1.  **Blocking:** Participants hold resources until all services agree, leading to high latency and potential deadlocks.
2.  **Single Point of Failure:** The coordinator is a SPOF. If it fails, transactions can be left in an uncertain state.
3.  **Performance Overhead:** High network overhead due to multiple rounds of communication.
4.  **Tight Coupling:** Services need to be aware of the 2PC protocol and coordinate closely, which goes against microservices' autonomy principles.

For these reasons, 2PC is generally avoided in modern, highly scalable microservices architectures.

### Introducing the Saga Pattern

The Saga pattern is an alternative to 2PC for managing distributed transactions. It provides *eventual consistency* by breaking a long-running transaction into a sequence of local transactions, each updating its own service's database.

If any local transaction fails, the Saga executes a series of *compensating transactions* to undo the preceding successful local transactions. This ensures data consistency without blocking resources across services.

Sagas are suitable for scenarios where a temporary inconsistency is acceptable, and eventual consistency is sufficient. We'll dive deeper into Saga orchestration, choreography, and idempotency in subsequent notes.