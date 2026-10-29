/**
 * src/services/order-processor-service.ts
 * Example of an idempotent order processing service consumer.
 */

import { OrderCreatedEvent, Order, OrderId, EventId } from '../shared/event-types';

// Mock database for orders and processed events
interface MockDatabase {
  orders: Map<OrderId, Order>;
  processedEventIds: Set<EventId>; // Stores event IDs that have been successfully processed
}

const mockDb: MockDatabase = {
  orders: new Map<OrderId, Order>(),
  processedEventIds: new Set<EventId>()
};

/**
 * Simulates a database operation to check if an event has been processed.
 * In a real system, this would be a DB query.
 */
async function hasEventBeenProcessed(eventId: EventId): Promise<boolean> {
  console.log(`[OrderProcessor] Checking if event ${eventId} has been processed.`);
  // Simulate async DB call
  return Promise.resolve(mockDb.processedEventIds.has(eventId));
}

/**
 * Simulates a database operation to mark an event as processed.
 * In a real system, this would be a DB insert/update.
 */
async function markEventAsProcessed(eventId: EventId): Promise<void> {
  console.log(`[OrderProcessor] Marking event ${eventId} as processed.`);
  // Simulate async DB call
  mockDb.processedEventIds.add(eventId);
  return Promise.resolve();
}

/**
 * Simulates storing an order in the database.
 */
async function saveOrder(order: Order): Promise<void> {
  console.log(`[OrderProcessor] Saving order ${order.orderId}.`);
  // Simulate async DB call
  mockDb.orders.set(order.orderId, { ...order, status: 'PROCESSED' });
  return Promise.resolve();
}

export async function processOrderCreatedEvent(
  event: OrderCreatedEvent
): Promise<void> {
  const { eventId, order } = event;

  console.log(`\n--- Received OrderCreatedEvent for Order ${order.orderId} (Event ID: ${eventId}) ---`);

  // 1. Idempotency Check: Use the eventId as the idempotency key.
  // This prevents processing the same logical event multiple times.
  const alreadyProcessed = await hasEventBeenProcessed(eventId);
  if (alreadyProcessed) {
    console.warn(`[OrderProcessor] Event ${eventId} for order ${order.orderId} already processed. Skipping.`);
    return;
  }

  // 2. Business Logic: Process the order.
  console.log(`[OrderProcessor] Processing new order ${order.orderId} for user ${order.userId}...`);
  // Simulate complex business logic, e.g., inventory check, fraud detection
  await new Promise(resolve => setTimeout(resolve, 100)); // Simulate work

  // 3. Save Order (Conditional/Upsert logic could be here too)
  // For simplicity, we just save, assuming the idempotency check handles duplicates.
  await saveOrder(order);
  console.log(`[OrderProcessor] Order ${order.orderId} successfully processed and saved.`);

  // 4. Mark Event as Processed: Crucial step to ensure idempotency for future retries.
  await markEventAsProcessed(eventId);
  console.log(`[OrderProcessor] Event ${eventId} marked as processed.`);
}

// --- Demonstration --- 

async function runDemo() {
  const order1: Order = {
    orderId: 'ORD-001',
    userId: 'USR-123',
    items: [{ productId: 'PROD-A', quantity: 1, price: 100 }],
    totalAmount: 100,
    status: 'PENDING'
  };

  const event1: OrderCreatedEvent = {
    eventId: 'EVT-ORDER-1-ABC',
    timestamp: new Date().toISOString(),
    eventType: 'OrderCreated',
    order: order1
  };

  const event1_retry: OrderCreatedEvent = {
    ...event1,
    timestamp: new Date().toISOString() // Simulating a retry with updated timestamp
  };

  const order2: Order = {
    orderId: 'ORD-002',
    userId: 'USR-456',
    items: [{ productId: 'PROD-B', quantity: 2, price: 50 }],
    totalAmount: 100,
    status: 'PENDING'
  };

  const event2: OrderCreatedEvent = {
    eventId: 'EVT-ORDER-2-XYZ',
    timestamp: new Date().toISOString(),
    eventType: 'OrderCreated',
    order: order2
  };

  // First processing of order 1
  await processOrderCreatedEvent(event1);
  console.log(`Current orders after event1: ${mockDb.orders.size}`);

  // Retry processing order 1 (should be skipped due to idempotency)
  await processOrderCreatedEvent(event1_retry);
  console.log(`Current orders after event1_retry: ${mockDb.orders.size}`);

  // Processing order 2
  await processOrderCreatedEvent(event2);
  console.log(`Current orders after event2: ${mockDb.orders.size}`);

  console.log('\n--- Final State ---');
  console.log('Orders in DB:', Array.from(mockDb.orders.values()).map(o => ({ id: o.orderId, status: o.status })));
  console.log('Processed Event IDs:', Array.from(mockDb.processedEventIds));
}

// To run the demo:
// runDemo().catch(console.error);
