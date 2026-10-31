import { SagaStep } from './saga-orchestrator';
import { Logger } from './utils/logger'; // Assume a logger utility exists

/**
 * Define the context type for our example Saga.
 * This context will be passed between different saga steps.
 */
interface OrderPlacementContext {
  userId: string;
  orderId?: string;
  productId: string;
  quantity: number;
  paymentProcessed?: boolean;
  inventoryReduced?: boolean;
  shippingScheduled?: boolean;
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
 * Example Saga Participant: Order Service
 * This participant is responsible for creating an order.
 */
export class OrderServiceParticipant implements SagaParticipant<OrderPlacementContext> {
  public name = 'OrderService';
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger || new Logger();
  }

  public async execute(context: OrderPlacementContext): Promise<OrderPlacementContext> {
    this.logger.info(`[${this.name}] Executing: Creating order for user ${context.userId}, product ${context.productId}...`);
    // Simulate API call to Order Service to create an order
    const newOrderId = `ORD-${Date.now()}`;
    this.logger.info(`[${this.name}] Order ${newOrderId} created successfully.`);
    return { ...context, orderId: newOrderId };
  }

  public async compensate(context: OrderPlacementContext): Promise<OrderPlacementContext> {
    if (context.orderId) {
      this.logger.warn(`[${this.name}] Compensating: Cancelling order ${context.orderId}...`);
      // Simulate API call to Order Service to cancel the order
      this.logger.warn(`[${this.name}] Order ${context.orderId} cancelled.`);
    } else {
      this.logger.warn(`[${this.name}] Compensating: No order to cancel (orderId not found).`);
    }
    return context; // Context remains unchanged or updated to reflect cancellation status
  }
}

/**
 * Example Saga Participant: Payment Service
 * This participant is responsible for processing payment.
 */
export class PaymentServiceParticipant implements SagaParticipant<OrderPlacementContext> {
  public name = 'PaymentService';
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger || new Logger();
  }

  public async execute(context: OrderPlacementContext): Promise<OrderPlacementContext> {
    if (!context.orderId) {
      throw new Error('Cannot process payment without an order ID.');
    }
    this.logger.info(`[${this.name}] Executing: Processing payment for order ${context.orderId}...`);
    // Simulate payment processing
    if (Math.random() < 0.1) { // Simulate a 10% payment failure rate
      throw new Error('Payment gateway declined transaction.');
    }
    this.logger.info(`[${this.name}] Payment processed successfully for order ${context.orderId}.`);
    return { ...context, paymentProcessed: true };
  }

  public async compensate(context: OrderPlacementContext): Promise<OrderPlacementContext> {
    if (context.paymentProcessed && context.orderId) {
      this.logger.warn(`[${this.name}] Compensating: Refunding payment for order ${context.orderId}...`);
      // Simulate API call to Payment Service to refund the payment
      this.logger.warn(`[${this.name}] Payment refunded for order ${context.orderId}.`);
    } else {
      this.logger.warn(`[${this.name}] Compensating: No payment to refund or orderId missing.`);
    }
    return { ...context, paymentProcessed: false };
  }
}

// Dummy Logger for demonstration
class Logger {
    info(...args: any[]) { console.log('[INFO]', ...args); }
    warn(...args: any[]) { console.warn('[WARN]', ...args); }
    error(...args: any[]) { console.error('[ERROR]', ...args); }
}

// Example of how to use these participants with the orchestrator
/*
(async () => {
  const logger = new Logger();
  const orderService = new OrderServiceParticipant(logger);
  const paymentService = new PaymentServiceParticipant(logger);

  const sagaSteps: SagaStep<OrderPlacementContext>[] = [
    {
      name: orderService.name,
      execute: orderService.execute.bind(orderService),
      compensate: orderService.compensate.bind(orderService),
    },
    {
      name: paymentService.name,
      execute: paymentService.execute.bind(paymentService),
      compensate: paymentService.compensate.bind(paymentService),
    },
    // ... other steps like InventoryService, ShippingService
  ];

  const orchestrator = new SagaOrchestrator(sagaSteps, logger);

  const initialContext: OrderPlacementContext = {
    userId: 'user-123',
    productId: 'prod-XYZ',
    quantity: 2,
  };

  logger.info('\n--- Running Successful Saga ---');
  const successState = await orchestrator.execute({ context: initialContext });
  logger.info('Final Saga State (Success):', successState);

  logger.info('\n--- Running Failing Saga (Payment fails) ---');
  // To simulate failure, we might inject a failure somewhere or rely on the random failure.
  // For this demo, let's just run it again and hope for the 10% failure rate.
  const failState = await orchestrator.execute({ context: initialContext });
  logger.info('Final Saga State (Failure):', failState);
})();
*/
