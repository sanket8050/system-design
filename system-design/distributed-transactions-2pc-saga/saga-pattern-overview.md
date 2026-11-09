# Day 31: Distributed Transactions - Saga Pattern

## Limitations of Two-Phase Commit (2PC)
While 2PC provides strong consistency, it comes with significant drawbacks, especially in modern microservice architectures:

1.  **Blocking:** Participants hold locks on resources for the entire duration of the transaction, leading to reduced throughput and availability.
2.  **Single Point of Failure:** The coordinator is a critical component. If it fails, transactions can be left in an uncertain state (indefinite blocking).
3.  **Performance:** High latency due to multiple network round trips and synchronous coordination.
4.  **Tight Coupling:** Services become tightly coupled to the 2PC protocol and the coordinator.

For these reasons, 2PC is generally avoided in favor of more loosely coupled, eventually consistent patterns in microservices.

## Introducing the Saga Pattern
The Saga pattern is a way to manage distributed transactions that don't require ACID properties across services, instead focusing on eventual consistency. A Saga is a sequence of local transactions, where each local transaction updates data within a single service and publishes an event to trigger the next step in the Saga.

### Key Concepts
*   **Local Transaction:** An atomic operation within a single service.
*   **Compensating Transaction:** An operation that undoes the changes made by a preceding local transaction. If a step in the Saga fails, compensating transactions are executed to revert the system to a consistent state (or as close as possible).
*   **Eventual Consistency:** The system will eventually reach a consistent state, but there might be temporary inconsistencies during the execution of a Saga.

### Types of Sagas
There are two main ways to implement the Saga pattern:

1.  **Choreography:** Each service produces and listens to events, deciding for itself if and when to execute its local transaction. It's decentralized, simpler for small Sagas, but harder to monitor and debug as Sagas grow complex.
2.  **Orchestration:** A dedicated orchestrator service manages the entire Saga. It tells each participant service what local transaction to execute. This centralizes the Saga logic, making it easier to monitor, debug, and manage complex workflows, but introduces a potential single point of failure (though less severe than 2PC's coordinator).

Next, we'll explore an example of an Orchestrated Saga.