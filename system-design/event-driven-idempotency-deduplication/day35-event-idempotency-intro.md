## Day 35: Idempotency in Distributed Systems

Idempotency is a fundamental concept in distributed system design, especially within event-driven architectures (EDA). An operation is *idempotent* if executing it multiple times has the same effect as executing it once.

### Why it Matters

In distributed systems, failures are inevitable. Network issues, service crashes, timeouts, and message broker retries mean that an operation might be executed, or a message delivered, multiple times. Without idempotency, these retries can lead to incorrect states or duplicate actions (e.g., charging a customer twice, creating duplicate orders).

**Common Scenarios Requiring Idempotency:**

1.  **Network Timeouts/Retries:** A client sends a request, doesn't receive a response, and retries. The original request might have succeeded, but the response was lost.
2.  **Message Broker Redelivery:** Message queues (Kafka, RabbitMQ, SQS) guarantee at-least-once delivery. If a consumer fails after processing but *before* acknowledging a message, the message will be redelivered.
3.  **Client-Side Retries:** Applications often have retry logic built in (e.g., `axios-retry`).

### Idempotency vs. Atomicity

*   **Atomicity:** An operation either completes entirely or not at all. It's indivisible. Often achieved with transactions.
*   **Idempotency:** An operation can be executed multiple times without changing the final state beyond the first execution. It's about the *effect* of the operation.

An atomic operation doesn't automatically mean it's idempotent. For example, `UPDATE balance SET balance = balance + 100 WHERE id = 'user123'` is atomic, but not idempotent if retried (it would add 100 multiple times). An idempotent version would be `UPDATE balance SET balance = 200 WHERE id = 'user123' AND balance = 100` (if `balance` was 100 to start) or, more practically, using a unique transaction ID to ensure the *business effect* happens only once.