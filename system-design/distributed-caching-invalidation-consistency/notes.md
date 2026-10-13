# Day 4: Distributed Caching - Invalidation & Consistency

Distributed caching is crucial for scaling, but it's a double-edged sword: it introduces complexity around data consistency and invalidation. Getting this wrong leads to stale data, performance bottlenecks, or even data corruption.

## Why it's hard

When you have multiple cache nodes and multiple application instances, ensuring all clients see the most up-to-date data (or at least consistently stale data) becomes a significant challenge. Cache consistency is often the hardest part.

## Common Invalidation Strategies

1.  **Time-To-Live (TTL)**:
    *   **Mechanism**: Each cache entry has an expiry time. After `TTL` passes, the entry is considered stale and re-fetched from the source.
    *   **Pros**: Simple to implement, automatically handles some staleness.
    *   **Cons**: Data can be stale for the duration of the TTL. Not suitable for rapidly changing data or strong consistency requirements.
    *   **Opinion**: Good default for most read-heavy, eventually consistent workloads.

2.  **Cache-Aside (Lazy Loading)**:
    *   **Mechanism**: Application explicitly manages cache. On read, check cache first. If missing (cache miss), fetch from DB, store in cache, then return. On write, update DB, then *invalidate* the corresponding cache entry.
    *   **Pros**: Simple, ensures cache only stores frequently accessed data.
    *   **Cons**: Requires explicit invalidation logic. Cache misses add latency. Prone to "thundering herd" if many clients simultaneously request a missing item.
    *   **Opinion**: Most common pattern. Pair with a messaging system for reliable invalidation.

3.  **Write-Through**:
    *   **Mechanism**: Data is written simultaneously to both the cache and the underlying database. The write operation only completes when both writes are successful.
    *   **Pros**: Cache is always consistent with the database on writes. Reads are fast for recently written data.
    *   **Cons**: Slower write operations due to dual writes. If cache is unavailable, write fails.
    *   **Opinion**: Useful for scenarios where write consistency is paramount and write latency is acceptable.

4.  **Write-Back (Write-Behind)**:
    *   **Mechanism**: Data is written only to the cache. The cache then asynchronously writes the data to the database.
    *   **Pros**: Very fast writes from the application's perspective.
    *   **Cons**: Data loss risk if cache fails before data is persisted to DB. More complex to manage.
    *   **Opinion**: High-performance scenarios where some data loss tolerance is acceptable (e.g., IoT sensor data, analytics). Requires robust cache persistence/replication.

5.  **Event-Driven Invalidation (Pub/Sub)**:
    *   **Mechanism**: When data changes in the primary data source (e.g., database), an event is published to a message queue. Cache nodes subscribe to these events and invalidate their local entries accordingly.
    *   **Pros**: Near real-time invalidation across distributed caches. Decouples data source from cache.
    *   **Cons**: Adds complexity (message queue, event handlers). Requires careful event design.
    *   **Opinion**: Best approach for achieving eventual consistency with minimal staleness in complex distributed systems. Use with Kafka, Redis Pub/Sub, etc.

## Consistency Models

*   **Strong Consistency**: All observers see the same data at the same time. Extremely difficult and expensive to achieve in distributed caches. Often requires distributed transactions (e.g., 2PC) or global locks, severely impacting performance and availability.
*   **Eventual Consistency**: Given enough time, all replicas will eventually converge to the same state. This is the practical choice for most high-scale web applications. It means some clients might see stale data for a short period.
    *   **Opinion**: Embrace eventual consistency with a well-tuned invalidation strategy (short TTLs + event-driven) for performance and scalability.

## Challenges

*   **Stale Data**: The inherent trade-off of caching. Manage expectations and implement robust invalidation.
*   **Cache Stampede / Thundering Herd**: Many clients simultaneously requesting an expired/missing item, all hitting the backend DB. Mitigate with distributed locks, probabilistic expiry, or pre-fetching.
*   **Serialization/Deserialization**: Overhead of converting data to/from cache format.
*   **Cache Warming**: Populating the cache initially for critical data to avoid cold starts.

## Practical Advice

Start simple with Cache-Aside + TTL. As requirements evolve, introduce event-driven invalidation for critical data. For very hot reads, consider Read-Through (where the cache itself fetches from DB on miss, rather than the app).

Always monitor cache hit ratio, latency, and memory usage. It's a critical component, treat it as such.