/**
 * @file A simplified sketch of an Orchestration-based Saga Coordinator for an e-commerce order.
 * This orchestrator manages the state of the order saga and directs interactions
 * with various microservices (Payment, Inventory, Notification).
 *
 * NOTE: This is an in-memory sketch. A real-world orchestrator would persist its state
 * to a database, use a robust message broker for communication, and handle concurrency.
 */

import {
  OrderCreatedEvent,
  PaymentProcessedEvent,
  PaymentFailedEvent,
  InventoryReservedEvent,
  InventoryReservationFailedEvent,
  OrderCompletedEvent,
  OrderFailedEvent,
} from './04-choreography-event-definitions'; // Reusing event definitions for consistency

// Define possible states for our Order Saga
type SagaState = 'NEW' | 'PAYMENT_PENDING' | 'PAYMENT_COMPLETED' | 'INVENTORY_RESERVATION_PENDING' | 'INVENTORY_RESERVED' | 'COMPLETED' | 'FAILED' | 'COMPENSATING';

/**
 * Represents a single instance of an order saga, holding its current state and relevant data.
 * In a real system, this would be persisted (e.g., in a database table).
 */
interface SagaInstance {
  orderId: string;
  customerId: string;
  totalAmount: number;
  items: { productId: string; quantity: number }[];
  state: SagaState;
  paymentId?: string; // Stored after payment is processed
  inventoryReservationIds?: string[]; // Stored after inventory is reserved
  error?: string; // Details about the failure, if any
  createdAt: string;
  lastUpdatedAt: string;
}

/**
 * Placeholder interfaces for service clients.
 * In a real application, these would be actual HTTP clients or message producers.
 */
interface PaymentServiceClient {
  requestPayment(data: { orderId: string; customerId: string; amount: number }): Promise<void>;
  refundPayment(data: { orderId: string; paymentId: string; amount: number }): Promise<void>;
}

interface InventoryServiceClient {
  reserveInventory(data: { orderId: string; items: { productId: string; quantity: number }[] }): Promise<void>;
  releaseInventory(data: { orderId: string; items: { productId: string; quantity: number }[] }): Promise<void>;
}

interface NotificationServiceClient {
  sendOrderConfirmation(orderId: string, customerId: string): Promise<void>;
  sendOrderFailureNotification(orderId: string, reason: string): Promise<void>;
}

/**
 * The OrderSagaOrchestrator class manages the flow of the order processing saga.
 * It listens for initial requests (e.g., OrderCreatedEvent), sends commands to services,
 * and reacts to their responses/events to drive the saga to completion or compensation.
 */
class OrderSagaOrchestrator {
  // In-memory store for saga instances. In production, use a persistent store (e.g., database).
  private sagaStates: Map<string, SagaInstance> = new Map();

  constructor(
    private paymentService: PaymentServiceClient,
    private inventoryService: InventoryServiceClient,
    private notificationService: NotificationServiceClient,
  ) {}

  /**
   * Initializes a new order saga based on an OrderCreatedEvent.
   * This is the entry point for a new order.
   */
  public async startOrderSaga(event: OrderCreatedEvent): Promise<void> {
    const { orderId, customerId, totalAmount, items } = event;
    const now = new Date().toISOString();

    // Idempotency check: If saga already exists, do nothing or recover.
    if (this.sagaStates.has(orderId)) {
      console.warn(`[${orderId}] Saga already initiated. Skipping.`);
      return;
    }

    const sagaInstance: SagaInstance = {
      orderId,
      customerId,
      totalAmount,
      items,
      state: 'NEW',
      createdAt: now,
      lastUpdatedAt: now,
    };
    this.sagaStates.set(orderId, sagaInstance);
    console.log(`[${orderId}] Saga started. State: ${sagaInstance.state}`);

    try {
      // Step 1: Request Payment
      sagaInstance.state = 'PAYMENT_PENDING';
      sagaInstance.lastUpdatedAt = new Date().toISOString();
      console.log(`[${orderId}] Requesting payment for ${totalAmount}.`);
      await this.paymentService.requestPayment({ orderId, customerId, amount: totalAmount });
      // Payment service will respond with PaymentProcessedEvent or PaymentFailedEvent
    } catch (error: any) {
      console.error(`[${orderId}] Failed to initiate payment:`, error.message);
      sagaInstance.state = 'FAILED';
      sagaInstance.error = `Payment initiation failed: ${error.message}`;
      sagaInstance.lastUpdatedAt = new Date().toISOString();
      await this.notifyOrderFailed(orderId, sagaInstance.error);
    }
  }

  /**
   * Handles the PaymentProcessedEvent from the Payment Service.
   * If successful, proceeds to inventory reservation.
   */
  public async handlePaymentProcessed(event: PaymentProcessedEvent): Promise<void> {
    const { orderId, paymentId } = event;
    const sagaInstance = this.sagaStates.get(orderId);

    if (!sagaInstance || sagaInstance.state !== 'PAYMENT_PENDING') {
      console.warn(`[${orderId}] Payment processed event received in unexpected state (${sagaInstance?.state}) or no saga found. Ignoring.`);
      return; // Idempotency check or out-of-order event
    }

    sagaInstance.state = 'PAYMENT_COMPLETED';
    sagaInstance.paymentId = paymentId;
    sagaInstance.lastUpdatedAt = new Date().toISOString();
    console.log(`[${orderId}] Payment processed. Payment ID: ${paymentId}. State: ${sagaInstance.state}`);

    try {
      // Step 2: Reserve Inventory
      sagaInstance.state = 'INVENTORY_RESERVATION_PENDING';
      sagaInstance.lastUpdatedAt = new Date().toISOString();
      console.log(`[${orderId}] Reserving inventory for items:`, sagaInstance.items);
      await this.inventoryService.reserveInventory({ orderId, items: sagaInstance.items });
      // Inventory service will respond with InventoryReservedEvent or InventoryReservationFailedEvent
    } catch (error: any) {
      console.error(`[${orderId}] Failed to initiate inventory reservation:`, error.message);
      sagaInstance.state = 'COMPENSATING';
      sagaInstance.error = `Inventory reservation initiation failed: ${error.message}`;
      sagaInstance.lastUpdatedAt = new Date().toISOString();
      await this.compensateOrder(sagaInstance);
    }
  }

  /**
   * Handles the PaymentFailedEvent from the Payment Service.
   * Marks the saga as failed and notifies the customer.
   */
  public async handlePaymentFailed(event: PaymentFailedEvent): Promise<void> {
    const { orderId, reason } = event;
    const sagaInstance = this.sagaStates.get(orderId);

    if (!sagaInstance || sagaInstance.state !== 'PAYMENT_PENDING') {
      console.warn(`[${orderId}] Payment failed event received in unexpected state (${sagaInstance?.state}) or no saga found. Ignoring.`);
      return;
    }

    sagaInstance.state = 'FAILED';
    sagaInstance.error = `Payment failed: ${reason}`;
    sagaInstance.lastUpdatedAt = new Date().toISOString();
    console.log(`[${orderId}] Payment failed. Reason: ${reason}. State: ${sagaInstance.state}`);
    await this.notifyOrderFailed(orderId, sagaInstance.error);
  }

  /**
   * Handles the InventoryReservedEvent from the Inventory Service.
   * If successful, completes the order.
   */
  public async handleInventoryReserved(event: InventoryReservedEvent): Promise<void> {
    const { orderId, items } = event;
    const sagaInstance = this.sagaStates.get(orderId);

    if (!sagaInstance || sagaInstance.state !== 'INVENTORY_RESERVATION_PENDING') {
      console.warn(`[${orderId}] Inventory reserved event received in unexpected state (${sagaInstance?.state}) or no saga found. Ignoring.`);
      return;
    }

    sagaInstance.state = 'INVENTORY_RESERVED'; // Intermediate state, could store specific item IDs
    // In a full implementation, you'd store event.items details in sagaInstance.inventoryReservationIds
    sagaInstance.lastUpdatedAt = new Date().toISOString();
    console.log(`[${orderId}] Inventory reserved. State: ${sagaInstance.state}`);

    // Step 3: Finalize Order (e.g., update order status in Order Service and notify customer)
    sagaInstance.state = 'COMPLETED';
    sagaInstance.lastUpdatedAt = new Date().toISOString();
    console.log(`[${orderId}] Order completed successfully. State: ${sagaInstance.state}`);
    await this.notificationService.sendOrderConfirmation(orderId, sagaInstance.customerId);
    // Potentially publish OrderCompletedEvent for other services to consume (hybrid choreography/orchestration)
  }

  /**
   * Handles the InventoryReservationFailedEvent from the Inventory Service.
   * Initiates compensation for previously completed steps.
   */
  public async handleInventoryReservationFailed(event: InventoryReservationFailedEvent): Promise<void> {
    const { orderId, reason } = event;
    const sagaInstance = this.sagaStates.get(orderId);

    if (!sagaInstance || sagaInstance.state !== 'INVENTORY_RESERVATION_PENDING') {
      console.warn(`[${orderId}] Inventory reservation failed event received in unexpected state (${sagaInstance?.state}) or no saga found. Ignoring.`);
      return;
    }

    sagaInstance.state = 'COMPENSATING';
    sagaInstance.error = `Inventory reservation failed: ${reason}`;
    sagaInstance.lastUpdatedAt = new Date().toISOString();
    console.log(`[${orderId}] Inventory reservation failed. Reason: ${reason}. State: ${sagaInstance.state}`);
    await this.compensateOrder(sagaInstance);
  }

  /**
   * Performs compensation logic to undo effects of successful steps.
   * This is critical for maintaining consistency when a later step fails.
   */
  private async compensateOrder(sagaInstance: SagaInstance): Promise<void> {
    console.log(`[${sagaInstance.orderId}] Starting compensation process.`);

    // Compensate payment if it was processed
    if (sagaInstance.paymentId) {
      try {
        console.log(`[${sagaInstance.orderId}] Refunding payment ${sagaInstance.paymentId}.`);
        await this.paymentService.refundPayment({ orderId: sagaInstance.orderId, paymentId: sagaInstance.paymentId, amount: sagaInstance.totalAmount });
        // Payment service would publish PaymentRefundedEvent, which could be handled if further steps depend on it.
      } catch (error) {
        console.error(`[${sagaInstance.orderId}] CRITICAL: Failed to refund payment ${sagaInstance.paymentId}. Manual intervention required!`, error);
        // In a real system, this would trigger alerts to operations staff.
        sagaInstance.error += ` | Manual refund needed for payment ${sagaInstance.paymentId}.`;
      }
    }

    // If inventory was reserved, release it. (This path should not be taken if payment failed first)
    // This part of compensation logic is highly dependent on *which* step failed.
    if (sagaInstance.inventoryReservationIds && sagaInstance.state !== 'INVENTORY_RESERVATION_PENDING') {
      // This branch implies inventory was successfully reserved, but a later (non-existent here) step failed.
      // For *this* example, inventory reservation failing directly triggers compensation, so we wouldn't release.
      // But if a *later* step failed, we'd need to release. For simplicity, omitting a separate release call here.
    }

    sagaInstance.state = 'FAILED';
    sagaInstance.lastUpdatedAt = new Date().toISOString();
    console.log(`[${sagaInstance.orderId}] Compensation finished. Order state: ${sagaInstance.state}`);
    await this.notifyOrderFailed(sagaInstance.orderId, sagaInstance.error || 'Order failed during compensation.');
  }

  /**
   * Notifies the customer and potentially other services about the order failure.
   */
  private async notifyOrderFailed(orderId: string, reason: string): Promise<void> {
    console.log(`[${orderId}] Notifying customer about order failure: ${reason}`);
    try {
      await this.notificationService.sendOrderFailureNotification(orderId, reason);
      // Potentially publish an OrderFailedEvent for external systems/analytics
    } catch (error) {
      console.error(`[${orderId}] Failed to send order failure notification.`, error);
    }
  }

  public getSagaState(orderId: string): SagaInstance | undefined {
    return this.sagaStates.get(orderId);
  }
}

// --- Example Usage Sketch ---

// Mock Service Clients
const mockPaymentService: PaymentServiceClient = {
  requestPayment: async (data) => {
    console.log(`[Mock Payment Service] Requesting payment for order ${data.orderId}, amount ${data.amount}`);
    await new Promise(res => setTimeout(res, 50)); // Simulate async call
    // In real life, this would send an event back to the orchestrator via a message broker
    // For this sketch, we'll manually call orchestrator methods
  },
  refundPayment: async (data) => {
    console.log(`[Mock Payment Service] Refunding payment ${data.paymentId} for order ${data.orderId}, amount ${data.amount}`);
    await new Promise(res => setTimeout(res, 50));
  },
};

const mockInventoryService: InventoryServiceClient = {
  reserveInventory: async (data) => {
    console.log(`[Mock Inventory Service] Reserving items for order ${data.orderId}:`, data.items);
    await new Promise(res => setTimeout(res, 50));
  },
  releaseInventory: async (data) => {
    console.log(`[Mock Inventory Service] Releasing items for order ${data.orderId}:`, data.items);
    await new Promise(res => setTimeout(res, 50));
  },
};

const mockNotificationService: NotificationServiceClient = {
  sendOrderConfirmation: async (orderId, customerId) => {
    console.log(`[Mock Notification Service] Sending confirmation for order ${orderId} to customer ${customerId}`);
    await new Promise(res => setTimeout(res, 50));
  },
  sendOrderFailureNotification: async (orderId, reason) => {
    console.log(`[Mock Notification Service] Sending failure notification for order ${orderId}: ${reason}`);
    await new Promise(res => setTimeout(res, 50));
  },
};

// Instantiate the orchestrator
const orchestrator = new OrderSagaOrchestrator(mockPaymentService, mockInventoryService, mockNotificationService);

async function runSagaExamples() {
  // --- Scenario 1: Successful Order ---
  const order1: OrderCreatedEvent = {
    type: 'OrderCreated',
    orderId: 'order-001',
    customerId: 'cust-A',
    items: [{ productId: 'prod-X', quantity: 2 }],
    totalAmount: 100.00,
    timestamp: new Date().toISOString(),
  };

  console.log('\n--- Starting Scenario 1: Successful Order ---\n');
  await orchestrator.startOrderSaga(order1);
  // Simulate payment service responding with success
  await orchestrator.handlePaymentProcessed({
    type: 'PaymentProcessed',
    orderId: 'order-001',
    paymentId: 'pay-001',
    amount: 100.00,
    timestamp: new Date().toISOString(),
  });
  // Simulate inventory service responding with success
  await orchestrator.handleInventoryReserved({
    type: 'InventoryReserved',
    orderId: 'order-001',
    items: [{ productId: 'prod-X', quantity: 2, inventoryItemId: 'inv-item-X1' }],
    timestamp: new Date().toISOString(),
  });
  console.log(`\nFinal State for order-001: ${orchestrator.getSagaState('order-001')?.state}\n`);

  // --- Scenario 2: Payment Failure ---
  const order2: OrderCreatedEvent = {
    type: 'OrderCreated',
    orderId: 'order-002',
    customerId: 'cust-B',
    items: [{ productId: 'prod-Y', quantity: 1 }],
    totalAmount: 50.00,
    timestamp: new Date().toISOString(),
  };

  console.log('\n--- Starting Scenario 2: Payment Failure ---\n');
  await orchestrator.startOrderSaga(order2);
  // Simulate payment service responding with failure
  await orchestrator.handlePaymentFailed({
    type: 'PaymentFailed',
    orderId: 'order-002',
    customerId: 'cust-B',
    reason: 'Insufficient funds',
    timestamp: new Date().toISOString(),
  });
  console.log(`\nFinal State for order-002: ${orchestrator.getSagaState('order-002')?.state}\n`);

  // --- Scenario 3: Inventory Reservation Failure (after successful payment) ---
  const order3: OrderCreatedEvent = {
    type: 'OrderCreated',
    orderId: 'order-003',
    customerId: 'cust-C',
    items: [{ productId: 'prod-Z', quantity: 3 }],
    totalAmount: 150.00,
    timestamp: new Date().toISOString(),
  };

  console.log('\n--- Starting Scenario 3: Inventory Failure ---\n');
  await orchestrator.startOrderSaga(order3);
  // Simulate payment service responding with success
  await orchestrator.handlePaymentProcessed({
    type: 'PaymentProcessed',
    orderId: 'order-003',
    paymentId: 'pay-003',
    amount: 150.00,
    timestamp: new Date().toISOString(),
  });
  // Simulate inventory service responding with failure
  await orchestrator.handleInventoryReservationFailed({
    type: 'InventoryReservationFailed',
    orderId: 'order-003',
    reason: 'Out of stock for prod-Z',
    timestamp: new Date().toISOString(),
  });
  console.log(`\nFinal State for order-003: ${orchestrator.getSagaState('order-003')?.state}\n`);
}

// Uncomment to run the example
// runSagaExamples();
