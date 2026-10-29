## Day 20: Event-Driven Architecture - Idempotency Strategies

Achieving idempotency often involves a combination of techniques. Here are common strategies:

### 1. Idempotency Key (Request ID)

*   **Concept**: The client/producer generates a unique key (e.g., a UUID) for each logical request and includes it in the message/API call header or payload. The server/consumer then uses this key to check if the operation has already been processed.
*   **Implementation**: Store processed idempotency keys (e.g., in a database table `processed_events` or a distributed cache like Redis) along with the result. Before processing, check if the key exists. If it does, return the previous result or skip processing. If not, process and then store the key.
*   **Use Cases**: API requests (e.g., Stripe's `Idempotency-Key` header), message processing in consumers.

### 2. Conditional Updates / State Checks

*   **Concept**: Perform updates only if certain conditions are met, typically based on the current state of the entity.
*   **Implementation**: `UPDATE table SET ... WHERE id = X AND status = 'PENDING'`. If the `status` is no longer 'PENDING', the update won't apply, indicating it might have been processed already. This is common in state machine transitions.
*   **Use Cases**: Order processing (only transition from `PENDING` to `PROCESSING`), payment status updates.

### 3. Version Numbers / Optimistic Concurrency

*   **Concept**: Include a version number (or ETag) with the data. Updates are only allowed if the provided version matches the current version in the database. After a successful update, the version number is incremented.
*   **Implementation**: `UPDATE table SET data = ..., version = version + 1 WHERE id = X AND version = Y`. If `Y` doesn't match the current version, another process has modified the data, and the update fails, signaling a concurrent modification (and implicitly, potentially a duplicate operation).
*   **Use Cases**: Highly concurrent data updates, preventing lost updates.

### 4. Upserts (INSERT ON CONFLICT UPDATE)

*   **Concept**: Attempt to insert a record. If a record with the same unique key already exists, update it instead of inserting a new one.
*   **Implementation**: Database features like `INSERT ... ON CONFLICT (unique_column) DO UPDATE SET ...` (PostgreSQL), `INSERT IGNORE` or `REPLACE INTO` (MySQL).
*   **Use Cases**: Storing unique events, user profiles, or configuration data where duplicates are not allowed but updates are acceptable.

### 5. Deduplication at the Source (Producer-side)

*   **Concept**: Ensure the producer sends the message only once. This is generally harder to guarantee perfectly in distributed systems due to network failures.
*   **Implementation**: Transactional Outbox Pattern (ensure message sending is part of the same transaction as data changes), but even this ensures *reliable* at-least-once publishing, not necessarily *exactly-once* from the consumer's perspective if the consumer itself is not idempotent.

### Choosing a Strategy

The best strategy often depends on the specific operation and data model. For most event consumers, a combination of **Idempotency Key** tracking and **Conditional Updates** is highly effective.