import { v4 as uuidv4 } from 'uuid';

// Mock Database Client
class MockDatabaseClient {
  private processedEvents: Map<string, Date> = new Map();
  private orders: Map<string, any> = new Map();
  private payments: Map<string, any> = new Map();

  public async insertProcessedEvent(eventId: string, consumerService: string): Promise<boolean> {
    // Simulate unique constraint violation
    if (this.processedEvents.has(eventId)) {
      console.warn(`  DB: Event ID ${eventId} already exists in processed_events.`);
      return false; // Indicates duplicate
    }
    this.processedEvents.set(eventId, new Date());
    console.log(`  DB: Inserted event ID ${eventId} into processed_events.`);
    return true;
  }

  public async createOrder(orderId: string, payload: any): Promise<void> {
    if (this.orders.has(orderId)) {
      console.warn(`  DB: Order ${orderId} already exists. Skipping creation.`);
      return;
    }
    this.orders.set(orderId, { ...payload, createdAt: new Date() });
    console.log(`  DB: Created order ${orderId}.`);
  }

  public async createPayment(paymentId: string, orderId: string, amount: number): Promise<void> {
    // Simulate unique constraint on payment_id
    if (this.payments.has(paymentId)) {
      console.warn(`  DB: Payment ${paymentId} already exists. Skipping creation.`);
      return;
    }
    this.payments.set(paymentId, { paymentId, orderId, amount, paidAt: new Date() });
    console.log(`  DB: Created payment ${paymentId} for order ${orderId}.`);
  }

  public async updateOrderStatus(orderId: string, status: string): Promise<void> {
    const order = this.orders.get(orderId);
    if (order) {
      order.status = status;
      console.log(`  DB: Updated order ${orderId} status to ${status}.`);
    } else {
      console.warn(`  DB: Order ${orderId} not found for status update.`);
    }
  }

  public getOrder(orderId: string): any | undefined {
    return this.orders.get(orderId);
  }

  public getPayment(paymentId: string): any | undefined {
    return this.payments.get(paymentId);
  }

  public getProcessedEventsCount(): number {
    return this.processedEvents.size;
  }
}

// Event Types (same as previous example)
type OrderCreatedEvent = {
  eventId: string;
  timestamp: string;
  eventType: 'OrderCreated';
  payload: { orderId: string; userId: string; items: string[]; totalAmount: number; status: string };
  correlationId?: string;
};

type OrderPaidEvent = {
  eventId: string;
  timestamp: string;
  eventType: 'OrderPaid';
  payload: { orderId: string; paymentId: string; amount: number; };
  correlationId?: string;
};

type Event = OrderCreatedEvent | OrderPaidEvent;

/**
 * Idempotent Event Consumer using a database table to track processed event IDs.
 */
class PaymentServiceDbIdempotentConsumer {
  private db: MockDatabaseClient;
  private consumerServiceId: string;

  constructor(dbClient: MockDatabaseClient, consumerServiceId: string) {
    this.db = dbClient;
    this.consumerServiceId = consumerServiceId;
  }

  public async processEvent(event: Event): Promise<void> {
    const { eventId, eventType, payload, correlationId } = event;

    console.log(`
--- Consumer received event [${eventType}] with ID: ${eventId} ---`);

    try {
      // 1. Idempotency Check: Attempt to record the event ID in the database.
      // This should be an atomic operation, ideally within a transaction with the business logic.
      const isNewEvent = await this.db.insertProcessedEvent(eventId, this.consumerServiceId);

      if (!isNewEvent) {
        console.warn(`[${eventType}] Event ${eventId} already processed or currently being processed. Skipping.`);
        return;
      }

      // 2. Process the event (only if it's a new event)
      console.log(`[${eventType}] Processing new event ${eventId} for correlation ${correlationId || 'N/A'}...`);

      switch (eventType) {
        case 'OrderCreated':
          await this.handleOrderCreated(payload as OrderCreatedEvent['payload']);
          break;
        case 'OrderPaid':
          await this.handleOrderPaid(payload as OrderPaidEvent['payload']);
          break;
        default:
          console.warn(`[${eventType}] Unknown event type. Skipping.`);
          // If we inserted the eventId, but then found it's an unknown type, we might want to remove it
          // or mark it as 'failed' in the processed_events table, depending on policy.
          // For now, let's just log and consider it 'processed' for this consumer.
          break;
      }

      console.log(`[${eventType}] Successfully processed event ${eventId}.`);

    } catch (error) {
      console.error(`[${eventType}] Failed to process event ${eventId}:`, error);
      // If an error occurs *after* `insertProcessedEvent` but *before* business logic commits,
      // and the `insertProcessedEvent` was not part of the same transaction as business logic,
      // this eventId will be in `processed_events` but business logic wasn't applied.
      // This is why transactional idempotency (next level) is crucial.
      throw error; // Re-throw for broker retry
    }
  }

  private async handleOrderCreated(payload: OrderCreatedEvent['payload']): Promise<void> {
    console.log(`  -> PaymentService: Creating order record for Order ${payload.orderId}...`);
    await this.db.createOrder(payload.orderId, payload);
  }

  private async handleOrderPaid(payload: OrderPaidEvent['payload']): Promise<void> {
    console.log(`  -> PaymentService: Recording payment ${payload.paymentId} for Order ${payload.orderId} (Amount: ${payload.amount})...`);
    await this.db.createPayment(payload.paymentId, payload.orderId, payload.amount);
    await this.db.updateOrderStatus(payload.orderId, 'PAID');
  }
}

// --- Demonstration ---
async function runDemo() {
  const db = new MockDatabaseClient();
  const consumer = new PaymentServiceDbIdempotentConsumer(db, 'payment-service-instance-1');

  const orderCreatedEvent1: OrderCreatedEvent = {
    eventId: uuidv4(),
    timestamp: new Date().toISOString(),
    eventType: 'OrderCreated',
    payload: { orderId: 'ORD-X', userId: 'USR-X', items: ['Keyboard'], totalAmount: 150, status: 'PENDING' },
    correlationId: uuidv4(),
  };

  const orderPaidEvent1: OrderPaidEvent = {
    eventId: uuidv4(),
    timestamp: new Date().toISOString(),
    eventType: 'OrderPaid',
    payload: { orderId: 'ORD-X', paymentId: 'PAY-X-1', amount: 150 },
    correlationId: orderCreatedEvent1.correlationId,
  };

  const orderPaidEvent2Duplicate = { ...orderPaidEvent1 }; // Simulate duplicate payment event

  console.log('--- First Processing Wave ---');
  await consumer.processEvent(orderCreatedEvent1);
  await consumer.processEvent(orderPaidEvent1);

  console.log('\n--- Simulating Re-delivery (Duplicates) ---');
  await consumer.processEvent(orderCreatedEvent1); // Should be skipped
  await consumer.processEvent(orderPaidEvent2Duplicate); // Should be skipped

  console.log('\n--- Verifying Database State ---');
  console.log('Order ORD-X:', db.getOrder('ORD-X'));
  console.log('Payment PAY-X-1:', db.getPayment('PAY-X-1'));
  console.log(`Total processed event IDs in DB: ${db.getProcessedEventsCount()}`);

  console.log('\n--- Introducing a New Order and Payment ---');
  const newOrderEvent: OrderCreatedEvent = {
    eventId: uuidv4(),
    timestamp: new Date().toISOString(),
    eventType: 'OrderCreated',
    payload: { orderId: 'ORD-Y', userId: 'USR-Y', items: ['Monitor'], totalAmount: 300, status: 'PENDING' },
    correlationId: uuidv4(),
  };
  const newOrderPaidEvent: OrderPaidEvent = {
    eventId: uuidv4(),
    timestamp: new Date().toISOString(),
    eventType: 'OrderPaid',
    payload: { orderId: 'ORD-Y', paymentId: 'PAY-Y-1', amount: 300 },
    correlationId: newOrderEvent.correlationId,
  };

  await consumer.processEvent(newOrderEvent);
  await consumer.processEvent(newOrderPaidEvent);

  console.log('\n--- Final Database State ---');
  console.log('Order ORD-Y:', db.getOrder('ORD-Y'));
  console.log('Payment PAY-Y-1:', db.getPayment('PAY-Y-1'));
  console.log(`Total processed event IDs in DB: ${db.getProcessedEventsCount()}`);
}

runDemo();
