/**
 * 02_problem_scenario.ts
 * Illustrates the problem of distributed transactions without a proper coordination mechanism.
 * A simple order processing flow where a failure can lead to data inconsistency.
 */

interface Order {
  orderId: string;
  userId: string;
  productId: string;
  quantity: number;
  amount: number;
  status: 'PENDING' | 'PAID' | 'COMPLETED' | 'FAILED';
}

interface Payment {
  paymentId: string;
  orderId: string;
  amount: number;
  status: 'INITIATED' | 'COMPLETED' | 'FAILED';
}

interface InventoryItem {
  productId: string;
  stock: number;
}

// --- Mock Services ---

class OrderService {
  private orders: Map<string, Order> = new Map();

  async createOrder(userId: string, productId: string, quantity: number, amount: number): Promise<Order> {
    const orderId = `ORD-${Date.now()}`;
    const newOrder: Order = {
      orderId, userId, productId, quantity, amount, status: 'PENDING'
    };
    this.orders.set(orderId, newOrder);
    console.log(`[OrderService] Order ${orderId} created as PENDING.`);
    return newOrder;
  }

  async updateOrderStatus(orderId: string, status: Order['status']): Promise<void> {
    const order = this.orders.get(orderId);
    if (order) {
      order.status = status;
      console.log(`[OrderService] Order ${orderId} status updated to ${status}.`);
    } else {
      throw new Error(`Order ${orderId} not found.`);
    }
  }
}

class PaymentService {
  private payments: Map<string, Payment> = new Map();

  async processPayment(orderId: string, amount: number, failRandomly: boolean = false): Promise<Payment> {
    console.log(`[PaymentService] Processing payment for order ${orderId}, amount ${amount}...`);
    if (failRandomly && Math.random() < 0.5) {
      console.error(`[PaymentService] Payment for order ${orderId} FAILED unpredictably.`);
      const failedPayment: Payment = { paymentId: `PAY-${Date.now()}`, orderId, amount, status: 'FAILED' };
      this.payments.set(failedPayment.paymentId, failedPayment);
      throw new Error('Payment gateway error');
    }
    const paymentId = `PAY-${Date.now()}`;
    const newPayment: Payment = { paymentId, orderId, amount, status: 'COMPLETED' };
    this.payments.set(paymentId, newPayment);
    console.log(`[PaymentService] Payment ${paymentId} for order ${orderId} COMPLETED.`);
    return newPayment;
  }
}

class InventoryService {
  private inventory: Map<string, InventoryItem> = new Map();

  constructor() {
    this.inventory.set('PROD-123', { productId: 'PROD-123', stock: 100 });
  }

  async deductStock(productId: string, quantity: number, failRandomly: boolean = false): Promise<void> {
    console.log(`[InventoryService] Deducting ${quantity} for product ${productId}...`);
    const item = this.inventory.get(productId);
    if (!item) {
      throw new Error(`Product ${productId} not found in inventory.`);
    }
    if (item.stock < quantity) {
      throw new Error(`Insufficient stock for product ${productId}.`);
    }

    if (failRandomly && Math.random() < 0.5) {
      console.error(`[InventoryService] Stock deduction for product ${productId} FAILED unpredictably.`);
      throw new Error('Inventory update error');
    }

    item.stock -= quantity;
    console.log(`[InventoryService] Stock for ${productId} reduced by ${quantity}. Remaining: ${item.stock}.`);
  }

  async addStock(productId: string, quantity: number): Promise<void> {
    const item = this.inventory.get(productId);
    if (item) {
      item.stock += quantity;
      console.log(`[InventoryService] Stock for ${productId} increased by ${quantity}. Current: ${item.stock}.`);
    }
  }

  async getStock(productId: string): Promise<number | undefined> {
    return this.inventory.get(productId)?.stock;
  }
}

// --- Main Application Logic (without distributed transaction handling) ---

async function processOrderNaive(userId: string, productId: string, quantity: number, amount: number, simulatePaymentFailure: boolean = false, simulateInventoryFailure: boolean = false) {
  const orderService = new OrderService();
  const paymentService = new PaymentService();
  const inventoryService = new InventoryService();

  console.log('\n--- Starting Naive Order Processing ---');
  let order: Order | undefined;
  try {
    // 1. Create Order (initial PENDING state)
    order = await orderService.createOrder(userId, productId, quantity, amount);

    // 2. Process Payment
    await paymentService.processPayment(order.orderId, order.amount, simulatePaymentFailure);
    await orderService.updateOrderStatus(order.orderId, 'PAID');

    // 3. Deduct Stock
    await inventoryService.deductStock(order.productId, order.quantity, simulateInventoryFailure);

    // 4. Finalize Order
    await orderService.updateOrderStatus(order.orderId, 'COMPLETED');
    console.log(`Order ${order.orderId} processed successfully!`);

  } catch (error: any) {
    console.error(`Order processing FAILED: ${error.message}`);
    if (order) {
      console.warn(`Order ${order.orderId} might be in an inconsistent state.`);
      // What if payment succeeded but inventory failed? Order is PAID, but stock isn't deducted.
      // What if payment failed? Order is PENDING, which is fine.
      // Manual intervention or a complex rollback logic is needed here.
      orderService.updateOrderStatus(order.orderId, 'FAILED').catch(e => console.error(`Failed to update order status to FAILED: ${e.message}`));
    }
  }

  console.log('\n--- Current System State After Naive Processing ---');
  if (order) {
    console.log(`Order ${order.orderId} status: ${orderService['orders'].get(order.orderId)?.status}`);
    console.log(`Product ${productId} stock: ${await inventoryService.getStock(productId)}`);
  }
}

// --- Test Scenarios ---

// Scenario 1: All successful
(async () => {
  await processOrderNaive('user-1', 'PROD-123', 5, 500);
})();

// Scenario 2: Payment fails - Order remains PENDING (or FAILED if updated), stock untouched. (Acceptable)
// (async () => {
//   await processOrderNaive('user-2', 'PROD-123', 3, 300, true, false);
// })();

// Scenario 3: Inventory deduction fails - This is the problem! Order is PAID, but stock isn't deducted.
// (async () => {
//   await processOrderNaive('user-3', 'PROD-123', 2, 200, false, true);
// })();
