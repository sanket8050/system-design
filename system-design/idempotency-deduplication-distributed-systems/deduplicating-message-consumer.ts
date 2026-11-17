import { IdempotencyStore, IdempotencyRecord, InMemoryIdempotencyStore } from './idempotency-store';

// --- Mock Message Queue Setup ---
interface Message {
  id: string; // Unique message identifier (e.g., Kafka offset, SQS MessageDeduplicationId)
  payload: any;
  timestamp: number;
}

class MockMessageQueue {
  private messages: Message[] = [];
  private consumerCallback: ((message: Message) => Promise<void>) | undefined;

  addMessage(payload: any) {
    const message: Message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      payload,
      timestamp: Date.now(),
    };
    this.messages.push(message);
    console.log(`[MockMQ] Produced message: ${message.id}`);
    // Simulate immediate delivery for demonstration
    if (this.consumerCallback) {
      this.consumerCallback(message);
    }
  }

  // Simulates re-delivery of a specific message
  reDeliverMessage(id: string) {
    const message = this.messages.find(m => m.id === id);
    if (message && this.consumerCallback) {
      console.log(`[MockMQ] Re-delivering message: ${message.id}`);
      this.consumerCallback(message);
    }
  }

  // Simulates a batch of messages, some potentially duplicates
  simulateBatch(payloads: any[]) {
    payloads.forEach(p => this.addMessage(p));
  }

  // Simulates a consumer subscribing
  subscribe(callback: (message: Message) => Promise<void>) {
    this.consumerCallback = callback;
    // In a real MQ, this would poll for messages
  }
}

// --- Deduplicating Message Consumer ---

interface BusinessLogicResult {
  status: 'SUCCESS' | 'FAILURE';
  details: string;
}

export class DeduplicatingMessageConsumer {
  private readonly idempotencyStore: IdempotencyStore;
  private readonly processMessageTTLSeconds: number = 3600; // Store idempotency records for 1 hour

  constructor(store: IdempotencyStore) {
    this.idempotencyStore = store;
  }

  public async consume(message: Message): Promise<void> {
    const idempotencyKey = message.id; // Using message ID as idempotency key

    try {
      const existingRecord = await this.idempotencyStore.get(idempotencyKey);

      if (existingRecord) {
        if (existingRecord.status === 'COMPLETED') {
          console.log(`[Consumer] Message ${idempotencyKey} already processed. Result: ${existingRecord.responseBody?.status}. Skipping.`);
          return; // Skip duplicate message
        } else if (existingRecord.status === 'PENDING') {
          console.warn(`[Consumer] Message ${idempotencyKey} is currently pending. This might indicate a concurrent processing attempt or a previous crash. Skipping for now.`);
          // In a real system, you might implement a timeout/retry logic for PENDING states
          return;
        } else if (existingRecord.status === 'FAILED') {
          console.error(`[Consumer] Message ${idempotencyKey} previously failed. Error: ${existingRecord.error?.message}. Skipping.`);
          // Depending on business logic, you might retry failed messages here
          return;
        }
      }

      console.log(`[Consumer] Processing new message: ${idempotencyKey} with payload:`, message.payload);

      // 1. Mark as PENDING in idempotency store (with a short TTL if using distributed lock for concurrency)
      await this.idempotencyStore.set(idempotencyKey, { status: 'PENDING' }, this.processMessageTTLSeconds);

      // 2. Execute actual business logic
      const result = await this.executeBusinessLogic(message.payload);

      // 3. Mark as COMPLETED or FAILED in idempotency store
      if (result.status === 'SUCCESS') {
        await this.idempotencyStore.set(idempotencyKey, {
          status: 'COMPLETED',
          responseBody: result,
        }, this.processMessageTTLSeconds);
        console.log(`[Consumer] Successfully processed message: ${idempotencyKey}`);
      } else {
        await this.idempotencyStore.set(idempotencyKey, {
          status: 'FAILED',
          error: new Error(result.details),
        }, this.processMessageTTLSeconds);
        console.error(`[Consumer] Failed to process message: ${idempotencyKey}. Error: ${result.details}`);
      }

    } catch (error: any) {
      console.error(`[Consumer] Unexpected error during processing of message ${idempotencyKey}:`, error.message);
      // Ensure the message is marked as FAILED even for unexpected errors
      await this.idempotencyStore.set(idempotencyKey, {
        status: 'FAILED',
        error: { message: error.message, stack: error.stack },
      }, this.processMessageTTLSeconds);
      // Depending on the MQ, you might re-queue the message or dead-letter it
    }
  }

  private async executeBusinessLogic(payload: any): Promise<BusinessLogicResult> {
    // Simulate some asynchronous business operation
    return new Promise(resolve => {
      setTimeout(() => {
        if (payload.shouldFail) {
          resolve({ status: 'FAILURE', details: `Simulated failure for: ${payload.orderId}` });
        } else {
          console.log(`   [BusinessLogic] Handling order: ${payload.orderId} for item: ${payload.item}`);
          resolve({ status: 'SUCCESS', details: `Order ${payload.orderId} processed.` });
        }
      }, Math.random() * 500 + 100); // Simulate variable processing time
    });
  }
}

// --- Example Usage ---
async function runDeduplicationExample() {
  const mockQueue = new MockMessageQueue();
  const idempotencyStore = new InMemoryIdempotencyStore(5000); // Cleanup every 5 seconds
  const consumer = new DeduplicatingMessageConsumer(idempotencyStore);

  // Subscribe the consumer to the mock queue
  mockQueue.subscribe(async (msg) => {
    await consumer.consume(msg);
  });

  console.log('\n--- Sending initial messages ---');
  mockQueue.addMessage({ orderId: 'ORD-001', item: 'Laptop' });
  mockQueue.addMessage({ orderId: 'ORD-002', item: 'Keyboard' });

  // Simulate a short delay then a re-delivery for ORD-001
  setTimeout(() => {
    console.log('\n--- Simulating re-delivery for ORD-001 ---');
    mockQueue.reDeliverMessage(idempotencyStore.store.keys().next().value); // Get the first message ID
  }, 2000);

  // Simulate another new message after a delay
  setTimeout(() => {
    console.log('\n--- Sending another new message ---');
    mockQueue.addMessage({ orderId: 'ORD-003', item: 'Mouse' });
  }, 4000);

  // Simulate a message that fails, then gets re-delivered
  let failedMessageId: string | undefined;
  setTimeout(() => {
    console.log('\n--- Sending a message that will fail ---');
    const failPayload = { orderId: 'ORD-FAIL-001', item: 'Monitor', shouldFail: true };
    mockQueue.addMessage(failPayload);
    // Find the ID of the failed message (this is a hack for the mock, in real life, you'd know the ID)
    failedMessageId = Array.from(idempotencyStore.store.keys()).find(key => idempotencyStore.store.get(key)?.responseBody?.details?.includes('ORD-FAIL-001'));

    setTimeout(() => {
      if (failedMessageId) {
        console.log('\n--- Simulating re-delivery for failed message ---');
        mockQueue.reDeliverMessage(failedMessageId);
      }
    }, 2000);
  }, 6000);

  // Clean up the store after some time
  setTimeout(() => {
    console.log('\n--- Destroying Idempotency Store ---');
    idempotencyStore.destroy();
  }, 10000);
}

runDeduplicationExample();
