/**
 * Day 31: Distributed Transactions - Saga Pattern (Orchestration)
 * File 4/5: A conceptual example of an Orchestrated Saga for an order placement flow.
 * This simulation uses a simplified event bus for communication.
 */

enum OrderStatus {
  PENDING,
  INVENTORY_RESERVED,
  PAYMENT_PROCESSED,
  COMPLETED,
  CANCELLED,
  FAILED,
}

interface Event {
  type: string;
  payload: any;
}

// --- Simplified Event Bus --- //
class EventBus {
  private subscribers: { [eventType: string]: Function[] } = {};

  public subscribe(eventType: string, callback: Function): void {
    if (!this.subscribers[eventType]) {
      this.subscribers[eventType] = [];
    }
    this.subscribers[eventType].push(callback);
  }

  public publish(event: Event): void {
    console.log(`[EventBus] Publishing: ${event.type} with payload:`, event.payload);
    if (this.subscribers[event.type]) {
      this.subscribers[event.type].forEach(callback => callback(event.payload));
    }
  }
}

const eventBus = new EventBus();

// --- Participant Services --- //

class OrderService {
  public orders: { [id: string]: { status: OrderStatus; item: string; qty: number; userId: string } } = {};

  constructor() {
    eventBus.subscribe('orderCreated', this.handleOrderCreated.bind(this));
    eventBus.subscribe('inventoryReserved', this.handleInventoryReserved.bind(this));
    eventBus.subscribe('paymentProcessed', this.handlePaymentProcessed.bind(this));
    eventBus.subscribe('orderFailed', this.handleOrderFailed.bind(this));
    eventBus.subscribe('inventoryCompensationNeeded', this.handleInventoryCompensation.bind(this));
  }

  public async createOrder(orderId: string, item: string, qty: number, userId: string): Promise<void> {
    this.orders[orderId] = { status: OrderStatus.PENDING, item, qty, userId };
    console.log(`[OrderService] Order ${orderId} created as PENDING.`);
    eventBus.publish({ type: 'orderCreated', payload: { orderId, item, qty, userId } });
  }

  private handleOrderCreated(payload: any): void {
    // No op for this service, it initiated the event.
  }

  private handleInventoryReserved(payload: any): void {
    const { orderId } = payload;
    if (this.orders[orderId]) {
      this.orders[orderId].status = OrderStatus.INVENTORY_RESERVED;
      console.log(`[OrderService] Order ${orderId} status updated to INVENTORY_RESERVED.`);
    }
  }

  private handlePaymentProcessed(payload: any): void {
    const { orderId } = payload;
    if (this.orders[orderId]) {
      this.orders[orderId].status = OrderStatus.COMPLETED;
      console.log(`[OrderService] Order ${orderId} status updated to COMPLETED.`);
    }
  }

  private handleOrderFailed(payload: any): void {
    const { orderId, reason } = payload;
    if (this.orders[orderId]) {
      this.orders[orderId].status = OrderStatus.FAILED;
      console.log(`[OrderService] Order ${orderId} failed: ${reason}.`);
    }
  }

  private handleInventoryCompensation(payload: any): void {
    const { orderId } = payload;
    // In a real system, OrderService might update its own status or log for audit
    console.log(`[OrderService] Noted inventory compensation for order ${orderId}.`);
  }
}

class InventoryService {
  public stock: { [item: string]: number } = { productA: 100, productB: 50 };
  private reservedStock: { [orderId: string]: { item: string; qty: number } } = {};

  constructor() {
    eventBus.subscribe('reserveInventory', this.reserveInventory.bind(this));
    eventBus.subscribe('compensateInventory', this.compensateInventory.bind(this));
  }

  public async reserveInventory(payload: { orderId: string; item: string; qty: number }): Promise<void> {
    const { orderId, item, qty } = payload;
    console.log(`[InventoryService] Attempting to reserve ${qty} of ${item} for order ${orderId}.`);
    if (this.stock[item] && this.stock[item] >= qty) {
      this.stock[item] -= qty;
      this.reservedStock[orderId] = { item, qty };
      console.log(`[InventoryService] Reserved ${qty} of ${item} for order ${orderId}. Remaining stock: ${this.stock[item]}.`);
      eventBus.publish({ type: 'inventoryReserved', payload: { orderId, item, qty } });
    } else {
      console.log(`[InventoryService] Failed to reserve ${qty} of ${item} for order ${orderId}. Not enough stock.`);
      eventBus.publish({ type: 'inventoryReservationFailed', payload: { orderId, item, qty, reason: 'Insufficient stock' } });
    }
  }

  public async compensateInventory(payload: { orderId: string }): Promise<void> {
    const { orderId } = payload;
    if (this.reservedStock[orderId]) {
      const { item, qty } = this.reservedStock[orderId];
      this.stock[item] += qty;
      delete this.reservedStock[orderId];
      console.log(`[InventoryService] Compensated ${qty} of ${item} for order ${orderId}. Stock returned. Current stock: ${this.stock[item]}.`);
      eventBus.publish({ type: 'inventoryCompensated', payload: { orderId } });
    } else {
      console.log(`[InventoryService] No reserved stock to compensate for order ${orderId}.`);
    }
  }
}

class PaymentService {
  public transactions: { [orderId: string]: { amount: number; status: string } } = {};
  private shouldFailPayment: boolean = false;

  constructor() {
    eventBus.subscribe('processPayment', this.processPayment.bind(this));
    eventBus.subscribe('refundPayment', this.refundPayment.bind(this));
  }

  public setFailureMode(fail: boolean): void {
    this.shouldFailPayment = fail;
  }

  public async processPayment(payload: { orderId: string; amount: number; userId: string }): Promise<void> {
    const { orderId, amount, userId } = payload;
    console.log(`[PaymentService] Attempting to process payment of $${amount} for order ${orderId} (user: ${userId}).`);
    if (this.shouldFailPayment) {
      this.transactions[orderId] = { amount, status: 'failed' };
      console.log(`[PaymentService] Payment for order ${orderId} FAILED (simulated).`);
      eventBus.publish({ type: 'paymentFailed', payload: { orderId, reason: 'Payment denied' } });
      return;
    }
    // Simulate payment processing time
    await new Promise(resolve => setTimeout(resolve, 100));
    this.transactions[orderId] = { amount, status: 'completed' };
    console.log(`[PaymentService] Payment for order ${orderId} PROCESSED.`);
    eventBus.publish({ type: 'paymentProcessed', payload: { orderId, amount, userId } });
  }

  public async refundPayment(payload: { orderId: string }): Promise<void> {
    const { orderId } = payload;
    if (this.transactions[orderId] && this.transactions[orderId].status === 'completed') {
      this.transactions[orderId].status = 'refunded';
      console.log(`[PaymentService] Refunded payment for order ${orderId}.`);
      eventBus.publish({ type: 'paymentRefunded', payload: { orderId } });
    } else {
      console.log(`[PaymentService] No completed payment to refund for order ${orderId}.`);
    }
  }
}

// --- Saga Orchestrator --- //
class OrderPlacementSagaOrchestrator {
  private orderId: string;
  private item: string;
  private qty: number;
  private userId: string;
  private amount: number;
  private currentStep: number = 0;
  private maxSteps: number = 3; // reserveInventory, processPayment, finalizeOrder

  constructor(orderId: string, item: string, qty: number, userId: string, amount: number) {
    this.orderId = orderId;
    this.item = item;
    this.qty = qty;
    this.userId = userId;
    this.amount = amount;

    // Subscribe to events from participant services
    eventBus.subscribe('orderCreated', this.startSaga.bind(this));
    eventBus.subscribe('inventoryReserved', this.handleInventoryReserved.bind(this));
    eventBus.subscribe('inventoryReservationFailed', this.handleInventoryReservationFailed.bind(this));
    eventBus.subscribe('paymentProcessed', this.handlePaymentProcessed.bind(this));
    eventBus.subscribe('paymentFailed', this.handlePaymentFailed.bind(this));
  }

  public startSaga(payload: any): void {
    if (payload.orderId !== this.orderId) return;
    console.log(`\n[SagaOrchestrator - ${this.orderId}] Starting Saga...`);
    this.currentStep = 1;
    eventBus.publish({ type: 'reserveInventory', payload: { orderId: this.orderId, item: this.item, qty: this.qty } });
  }

  private handleInventoryReserved(payload: any): void {
    if (payload.orderId !== this.orderId) return;
    console.log(`[SagaOrchestrator - ${this.orderId}] Inventory reserved. Proceeding to payment.`);
    this.currentStep = 2;
    eventBus.publish({ type: 'processPayment', payload: { orderId: this.orderId, amount: this.amount, userId: this.userId } });
  }

  private handlePaymentProcessed(payload: any): void {
    if (payload.orderId !== this.orderId) return;
    console.log(`[SagaOrchestrator - ${this.orderId}] Payment processed. Saga COMPLETED.`);
    this.currentStep = 3;
    eventBus.publish({ type: 'orderCompleted', payload: { orderId: this.orderId } }); // Final event for OrderService or other listeners
  }

  // --- Compensation Logic --- //
  private handleInventoryReservationFailed(payload: any): void {
    if (payload.orderId !== this.orderId) return;
    console.error(`[SagaOrchestrator - ${this.orderId}] Inventory reservation FAILED. Aborting Saga.`);
    this.currentStep = -1; // Mark as failed
    eventBus.publish({ type: 'orderFailed', payload: { orderId: this.orderId, reason: payload.reason } });
    // No compensation needed for prior steps as this is the first real step after order creation.
  }

  private handlePaymentFailed(payload: any): void {
    if (payload.orderId !== this.orderId) return;
    console.error(`[SagaOrchestrator - ${this.orderId}] Payment FAILED. Initiating compensation.`);
    this.currentStep = -1; // Mark as failed
    eventBus.publish({ type: 'orderFailed', payload: { orderId: this.orderId, reason: payload.reason } });

    // Compensate previous successful steps
    if (this.currentStep >= 1) {
      console.log(`[SagaOrchestrator - ${this.orderId}] Compensating Inventory Service.`);
      eventBus.publish({ type: 'compensateInventory', payload: { orderId: this.orderId } });
    }
    // If there were other steps before inventory, their compensation would be here.
  }
}

// --- Simulation --- //
const orderService = new OrderService();
const inventoryService = new InventoryService();
const paymentService = new PaymentService();

// Scenario 1: Successful Order Placement
console.log("\n--- Scenario 1: Successful Order Placement ---");
const saga1 = new OrderPlacementSagaOrchestrator('ORD-001', 'productA', 5, 'user123', 100);
orderService.createOrder('ORD-001', 'productA', 5, 'user123');

// Scenario 2: Payment Failure (triggering compensation)
console.log("\n--- Scenario 2: Payment Failure ---");
paymentService.setFailureMode(true); // Make payment fail
const saga2 = new OrderPlacementSagaOrchestrator('ORD-002', 'productB', 10, 'user456', 250);
orderService.createOrder('ORD-002', 'productB', 10, 'user456');

// Reset payment service for next scenario if needed
setTimeout(() => paymentService.setFailureMode(false), 500);

// Scenario 3: Inventory Reservation Failure
console.log("\n--- Scenario 3: Inventory Reservation Failure ---");
// Simulate insufficient stock for productC (which doesn't exist)
const saga3 = new OrderPlacementSagaOrchestrator('ORD-003', 'productC', 20, 'user789', 500);
orderService.createOrder('ORD-003', 'productC', 20, 'user789');
