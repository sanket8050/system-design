/**
 * Simulates an idempotent order processing service.
 * Uses an `idempotencyKey` to prevent duplicate processing of the same order.
 */

interface OrderPayload {
  orderId: string;
  userId: string;
  amount: number;
  currency: string;
}

// --- Mock External Services ---

class PaymentGateway {
  async charge(userId: string, amount: number, currency: string): Promise<boolean> {
    console.log(`[PaymentGateway] Charging user ${userId} for ${amount} ${currency}...`);
    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate async
    console.log(`[PaymentGateway] User ${userId} charged successfully for ${amount} ${currency}.`);
    return true;
  }
}

class OrderRepository {
  private orders: Map<string, OrderPayload> = new Map();

  async createOrder(order: OrderPayload): Promise<OrderPayload> {
    // In a real system, this would involve a unique constraint on orderId.
    if (this.orders.has(order.orderId)) {
      console.log(`[OrderRepository] Order ${order.orderId} already exists. Skipping creation.`);
      return this.orders.get(order.orderId)!; // Return existing order
    }
    this.orders.set(order.orderId, order);
    console.log(`[OrderRepository] Order ${order.orderId} created.`);
    return order;
  }
}

// --- Idempotency Store (Simulated) ---

class IdempotencyStore {
  private processedKeys: Set<string> = new Set();

  async hasProcessed(key: string): Promise<boolean> {
    console.log(`[IdempotencyStore] Checking key: ${key}`);
    await new Promise(resolve => setTimeout(resolve, 50)); // Simulate async DB/cache lookup
    return this.processedKeys.has(key);
  }

  async markAsProcessed(key: string): Promise<void> {
    console.log(`[IdempotencyStore] Marking key as processed: ${key}`);
    await new Promise(resolve => setTimeout(resolve, 50)); // Simulate async DB/cache write
    this.processedKeys.add(key);
  }

  // In a real system, this would also need to handle concurrent writes carefully.
  // For example, using `INSERT IF NOT EXISTS` with a unique constraint on the key.
}

export class IdempotentOrderProcessor {
  private paymentGateway: PaymentGateway;
  private orderRepository: OrderRepository;
  private idempotencyStore: IdempotencyStore;

  constructor() {
    this.paymentGateway = new PaymentGateway();
    this.orderRepository = new OrderRepository();
    this.idempotencyStore = new IdempotencyStore();
  }

  /**
   * Processes an order idempotently using a unique idempotency key.
   * The key ensures that even if the message is re-delivered, the side effects (charging, creating order)
   * happen only once.
   * @param order The order payload.
   * @param idempotencyKey A unique key for this specific processing attempt (e.g., message ID, request ID).
   */
  async processOrder(order: OrderPayload, idempotencyKey: string): Promise<void> {
    console.log(`\n--- Processing Order ${order.orderId} with Key ${idempotencyKey} (Idempotent) ---`);

    // 1. Check idempotency key
    const alreadyProcessed = await this.idempotencyStore.hasProcessed(idempotencyKey);
    if (alreadyProcessed) {
      console.log(`Idempotency key ${idempotencyKey} already processed. Skipping duplicate.`);
      return;
    }

    // Start a conceptual transaction here if possible (e.g., database transaction)
    try {
      // 2. Perform business logic (charge customer)
      const paymentSuccess = await this.paymentGateway.charge(order.userId, order.amount, order.currency);

      if (!paymentSuccess) {
        console.error(`Failed to charge for order ${order.orderId}. Aborting.`);
        // In a real system, this would roll back the transaction if payment was part of it
        return;
      }

      // 3. Create order record (this should also be idempotent or part of the same transaction)
      await this.orderRepository.createOrder(order);

      // 4. Mark idempotency key as processed (must be atomic with business logic or after successful completion)
      await this.idempotencyStore.markAsProcessed(idempotencyKey);

      console.log(`Order ${order.orderId} processed successfully with key ${idempotencyKey}.`);
    } catch (error) {
      console.error(`Error processing order ${order.orderId} with key ${idempotencyKey}:`, error);
      // In a real system, this would roll back the transaction
      throw error;
    }
  }
}

// --- Demonstration --- 
async function runDemo() {
  const processor = new IdempotentOrderProcessor();

  const order1: OrderPayload = {
    orderId: 'ORD-002',
    userId: 'user-xyz',
    amount: 120.50,
    currency: 'EUR',
  };
  const idempotencyKey1 = 'msg-abc-123'; // This would typically come from the message broker

  console.log('--- First attempt to process ORD-002 ---');
  await processor.processOrder(order1, idempotencyKey1);

  console.log('\n--- Second attempt to process ORD-002 (simulating duplicate message) ---');
  await processor.processOrder(order1, idempotencyKey1);

  const order2: OrderPayload = {
    orderId: 'ORD-003',
    userId: 'user-def',
    amount: 50.00,
    currency: 'GBP',
  };
  const idempotencyKey2 = 'msg-def-456';

  console.log('\n--- Processing a new order ORD-003 ---');
  await processor.processOrder(order2, idempotencyKey2);

  console.log('\nExpected output: PaymentGateway.charge() is called only once for ORD-002.');
  console.log('The second call for ORD-002 should be skipped due to idempotency check.');
}

if (require.main === module) {
  runDemo();
}
