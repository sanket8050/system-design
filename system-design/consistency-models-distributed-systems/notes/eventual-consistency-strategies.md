## Eventual Consistency Strategies

Eventual consistency provides higher availability and lower latency compared to strong consistency, but at the cost of immediate data freshness. It's a pragmatic choice for many web-scale applications where strict real-time consistency isn't always critical.

### Core Principle:

If no new updates are made to a given data item, eventually all accesses to that item will return the last updated value. There's no guarantee on *when* "eventually" will be.

### Common Weaker Consistency Models (Stronger than pure Eventual):

These models add specific guarantees on top of basic eventual consistency to make it more usable for applications:

1.  **Read-Your-Writes Consistency**: After a process updates a data item, any subsequent read operations by *that same process* will return the updated value. Other processes might still see stale data temporarily.
    *   **Use Case**: User updating their profile and immediately seeing the changes.
    *   **Implementation**: Can be achieved by routing subsequent reads from the same client to the replica that handled the write, or by including a version token with the read request.

2.  **Monotonic Reads Consistency**: If a process reads a value for a data item, any subsequent read operations by *that same process* will never return an older value. It ensures that data doesn't appear to "go back in time".
    *   **Use Case**: Reading a news feed; you don't want to see an older version of the feed after seeing a newer one.
    *   **Implementation**: Often involves sticky sessions to a particular replica or tracking the highest version seen by a client.

3.  **Monotonic Writes Consistency**: A write operation by a process is completed only after all previous write operations by *the same process* have completed.
    *   **Use Case**: Ensuring ordered updates from a single client, e.g., a sequence of messages in a chat.
    *   **Implementation**: Requires a client to wait for previous writes to be acknowledged or to send writes with sequential version numbers.

4.  **Causal Consistency**: If event A causally precedes event B (e.g., A is a write, B is a read of that write, or A and B are operations by the same process), then every process that sees B must also see A. Concurrent writes are not ordered.
    *   **Use Case**: Distributed conversations where replies must see the messages they are replying to.
    *   **Implementation**: Vector clocks are a common mechanism to track causal relationships.

### Trade-offs:

*   **Pros**: High availability, low latency, scalability, fault tolerance.
*   **Cons**: Data can be stale, complex application logic to handle potential inconsistencies, requires careful design to prevent data loss or anomalies.

### When to use:

Social media feeds, IoT sensor data, user profiles (where immediate global consistency isn't critical), large-scale analytics, caching.