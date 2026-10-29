## Day 20: Event-Driven Architecture - Idempotency Basics

### What is Idempotency?

In the context of distributed systems and Event-Driven Architectures (EDA), an operation is **idempotent** if applying it multiple times yields the same result as applying it once. This is crucial because distributed systems inherently deal with network unreliability, retries, and "at-least-once" message delivery guarantees.

### Why is it Crucial?

1.  **At-Least-Once Delivery**: Message queues often guarantee that a message will be delivered at least once. This means a consumer might receive the same message multiple times (e.g., due to consumer crash after processing but before acknowledging, or network issues).
2.  **Retries**: Publishers or consumers might retry operations on failure. Without idempotency, a retry could lead to duplicate side effects (e.g., double charging a customer, creating duplicate records).
3.  **Network Partitions**: Temporary network issues can cause a service to not receive an acknowledgment, leading to retries.

### Impact of Non-Idempotent Operations

Consider an `OrderCreated` event:

*   **Non-Idempotent**: If processing this event means `INSERT INTO orders ...`, receiving it twice would create two identical orders.
*   **Idempotent**: If processing involves checking for an existing order with the same unique ID first, receiving it twice would only result in one order.

### Key Principle

Design your consumers and services such that any operation, when invoked multiple times with the same input, produces the same outcome and state changes as if it were invoked only once. This typically involves using a unique identifier associated with the operation or message.