import { v4 as uuidv4 } from 'uuid';

// --- Mock Database / ORM layer ---
// In a real app, this would be a proper ORM (e.g., TypeORM, Prisma) interacting with PostgreSQL/MySQL.

enum IdempotencyStatus {
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

interface IdempotencyRecord {
  idempotencyKey: string;
  requestHash: string;
  status: IdempotencyStatus;
  responsePayload?: any;
  errorPayload?: any;
  createdAt: Date;
  updatedAt: Date;
}

interface PaymentTransaction {
  id: string;
  amount: number;
  currency: string;
  userId: string;
  status: 'pending' | 'completed' | 'failed';
  createdAt: Date;
}

// Simple in-memory mock for a database table
const db = {
  idempotencyRecords: new Map<string, IdempotencyRecord>(),
  paymentTransactions: new Map<string, PaymentTransaction>(),
  // Simulate a transaction manager
  transaction: async <T>(callback: () => Promise<T>): Promise<T> => {
    console.log('[DB] Starting transaction...');
    try {
      const result = await callback();
      console.log('[DB] Transaction committed.');
      return result;
    } catch (error) {
      console.error('[DB] Transaction rolled back:', error);
      throw error;
    }
  },
};

// --- Service Logic ---

interface PaymentRequest {
  idempotencyKey: string;
  amount: number;
  currency: string;
  userId: string;
}

interface PaymentResponse {
  transactionId: string;
  status: 'completed' | 'failed';
  message: string;
}

/**
 * Simulates a payment processing service that uses a database-backed idempotency record.
 * Ensures that a payment request with the same idempotencyKey is processed only once.
 */
export class PaymentService {
  /**
   * Processes a payment request, ensuring idempotency using a dedicated database record.
   * @param request The payment request details, including an idempotencyKey.
   * @returns A promise that resolves to the PaymentResponse.
   * @throws Error if the request is already processing or has a different payload.
   */
  public async processPayment(request: PaymentRequest): Promise<PaymentResponse> {
    const { idempotencyKey, amount, currency, userId } = request;
    const requestHash = this.getRequestHash(request);

    return db.transaction(async () => {
      let record = db.idempotencyRecords.get(idempotencyKey);

      if (record) {
        // Existing record found
        if (record.requestHash !== requestHash) {
          // Mismatch in request payload for the same idempotency key
          throw new Error('Idempotency key used with a different request payload.');
        }

        if (record.status === IdempotencyStatus.PROCESSING) {
          // Request is already being processed
          throw new Error('Request with this idempotency key is already processing.');
        }

        if (record.status === IdempotencyStatus.COMPLETED) {
          // Request already completed, return cached response
          console.log(`[PaymentService] Returning cached response for key: ${idempotencyKey}`);
          return record.responsePayload as PaymentResponse;
        }

        if (record.status === IdempotencyStatus.FAILED) {
          // Request failed previously, might want to re-attempt or return error
          // For simplicity, let's re-attempt here, but a real system might have retry policies.
          console.warn(`[PaymentService] Retrying previously failed request for key: ${idempotencyKey}`);
          record.status = IdempotencyStatus.PROCESSING;
          record.updatedAt = new Date();
          db.idempotencyRecords.set(idempotencyKey, record);
        }

      } else {
        // New idempotency key, create a new record
        record = {
          idempotencyKey,
          requestHash,
          status: IdempotencyStatus.PROCESSING,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        db.idempotencyRecords.set(idempotencyKey, record);
        console.log(`[PaymentService] New idempotency record created for key: ${idempotencyKey}`);
      }

      // --- Business Logic Execution --- (Simulated)
      let paymentResult: PaymentResponse;
      try {
        console.log(`[PaymentService] Processing payment for user ${userId}, amount ${amount} ${currency}...`);
        // Simulate external payment gateway call or complex business logic
        await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));

        const transactionId = `txn_${uuidv4().substring(0, 8)}`;
        const newTransaction: PaymentTransaction = {
          id: transactionId,
          amount,
          currency,
          userId,
          status: 'completed',
          createdAt: new Date(),
        };
        db.paymentTransactions.set(transactionId, newTransaction);

        paymentResult = {
          transactionId,
          status: 'completed',
          message: 'Payment processed successfully',
        };

        // Update idempotency record to COMPLETED with success response
        record.status = IdempotencyStatus.COMPLETED;
        record.responsePayload = paymentResult;
        record.updatedAt = new Date();
        db.idempotencyRecords.set(idempotencyKey, record);
        console.log(`[PaymentService] Payment for key ${idempotencyKey} completed.`);

      } catch (error: any) {
        // Handle business logic failure
        record.status = IdempotencyStatus.FAILED;
        record.errorPayload = { message: error.message || 'Unknown error during payment processing' };
        record.updatedAt = new Date();
        db.idempotencyRecords.set(idempotencyKey, record);
        console.error(`[PaymentService] Payment for key ${idempotencyKey} failed:`, error);
        throw error; // Re-throw to ensure transaction rollback
      }

      return paymentResult;
    });
  }

  /**
   * Generates a hash of the request payload to ensure the same idempotency key isn't used
   * for different requests.
   */
  private getRequestHash(request: Omit<PaymentRequest, 'idempotencyKey'>): string {
    const payload = { amount: request.amount, currency: request.currency, userId: request.userId };
    return require('crypto').createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }
}

// --- Example Usage ---
async function runExample() {
  const paymentService = new PaymentService();

  const payment1: PaymentRequest = {
    idempotencyKey: 'client-req-001',
    amount: 1000,
    currency: 'USD',
    userId: 'user-abc',
  };

  const payment2: PaymentRequest = {
    idempotencyKey: 'client-req-002',
    amount: 500,
    currency: 'EUR',
    userId: 'user-xyz',
  };

  console.log('\n--- First attempt for payment1 ---');
  const res1 = await paymentService.processPayment(payment1);
  console.log('Result 1:', res1);

  console.log('\n--- Second attempt for payment1 (should return cached) ---');
  const res1_retry = await paymentService.processPayment(payment1);
  console.log('Result 1 Retry:', res1_retry);

  console.log('\n--- Attempt for payment2 ---');
  const res2 = await paymentService.processPayment(payment2);
  console.log('Result 2:', res2);

  console.log('\n--- Attempt for payment1 with different amount (should throw error) ---');
  try {
    await paymentService.processPayment({
      ...payment1,
      amount: 1200, // Different amount
    });
  } catch (error: any) {
    console.error('Expected error:', error.message);
  }

  console.log('\n--- Simulate concurrent processing for a new key (should throw error) ---');
  const concurrentKey = 'client-req-003';
  const concurrentPayment: PaymentRequest = {
    idempotencyKey: concurrentKey,
    amount: 200,
    currency: 'GBP',
    userId: 'user-con',
  };

  const promise1 = paymentService.processPayment(concurrentPayment);
  const promise2 = paymentService.processPayment(concurrentPayment);

  try {
    await Promise.allSettled([promise1, promise2]);
  } catch (error: any) {
    // One of them will succeed, the other will fail with 'already processing'
    console.error('Concurrent processing error caught:', error.message);
  }

  console.log('\n--- Check final state of concurrent key ---');
  const finalConcurrentRes = await paymentService.processPayment(concurrentPayment);
  console.log('Final concurrent result (should be cached):', finalConcurrentRes);

  console.log('\n--- Database contents (mocked) ---');
  console.log('Idempotency Records:', Array.from(db.idempotencyRecords.values()));
  console.log('Payment Transactions:', Array.from(db.paymentTransactions.values()));
}

// runExample();
