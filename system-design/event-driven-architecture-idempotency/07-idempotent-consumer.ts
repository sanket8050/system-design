import { v4 as uuidv4 } from 'uuid';

type OrderCreatedEvent = {
  eventId: string;
  timestamp: string;
  eventType: 'OrderCreated';
  payload: { orderId: string; userId: string; items: string[]; totalAmount: number; status: string };
  correlationId?: string;
};

type OrderStatusUpdatedEvent = {
  eventId: string;
  timestamp: string;
  eventType: 'OrderStatusUpdated';
  payload: { orderId: string; newStatus: string; updatedBy: string };
  correlationId?: string;
};

type Event = OrderCreatedEvent | OrderStatusUpdatedEvent;

/**
 * Simulates an Idempotent Event Consumer service.
 * This example uses a simple in-memory set for processed event IDs.
 * In production, this would be backed by a persistent store (DB or distributed cache).
 */
class PaymentServiceIdempotentConsumer {
  private processedEventIds: Set<string>; // In-memory store for demonstration

  constructor() {
    this.processedEventIds = new Set<string>();
  }

  /**
   * Processes an incoming event idempotently.
   * @param event The event to process.
   */
  public async processEvent(event: Event): Promise<void> {
    const { eventId, eventType, payload, correlationId } = event;

    console.log(`
--- Consumer received event [${eventType}] with ID: ${eventId} ---`);

    // 1. Idempotency Check: Have we processed this event before?
    if (this.processedEventIds.has(eventId)) {
      console.warn(`[${eventType}] Event ${eventId} already processed. Skipping.`);
      return;
    }

    try {
      // 2. Process the event (simulate some work)
      console.log(`[${eventType}] Processing event ${eventId} for correlation ${correlationId || 'N/A'}...`);

      switch (eventType) {
        case 'OrderCreated':
          await this.handleOrderCreated(payload as OrderCreatedEvent['payload']);
          break;
        case 'OrderStatusUpdated':
          await this.handleOrderStatusUpdated(payload as OrderStatusUpdatedEvent['payload']);
          break;
        default:
          console.warn(`[${eventType}] Unknown event type. Skipping.`);
          return;
      }

      // 3. Mark event as processed (after successful processing)
      this.processedEventIds.add(eventId);
      console.log(`[${eventType}] Successfully processed and marked event ${eventId} as done.`);

    } catch (error) {
      console.error(`[${eventType}] Failed to process event ${eventId}:`, error);
      // Crucially, if processing fails, DO NOT add to processedEventIds.
      // This allows re-delivery and reprocessing (after fixing the issue).
      throw error; // Re-throw to signal consumer failure for broker retry
    }
  }

  private async handleOrderCreated(payload: OrderCreatedEvent['payload']): Promise<void> {
    console.log(`  -> Creating payment record for Order ${payload.orderId} (Total: ${payload.totalAmount})...`);
    // Simulate database interaction
    await new Promise(resolve => setTimeout(resolve, 500));
    console.log(`  -> Payment record for Order ${payload.orderId} created.`);
  }

  private async handleOrderStatusUpdated(payload: OrderStatusUpdatedEvent['payload']): Promise<void> {
    console.log(`  -> Updating payment status for Order ${payload.orderId} to ${payload.newStatus}...`);
    // Simulate database interaction
    await new Promise(resolve => setTimeout(resolve, 300));
    console.log(`  -> Payment status for Order ${payload.orderId} updated.`);
  }

  public getProcessedEventCount(): number {
    return this.processedEventIds.size;
  }
}

// --- Demonstration ---
async function runDemo() {
  const consumer = new PaymentServiceIdempotentConsumer();

  const orderCreatedEvent1: OrderCreatedEvent = {
    eventId: uuidv4(),
    timestamp: new Date().toISOString(),
    eventType: 'OrderCreated',
    payload: { orderId: 'ORD-A', userId: 'USR-1', items: ['Pen'], totalAmount: 10, status: 'PENDING' },
    correlationId: uuidv4(),
  };

  const orderCreatedEvent2Duplicate = { ...orderCreatedEvent1 }; // Simulate a duplicate delivery

  const orderStatusUpdatedEvent: OrderStatusUpdatedEvent = {
    eventId: uuidv4(),
    timestamp: new Date().toISOString(),
    eventType: 'OrderStatusUpdated',
    payload: { orderId: 'ORD-A', newStatus: 'PAID', updatedBy: 'PaymentService' },
    correlationId: orderCreatedEvent1.correlationId,
  };

  console.log('--- First Processing Wave ---');
  await consumer.processEvent(orderCreatedEvent1);
  await consumer.processEvent(orderStatusUpdatedEvent);

  console.log('\n--- Simulating Re-delivery (Duplicates) ---');
  await consumer.processEvent(orderCreatedEvent2Duplicate); // Should be skipped
  await consumer.processEvent(orderStatusUpdatedEvent); // Should be skipped

  console.log('\n--- Introducing a New Event ---');
  const newOrderEvent: OrderCreatedEvent = {
    eventId: uuidv4(),
    timestamp: new Date().toISOString(),
    eventType: 'OrderCreated',
    payload: { orderId: 'ORD-B', userId: 'USR-2', items: ['Book'], totalAmount: 25, status: 'PENDING' },
    correlationId: uuidv4(),
  };
  await consumer.processEvent(newOrderEvent);

  console.log(`\nTotal unique events processed: ${consumer.getProcessedEventCount()}`);
}

runDemo();
