// In-memory event bus simulating a message queue with consumer groups

type Handler<T> = (message: T) => Promise<void>;

interface QueuedMessage<T> {
  id: string;
  payload: T;
  attempts: number;
  publishedAt: Date;
}

export class InMemoryMessageQueue<T> {
  private queue: QueuedMessage<T>[] = [];
  private dlq: QueuedMessage<T>[] = [];
  private processedIds = new Set<string>();
  private readonly maxAttempts: number;

  constructor(maxAttempts = 3) {
    this.maxAttempts = maxAttempts;
  }

  publish(id: string, payload: T): void {
    this.queue.push({ id, payload, attempts: 0, publishedAt: new Date() });
  }

  async consume(handler: Handler<T>): Promise<{ processed: number; failed: number }> {
    let processed = 0;
    let failed = 0;

    while (this.queue.length > 0) {
      const msg = this.queue.shift()!;

      // Idempotency check
      if (this.processedIds.has(msg.id)) {
        console.log(`[Queue] Skipping duplicate message ${msg.id}`);
        continue;
      }

      try {
        await handler(msg.payload);
        this.processedIds.add(msg.id);
        processed++;
      } catch (err) {
        msg.attempts++;
        if (msg.attempts < this.maxAttempts) {
          this.queue.push(msg); // re-queue
        } else {
          this.dlq.push(msg);
          failed++;
          console.warn(`[Queue] Message ${msg.id} moved to DLQ after ${msg.attempts} attempts`);
        }
      }
    }
    return { processed, failed };
  }

  getDlq(): QueuedMessage<T>[] {
    return [...this.dlq];
  }
}

// Test
async function runTest() {
  const queue = new InMemoryMessageQueue<{ orderId: string }>(3);

  queue.publish('evt-1', { orderId: 'order-100' });
  queue.publish('evt-2', { orderId: 'order-101' });
  queue.publish('evt-1', { orderId: 'order-100' }); // duplicate

  let callCount = 0;
  const result = await queue.consume(async (msg) => {
    callCount++;
    if (msg.orderId === 'order-101' && callCount === 2) {
      throw new Error('Simulated transient failure');
    }
  });

  console.log('Processed:', result.processed, '| Failed:', result.failed);
  console.log('DLQ length:', queue.getDlq().length);
  console.log('Event-driven queue tests passed');
}

runTest().catch(console.error);
