import { PaymentProcessedEvent, PaymentFailedEvent, IdempotencyKey } from '../types/payment-events';
import { IdempotencyStore, IdempotencyStatus } from '../utils/database-idempotency-store';

interface PaymentGatewayResponse {
  success: boolean;
  transactionId?: string;
  errorMessage?: string;
}

/**
 * Simulates an external payment gateway interaction.
 */
class PaymentGatewayService {
  public async charge(amount: number, currency: string, userId: string): Promise<PaymentGatewayResponse> {
    console.log(`[PaymentGateway] Attempting to charge ${amount} ${currency} for user ${userId}...`);
    // Simulate network latency and occasional failures
    await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 100));

    if (Math.random() < 0.1) { // 10% chance of failure
      return { success: false, errorMessage: 'Payment gateway declined transaction.' };
    }

    const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    console.log(`[PaymentGateway] Successfully charged. Transaction ID: ${transactionId}`);
    return { success: true, transactionId };
  }
}

/**
 * Service responsible for processing payment events idempotently.
 */
export class PaymentProcessorService {
  private paymentGateway: PaymentGatewayService;
  private idempotencyStore: IdempotencyStore;

  constructor(idempotencyStore: IdempotencyStore, paymentGateway?: PaymentGatewayService) {
    this.idempotencyStore = idempotencyStore;
    this.paymentGateway = paymentGateway || new PaymentGatewayService();
  }

  /**
   * Processes a payment request, ensuring idempotency using a key.
   * @param idempotencyKey A unique key for this specific payment operation.
   * @param orderId The ID of the order associated with the payment.
   * @param userId The ID of the user initiating the payment.
   * @param amount The amount to charge.
   * @param currency The currency of the amount.
   * @returns A promise that resolves to a PaymentProcessedEvent or PaymentFailedEvent.
   */
  public async processPayment(
    idempotencyKey: IdempotencyKey,
    orderId: string,
    userId: string,
    amount: number,
    currency: string
  ): Promise<PaymentProcessedEvent | PaymentFailedEvent> {
    console.log(`[PaymentProcessor] Processing payment with idempotencyKey: ${idempotencyKey}`);

    // 1. Check idempotency store
    const existingRecord = await this.idempotencyStore.get(idempotencyKey);

    if (existingRecord) {
      if (existingRecord.status === IdempotencyStatus.COMPLETED) {
        console.log(`[PaymentProcessor] Idempotency key ${idempotencyKey} already processed. Returning stored result.`);
        // Assuming the stored result is directly the event data
        return existingRecord.result as PaymentProcessedEvent | PaymentFailedEvent;
      } else if (existingRecord.status === IdempotencyStatus.PENDING) {
        console.warn(`[PaymentProcessor] Idempotency key ${idempotencyKey} is currently pending. Possible concurrent request or retry.`);
        // In a real system, you might wait, retry, or throw an error.
        // For simplicity, we'll simulate a slight delay and re-check, or just return a default pending state.
        throw new Error(`Operation with idempotency key ${idempotencyKey} is already in progress.`);
      }
    }

    // 2. Record pending state
    await this.idempotencyStore.set(idempotencyKey, IdempotencyStatus.PENDING, null, orderId, userId);

    let event: PaymentProcessedEvent | PaymentFailedEvent;
    try {
      // 3. Execute business logic (charge via payment gateway)
      const gatewayResponse = await this.paymentGateway.charge(amount, currency, userId);

      if (gatewayResponse.success) {
        event = {
          eventId: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
          idempotencyKey,
          orderId,
          userId,
          amount,
          currency,
          transactionId: gatewayResponse.transactionId!,
          processedAt: new Date().toISOString(),
        };
        console.log(`[PaymentProcessor] Payment successful for ${idempotencyKey}. Transaction: ${gatewayResponse.transactionId}`);
      } else {
        event = {
          eventId: `evt_fail_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
          idempotencyKey,
          orderId,
          userId,
          amount,
          currency,
          reason: gatewayResponse.errorMessage || 'Unknown error',
          failedAt: new Date().toISOString(),
        };
        console.error(`[PaymentProcessor] Payment failed for ${idempotencyKey}. Reason: ${gatewayResponse.errorMessage}`);
      }

      // 4. Record completion/failure and result
      await this.idempotencyStore.update(idempotencyKey, IdempotencyStatus.COMPLETED, event);
      return event;

    } catch (error: any) {
      // Handle unexpected errors during processing
      event = {
        eventId: `evt_error_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
        idempotencyKey,
        orderId,
        userId,
        amount,
        currency,
        reason: `Unexpected error: ${error.message || 'unknown'}`,
        failedAt: new Date().toISOString(),
      };
      await this.idempotencyStore.update(idempotencyKey, IdempotencyStatus.FAILED, event);
      console.error(`[PaymentProcessor] Critical error for ${idempotencyKey}:`, error);
      return event;
    }
  }
}

// Example Usage (for demonstration)
async function runExample() {
  const idempotencyStore = new IdempotencyStore();
  const processor = new PaymentProcessorService(idempotencyStore);

  const commonPaymentDetails = {
    orderId: 'order_abc123',
    userId: 'user_xyz789',
    amount: 100.00,
    currency: 'USD'
  };

  console.log('\n--- First attempt with key: key-123 ---\n');
  const key1 = 'key-123';
  let result1 = await processor.processPayment(key1, ...Object.values(commonPaymentDetails));
  console.log('Result 1:', JSON.stringify(result1, null, 2));

  console.log('\n--- Second attempt with same key: key-123 (should be idempotent) ---\n');
  let result1_retry = await processor.processPayment(key1, ...Object.values(commonPaymentDetails));
  console.log('Result 1 (retry):', JSON.stringify(result1_retry, null, 2));
  console.log(`Is result1 === result1_retry? ${result1 === result1_retry}`); // Should be true if returning same object reference

  console.log('\n--- Third attempt with a new key: key-456 ---\n');
  const key2 = 'key-456';
  let result2 = await processor.processPayment(key2, ...Object.values(commonPaymentDetails));
  console.log('Result 2:', JSON.stringify(result2, null, 2));

  // Simulate a failure and retry
  console.log('\n--- Fourth attempt with key: key-789 (simulating initial failure) ---\n');
  const key3 = 'key-789';
  // To force a failure, we could mock the gateway, but for this example, rely on random chance.
  let result3 = await processor.processPayment(key3, 'order_fail_1', 'user_fail_1', 50.00, 'EUR');
  console.log('Result 3:', JSON.stringify(result3, null, 2));

  console.log('\n--- Fifth attempt with same key: key-789 (retry after potential failure) ---\n');
  let result3_retry = await processor.processPayment(key3, 'order_fail_1', 'user_fail_1', 50.00, 'EUR');
  console.log('Result 3 (retry):', JSON.stringify(result3_retry, null, 2));

  console.log('\n--- Show all records in store ---\n');
  console.log(idempotencyStore.getAllRecords());
}

// runExample(); // Uncomment to run the example
