import { v4 as uuidv4 } from 'uuid';

// --- Mock Persistent Store for Processed Message IDs ---
// In a real application, this would be Redis, a database table, or a dedicated deduplication service.
// Redis's `SETNX` (Set if Not Exists) is a common pattern for this.
class ProcessedMessagesStore {
  private store = new Map<string, Date>(); // messageId -> processedAt
  private readonly TTL_SECONDS = 24 * 60 * 60; // 24 hours

  /**
   * Attempts to mark a messageId as processed. Returns true if marked successfully (first time),
   * false if it was already marked.
   */
  public async markAsProcessed(messageId: string): Promise<boolean> {
    // Simulate async operation
    await new Promise(resolve => setTimeout(resolve, Math.random() * 50));

    if (this.store.has(messageId)) {
      // Check for expiration (simple in-memory cleanup)
      const processedAt = this.store.get(messageId)!;
      if ((Date.now() - processedAt.getTime()) / 1000 > this.TTL_SECONDS) {
        console.log(`[Deduplicator] Expired messageId ${messageId} found. Re-processing.`);
        this.store.delete(messageId);
      } else {
        return false; // Already processed and not expired
      }
    }

    this.store.set(messageId, new Date());
    console.log(`[Deduplicator] MessageId ${messageId} marked as processed.`);
    return true;
  }

  public async isProcessed(messageId: string): Promise<boolean> {
    // Simulate async operation
    await new Promise(resolve => setTimeout(resolve, Math.random() * 20));
    return this.store.has(messageId);
  }

  public getCount(): number {
    return this.store.size;
  }

  public clear(): void {
    this.store.clear();
  }
}

const processedMessagesStore = new ProcessedMessagesStore();

// --- Mock Business Logic Service ---
// This service performs the actual work that needs to be idempotent.
interface TransactionData {
  amount: number;
  currency: string;
  userId: string;
}

interface ProcessedTransaction {
  transactionId: string;
  amount: number;
  currency: string;
  userId: string;
  status: 'completed' | 'failed';
  processedAt: Date;
}

class TransactionProcessor {
  private transactions = new Map<string, ProcessedTransaction>();

  public async executeTransaction(data: TransactionData): Promise<ProcessedTransaction> {
    console.log(`  [TransactionProcessor] Executing transaction for user ${data.userId}, amount ${data.amount} ${data.currency}...`);
    // Simulate complex, potentially non-idempotent business logic
    await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 100));

    const transactionId = `txn_${uuidv4().substring(0, 8)}`;
    const result: ProcessedTransaction = {
      transactionId,
      ...data,
      status: 'completed',
      processedAt: new Date(),
    };
    this.transactions.set(transactionId, result);
    console.log(`  [TransactionProcessor] Transaction ${transactionId} completed.`);
    return result;
  }

  public getTransactionCount(): number {
    return this.transactions.size;
  }
}

const transactionProcessor = new TransactionProcessor();

// --- Idempotent Message Consumer ---

interface Message {
  id: string; // Unique message ID, typically from producer or broker
  payload: TransactionData;
  retries?: number; // Simulate retry count from broker
}

export class IdempotentMessageConsumer {
  private consumerId: string;

  constructor(consumerId: string) {
    this.consumerId = consumerId;
    console.log(`Consumer ${this.consumerId} initialized.`);
  }

  public async processMessage(message: Message): Promise<void> {
    const { id: messageId, payload, retries = 0 } = message;
    console.log(`[Consumer ${this.consumerId}] Received message ${messageId} (Retries: ${retries}).`);

    try {
      const isFirstProcessing = await processedMessagesStore.markAsProcessed(messageId);

      if (!isFirstProcessing) {
        console.warn(`[Consumer ${this.consumerId}] Message ${messageId} already processed. Skipping business logic.`);
        // Acknowledge the message to the broker even if it's a duplicate
        // (Assuming an external 'acknowledgeMessage' function)
        // await this.acknowledgeMessage(messageId);
        return;
      }

      // If we reach here, it's the first time processing this message (or an expired one).
      console.log(`[Consumer ${this.consumerId}] Processing new message ${messageId}.`);
      await transactionProcessor.executeTransaction(payload);

      // Acknowledge the message to the broker after successful processing
      // await this.acknowledgeMessage(messageId);
      console.log(`[Consumer ${this.consumerId}] Successfully processed and acknowledged message ${messageId}.`);
    } catch (error: any) {
      console.error(`[Consumer ${this.consumerId}] Error processing message ${messageId}:`, error.message);
      // In a real scenario, you might NACK the message or move it to a Dead Letter Queue (DLQ)
      // await this.nackMessage(messageId);
      throw error; // Re-throw to simulate consumer crash/retry by broker
    }
  }

  // private async acknowledgeMessage(messageId: string): Promise<void> {
  //   // Simulate sending acknowledgment to message broker
  //   await new Promise(resolve => setTimeout(resolve, 10));
  //   console.log(`[Consumer ${this.consumerId}] Acknowledged ${messageId} to broker.`);
  // }

  // private async nackMessage(messageId: string): Promise<void> {
  //   // Simulate sending negative acknowledgment to message broker
  //   await new Promise(resolve => setTimeout(resolve, 10));
  //   console.log(`[Consumer ${this.consumerId}] NACKed ${messageId} to broker.`);
  // }
}

// --- Example Usage ---
async function runExample() {
  const consumer = new IdempotentMessageConsumer('PaymentsConsumer-1');

  const message1: Message = {
    id: 'msg-abc-123',
    payload: { amount: 100, currency: 'USD', userId: 'user-001' },
  };
  const message2: Message = {
    id: 'msg-def-456',
    payload: { amount: 250, currency: 'EUR', userId: 'user-002' },
  };
  const message1_retry: Message = {
    id: 'msg-abc-123',
    payload: { amount: 100, currency: 'USD', userId: 'user-001' },
    retries: 1,
  };
  const message3: Message = {
    id: 'msg-ghi-789',
    payload: { amount: 50, currency: 'GBP', userId: 'user-003' },
  };

  console.log('\n--- Processing initial messages ---');
  await consumer.processMessage(message1);
  await consumer.processMessage(message2);

  console.log('\n--- Processing message1 again (simulating redelivery) ---');
  await consumer.processMessage(message1_retry);

  console.log('\n--- Processing message3 ---');
  await consumer.processMessage(message3);

  console.log('\n--- Processing message1 again (third time) ---');
  await consumer.processMessage(message1_retry);

  console.log('\n--- Summary ---');
  console.log(`Total messages processed (deduplicated): ${processedMessagesStore.getCount()}`);
  console.log(`Total business transactions executed: ${transactionProcessor.getTransactionCount()}`);

  // Expected output for counts:
  // Total messages processed (deduplicated): 3 (msg-abc-123, msg-def-456, msg-ghi-789)
  // Total business transactions executed: 3 (one for each unique message)
}

// runExample();
