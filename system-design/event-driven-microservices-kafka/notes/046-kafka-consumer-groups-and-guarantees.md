## Day 46: Kafka Consumer Groups & Delivery Guarantees

Continuing our Kafka deep dive, today we're focusing on how consumers work, especially with consumer groups, and the crucial aspects of message delivery guarantees.

### Consumer Groups: Scaling and Fault Tolerance

Kafka's consumer groups are fundamental to achieving scalable and fault-tolerant event processing. They allow multiple consumers to process messages from a topic in parallel.

*   **How it works**: When multiple consumers belong to the same `consumerGroup`, Kafka ensures that each partition of a topic is consumed by *exactly one* consumer instance within that group. If a topic has `N` partitions and a consumer group has `M` consumers:
    *   If `M < N`, some consumers will process multiple partitions.
    *   If `M = N`, each consumer processes one partition.
    *   If `M > N`, some consumers will be idle.
*   **Parallel Processing**: Each consumer in a group processes a unique set of partitions, enabling horizontal scaling of processing power.
*   **Fault Tolerance**: If a consumer fails, Kafka automatically rebalances the partitions among the remaining active consumers in the group. This ensures continuous processing without manual intervention.
*   **Independent Progress**: Different consumer groups can consume the *same topic* independently, each maintaining its own offset. This is powerful for multiple services needing the same data for different purposes (e.g., `InventoryService` and `NotificationService` both consuming `orders` topic).

### Partition Assignment Strategies

When consumers join or leave a group, or when new partitions are added, Kafka triggers a *rebalance* to redistribute partitions. Common assignment strategies:

*   **RangeAssigner (Default)**: Assigns contiguous ranges of partitions to consumers.
*   **RoundRobinAssigner**: Assigns partitions in a round-robin fashion across all consumers and all topics they subscribe to.
*   **StickyAssigner**: Attempts to keep assignments as "sticky" as possible during rebalances to minimize partition movements and maximize processing continuity.

### Message Delivery Semantics

This is critical for data consistency and reliability.

1.  **At-Most-Once**: Messages might be lost but are never redelivered. The consumer commits offsets *before* processing the message. If the consumer crashes during processing, the message is lost.
    *   *Use case*: Non-critical data where some loss is acceptable (e.g., logging).

2.  **At-Least-Once (Default in Kafka)**: Messages are guaranteed to be delivered, but duplicates are possible. The consumer commits offsets *after* successfully processing the message. If the consumer crashes after processing but *before* committing, the message will be redelivered upon restart.
    *   *Mechanism*: Manual offset commit `consumer.commitOffsets()` after successful processing.
    *   *Challenge*: Requires consumers to be **idempotent** (processing a message multiple times yields the same result) to handle duplicates gracefully.
    *   *Use case*: Most business-critical operations where data loss is unacceptable (e.g., order processing, payment updates).

3.  **Exactly-Once**: Each message is processed exactly once, with no duplicates and no loss. This is the hardest to achieve.
    *   *Kafka's solution*: Requires Kafka transactions for both producers (idempotent producers) and consumers (transactional consumer processing).
    *   **Idempotent Producer**: Kafka guarantees that retries on the producer side will not result in duplicate messages being written to the log (using a Producer ID and sequence numbers).
    *   **Transactional Consumer**: Consumers can read messages within a transaction, process them, and then write results to another Kafka topic (or external system) as part of the *same atomic transaction*. If any part fails, the entire transaction is rolled back.
    *   *Complexity*: Significantly increases system complexity.
    *   *Use case*: Critical financial transactions, stateful stream processing.

### Offset Management

Consumers need to track their progress in each partition. This is done via **offsets**.

*   **Automatic Commit**: Kafka (via `kafkajs` or other clients) can automatically commit offsets at regular intervals. Simple, but can lead to at-most-once or at-least-once depending on commit timing relative to processing.
*   **Manual Commit**: The consumer explicitly commits offsets after it has successfully processed a batch of messages. This is preferred for at-least-once semantics to avoid data loss.
    *   `consumer.commitOffsets([{ topic, partition, offset: (message.offset + 1).toString() }])`

### Ordering Guarantees

Kafka guarantees message order *within a single partition*. Messages sent to the same partition will be delivered to consumers in the order they were written. There is *no global ordering guarantee* across partitions or topics. If strict global ordering is required, all messages must go to a single partition, which limits scalability.