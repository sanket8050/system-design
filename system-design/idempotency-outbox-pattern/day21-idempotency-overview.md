## Day 21: Idempotency in Distributed Systems

### Why Idempotency?

In distributed systems, network failures, timeouts, and retries are a given. When a client makes a request, it might not receive a response, leading it to retry the same operation. Without idempotency, this can cause unintended side effects like duplicate orders, multiple payment charges, or inconsistent state.

An operation is **idempotent** if applying it multiple times produces the same result as applying it once. It's about the *effect* on the system state, not necessarily the *response* returned.

### Common Scenarios Requiring Idempotency:

1.  **Payment Processing**: Charging a customer multiple times for a single purchase is unacceptable.
2.  **Order Creation**: Preventing duplicate orders when a user clicks 'submit' multiple times or a network retry occurs.
3.  **Message Processing**: Consumers of message queues (Kafka, RabbitMQ) often operate with "at-least-once" delivery semantics. This means a message might be delivered and processed more than once. The consumer *must* be idempotent.
4.  **API Retries**: Any client-side retry logic benefits from idempotent server endpoints.

### Strategies for Achieving Idempotency:

1.  **Unique Request IDs**: The most common approach for API endpoints. The client generates a unique `Idempotency-Key` (UUID) and sends it with the request. The server stores this key along with the request's outcome. If the same key is received again, the server returns the previously stored result without re-executing the operation.
    *   **Pros**: Simple to implement, effective for many scenarios.
    *   **Cons**: Requires a durable store for keys and results, needs expiry/cleanup strategy.

2.  **State Checks**: Before performing an action, check the current state of the resource. If the action has already been applied (or would lead to the same state), skip it. Example: `PUT /resource/{id}` is inherently idempotent if the client sends the *full* desired state.

3.  **Transactional Logic**: Ensure that the entire operation (including side effects) is wrapped in a transaction. If any part fails, the whole operation rolls back. This doesn't directly solve idempotency for retries but helps with consistency.

4.  **Version Numbers / Optimistic Locking**: For updates, include a version number. Only apply the update if the current version matches the expected version. If a retry comes in with an old version, it's rejected.

### Key Takeaway:

Assume network unreliability. Design your services, especially those with side effects, to be idempotent. It's a fundamental property for building robust distributed systems.