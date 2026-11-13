/**
 * Day 35: Idempotent Payment Processor Example
 * Implements idempotency using a unique `idempotencyKey` to prevent duplicate processing.
 */

interface UserAccount {
  userId: string;
  balance: number;
}

// In-memory store for demonstration purposes
const userAccounts: Map<string, UserAccount> = new Map();
userAccounts.set('user123', { userId: 'user123', balance: 1000 });
userAccounts.set('user456', { userId: 'user456', balance: 500 });

// In-memory store for processed idempotency keys (simulates a database table or Redis)
// In a real system, this would be a persistent, transactional store.
const processedRequests: Set<string> = new Set();

class IdempotentPaymentProcessor {
  public async processPayment(
    userId: string,
    amount: number,
    idempotencyKey: string // Unique identifier for this specific payment attempt
  ): Promise<boolean> {
    console.log(`[${new Date().toISOString()}] Processing payment for user ${userId}, amount ${amount} with key: ${idempotencyKey}`);

    // 1. Check if this idempotency key has already been processed
    if (processedRequests.has(idempotencyKey)) {
      console.warn(`Idempotency key ${idempotencyKey} already processed. Skipping duplicate payment.`);
      return true; // Consider it successful as the original operation completed.
    }

    // Simulate a database transaction or distributed lock acquisition here
    // In a real system, this check and the subsequent mark-as-processed would be atomic.
    // e.g., using a `SELECT ... FOR UPDATE` or `INSERT ... ON CONFLICT` in a database.

    const account = userAccounts.get(userId);
    if (!account) {
      console.error(`User ${userId} not found.`);
      return false;
    }

    if (account.balance < amount) {
      console.warn(`Insufficient funds for user ${userId}. Current balance: ${account.balance}, requested: ${amount}`);
      // Even if insufficient funds, we might want to record the idempotencyKey
      // to prevent future retries from attempting the same invalid operation.
      processedRequests.add(idempotencyKey);
      return false;
    }

    // Simulate a potential network delay or transient error during actual processing
    await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 50));

    // 2. Execute the business logic
    account.balance -= amount;
    userAccounts.set(userId, account);

    // 3. Mark the idempotency key as processed (this should be atomic with step 2)
    processedRequests.add(idempotencyKey);

    console.log(`[${new Date().toISOString()}] Payment processed successfully for user ${userId}. New balance: ${account.balance}`);
    return true;
  }
}

async function simulateIdempotentPaymentFlow() {
  const processor = new IdempotentPaymentProcessor();
  const userId = 'user123';
  const paymentAmount = 100;
  const paymentTransactionId = 'txn-abc-123-xyz'; // Unique ID for this payment

  console.log(`\n--- Initial balance for ${userId}: ${userAccounts.get(userId)?.balance} ---\n`);

  console.log('Simulating first payment attempt (with potential retry)...');
  let success1 = await processor.processPayment(userId, paymentAmount, paymentTransactionId);

  // Simulate a retry, perhaps due to client timeout or message redelivery
  console.log('\nSimulating a retry with the SAME idempotency key...');
  let success2 = await processor.processPayment(userId, paymentAmount, paymentTransactionId);

  console.log(`\n--- Final balance for ${userId}: ${userAccounts.get(userId)?.balance} ---\n`);
  console.log('Expected final balance if payment processed once: 900');
  console.log('With idempotency, even if retried, actual balance should be 900 (correct).');
}

simulateIdempotentPaymentFlow();
