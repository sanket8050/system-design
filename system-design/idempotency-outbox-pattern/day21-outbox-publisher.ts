import { v4 as uuidv4 } from 'uuid';

// --- Mock Database Client --- //
// In a real application, this would be a client for PostgreSQL, MySQL, etc.
// We're simulating transactions and data storage for demonstration.
interface MockDBTransaction {
  id: string;
  operations: Array<() => void>;
  committed: boolean;
}

const mockDB: { [tableName: string]: any[] } = {
  orders: [],
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
  console.log(`[DB] Transaction ${tx.id} started.`);
  return tx;
}

async function commitTransaction(tx: MockDBTransaction): Promise<void> {
  if (tx.committed) throw new Error('Transaction already committed.');
  for (const op of tx.operations) {
    op(); // Execute all operations (simulates applying changes to the DB)
  }
  tx.committed = true;
  activeTransactions = activeTransactions.filter(t => t.id !== tx.id);
  console.log(`[DB] Transaction ${tx.id} committed.`);
}

async function rollbackTransaction(tx: MockDBTransaction): Promise<void> {
  activeTransactions = activeTransactions.filter(t => t.id !== tx.id);
  console.log(`[DB] Transaction ${tx.id} rolled back.`);
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

// Mock DB operations within a transaction
function mockInsert(tx: MockDBTransaction, tableName: string, data: any) {
  tx.operations.push(() => {
    mockDB[tableName].push({ ...data, id: uuidv4(), created_at: new Date() });
    console.log(`[DB] Inserted into ${tableName}:`, data);
  });
}

// --- Outbox Pattern Implementation --- //

interface OutboxMessage {
  id: string;
  topic: string;
  payload: any;
  status: 'pending' | 'processed' | 'failed';
  created_at: Date;
}

/**
 * Simulates creating an order and publishing an 'OrderCreated' event
 * using the Outbox Pattern. Both operations occur in a single DB transaction.
 */
async function createOrderAndPublishEvent(orderData: { customerId: string; amount: number; items: string[] }) {
  console.log(`
--- Attempting to create order for customer ${orderData.customerId} ---`);
  try {
    const result = await executeInTransaction(async (tx) => {
      // 1. Perform business logic (e.g., insert into orders table)
      const newOrder = {
        ...orderData,
        orderStatus: 'PENDING',
      };
      mockInsert(tx, 'orders', newOrder);
      const orderId = newOrder.id; // Assuming mockInsert assigns ID

      // 2. Insert message into the outbox table
      const outboxMessage: Omit<OutboxMessage, 'id' | 'created_at'> = {
        topic: 'order_events',
        payload: {
          eventType: 'OrderCreated',
          orderId: orderId,
          customerId: orderData.customerId,
          amount: orderData.amount,
          items: orderData.items,
          timestamp: new Date().toISOString(),
        },
        status: 'pending',
      };
      mockInsert(tx, 'outbox', outboxMessage);

      return { orderId, message: 'Order created and event queued successfully.' };
    });
    console.log(result.message);
    console.log('Current Outbox:', mockDB.outbox);
    console.log('Current Orders:', mockDB.orders);
    return result;
  } catch (error) {
    console.error('Failed to create order and publish event:', error);
    console.log('Current Outbox (after rollback):', mockDB.outbox);
    console.log('Current Orders (after rollback):', mockDB.orders);
    throw error;
  }
}

// --- Demonstration --- //

async function runDemo() {
  // Scenario 1: Successful operation
  await createOrderAndPublishEvent({
    customerId: 'cust-123',
    amount: 100.00,
    items: ['Laptop', 'Mouse'],
  });

  // Scenario 2: Simulate a failure during the transaction (e.g., DB constraint violation)
  // For simplicity, we'll just throw an error in the callback.
  console.log(`
--- Attempting to create order (simulated failure) ---`);
  try {
    await executeInTransaction(async (tx) => {
      mockInsert(tx, 'orders', { customerId: 'cust-456', amount: 50.00, orderStatus: 'PENDING' });
      // Simulate a critical error before inserting into outbox
      throw new Error('Simulated DB connection error during business logic.');
      // This part will not be reached due to the error:
      // mockInsert(tx, 'outbox', { topic: 'order_events', payload: { eventType: 'OrderCreated' }, status: 'pending' });
    });
  } catch (error: any) {
    console.error('Expected error during transaction:', error.message);
  }

  console.log(`
--- Final State ---`);
  console.log('Final Outbox:', mockDB.outbox);
  console.log('Final Orders:', mockDB.orders);
}

runDemo();
