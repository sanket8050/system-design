## Day 49: Rate Limiting Algorithms

Rate limiting is crucial for protecting services from abuse, managing resource consumption, and ensuring fair usage. It prevents DDoS attacks, brute-force attempts, and keeps downstream services stable.

### Key Algorithms

1.  **Fixed Window Counter**
    *   **Mechanism**: A time window (e.g., 60 seconds) is defined. Requests within this window increment a counter. If the counter exceeds a threshold, requests are rejected until the window resets.
    *   **Pros**: Simple to implement, low memory usage.
    *   **Cons**:
        *   **Burstiness at Window Edges**: A client can make `N` requests just before the window resets, and another `N` requests just after, effectively making `2N` requests in a very short period around the window boundary.
        *   Doesn't handle spikes well.

2.  **Sliding Window Log**
    *   **Mechanism**: For each user, store a timestamp for every request made. When a new request comes, remove all timestamps older than the current time minus the window duration. If the remaining count exceeds the limit, reject.
    *   **Pros**: Highly accurate, no burstiness issues at window edges.
    *   **Cons**: High memory usage, especially for high request volumes, as every request timestamp needs to be stored.

3.  **Sliding Window Counter**
    *   **Mechanism**: Combines Fixed Window simplicity with better handling of window edge bursts. It tracks counts for the current window and the previous window. A weighted average of the previous window's count (based on how much of it overlaps with the current "sliding" perspective) and the current window's count is used.
    *   **Pros**: Better burst handling than Fixed Window, lower memory than Sliding Window Log.
    *   **Cons**: Not perfectly accurate, can still allow slightly more requests than the limit under specific conditions, but generally a good compromise.

4.  **Token Bucket**
    *   **Mechanism**: A bucket holds "tokens". Tokens are added to the bucket at a fixed refill rate. Each request consumes one (or more) tokens. If the bucket is empty, the request is rejected or queued. The bucket has a maximum capacity.
    *   **Pros**: Allows for some burstiness (up to bucket capacity), smooths out traffic, good for rate limiting APIs.
    *   **Cons**: Requires careful tuning of bucket size and refill rate. Initial requests might be delayed if the bucket is empty.

5.  **Leaky Bucket**
    *   **Mechanism**: Requests are added to a queue (the "bucket"). Requests "leak" out of the bucket at a fixed rate. If the bucket is full, new requests are rejected.
    *   **Pros**: Provides a constant output rate, good for smoothing out traffic.
    *   **Cons**: Doesn't allow for burstiness at all, might reject requests even if capacity is available if the queue is full.

### Choosing an Algorithm

*   **Fixed Window**: Simple, good for basic protection where occasional burstiness is acceptable.
*   **Sliding Window Counter**: Good general-purpose choice, balances accuracy and resource usage.
*   **Token Bucket**: Excellent for API rate limiting where some burstiness is desired but overall average rate needs to be capped.
*   **Sliding Window Log**: When absolute precision is critical, but resource cost is not an issue.
*   **Leaky Bucket**: When a perfectly smooth output rate is paramount, e.g., network traffic shaping.

For most API gateways, **Token Bucket** and **Sliding Window Counter** are popular choices.
