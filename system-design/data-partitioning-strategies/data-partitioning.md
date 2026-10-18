# Data Partitioning: Scaling Beyond a Single Node

Scaling a database or data store vertically (more CPU, RAM, disk) hits limits quickly. Data partitioning, often called sharding, is the horizontal scaling approach. It splits a large dataset into smaller, more manageable pieces (partitions or shards) and distributes them across multiple nodes.

## Why Partition?
-   **Scalability:** Distribute load, storage, and I/O across many machines.
-   **Performance:** Smaller datasets per node mean faster queries, better cache hit rates.
-   **Availability:** Failure of one node doesn't bring down the entire system (if designed with replication).

## Common Partitioning Strategies

1.  **Horizontal Partitioning (Sharding):**
    -   Splits rows of a table across multiple database instances.
    -   Each instance holds a subset of the total data.
    -   Requires a "sharding key" to determine where a row lives.
    -   Example: User ID, Product ID.

2.  **Vertical Partitioning:**
    -   Splits columns of a table across multiple tables or even different servers.
    -   Less common for scaling *data volume* but useful for optimizing access patterns (e.g., frequently accessed columns on faster storage).
    -   Example: User profile (name, email) on one table, user activity (login history) on another.

3.  **Directory-Based Partitioning:**
    -   Uses a lookup service (e.g., Zookeeper, external database) to map sharding keys to physical nodes.
    -   Flexible but adds a single point of failure/bottleneck if not highly available.

## Key Considerations
-   **Sharding Key Choice:** Critical. Must distribute data evenly and minimize cross-partition queries.
-   **Rebalancing:** How to move data when adding/removing nodes or when partitions become uneven.
-   **Distributed Transactions:** Operations spanning multiple partitions are significantly harder.
-   **Complexity:** Adds significant operational overhead and development complexity.
