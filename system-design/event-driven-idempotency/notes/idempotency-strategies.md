# Idempotency Strategies

Implementing idempotency requires a mechanism to track processed operations. Here are common strategies:

## 1. Deduplication Table (Idempotency Store)

This is the most common and robust approach. A dedicated storage (e.g., a database table, Redis) is used to store idempotency keys along with the outcome of the operation.

### Workflow:
1.  **Receive Request/Event**: An API endpoint or event consumer receives an operation with an `idempotencyKey`.
2.  **Check Store**: Query the idempotency store using the `idempotencyKey`.
    *   **If found and status is `completed`**: Return the stored result immediately. No re-execution.
    *   **If found and status is `pending`**: This indicates a concurrent request or a previous retry that's still in progress. Depending on the use case, you might:
        *   Wait and retry (e.g., using a lock or a short delay).
        *   Return a `409 Conflict` (for APIs) or log and drop (for events) if concurrent processing isn't desired.
    *   **If not found**: This is a new operation.
3.  **Record Pending State**: Insert the `idempotencyKey` into the store with a `pending` status. This must be done atomically with the subsequent business logic or within a transaction.
4.  **Execute Business Logic**: Perform the actual operation (e.g., charge customer, update order status).
5.  **Record Completion/Failure**: Update the `idempotencyKey`'s status in the store to `completed` (along with the result) or `failed` (with error details).

### Advantages:
-   Highly reliable, handles concurrent requests well.
-   Provides a clear audit trail of processed operations.

### Disadvantages:
-   Requires an additional storage lookup for every idempotent operation.
-   Need a cleanup strategy for old keys (TTL).

## 2. State-Based Idempotency (Optimistic Locking)

Applicable when the operation itself involves updating a specific resource, and the resource's state can be used to determine if the operation has already been applied.

### Example:
If an event says "set order status to SHIPPED", and the order is already `SHIPPED`, then applying the event again is idempotent without explicit key tracking. This often involves checking the current state and only proceeding if it's in an expected prior state.

### Advantages:
-   Simpler for certain operations, no separate idempotency store needed.

### Disadvantages:
-   Limited applicability; only works if the operation's effect is naturally idempotent based on state.
-   Doesn't prevent all types of duplicate side effects (e.g., sending multiple emails).

## 3. Unique Constraints in Database

Leverage database unique constraints. If an operation creates a record, and you include the `idempotencyKey` (or a derived unique identifier) as part of a unique index, subsequent attempts to insert the same record will fail at the database level.

### Advantages:
-   Database handles concurrency and uniqueness guarantees.
-   Very efficient for insert-heavy idempotent operations.

### Disadvantages:
-   Primarily useful for `CREATE` operations, less so for `UPDATE`.
-   Error handling needs to differentiate between actual business errors and idempotency violations.

For most general-purpose idempotent operations, especially in event consumers or public APIs, the **Deduplication Table** strategy is the most flexible and robust.