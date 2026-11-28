# Rate Limiting: Fundamentals

Rate limiting is a critical mechanism to control the rate at which an API or service is consumed. Without it, a single client could overwhelm your backend, leading to degraded performance or complete service outages for legitimate users.

## Why Rate Limit?

1.  **Resource Protection:** Prevent servers from being overloaded by too many requests.
2.  **Abuse Prevention:** Mitigate DDoS attacks, brute-force attempts, and spam.
3.  **Cost Control:** Manage infrastructure costs by limiting excessive usage.
4.  **Fair Usage:** Ensure fair access to resources across all clients.
5.  **Monetization:** Enforce API tiers (e.g., free vs. paid plans with different limits).

## Common Algorithms

### 1. Token Bucket

Imagine a bucket with a fixed capacity for "tokens".
*   Tokens are added to the bucket at a constant rate.
*   Each incoming request consumes one token.
*   If the bucket has tokens, the request is processed, and a token is removed.
*   If the bucket is empty, the request is rejected or queued.

**Pros:** Allows for bursts (as long as tokens are available), simple to implement.
**Cons:** Bucket size and refill rate need careful tuning.

### 2. Leaky Bucket

Imagine a bucket with a fixed capacity, and water "leaks" out at a constant rate.
*   Incoming requests are like water drops.
*   If the bucket isn't full, the request is added (queued).
*   If the bucket is full, the request is rejected.
*   Requests are processed at a constant rate (the "leak rate").

**Pros:** Smooths out traffic bursts, ensures a constant output rate.
**Cons:** Requires a queue, latency can increase during bursts if the queue fills up.

For distributed systems, these simple in-memory implementations become complex due to state synchronization. We'll explore distributed strategies using Redis.