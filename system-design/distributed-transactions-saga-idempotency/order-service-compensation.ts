import { SagaStep } from './saga-orchestrator';
import { Logger } from './utils/logger';

/**
 * Define the context type for our example Saga.
 * This context will be passed between different saga steps.
 */
interface OrderPlacementContext {
  userId: string;
  orderId?: string; // Set by OrderService
  productId: string;
  quantity: number;
  paymentProcessed?: boolean; // Set by PaymentService
  inventoryReduced?: boolean; // Set by InventoryService
  shippingScheduled?: boolean; // Set by ShippingService
}

/**
 * Represents a service that participates in a Saga.
 * It implements the `execute` and `compensate` logic for its part of the transaction.
 */
export interface SagaParticipant<TContext extends object> {
  name: string;
  execute: (context: TContext) => Promise<TContext>;
  compensate: (context: TContext) => Promise<TContext>;
}

/**
 * Extended Order Service Participant with more robust compensation logic.
 */
export class OrderServiceParticipant implements SagaParticipant<OrderPlacementContext> {
  public name = 'OrderService';
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger || new Logger();
  }

  /**
   * Executes the order creation logic.
   * @param context The current saga context.
   * @returns Updated context with orderId.
   */
  public async execute(context: OrderPlacementContext): Promise<OrderPlacementContext> {
    this.logger.info(`[${this.name}] Executing: Creating order for user ${context.userId}, product ${context.productId}...`);

    // Simulate calling an external Order API
    // This might throw an error if the user is banned, product is invalid, etc.
    const newOrderId = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    // Simulate saving order to a database
    // In a real system, this would involve a DB transaction.
    // Assume this is an atomic operation within the OrderService.
    this.logger.info(`[${this.name}] Order ${newOrderId} created successfully.`);

    return { ...context, orderId: newOrderId };
  }

  /**
   * Compensates for a previously created order by cancelling it.
   * This operation must be idempotent.
   * @param context The current saga context, potentially containing the orderId.
   * @returns Updated context, marking the order as cancelled or indicating no action was taken.
   */
  public async compensate(context: OrderPlacementContext): Promise<OrderPlacementContext> {
    if (!context.orderId) {
      this.logger.warn(`[${this.name}] Compensating: No order ID found in context to cancel. Skipping compensation.`);
      return context; // Nothing to compensate if no order was created.
    }

    // Simulate checking the order status before attempting to cancel
    // This makes the compensation idempotent: if already cancelled, do nothing.
    const currentOrderStatus = await this.getOrderStatus(context.orderId);

    if (currentOrderStatus === 'cancelled') {
      this.logger.info(`[${this.name}] Compensating: Order ${context.orderId} is already cancelled. Idempotent action.`);
      return context;
    } else if (currentOrderStatus === 'completed' || currentOrderStatus === 'shipped') {
      // This is a critical scenario: order was completed/shipped but needs to be compensated.
      // Requires careful business logic, potentially manual review, or specific return/recall process.
      this.logger.error(
        `[${this.name}] CRITICAL: Attempting to cancel completed/shipped order ${context.orderId}. ` +
        `This may require manual intervention or a specific return process.`
      );
      // In a real system, this might throw an error to signal unrecoverable state
      // or trigger a different, manual workflow.
      // For now, we'll proceed with a simulated cancellation.
    }

    this.logger.warn(`[${this.name}] Compensating: Attempting to cancel order ${context.orderId}...`);
    // Simulate API call to Order Service to cancel the order
    // This call should also be idempotent on the receiving service side.
    await new Promise(resolve => setTimeout(resolve, 150)); // Simulate async API call

    // Simulate updating the order status in the database to 'cancelled'
    this.logger.warn(`[${this.name}] Order ${context.orderId} successfully cancelled.`);

    // Update context to reflect the compensation status if needed
    return { ...context, orderId: undefined }; // Or add a 'orderStatus: 'cancelled'' field
  }

  private async getOrderStatus(orderId: string): Promise<'pending' | 'completed' | 'cancelled' | 'shipped'> {
    // Simulate fetching order status from a database or order service API
    // For demo purposes, assume it's often 'pending' unless explicitly cancelled.
    // Could add random chance of being 'cancelled' to test idempotency.
    if (orderId.includes('ALREADY_CANCELLED')) {
      return 'cancelled';
    }
    return 'pending';
  }
}

// Dummy Logger for demonstration
class Logger {
    info(...args: any[]) { console.log('[INFO]', ...args); }
    warn(...args: any[]) { console.warn('[WARN]', ...args); }
    error(...args: any[]) { console.error('[ERROR]', ...args); }
}

// This file primarily focuses on the enhanced compensation logic.
// For a full example, refer back to 'saga-participant.ts' for other participants
// and 'saga-orchestrator.ts' for how to wire them up.
