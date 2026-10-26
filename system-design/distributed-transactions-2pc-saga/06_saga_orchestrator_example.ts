/**
 * 06_saga_orchestrator_example.ts
 * A simplified example of the Saga Orchestration pattern.
 * An Order Creation Saga involving multiple services.
 */

// --- Interfaces and Mocks for Services (similar to 02_problem_scenario.ts) ---

interface Order {
  orderId: string;
  userId: string;
  productId: string;
  quantity: number;
  amount: number;
  status: 'PENDING' | 'PAID' | 'INVENTORY_RESERVED' | 'COMPLETED' | 'FAILED' | 'REFUNDED' | 'STOCK_RELEASED';
}

class MockOrderService {
  private orders: Map<string, Order> = new Map();

  async createOrder(userId: string, productId: string, quantity: number, amount: number): Promise<Order> {
    const orderId = `ORD-${Date.now()}`;
    const newOrder: Order = { orderId, userId, productId, quantity, amount, status: 'PENDING' };
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

  async getOrder(orderId: string): Promise<Order | undefined> {
    return this.orders.get(orderId);
  }
}

class MockPaymentService {
  private payments: Map<string, { orderId: string, amount: number, status: string }> = new Map();

  async processPayment(orderId: string, amount: number, shouldFail: boolean = false): Promise<string> {
    console.log(`[PaymentService] Processing payment for order ${orderId}, amount ${amount}...`);
    if (shouldFail) {
      console.error(`[PaymentService] Payment for order ${orderId} FAILED unpredictably.`);
      throw new Error('Payment gateway error');
    }
    const paymentId = `PAY-${Date.now()}`;
    this.payments.set(paymentId, { orderId, amount, status: 'COMPLETED' });
    console.log(`[PaymentService] Payment ${paymentId} for order ${orderId} COMPLETED.`);
    return paymentId;
  }

  async refundPayment(orderId: string): Promise<void> {
    console.log(`[PaymentService] Refunding payment for order ${orderId}...`);
    // In a real system, you'd find the payment by orderId and update its status/process refund.
    // For simplicity, we just log.
    console.log(`[PaymentService] Payment for order ${orderId} REFUNDED.`);
  }
}

class MockInventoryService {
  private inventory: Map<string, { productId: string, stock: number }> = new Map();

  constructor() {
    this.inventory.set('PROD-123', { productId: 'PROD-123', stock: 100 });
  }

  async reserveStock(productId: string, quantity: number, shouldFail: boolean = false): Promise<void> {
    console.log(`[InventoryService] Reserving ${quantity} for product ${productId}...`);
    const item = this.inventory.get(productId);
    if (!item) {
      throw new Error(`Product ${productId} not found.`);
    }
    if (item.stock < quantity) {
      throw new Error(`Insufficient stock for product ${productId}.`);
    }
    if (shouldFail) {
      console.error(`[InventoryService] Stock reservation for product ${productId} FAILED unpredictably.`);
      throw new Error('Inventory reservation error');
    }
    item.stock -= quantity; // Simulate reservation by deducting
    console.log(`[InventoryService] Stock for ${productId} reserved. Remaining: ${item.stock}.`);
  }

  async releaseStock(productId: string, quantity: number): Promise<void> {
    console.log(`[InventoryService] Releasing ${quantity} for product ${productId}...`);
    const item = this.inventory.get(productId);
    if (item) {
      item.stock += quantity;
      console.log(`[InventoryService] Stock for ${productId} released. Current: ${item.stock}.`);
    }
  }

  async getStock(productId: string): Promise<number | undefined> {
    return this.inventory.get(productId)?.stock;
  }
}

// --- Saga Orchestration Logic ---

interface SagaStep {
  name: string;
  execute(context: Record<string, any>): Promise<void>;
  compensate(context: Record<string, any>): Promise<void>;
}

class SagaOrchestrator {
  private steps: SagaStep[];
  private context: Record<string, any>;

  constructor(initialContext: Record<string, any>) {
    this.steps = [];
    this.context = { ...initialContext };
  }

  addStep(step: SagaStep): SagaOrchestrator {
    this.steps.push(step);
    return this;
  }

  async execute(): Promise<boolean> {
    const completedSteps: SagaStep[] = [];
    console.log(`\n--- Saga Orchestrator: Starting Saga ---`);

    for (const step of this.steps) {
      try {
        console.log(`[Orchestrator] Executing step: ${step.name}`);
        await step.execute(this.context);
        completedSteps.push(step);
      } catch (error: any) {
        console.error(`[Orchestrator] Step '${step.name}' FAILED: ${error.message}. Initiating compensation.`);
        await this.compensate(completedSteps.reverse()); // Compensate in reverse order
        console.log(`[Orchestrator] Saga FAILED and compensated.`);
        return false;
      }
    }
    console.log(`[Orchestrator] Saga COMPLETED successfully.`);
    return true;
  }

  private async compensate(stepsToCompensate: SagaStep[]): Promise<void> {
    console.log(`[Orchestrator] Starting compensation for ${stepsToCompensate.length} steps.`);
    for (const step of stepsToCompensate) {
      try {
        console.log(`[Orchestrator] Compensating step: ${step.name}`);
        await step.compensate(this.context);
      } catch (compensateError: any) {
        console.error(`[Orchestrator] Compensation for step '${step.name}' FAILED: ${compensateError.message}. Manual intervention may be required!`);
        // In a real system, this would trigger alerts or dead-letter queues.
      }
    }
    console.log(`[Orchestrator] Compensation finished.`);
  }
}

// --- Define Saga Steps ---

const orderService = new MockOrderService();
const paymentService = new MockPaymentService();
const inventoryService = new MockInventoryService();

const createOrderStep: SagaStep = {
  name: 'Create Order',
  execute: async (context) => {
    const order = await orderService.createOrder(context.userId, context.productId, context.quantity, context.amount);
    context.orderId = order.orderId;
    context.order = order;
  },
  compensate: async (context) => {
    if (context.orderId) {
      await orderService.updateOrderStatus(context.orderId, 'FAILED'); // Mark order as failed
      console.log(`[Compensate:CreateOrder] Order ${context.orderId} marked as FAILED.`);
    }
  },
};

const processPaymentStep: SagaStep = {
  name: 'Process Payment',
  execute: async (context) => {
    await paymentService.processPayment(context.orderId, context.amount, context.simulatePaymentFailure);
    await orderService.updateOrderStatus(context.orderId, 'PAID');
  },
  compensate: async (context) => {
    if (context.orderId) {
      await paymentService.refundPayment(context.orderId);
      await orderService.updateOrderStatus(context.orderId, 'REFUNDED');
      console.log(`[Compensate:ProcessPayment] Order ${context.orderId} payment refunded.`);
    }
  },
};

const reserveInventoryStep: SagaStep = {
  name: 'Reserve Inventory',
  execute: async (context) => {
    await inventoryService.reserveStock(context.productId, context.quantity, context.simulateInventoryFailure);
    await orderService.updateOrderStatus(context.orderId, 'INVENTORY_RESERVED');
  },
  compensate: async (context) => {
    if (context.orderId) {
      await inventoryService.releaseStock(context.productId, context.quantity);
      await orderService.updateOrderStatus(context.orderId, 'STOCK_RELEASED');
      console.log(`[Compensate:ReserveInventory] Stock for ${context.productId} released.`);
    }
  },
};

const finalizeOrderStep: SagaStep = {
  name: 'Finalize Order',
  execute: async (context) => {
    await orderService.updateOrderStatus(context.orderId, 'COMPLETED');
  },
  compensate: async (context) => {
    // If this step fails, previous steps are already committed. We can't 'undo' a completed order easily.
    // Here, compensation might involve a manual review or a different status.
    if (context.orderId) {
      await orderService.updateOrderStatus(context.orderId, 'FAILED'); // As a fallback
      console.log(`[Compensate:FinalizeOrder] Order ${context.orderId} marked as FAILED (post-completion attempt).`);
    }
  },
};

// --- Test Scenarios ---

async function runSagaScenario(scenarioName: string, initialContext: Record<string, any>) {
  console.log(`\n======================================================`);
  console.log(`Running Saga Scenario: ${scenarioName}`);
  console.log(`======================================================`);

  const saga = new SagaOrchestrator(initialContext)
    .addStep(createOrderStep)
    .addStep(processPaymentStep)
    .addStep(reserveInventoryStep)
    .addStep(finalizeOrderStep);

  const success = await saga.execute();
  console.log(`\nSaga Final Result: ${success ? 'SUCCESS' : 'FAILURE'}`);

  // Check final state of order and inventory
  if (saga.context.orderId) {
    const finalOrder = await orderService.getOrder(saga.context.orderId);
    const finalStock = await inventoryService.getStock(saga.context.productId);
    console.log(`Final Order ${saga.context.orderId} Status: ${finalOrder?.status}`);
    console.log(`Final Product ${saga.context.productId} Stock: ${finalStock}`);
  }
}

// Scenario 1: All successful
(async () => {
  await runSagaScenario('All Steps Succeed', {
    userId: 'user-a', productId: 'PROD-123', quantity: 2, amount: 200,
    simulatePaymentFailure: false, simulateInventoryFailure: false
  });
})();

// Scenario 2: Payment fails - Compensation should refund payment and mark order as failed/refunded.
// (async () => {
//   await runSagaScenario('Payment Step Fails', {
//     userId: 'user-b', productId: 'PROD-123', quantity: 1, amount: 100,
//     simulatePaymentFailure: true, simulateInventoryFailure: false
//   });
// })();

// Scenario 3: Inventory reservation fails - Compensation should refund payment and release stock.
// (async () => {
//   await runSagaScenario('Inventory Step Fails', {
//     userId: 'user-c', productId: 'PROD-123', quantity: 3, amount: 300,
//     simulatePaymentFailure: false, simulateInventoryFailure: true
//   });
// })();
