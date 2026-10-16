import { v4 as uuidv4 } from 'uuid';

// Mock Database Client for Outbox and Business Logic
class MockOutboxDatabaseClient {
  private orders: Map<string, any> = new Map();
  private outbox: any[] = []; // Simulates outbox table

  public async beginTransaction(): Promise<void> {
    console.log('  DB: Transaction started.');
    // In a real DB, this would be `client.query('BEGIN')`
  }

  public async commitTransaction(): Promise<void> {
    console.log('  DB: Transaction committed.');
    // In a real DB, `client.query('COMMIT')`
  }

  public async rollbackTransaction(): Promise<void> {
    console.log('  DB: Transaction rolled back.');
    // In a real DB, `client.query('ROLLBACK')`
  }

  public async createOrderInTransaction(orderId: string, userId: string, items: string[], totalAmount: number): Promise<void> {
    const orderData = { orderId, userId, items, totalAmount, status: 'PENDING', createdAt: new Date() };
    this.orders.set(orderId, orderData);
    console.log(`  DB: Created order ${orderId} in transaction.`);
  }

  public async insertOutboxEventInTransaction(eventType: string, payload: any, correlationId: string): Promise<void> {
    const event = {
      id: uuidv4(),
      eventType,
      payload,
      correlationId,
      createdAt: new Date(),
      published: false,
    };
    this.outbox.push(event);
    console.log(`  DB: Inserted event ${event.id} (${eventType}) into Outbox in transaction.`);
  }

  public async getUnpublishedOutboxEvents(): Promise<any[]> {
    // In a real DB, this would be `SELECT * FROM outbox WHERE published = false ORDER BY createdAt ASC`
    return this.outbox.filter(event => !event.published);
  }

  public async markOutboxEventAsPublished(eventId: string): Promise<void> {
    const event = this.outbox.find(e => e.id === eventId);
    if (event) {
      event.published = true;
      console.log(`  DB: Marked outbox event ${eventId} as published.`);
    }
  }

  public getOrder(orderId: string): any | undefined {
    return this.orders.get(orderId);
  }

  public getOutboxContents(): any[] {
    return [...this.outbox];
  }
}

/**
 * Simulates a service that uses the Outbox Pattern for reliable event publishing.
 */
class OrderServiceOutboxPublisher {
  private db: MockOutboxDatabaseClient;
  private messageBrokerEndpoint: string;

  constructor(dbClient: MockOutboxDatabaseClient, messageBrokerEndpoint: string) {
    this.db = dbClient;
    this.messageBrokerEndpoint = messageBrokerEndpoint;
  }

  public async createOrderAndPublishEvent(userId: string, items: string[], totalAmount: number): Promise<string> {
    const orderId = `ORD-${uuidv4().substring(0, 8).toUpperCase()}`;
    const correlationId = uuidv4();

    console.log(`
--- Order Service: Attempting to create order ${orderId} ---`);

    await this.db.beginTransaction();
    try {
      // 1. Perform business logic (e.g., create order record)
      await this.db.createOrderInTransaction(orderId, userId, items, totalAmount);

      // 2. Insert event into Outbox table (part of the same transaction)
      const eventPayload = { orderId, userId, items, totalAmount, status: 'PENDING' };
      await this.db.insertOutboxEventInTransaction('OrderCreated', eventPayload, correlationId);

      await this.db.commitTransaction();
      console.log(`Order ${orderId} created and event queued in Outbox successfully.`);
      return orderId;
    } catch (error) {
      await this.db.rollbackTransaction();
      console.error(`Failed to create order ${orderId} and publish event. Transaction rolled back:`, error);
      throw error;
    }
  }
}

/**
 * Simulates the Outbox Relayer process.
 * This would typically be a separate microservice or a background worker.
 */
class OutboxRelayer {
  private db: MockOutboxDatabaseClient;
  private brokerEndpoint: string;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(dbClient: MockOutboxDatabaseClient, brokerEndpoint: string) {
    this.db = dbClient;
    this.brokerEndpoint = brokerEndpoint;
  }

  public startPolling(intervalMs: number = 1000): void {
    console.log(`
--- Outbox Relayer: Starting polling every ${intervalMs}ms ---`);
    this.intervalId = setInterval(this.processOutbox.bind(this), intervalMs);
  }

  public stopPolling(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      console.log('--- Outbox Relayer: Stopped polling ---');
    }
  }

  private async processOutbox(): Promise<void> {
    // console.log('Relayer: Checking for unpublished events...');
    const unpublishedEvents = await this.db.getUnpublishedOutboxEvents();

    for (const event of unpublishedEvents) {
      try {
        console.log(`Relayer: Publishing event ${event.id} (${event.eventType}) to ${this.brokerEndpoint}...`);
        // Simulate actual message broker publish
        // await this.messageBrokerClient.send(event.eventType, event.payload);
        console.log(`Relayer: Event ${event.id} published successfully.`);

        await this.db.markOutboxEventAsPublished(event.id);
      } catch (error) {
        console.error(`Relayer: Failed to publish event ${event.id}:`, error);
        // The event remains in the outbox as 'unpublished' for retry on next poll.
        // Important: Consumers must be idempotent!
      }
    }
  }
}

// --- Demonstration ---
async function runDemo() {
  const db = new MockOutboxDatabaseClient();
  const orderService = new OrderServiceOutboxPublisher(db, 'kafka://order-events.internal:9092');
  const outboxRelayer = new OutboxRelayer(db, 'kafka://order-events.internal:9092');

  outboxRelayer.startPolling(500); // Poll every 500ms

  await orderService.createOrderAndPublishEvent('user-123', ['Product A', 'Product B'], 250);
  await new Promise(resolve => setTimeout(resolve, 1000)); // Give relayer time to pick up

  await orderService.createOrderAndPublishEvent('user-456', ['Product C'], 100);
  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log('\n--- Final State ---');
  console.log('Orders in DB:', db.getOrder('ORD-')); // Will not show full map, just check for existence
  console.log('Outbox contents (all):', db.getOutboxContents());

  outboxRelayer.stopPolling();
}

runDemo();
