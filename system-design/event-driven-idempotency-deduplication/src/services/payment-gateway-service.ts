/**
 * src/services/payment-gateway-service.ts
 * Example of a payment gateway service consumer demonstrating deduplication.
 */

import { PaymentRequestEvent, Payment, PaymentId, EventId, OrderId } from '../shared/event-types';

// Mock database for payments and processed events
interface MockDatabase {
  payments: Map<PaymentId, Payment>;
  processedEventIds: Set<EventId>; // Stores event IDs that have been successfully processed
}

const mockDb: MockDatabase = {
  payments: new Map<PaymentId, Payment>(),
  processedEventIds: new Set<EventId>()
};

/**
 * Simulates a database operation to check if an event has been processed.
 * This is the core deduplication mechanism.
 */
async function hasEventBeenProcessed(eventId: EventId): Promise<boolean> {
  console.log(`[PaymentGateway] Checking if event ${eventId} has been processed.`);
  // Simulate async DB call
  return Promise.resolve(mockDb.processedEventIds.has(eventId));
}

/**
 * Simulates a database operation to mark an event as processed.
 */
async function markEventAsProcessed(eventId: EventId): Promise<void> {
  console.log(`[PaymentGateway] Marking event ${eventId} as processed.`);
  // Simulate async DB call
  mockDb.processedEventIds.add(eventId);
  return Promise.resolve();
}

/**
 * Simulates saving a payment record.
 */
async function savePayment(payment: Payment): Promise<void> {
  console.log(`[PaymentGateway] Saving payment ${payment.paymentId}.`);
  // Simulate async DB call
  mockDb.payments.set(payment.paymentId, payment);
  return Promise.resolve();
}

/**
 * Simulates an external payment processing call.
 * This operation is typically non-idempotent externally, so internal deduplication is vital.
 */
async function callExternalPaymentProcessor(
  orderId: OrderId,
  amount: number
): Promise<{ transactionRef: string; status: 'SUCCESS' | 'FAILED' }> {
  console.log(`[PaymentGateway] Calling external processor for order ${orderId}, amount ${amount}...`);
  // Simulate network delay and potential failure
  await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 100));
  const success = Math.random() > 0.1; // 90% success rate
  if (!success) {
    console.error(`[PaymentGateway] External payment failed for order ${orderId}.`);
    return { transactionRef: '', status: 'FAILED' };
  }
  const transactionRef = `TXN-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  console.log(`[PaymentGateway] External payment successful for order ${orderId}. Ref: ${transactionRef}`);
  return { transactionRef, status: 'SUCCESS' };
}

export async function processPaymentRequestEvent(
  event: PaymentRequestEvent
): Promise<void> {
  const { eventId, orderId, userId, amount } = event;

  console.log(`\n--- Received PaymentRequestEvent for Order ${orderId} (Event ID: ${eventId}) ---`);

  // 1. Deduplication Check: Use eventId to prevent duplicate processing.
  const alreadyProcessed = await hasEventBeenProcessed(eventId);
  if (alreadyProcessed) {
    console.warn(`[PaymentGateway] Event ${eventId} for order ${orderId} already processed. Skipping.`);
    return;
  }

  // 2. Process Payment: Call external payment gateway.
  // This part is crucial: we only call the *external* non-idempotent service once
  const { transactionRef, status } = await callExternalPaymentProcessor(orderId, amount);

  const paymentId: PaymentId = `PAY-${orderId}-${Date.now()}`;
  const newPayment: Payment = {
    paymentId,
    orderId,
    userId,
    amount,
    status: status === 'SUCCESS' ? 'COMPLETED' : 'FAILED',
    transactionRef,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // 3. Save Payment and Mark Event as Processed Atomically (ideally)
  // In a real system, these two operations (savePayment and markEventAsProcessed)
  // should ideally be part of a single atomic transaction (e.g., using a local database transaction).
  // For this mock, we'll do them sequentially.
  try {
    await savePayment(newPayment);
    await markEventAsProcessed(eventId);
    console.log(`[PaymentGateway] Payment ${newPayment.paymentId} for order ${orderId} processed and recorded.`);
  } catch (error) {
    console.error(`[PaymentGateway] Failed to record payment or mark event for ${eventId}:`, error);
    // In a real system, you might re-throw, dead-letter the message, or implement retry with exponential backoff.
    // The key is that if this fails, the eventId is NOT marked, so a retry will re-process.
  }
}

// --- Demonstration --- 

async function runDemo() {
  const paymentRequest1: PaymentRequestEvent = {
    eventId: 'EVT-PAY-1-XYZ',
    timestamp: new Date().toISOString(),
    eventType: 'PaymentRequest',
    orderId: 'ORD-001',
    userId: 'USR-123',
    amount: 100,
    paymentMethod: 'CreditCard'
  };

  const paymentRequest1_retry: PaymentRequestEvent = {
    ...paymentRequest1,
    timestamp: new Date().toISOString() // Simulating a retry
  };

  const paymentRequest2: PaymentRequestEvent = {
    eventId: 'EVT-PAY-2-ABC',
    timestamp: new Date().toISOString(),
    eventType: 'PaymentRequest',
    orderId: 'ORD-002',
    userId: 'USR-456',
    amount: 150,
    paymentMethod: 'PayPal'
  };

  // First processing of payment request 1
  await processPaymentRequestEvent(paymentRequest1);
  console.log(`Current payments after event1: ${mockDb.payments.size}`);

  // Retry processing payment request 1 (should be skipped due to deduplication)
  await processPaymentRequestEvent(paymentRequest1_retry);
  console.log(`Current payments after event1_retry: ${mockDb.payments.size}`);

  // Processing payment request 2
  await processPaymentRequestEvent(paymentRequest2);
  console.log(`Current payments after event2: ${mockDb.payments.size}`);

  console.log('\n--- Final State ---');
  console.log('Payments in DB:', Array.from(mockDb.payments.values()).map(p => ({ id: p.paymentId, orderId: p.orderId, status: p.status, ref: p.transactionRef })));
  console.log('Processed Event IDs:', Array.from(mockDb.processedEventIds));
}

// To run the demo:
// runDemo().catch(console.error);
