# Day 36: Saga Pattern for Distributed Transactions

In microservices, managing transactions across multiple services (each with its own database) is hard. Traditional ACID transactions don't span service boundaries. The **Saga Pattern** is a way to manage long-lived, distributed transactions by breaking them down into a sequence of local transactions.

Each local transaction updates its own database and publishes an event. If a local transaction fails, the Saga executes **compensating transactions** to undo the changes made by previous successful transactions. This ensures eventual consistency.

## Key Concepts

*   **Local Transaction:** An atomic operation within a single service, updating its own database.
*   **Compensating Transaction:** An operation that undoes the effects of a previous successful local transaction. It doesn't necessarily revert state, but rather creates a new state that semantically reverses the original.
*   **Saga:** A sequence of local transactions, each updating its own database and publishing an event to trigger the next local transaction.

## Saga Orchestration vs. Choreography

There are two main ways to coordinate a Saga:

### 1. Choreography (Decentralized)

*   Each service produces and listens to events, deciding for itself whether to perform its local transaction and publish the next event.
*   **Pros:** Simpler to implement for small Sagas, less central point of failure.
*   **Cons:** Can be hard to understand the overall flow, difficult to manage complex Sagas (dependencies, error handling), risk of circular dependencies. Debugging is challenging.

### 2. Orchestration (Centralized)

*   A dedicated **Saga Orchestrator** service manages the entire transaction flow. It sends commands to participant services and subscribes to their events to determine the next step.
*   **Pros:** Clear separation of concerns, easier to understand and manage complex workflows, easier to implement compensating transactions and error handling.
*   **Cons:** Orchestrator becomes a central point of failure (though can be made highly available), potential for bottleneck if not designed carefully.

**Opinion:** For non-trivial Sagas (3+ steps), I lean towards Orchestration. The explicit flow control and error handling capabilities outweigh the single point of failure concern, which can be mitigated with robust deployment strategies. Choreography often leads to "event spaghetti" in complex scenarios.

## Example Workflow (Orchestration)

1.  **Order Service** receives `CreateOrder` request.
2.  **Order Service** starts `CreateOrderSaga` via **Saga Orchestrator**.
3.  **Orchestrator** sends `ReserveCreditCommand` to **Customer Service**.
4.  **Customer Service** reserves credit, publishes `CreditReservedEvent`.
5.  **Orchestrator** receives `CreditReservedEvent`, sends `ProcessPaymentCommand` to **Payment Service**.
6.  **Payment Service** processes payment, publishes `PaymentProcessedEvent`.
7.  **Orchestrator** receives `PaymentProcessedEvent`, sends `UpdateOrderStatusCommand` to **Order Service**.
8.  **Order Service** updates status to `Approved`, publishes `OrderApprovedEvent`.
9.  **Orchestrator** receives `OrderApprovedEvent`, marks Saga as complete.

### Failure Scenario (Customer Service fails to reserve credit)

1.  ... (steps 1-3)
2.  **Customer Service** fails to reserve credit, publishes `CreditReservationFailedEvent`.
3.  **Orchestrator** receives `CreditReservationFailedEvent`, starts compensation.
4.  **Orchestrator** sends `RejectOrderCommand` to **Order Service** (compensating transaction).
5.  **Order Service** marks order as `Rejected`, publishes `OrderRejectedEvent`.
6.  **Orchestrator** receives `OrderRejectedEvent`, marks Saga as complete (failed).

The key is that each service performs its local transaction and communicates its outcome via events. The orchestrator coordinates these events and issues compensating actions when necessary.