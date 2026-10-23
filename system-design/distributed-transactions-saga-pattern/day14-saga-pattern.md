## Day 14: The Saga Pattern - Embracing Eventual Consistency

Since 2PC is largely unsuitable for modern microservices, we need an alternative for managing distributed transactions that prioritizes availability and scalability. The **Saga pattern** is a common choice for achieving eventual consistency across multiple services.

### What is a Saga?

A Saga is a sequence of local transactions, where each local transaction updates data within a single service and publishes an event that triggers the next local transaction in the saga. If a local transaction fails, the saga executes a series of **compensation transactions** to undo the changes made by preceding successful local transactions.

Unlike 2PC, a Saga does *not* guarantee atomicity in the traditional sense. It guarantees that either all transactions complete successfully, or compensating transactions are run to reverse the effects of any completed transactions, leaving the system in a consistent state (though potentially different from the initial state before the saga started).

### Key Characteristics

*   **Eventual Consistency**: The system might be temporarily inconsistent during the execution of a saga, but it will eventually reach a consistent state.
*   **No Global Locks**: Services don't hold global locks, improving availability and throughput.
*   **Compensation**: Critical for handling failures. Each step must define a compensation action.
*   **Increased Complexity**: Managing the sequence, state, and compensation logic adds complexity compared to a single ACID transaction.

### Saga Orchestration vs. Choreography

There are two main ways to implement the Saga pattern:

1.  **Choreography (Event-Driven)**:
    *   Each service produces and consumes events. When a service completes its local transaction, it publishes an event. Other services listen to this event and start their own local transactions.
    *   **Pros**: Decoupled services, simple to implement for simple sagas.
    *   **Cons**: Can become difficult to trace and manage complex sagas, potential for circular dependencies, harder to define the overall flow.

2.  **Orchestration (Centralized)**:
    *   A dedicated **Saga Orchestrator** service is responsible for defining and executing the saga workflow. It sends commands to participant services, waits for their responses (events), and then decides the next step (or compensation step).
    *   **Pros**: Clear separation of concerns, easier to manage complex workflows, better visibility into the saga's state, easier to implement compensation logic.
    *   **Cons**: The orchestrator can become a single point of failure (though it's usually designed to be highly available and resilient), potential for tight coupling if not designed carefully.

### Example: Order Placement Saga (Orchestration)

Consider an order placement process:

1.  **Orchestrator** sends `CreateOrderCommand` to `OrderService`.
2.  `OrderService` creates order (pending), publishes `OrderCreatedEvent`.
3.  **Orchestrator** receives `OrderCreatedEvent`, sends `ReserveInventoryCommand` to `InventoryService`.
4.  `InventoryService` reserves items, publishes `InventoryReservedEvent`.
5.  **Orchestrator** receives `InventoryReservedEvent`, sends `ProcessPaymentCommand` to `PaymentService`.
6.  `PaymentService` processes payment, publishes `PaymentProcessedEvent`.
7.  **Orchestrator** receives `PaymentProcessedEvent`, sends `ConfirmOrderCommand` to `OrderService`.
8.  `OrderService` confirms order, publishes `OrderConfirmedEvent`.
9.  **Orchestrator** receives `OrderConfirmedEvent`, saga complete.

#### Compensation Scenario (Payment fails at step 6):

1.  **Orchestrator** sends `CreateOrderCommand` -> `OrderService` (`OrderCreatedEvent`).
2.  **Orchestrator** sends `ReserveInventoryCommand` -> `InventoryService` (`InventoryReservedEvent`).
3.  **Orchestrator** sends `ProcessPaymentCommand` -> `PaymentService`.
4.  `PaymentService` fails to process payment, publishes `PaymentFailedEvent`.
5.  **Orchestrator** receives `PaymentFailedEvent`.
6.  **Orchestrator** sends `CancelInventoryReservationCommand` to `InventoryService` (compensation for step 4).
7.  **Orchestrator** sends `CancelOrderCommand` to `OrderService` (compensation for step 2).
8.  Saga aborted, system consistent.

### Conclusion

The Saga pattern is powerful for distributed transactions in microservices, but it shifts complexity from transactional guarantees to application-level logic for managing state and compensation. Designing robust compensation transactions is crucial for its success.