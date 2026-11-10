# Event-Driven Architecture

In event-driven systems, services communicate via events published to a broker (Kafka, RabbitMQ, SQS) rather than direct API calls.

## Core Concepts

### Events vs Commands vs Queries

| Type | Direction | Example |
|------|-----------|---------|
| Command | Sender → Receiver (one target) | `PlaceOrder` |
| Event | Publisher → Any interested party | `OrderPlaced` |
| Query | Requester → Responder | `GetOrderStatus` |

### Broker Patterns

**Point-to-Point (Queue):** Single consumer processes each message. Good for task distribution.
**Pub/Sub (Topic):** Multiple consumers receive each message independently. Good for fan-out.

## Kafka Architecture

```
Producer → Topic (Partitioned) → Consumer Group
                ↓
         Partition 0 → Consumer A
         Partition 1 → Consumer B
         Partition 2 → Consumer A
```

- **Partition key** determines which partition a message goes to (ensures ordering per key)
- **Consumer groups** enable parallel consumption with each partition assigned to one consumer
- Messages are retained for a configurable duration (replayed if needed)

## Outbox Pattern (Guaranteed Delivery)

Problem: Writing to DB and publishing to Kafka in the same operation is not atomic.

Solution:
1. Write event to an `outbox` table in the same DB transaction as the business data.
2. A poller/CDC reads the outbox table and publishes to Kafka.
3. Mark events as published.

This guarantees at-least-once delivery without distributed transactions.

## Dead Letter Queue (DLQ)

If a consumer fails to process a message N times, the message is moved to a DLQ for inspection and manual replay.

## Idempotent Consumers

Since message queues guarantee at-least-once delivery (not exactly-once), consumers must be idempotent:

```typescript
async function handleOrderPlaced(event: OrderPlacedEvent) {
  const alreadyProcessed = await db.events.findOne({ eventId: event.id });
  if (alreadyProcessed) return; // deduplicate

  await db.orders.update({ id: event.orderId, status: 'confirmed' });
  await db.events.insert({ eventId: event.id, processedAt: new Date() });
}
```
