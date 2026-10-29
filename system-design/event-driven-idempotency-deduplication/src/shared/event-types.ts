/**
 * src/shared/event-types.ts
 * Shared types for demonstrating event-driven idempotency and deduplication.
 */

export type EventId = string;
export type OrderId = string;
export type UserId = string;
export type PaymentId = string;

export interface BaseEvent {
  eventId: EventId; // Unique identifier for the event itself
  timestamp: string;
  eventType: string;
}

export interface OrderItem {
  productId: string;
  quantity: number;
  price: number;
}

export interface Order {
  orderId: OrderId;
  userId: UserId;
  items: OrderItem[];
  totalAmount: number;
  status: 'PENDING' | 'PROCESSED' | 'CANCELLED' | 'PAID';
}

export interface OrderCreatedEvent extends BaseEvent {
  eventType: 'OrderCreated';
  order: Order;
}

export interface PaymentRequestEvent extends BaseEvent {
  eventType: 'PaymentRequest';
  orderId: OrderId;
  userId: UserId;
  amount: number;
  paymentMethod: string;
}

export interface PaymentProcessedEvent extends BaseEvent {
  eventType: 'PaymentProcessed';
  paymentId: PaymentId;
  orderId: OrderId;
  amount: number;
  status: 'SUCCESS' | 'FAILED';
  transactionRef: string;
}

export interface Payment {
  paymentId: PaymentId;
  orderId: OrderId;
  userId: UserId;
  amount: number;
  status: 'PENDING' | 'COMPLETED' | 'REFUNDED' | 'FAILED';
  transactionRef: string;
  createdAt: string;
  updatedAt: string;
}