/**
 * @file Defines TypeScript interfaces for events used in a choreography-based saga
 * for an e-commerce order processing workflow.
 * Each service publishes events that other services subscribe to, driving the saga forward.
 */

export type OrderId = string;
export type CustomerId = string;
export type ProductId = string;
export type PaymentId = string;
export type InventoryItemId = string;

/**
 * Event published by the Order Service when a new order is created.
 * Triggers the payment and inventory reservation steps.
 */
export interface OrderCreatedEvent {
  type: 'OrderCreated';
  orderId: OrderId;
  customerId: CustomerId;
  items: { productId: ProductId; quantity: number }[];
  totalAmount: number;
  timestamp: string;
}

/**
 * Event published by the Order Service (or a payment gateway interaction service)
 * to request payment processing.
 */
export interface PaymentRequestedEvent {
  type: 'PaymentRequested';
  orderId: OrderId;
  customerId: CustomerId;
  amount: number;
  timestamp: string;
}

/**
 * Event published by the Payment Service upon successful payment processing.
 * Triggers inventory reservation.
 */
export interface PaymentProcessedEvent {
  type: 'PaymentProcessed';
  orderId: OrderId;
  paymentId: PaymentId;
  amount: number;
  timestamp: string;
}

/**
 * Event published by the Payment Service if payment fails.
 * Triggers order failure and potential compensation (e.g., notifying customer).
 */
export interface PaymentFailedEvent {
  type: 'PaymentFailed';
  orderId: OrderId;
  customerId: CustomerId;
  reason: string;
  timestamp: string;
}

/**
 * Event published by the Inventory Service upon successful reservation of items.
 * Triggers order completion.
 */
export interface InventoryReservedEvent {
  type: 'InventoryReserved';
  orderId: OrderId;
  items: { productId: ProductId; quantity: number; inventoryItemId: InventoryItemId }[];
  timestamp: string;
}

/**
 * Event published by the Inventory Service if inventory reservation fails.
 * Triggers compensation (e.g., refunding payment).
 */
export interface InventoryReservationFailedEvent {
  type: 'InventoryReservationFailed';
  orderId: OrderId;
  reason: string;
  timestamp: string;
}

/**
 * Event published by the Payment Service when a refund is successfully processed.
 * Part of compensation flow.
 */
export interface PaymentRefundedEvent {
  type: 'PaymentRefunded';
  orderId: OrderId;
  paymentId: PaymentId;
  amount: number;
  timestamp: string;
}

/**
 * Event published by the Inventory Service when reserved items are released.
 * Part of compensation flow.
 */
export interface InventoryReleasedEvent {
  type: 'InventoryReleased';
  orderId: OrderId;
  items: { productId: ProductId; quantity: number }[];
  timestamp: string;
}

/**
 * Final event published when the order saga successfully completes.
 */
export interface OrderCompletedEvent {
  type: 'OrderCompleted';
  orderId: OrderId;
  timestamp: string;
}

/**
 * Final event published when the order saga fails and compensation is complete (or not possible).
 */
export interface OrderFailedEvent {
  type: 'OrderFailed';
  orderId: OrderId;
  reason: string;
  timestamp: string;
}

// Union type for all possible events in this saga
export type OrderSagaEvent =
  | OrderCreatedEvent
  | PaymentRequestedEvent
  | PaymentProcessedEvent
  | PaymentFailedEvent
  | InventoryReservedEvent
  | InventoryReservationFailedEvent
  | PaymentRefundedEvent
  | InventoryReleasedEvent
  | OrderCompletedEvent
  | OrderFailedEvent;
