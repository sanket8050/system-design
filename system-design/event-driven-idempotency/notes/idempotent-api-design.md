# Idempotent API Design

While idempotency is critical for event consumers, it's equally important for designing robust REST APIs that can handle client retries safely. Clients might retry requests due to network timeouts, server errors, or simply user-initiated retries.

## HTTP Methods and Idempotency

HTTP defines certain methods as idempotent by nature:

-   **`GET`**: Always idempotent. Multiple `GET` requests for the same resource have no side effects on the server.
-   **`HEAD`**: Idempotent. Similar to `GET`, but without the response body.
-   **`PUT`**: Idempotent. `PUT /resources/123` means "set the state of resource 123 to this representation." Repeated `PUT` requests with the same payload will result in the same state.
-   **`DELETE`**: Idempotent. `DELETE /resources/123` means "remove resource 123." After the first successful `DELETE`, subsequent `DELETE` requests will find the resource already gone, but the system state (resource 123 is absent) remains the same.

### Non-Idempotent Methods:

-   **`POST`**: Generally *not* idempotent. `POST /resources` means "create a new resource." Repeated `POST` requests could create multiple identical resources.
-   **`PATCH`**: Not inherently idempotent. `PATCH /resources/123` means "apply this partial modification to resource 123." If the modification is relative (e.g., `increment quantity by 1`), repeating it will change the state further.

## Implementing Idempotency for `POST` and `PATCH`

For `POST` and `PATCH` requests, where side effects are common and not naturally idempotent, you need to explicitly implement idempotency using an **idempotency key**.

### Client-Generated Idempotency Keys

-   **Header**: The most common approach is for the client to send a unique `Idempotency-Key` header with the request. Example:
    `Idempotency-Key: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`
-   **UUIDs**: Clients should use cryptographically strong UUIDs (e.g., UUID v4) for these keys to ensure uniqueness.
-   **Lifetime**: The key should be unique for a specific logical operation. If a client retries a request, they *must* use the same idempotency key.

### Server-Side Processing (similar to event consumers):

1.  **Extract Key**: On receiving a `POST` or `PATCH` request, extract the `Idempotency-Key` header.
2.  **Check Store**: Query an idempotency store (e.g., Redis, database table) to see if this key has been processed.
    *   **Found and `completed`**: Return the stored response from the original successful request (e.g., `200 OK` with the created resource details, or `204 No Content` for a successful update).
    *   **Found and `pending`**: Return a `409 Conflict` (or `429 Too Many Requests`) to indicate the operation is already in progress, or implement a retry/wait mechanism.
    *   **Not found**: Proceed with the operation.
3.  **Record Pending**: Store the `idempotencyKey` with a `pending` status.
4.  **Execute Logic**: Perform the core business logic (e.g., create order, process payment).
5.  **Record Result**: Update the `idempotencyKey` record with `completed` status and the actual HTTP response (status code, headers, body) to be returned for subsequent retries.

### Considerations:
-   **Response Caching**: For retries, you must return the *exact same* response (status code, headers, and body) as the original successful request. This implies storing the full response in your idempotency store.
-   **Cleanup**: Implement a TTL (Time-To-Live) for idempotency keys. Keys older than a few hours or days (depending on your retry policies) can usually be safely deleted.
-   **Transactionality**: The recording of the pending state, business logic execution, and updating the completed state should ideally be atomic, especially if the idempotency store is the same as your primary database.

Designing APIs with idempotency significantly improves the client experience and system reliability, especially in microservices architectures where network failures and retries are commonplace.