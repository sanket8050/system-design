# Day 31: Distributed Transactions - 2PC vs. Saga

Choosing between 2PC and Saga patterns depends heavily on your system's requirements, particularly regarding consistency guarantees, performance, and complexity tolerance.

## Comparison Matrix

| Feature             | Two-Phase Commit (2PC)                               | Saga Pattern                                         |
| :------------------ | :--------------------------------------------------- | :--------------------------------------------------- |
| **Consistency**     | **Strong (ACID)** across all participants.           | **Eventual Consistency**. Temporary inconsistencies possible. |
| **Atomicity**       | All or nothing.                                      | Achieved through compensating transactions.          |
| **Isolation**       | High (locks resources).                              | Low (local transactions commit independently).       |
| **Durability**      | High.                                                | High (each local transaction is durable).            |
| **Blocking**        | Yes, participants hold locks during the prepare phase. | No, non-blocking. Local transactions commit quickly. |
| **Performance**     | Lower throughput, higher latency (synchronous, network hops). | Higher throughput, lower latency (asynchronous, independent). |
| **Complexity**      | Protocol is complex to implement correctly, especially failure recovery. | Logic for compensating transactions and orchestrator/choreography can be complex. |
| **Failure Handling**| Coordinator failure is a major problem; can leave transactions in doubt. | Easier to recover from individual service failures; compensating transactions handle rollbacks. |
| **Coupling**        | Tightly coupled to the coordinator and protocol.     | Loosely coupled via events.                          |
| **Scalability**     | Poor, due to blocking and synchronous nature.        | Good, due to asynchronous and non-blocking nature.   |

## When to Use Which?

### Use 2PC When:
*   **Strong ACID consistency is absolutely critical** across a small number of tightly coupled services or databases that can participate in the protocol (e.g., within a single organization's data center where network reliability is high).
*   **The transaction scope is narrow** and involves resources that naturally support 2PC (e.g., XA transactions in enterprise application servers).
*   **You can tolerate the performance overhead and blocking.**

*Opinion:* In modern microservice architectures, 2PC is generally avoided due to its blocking nature and impact on availability and scalability. It's often a last resort for very specific, legacy, or tightly controlled scenarios.

### Use Saga Pattern When:
*   **Building highly distributed microservice architectures** where services have independent databases.
*   **Eventual consistency is acceptable** for business processes (most business processes can tolerate this).
*   **High availability and scalability are paramount.**
*   **You need to avoid blocking resources** across services.
*   **The transaction involves a long-running process** or many steps across multiple services.

*Opinion:* Saga is the go-to pattern for managing distributed transactions in microservices. The choice between Choreography and Orchestration depends on the complexity of the Saga and the need for centralized control/monitoring. Orchestration is often preferred for complex Sagas due to better visibility and maintainability.