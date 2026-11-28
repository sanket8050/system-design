# Distributed Rate Limiting: The Hard Problems

The `InMemoryTokenBucket` works fine for a single process. But in a modern microservices architecture, your application often runs on multiple instances behind a load balancer. This introduces significant challenges for rate limiting:

## Why In-Memory Fails in Distributed Systems

1.  **Inconsistent State:** Each instance has its own independent rate limiter. If a client sends 10 requests to instance A and 10 requests to instance B, both might independently allow 10 requests, effectively bypassing a global limit of 10.
2.  **Race Conditions:** If multiple instances try to decrement a shared counter simultaneously, without proper synchronization, they can lead to incorrect counts and allow more requests than permitted.
3.  **Single Point of Failure (SPOF) for State:** If you were to somehow share a single in-memory bucket across instances (e.g., via IPC), that single point becomes a bottleneck and a SPOF.

## Requirements for Distributed Rate Limiting

To implement effective rate limiting in a distributed environment, we need:

1.  **Centralized State:** A single source of truth for rate limit counters/tokens that all application instances can access.
2.  **Atomic Operations:** Operations on this shared state (e.g., decrementing a counter, adding a timestamp) must be atomic to prevent race conditions.
3.  **High Availability & Performance:** The centralized state store itself must be highly available and performant to avoid becoming a bottleneck.

## Enter Redis

Redis is an excellent choice for distributed rate limiting due to its:

*   **In-memory speed:** Low latency operations.
*   **Atomic commands:** Many commands (like `INCR`, `SETNX`, `ZADD`) are atomic.
*   **Lua Scripting:** Allows execution of complex, multi-command logic atomically on the Redis server.
*   **Data Structures:** Sorted Sets (`ZSET`), Hashes (`HASH`), and Strings (`STRING`) are perfect for implementing various rate limiting algorithms.

We'll primarily focus on Redis-based approaches for distributed rate limiting.