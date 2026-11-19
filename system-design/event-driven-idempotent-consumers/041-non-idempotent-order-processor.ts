/**
 * Simulates a non-idempotent order processing service.
 * If `processOrder` is called multiple times with the same order, it will result in duplicate actions.
 */

interface OrderPayload {
  orderId: string;
  userId: string;
  amount: number;
  currency: string;
}

class PaymentGateway {
  async charge(userId: string, amount: number, currency: string): Promise<boolean> {
    console.log(`[PaymentGateway] Charging user ${userId} for ${amount} ${currency}...`);
    // Simulate async payment processing
    await new Promise(resolve => setTimeout(resolve, 100));
    console.log(`[PaymentGateway] User ${userId} charged successfully for ${amount} ${currency}.`);
    return true;
  }
}

class OrderRepository {
  private orders: Map<string, OrderPayload> = new Map();

  async createOrder(order: OrderPayload): Promise<OrderPayload> {
    if (this.orders.has(order.orderId)) {
      // This simplistic example doesn't prevent duplicate creation here,
      // focusing on the payment side effect for non-idempotency demo.
      // A real system would have unique constraints.
      console.warn(`[OrderRepository] Order ${order.orderId} already exists. Creating anyway for demo.`);
    }
    this.orders.set(order.orderId, order);
    console.log(`[OrderRepository] Order ${order.orderId} created.`);
    return order;
  }

  async getOrderById(orderId: string): Promise<OrderPayload | undefined> {
    return this.orders.get(orderId);
  }
}

export class NonIdempotentOrderProcessor {
  private paymentGateway: PaymentGateway;
  private orderRepository: OrderRepository;

  constructor() {
    this.paymentGateway = new PaymentGateway();
    this.orderRepository = new OrderRepository();
  }

  /**
   * Processes an order. This method is NOT idempotent.
   * If called multiple times with the same orderId, it will charge the customer multiple times.
   */
  async processOrder(order: OrderPayload): Promise<void> {
    console.log(`\n--- Processing Order ${order.orderId} (Non-Idempotent) ---`);

    // 1. Charge customer
    const paymentSuccess = await this.paymentGateway.charge(order.userId, order.amount, order.currency);

    if (!paymentSuccess) {
      console.error(`Failed to charge for order ${order.orderId}. Aborting.`);
      return;
    }

    // 2. Create order record
    await this.orderRepository.createOrder(order);

    console.log(`Order ${order.orderId} processed successfully.`);
  }
}

// --- Demonstration --- 
async function runDemo() {
  const processor = new NonIdempotentOrderProcessor();

  const order1: OrderPayload = {
    orderId: 'ORD-001',
    userId: 'user-abc',
    amount: 99.99,
    currency: 'USD',
  };

  console.log('--- First attempt to process ORD-001 ---');
  await processor.processOrder(order1);

  console.log('\n--- Second attempt to process ORD-001 (simulating duplicate message) ---');
  await processor.processOrder(order1);

  console.log('\nExpected output: PaymentGateway.charge() is called twice for ORD-001.');
}

if (require.main === module) {
  runDemo();
}
