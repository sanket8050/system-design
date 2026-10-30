import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';

// --- Mock Database Client (similar to outbox-publisher.ts) --- //
interface MockDBTransaction {
  id: string;
  operations: Array<() => void>;
  committed: boolean;
}

interface OutboxMessage {
  id: string;
  topic: string;
  payload: any;
  status: 'pending' | 'processed' | 'failed';
  created_at: Date;
  processed_at?: Date;
}

const mockDB: { [tableName: string]: any[] } = {
  outbox: [],
};
let activeTransactions: MockDBTransaction[] = [];

async function beginTransaction(): Promise<MockDBTransaction> {
  const tx: MockDBTransaction = {
    id: uuidv4(),
    operations: [],
    committed: false,
  };
  activeTransactions.push(tx);
  return tx;
}

async function commitTransaction(tx: MockDBTransaction): Promise<void> {
  if (tx.committed) throw new Error('Transaction already committed.');
  for (const op of tx.operations) {
    op();
  }
  tx.committed = true;
  activeTransactions = activeTransactions.filter(t => t.id !== tx.id);
}

async function rollbackTransaction(tx: MockDBTransaction): Promise<void> {
  activeTransactions = activeTransactions.filter(t => t.id !== tx.id);
}

async function executeInTransaction<T>(callback: (tx: MockDBTransaction) => Promise<T>): Promise<T> {
  const tx = await beginTransaction();
  try {
    const result = await callback(tx);
    await commitTransaction(tx);
    return result;
  } catch (error) {
    await rollbackTransaction(tx);
    throw error;
  }
}

function mockInsert(tx: MockDBTransaction, tableName: string, data: any) {
  tx.operations.push(() => {
    mockDB[tableName].push({ ...data, id: uuidv4(), created_at: new Date() });
  });
}

function mockUpdate(tx: MockDBTransaction, tableName: string, id: string, updates: Partial<OutboxMessage>) {
  tx.operations.push(() => {
    const index = mockDB[tableName].findIndex((item: any) => item.id === id);
    if (index !== -1) {
      mockDB[tableName][index] = { ...mockDB[tableName][index], ...updates };
    }
  });
}

function mockSelectPendingOutboxMessages(tx: MockDBTransaction, limit: number): OutboxMessage[] {
  // In a real scenario, this would select from the DB.
  // For mock, we filter from the current state (committed transactions only).
  // Note: This mock isn't perfectly transactional for selects, but demonstrates the idea.
  const pendingMessages = mockDB.outbox.filter((msg: OutboxMessage) => msg.status === 'pending');
  return pendingMessages.slice(0, limit);
}

// --- Mock Message Broker --- //
// In a real system, this would be KafkaProducer, RabbitMQ client, etc.
class MockMessageBroker extends EventEmitter {
  publish(topic: string, message: any) {
    console.log(`[Broker] Publishing to topic '${topic}': ${JSON.stringify(message)}`);
    this.emit('messagePublished', topic, message);
  }
}
const mockBroker = new MockMessageBroker();

// --- Outbox Processor Worker --- //

const POLL_INTERVAL_MS = 3000;
const BATCH_SIZE = 10;
let isRunning = false;

/**
 * The OutboxProcessorWorker polls the outbox table for pending messages,
 * publishes them to the message broker, and marks them as processed.
 */
class OutboxProcessorWorker {
  private intervalId: NodeJS.Timeout | null = null;

  constructor() {
    console.log('OutboxProcessorWorker initialized.');
  }

  public start() {
    if (isRunning) {
      console.log('Worker already running.');
      return;
    }
    isRunning = true;
    console.log(`Worker started, polling every ${POLL_INTERVAL_MS}ms.`);
    this.intervalId = setInterval(() => this.processOutbox(), POLL_INTERVAL_MS);
  }

  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    isRunning = false;
    console.log('Worker stopped.');
  }

  private async processOutbox() {
    if (!isRunning) return;

    console.log(`[Worker] Polling for pending outbox messages...`);

    try {
      const messagesToProcess = await executeInTransaction(async (tx) => {
        // 1. Select pending messages from the outbox table
        const pendingMessages = mockSelectPendingOutboxMessages(tx, BATCH_SIZE);
        return pendingMessages;
      });

      if (messagesToProcess.length === 0) {
        console.log('[Worker] No pending messages found.');
        return;
      }

      console.log(`[Worker] Found ${messagesToProcess.length} messages to process.`);

      for (const message of messagesToProcess) {
        try {
          // 2. Publish message to the actual message broker
          mockBroker.publish(message.topic, message.payload);

          // 3. Mark message as processed in the outbox table (within a new transaction)
          await executeInTransaction(async (tx) => {
            mockUpdate(tx, 'outbox', message.id, { status: 'processed', processed_at: new Date() });
          });
          console.log(`[Worker] Successfully processed and marked message ID: ${message.id}`);
        } catch (publishError) {
          console.error(`[Worker] Failed to publish message ID: ${message.id}. Error:`, publishError);
          // In a real system, you might increment a retry count or move to a failed state
          // For now, we'll let it stay 'pending' for retry on next poll.
          await executeInTransaction(async (tx) => {
            mockUpdate(tx, 'outbox', message.id, { status: 'failed' }); // Or 'pending' for retry
          });
        }
      }
    } catch (dbError) {
      console.error('[Worker] Database error during outbox processing:', dbError);
    }
  }
}

// --- Demonstration --- //

async function simulateProducerMessage() {
  const orderData = {
    customerId: uuidv4().slice(0, 8),
    amount: Math.floor(Math.random() * 1000) + 10,
    items: [`Item-${Math.random().toFixed(2)}`],
  };

  await executeInTransaction(async (tx) => {
    // Simulate business logic (e.g., insert into orders table)
    // For this worker demo, we'll just insert directly into outbox for simplicity
    const outboxMessage: Omit<OutboxMessage, 'id' | 'created_at' | 'processed_at'> = {
      topic: 'order_events',
      payload: {
        eventType: 'OrderCreated',
        orderId: uuidv4(),
        customerId: orderData.customerId,
        amount: orderData.amount,
        items: orderData.items,
        timestamp: new Date().toISOString(),
      },
      status: 'pending',
    };
    mockInsert(tx, 'outbox', outboxMessage);
  });
  console.log(`[Producer] Simulated new message added to outbox for customer: ${orderData.customerId}`);
}

const worker = new OutboxProcessorWorker();
worker.start();

// Simulate messages being added to the outbox over time
setInterval(() => simulateProducerMessage(), 5000);

// Stop the worker after some time for demonstration
setTimeout(() => {
  worker.stop();
  console.log('\n--- Final Outbox State ---');
  console.log(JSON.stringify(mockDB.outbox, null, 2));
  console.log('\n--- Messages Published by Broker ---');
  // You'd typically have a consumer listening to the broker, but for this demo
  // we just log what the mockBroker 'published'.
}, 20 * 1000);
