/**
 * Day 35: Non-Idempotent Payment Processor Example
 * Demonstrates how retries can lead to incorrect state without idempotency.
 */

interface UserAccount {
  userId: string;
  balance: number;
}

// In-memory store for demonstration purposes
const userAccounts: Map<string, UserAccount> = new Map();

userAccounts.set('user123', { userId: 'user123', balance: 1000 });
userAccounts.set('user456', { userId: 'user456', balance: 500 });

class NonIdempotentPaymentProcessor {
  public async processPayment(userId: string, amount: number): Promise<boolean> {
    console.log(`[${new Date().toISOString()}] Attempting to process payment for user ${userId}, amount ${amount}...`);

    const account = userAccounts.get(userId);
    if (!account) {
      console.error(`User ${userId} not found.`);
      return false;
    }

    if (account.balance < amount) {
      console.warn(`Insufficient funds for user ${userId}. Current balance: ${account.balance}, requested: ${amount}`);
      return false;
    }

    // Simulate a potential network delay or transient error
    await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 50));

    // This operation is NOT idempotent. If called multiple times, it will deduct multiple times.
    account.balance -= amount;
    userAccounts.set(userId, account);

    console.log(`[${new Date().toISOString()}] Payment processed successfully for user ${userId}. New balance: ${account.balance}`);
    return true;
  }
}

async function simulatePaymentFlow() {
  const processor = new NonIdempotentPaymentProcessor();
  const userId = 'user123';
  const paymentAmount = 100;

  console.log(`\n--- Initial balance for ${userId}: ${userAccounts.get(userId)?.balance} ---\n`);

  // Simulate a payment attempt that might be retried due to a lost response
  console.log('Simulating first payment attempt...');
  let success1 = await processor.processPayment(userId, paymentAmount);
  if (!success1) {
    console.log('First attempt failed or timed out. Retrying...');
    // In a real system, this retry would happen automatically by a client library or message broker
    let success2 = await processor.processPayment(userId, paymentAmount);
    if (!success2) {
      console.error('Second attempt also failed.');
    }
  }

  console.log(`\n--- Final balance for ${userId}: ${userAccounts.get(userId)?.balance} ---\n`);
  console.log('Expected final balance if payment processed once: 900');
  console.log('If retried and both succeeded, actual balance will be 800 (incorrect).');
}

simulatePaymentFlow();
