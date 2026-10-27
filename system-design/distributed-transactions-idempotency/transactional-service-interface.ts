/**
 * @file This file defines a simplified interface for a service that performs
 *       a unit of work, illustrating what a "local transaction" might look like
 *       within a single service boundary. This is the building block for
 *       distributed transactions.
 */

interface ILocalTransactionService<TInput, TOutput> {
  /**
   * Executes a unit of work within the service's local transactional boundary.
   * This method is expected to either fully succeed or fully fail,
   * typically leveraging a single database transaction.
   * @param data The input data required for the operation.
   * @returns The result of the operation.
   * @throws An error if the local transaction fails.
   */
  execute(data: TInput): Promise<TOutput>;

  /**
   * Optionally defines a compensation action for the unit of work.
   * This is crucial when this service is part of a larger distributed transaction (Saga).
   * If the `execute` method succeeded but a subsequent step in the distributed
   * transaction failed, this method should reverse the effects of `execute`.
   * @param context Data needed to reverse the operation (e.g., original order ID, payment ID).
   * @returns A promise that resolves when compensation is complete.
   * @throws An error if compensation fails, which might require manual intervention.
   */
  compensate?(context: any): Promise<void>;
}

// Example usage:
interface CreateOrderInput {
  userId: string;
  productId: string;
  quantity: number;
}

interface OrderOutput {
  orderId: string;
  status: 'pending' | 'completed' | 'failed';
}

class OrderProcessingService implements ILocalTransactionService<CreateOrderInput, OrderOutput> {
  async execute(data: CreateOrderInput): Promise<OrderOutput> {
    console.log(`[OrderService] Attempting to create order for user ${data.userId}, product ${data.productId}, quantity ${data.quantity}`);
    // Simulate database transaction
    const orderId = `ORDER-${Date.now()}`;
    // await db.transaction(async (trx) => {
    //   await trx('orders').insert({ id: orderId, userId: data.userId, productId: data.productId, quantity: data.quantity, status: 'pending' });
    //   // ... other local operations
    // });
    console.log(`[OrderService] Order ${orderId} created successfully locally.`);
    return { orderId, status: 'pending' };
  }

  async compensate(context: { orderId: string }): Promise<void> {
    console.log(`[OrderService] Compensating order ${context.orderId}: marking as cancelled/failed.`);
    // Simulate database update to reverse the order creation
    // await db('orders').where({ id: context.orderId }).update({ status: 'cancelled' });
    console.log(`[OrderService] Order ${context.orderId} compensation complete.`);
  }
}

// Another example: Payment service
interface ProcessPaymentInput {
  orderId: string;
  amount: number;
  userId: string;
}

interface PaymentOutput {
  paymentId: string;
  status: 'approved' | 'rejected';
}

class PaymentService implements ILocalTransactionService<ProcessPaymentInput, PaymentOutput> {
  async execute(data: ProcessPaymentInput): Promise<PaymentOutput> {
    console.log(`[PaymentService] Processing payment for order ${data.orderId}, amount ${data.amount}`);
    // Simulate external payment gateway call and local payment record
    const paymentId = `PAY-${Date.now()}`;
    // await db.transaction(async (trx) => {
    //   await trx('payments').insert({ id: paymentId, orderId: data.orderId, amount: data.amount, status: 'approved' });
    // });
    console.log(`[PaymentService] Payment ${paymentId} approved for order ${data.orderId}.`);
    return { paymentId, status: 'approved' };
  }

  async compensate(context: { paymentId: string; orderId: string }): Promise<void> {
    console.log(`[PaymentService] Compensating payment ${context.paymentId} for order ${context.orderId}: initiating refund.`);
    // Simulate refund call to payment gateway and update local record
    // await paymentGateway.refund(context.paymentId);
    // await db('payments').where({ id: context.paymentId }).update({ status: 'refunded' });
    console.log(`[PaymentService] Payment ${context.paymentId} compensation (refund) complete.`);
  }
}
