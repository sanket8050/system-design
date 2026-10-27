/**
 * @file This file provides a simplified example of a Saga Orchestrator.
 *       It demonstrates how an orchestrator can manage a sequence of
 *       local transactions and their corresponding compensation actions.
 *       This is a conceptual implementation, actual orchestrators would
 *       use persistent state (database), message queues, and robust error handling.
 */

// A step in the Saga, representing a local transaction within a service.
interface SagaStep<TContext> {
  name: string;
  execute(context: TContext): Promise<any>; // Executes the local transaction
  compensate(context: TContext): Promise<void>; // Reverses the local transaction
}

// The context passed between Saga steps, holding all necessary data.
interface OrderSagaContext {
  orderId?: string;
  userId: string;
  productId: string;
  quantity: number;
  amount: number;
  paymentId?: string;
  inventoryDeducted?: boolean;
  status: 'pending' | 'completed' | 'failed' | 'compensated';
  error?: string;
}

class SagaOrchestrator<TContext extends { status: string; error?: string }> {
  private steps: SagaStep<TContext>[];
  private context: TContext;

  constructor(initialContext: TContext, steps: SagaStep<TContext>[]) {
    this.context = initialContext;
    this.steps = steps;
  }

  public async executeSaga(): Promise<TContext> {
    console.log(`[Saga Orchestrator] Starting Saga with context:`, this.context);
    const executedSteps: SagaStep<TContext>[] = [];

    for (let i = 0; i < this.steps.length; i++) {
      const step = this.steps[i];
      console.log(`[Saga Orchestrator] Executing step: ${step.name}`);
      try {
        await step.execute(this.context);
        executedSteps.push(step);
        console.log(`[Saga Orchestrator] Step '${step.name}' completed.`);
      } catch (error: any) {
        console.error(`[Saga Orchestrator] Step '${step.name}' FAILED:`, error.message);
        this.context.status = 'failed';
        this.context.error = error.message;
        await this.compensateSaga(executedSteps);
        return this.context;
      }
    }

    this.context.status = 'completed';
    console.log(`[Saga Orchestrator] Saga completed successfully.`);
    return this.context;
  }

  private async compensateSaga(successfulSteps: SagaStep<TContext>[]): Promise<void> {
    console.log(`[Saga Orchestrator] Initiating compensation for ${successfulSteps.length} successful steps.`);
    // Compensate in reverse order of execution
    for (let i = successfulSteps.length - 1; i >= 0; i--) {
      const step = successfulSteps[i];
      console.log(`[Saga Orchestrator] Compensating step: ${step.name}`);
      try {
        await step.compensate(this.context);
        console.log(`[Saga Orchestrator] Step '${step.name}' compensated.`);
      } catch (compensationError: any) {
        console.error(`[Saga Orchestrator] CRITICAL: Compensation for step '${step.name}' FAILED:`, compensationError.message);
        // This is a serious issue. Manual intervention is likely required here.
        // In a real system, this would trigger alerts, dead-letter queues, etc.
      }
    }
    this.context.status = 'compensated';
    console.log(`[Saga Orchestrator] Saga compensation complete.`);
  }
}

// --- Mock Saga Steps (representing interactions with different services) ---

// Step 1: Create Order
const createOrderStep: SagaStep<OrderSagaContext> = {
  name: 'CreateOrder',
  execute: async (context) => {
    // Simulate Order Service call
    console.log(`  [OrderService] Creating order for user ${context.userId}, product ${context.productId}...`);
    const orderId = `ORD-${Date.now()}`;
    context.orderId = orderId;
    // Simulate DB write
    // await orderService.createOrder(context.userId, context.productId, context.quantity);
    console.log(`  [OrderService] Order ${orderId} created.`);
  },
  compensate: async (context) => {
    if (context.orderId) {
      console.log(`  [OrderService] Compensating: Cancelling order ${context.orderId}...`);
      // Simulate DB update to cancel order
      // await orderService.cancelOrder(context.orderId);
      console.log(`  [OrderService] Order ${context.orderId} cancelled.`);
    }
  },
};

// Step 2: Process Payment
const processPaymentStep: SagaStep<OrderSagaContext> = {
  name: 'ProcessPayment',
  execute: async (context) => {
    // Simulate Payment Service call
    console.log(`  [PaymentService] Processing payment for order ${context.orderId}, amount ${context.amount}...`);
    // Simulate a payment failure condition
    if (context.amount < 10) {
      throw new Error('Payment amount too low.');
    }
    const paymentId = `PAY-${Date.now()}`;
    context.paymentId = paymentId;
    // await paymentService.processPayment(context.orderId, context.amount);
    console.log(`  [PaymentService] Payment ${paymentId} processed.`);
  },
  compensate: async (context) => {
    if (context.paymentId) {
      console.log(`  [PaymentService] Compensating: Refunding payment ${context.paymentId}...`);
      // Simulate Payment Service refund
      // await paymentService.refundPayment(context.paymentId);
      console.log(`  [PaymentService] Payment ${context.paymentId} refunded.`);
    }
  },
};

// Step 3: Deduct Inventory
const deductInventoryStep: SagaStep<OrderSagaContext> = {
  name: 'DeductInventory',
  execute: async (context) => {
    // Simulate Inventory Service call
    console.log(`  [InventoryService] Deducting ${context.quantity} of product ${context.productId}...`);
    // Simulate an inventory failure condition
    if (context.quantity > 5) { // e.g., only 5 items in stock
      throw new Error('Insufficient inventory.');
    }
    context.inventoryDeducted = true;
    // await inventoryService.deductStock(context.productId, context.quantity);
    console.log(`  [InventoryService] Inventory deducted.`);
  },
  compensate: async (context) => {
    if (context.inventoryDeducted) {
      console.log(`  [InventoryService] Compensating: Restoring ${context.quantity} of product ${context.productId}...`);
      // Simulate Inventory Service restore
      // await inventoryService.restoreStock(context.productId, context.quantity);
      console.log(`  [InventoryService] Inventory restored.`);
    }
  },
};
