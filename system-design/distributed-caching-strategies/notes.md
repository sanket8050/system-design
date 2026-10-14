### Distributed Caching Strategies

Caching is critical for performance in distributed systems, but it introduces complexity around consistency and invalidation. Here are common patterns:

#### 1. Cache-Aside (Lazy Loading)

**Mechanism:**
-   **Read:** Application first checks the cache. If data is found (cache hit), it's returned. If not (cache miss), the application fetches data from the database, stores it in the cache, and then returns it.
-   **Write:** Application writes data directly to the database, then explicitly invalidates (deletes) the corresponding entry from the cache.

**Pros:**
-   **Simplicity:** Easiest to implement and understand.
-   **Read-heavy optimization:** Only caches data that is actually requested, preventing cache pollution with unused data.
-   **Fault tolerance:** Cache failure doesn't directly impact data persistence; data is always in the database.

**Cons:**
-   **Cache Miss Latency:** First read for an item will always hit the database, leading to higher latency.
-   **Stale Data Risk:** If a write updates the DB but fails to invalidate the cache, subsequent reads might get stale data until the cache entry expires or is explicitly invalidated. Race conditions during concurrent writes/reads can exacerbate this.
-   **Thundering Herd:** Multiple concurrent requests for a missing item can all hit the database simultaneously.

**Opinion:** This is my go-to strategy for most read-heavy microservices. The trade-off of potential eventual consistency (brief staleness) is often acceptable for the performance gains and operational simplicity.

#### 2. Write-Through

**Mechanism:**
-   **Write:** Application writes data to the cache, and the cache synchronously writes the data to the database. Both operations must succeed for the write to be considered complete.
-   **Read:** Data is read directly from the cache. If not found, it's fetched from the database and populated in the cache (similar to Cache-Aside's read path, but often the expectation is data is already in cache).

**Pros:**
-   **Strong Consistency:** Cache and database are always in sync (or appear to be from the application's perspective) immediately after a write.
-   **Simpler Read Logic:** Reads almost always hit the cache, reducing read latency.

**Cons:**
-   **Higher Write Latency:** Writes take longer as data must be written to both cache and DB sequentially.
-   **Cache as Bottleneck:** If the cache goes down or is slow, writes are directly impacted.
-   **Cache Pollution:** Unused data might be written to the cache, consuming resources.

**Opinion:** Less common for general-purpose application caches. More suitable for scenarios where strong read-after-write consistency is paramount, or when the cache itself is treated as a primary data store (e.g., some specialized data grids or ORM caching layers).

#### 3. Write-Back (Write-Behind)

**Mechanism:**
-   **Write:** Application writes data to the cache, and the cache acknowledges the write immediately. The cache then asynchronously writes the data to the database in the background (e.g., batched or after a delay).
-   **Read:** Data is read directly from the cache.

**Pros:**
-   **Lowest Write Latency:** Writes are extremely fast as they only hit the cache initially.
-   **High Throughput:** Can handle high write volumes by batching updates to the database.

**Cons:**
-   **Data Loss Risk:** If the cache fails before data is persisted to the database, data can be lost.
-   **Complex Consistency:** Hardest to manage consistency across multiple cache nodes and the database.

**Opinion:** Use with extreme caution. Best for high-performance, write-intensive systems where some data loss is acceptable, or where a highly robust and replicated caching layer (e.g., Kafka + Redis/Cassandra) mitigates the data loss risk. Not for critical financial or user data without extensive safeguards.

### Cache Invalidation Strategies

-   **Time-To-Live (TTL):** Entries automatically expire after a set duration. Simple, but can lead to temporary staleness.
-   **Explicit Invalidation:** Application explicitly deletes or updates cache entries after a database write. Used in Cache-Aside.
-   **Publish/Subscribe:** Database changes (or application writes) trigger events that invalidate relevant cache entries across distributed cache nodes. More complex, but offers better consistency for distributed caches.
-   **Least Recently Used (LRU) / Least Frequently Used (LFU):** Cache eviction policies when the cache is full. Not primary invalidation, but important for cache management.