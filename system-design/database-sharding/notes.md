# Database Sharding Strategies

Sharding partitions a large dataset across multiple database instances (shards), each holding a subset of data. This enables horizontal scaling beyond what a single node can handle.

## Sharding Strategies

### 1. Range-Based Sharding

Assign rows to shards based on key ranges.

```
Shard A: user_id 1 – 1,000,000
Shard B: user_id 1,000,001 – 2,000,000
Shard C: user_id 2,000,001 – ...
```

**Pros:** Simple routing, efficient range queries.
**Cons:** Hot spots if keys are sequential (all new users go to the last shard).

### 2. Hash-Based Sharding

`shard_id = hash(user_id) % num_shards`

**Pros:** Even distribution, no hot spots.
**Cons:** Range queries require scatter-gather across all shards. Resharding is expensive.

### 3. Directory-Based Sharding

A lookup table (directory service) maps keys to shard IDs.

**Pros:** Flexible, easy to move individual keys between shards.
**Cons:** Directory is a single point of failure unless replicated. Adds a lookup hop.

### 4. Geo-Based Sharding

Route data by geography (EU users → EU shard, US users → US shard).

**Pros:** Latency reduction, compliance with data-residency laws (GDPR).
**Cons:** Uneven load if user populations are imbalanced.

## Cross-Shard Challenges

| Problem | Solution |
|---------|----------|
| Cross-shard joins | Denormalize, or use application-level joins |
| Cross-shard transactions | 2PC, Saga pattern, or avoid entirely |
| Global unique IDs | Snowflake IDs, ULIDs, or a central ID service |
| Re-sharding | Consistent hashing (only ~1/N keys move) |

## Resharding Without Downtime

1. Add new shard.
2. Double-write to old + new shards.
3. Backfill old data to new shard.
4. Switch reads to new shard.
5. Stop writes to old shard.

## Snowflake ID Structure (64-bit)

```
| sign (1b) | timestamp (41b) | datacenter (5b) | worker (5b) | sequence (12b) |
```

Generates ~4096 unique IDs/ms per worker without coordination.
