// system-design/event-driven-architecture-patterns/idempotent-message-processor.ts

import { v4 as uuidv4 } from 'uuid'; // For generating unique message IDs

/**
 * Represents a generic message with a unique ID.
 */
interface Message {
  id: string; // Unique identifier for the message
  type: string;
  payload: any;
  timestamp: Date;
}

/**
 * A mock database to simulate storing processed message IDs and application data.
 */
class MockDatabase {
  private processedMessageIds: Set<string> = new Set();
  private applicationData: Map<string, any> = new Map(); // e.g., user balances, inventory counts

  public async hasProcessed(messageId: string): Promise<boolean> {
    // Simulate async DB call
    await new Promise(resolve => setTimeout(resolve, 10));
    return this.processedMessageIds.has(messageId);
  }

  public async markAsProcessed(messageId: string): Promise<void> {
    // Simulate async DB call
    await new Promise(resolve => setTimeout(resolve, 5));
    this.processedMessageIds.add(messageId);
    console.log(`[DB] Marked message ID '${messageId}' as processed.`);
  }

  public async updateApplicationData(key: string, value: any): Promise<void> {
    // Simulate async DB call
    await new Promise(resolve => setTimeout(resolve, 20));
    this.applicationData.set(key, value);
    console.log(`[DB] Updated application data for '${key}': ${JSON.stringify(value)}`);
  }

  public async getApplicationData(key: string): Promise<any | undefined> {
    await new Promise(resolve => setTimeout(resolve, 5));
    return this.applicationData.get(key);
  }
}

/**
 * An IdempotentMessageProcessor that ensures messages are processed only once.
 * It uses a mock database to store processed message IDs.
 */
class IdempotentMessageProcessor {
  private db: MockDatabase;

  constructor(database: MockDatabase) {
    this.db = database;
  }

  /**
   * Processes a message idempotently.
   * @param message The message to process.
   * @param processingLogic The actual business logic to execute if the message hasn't been processed.
   * @returns True if the message was processed, false if it was a duplicate.
   */
  public async process(
    message: Message,
    processingLogic: (payload: any) => Promise<void>
  ): Promise<boolean> {
    console.log(`\n[Processor] Attempting to process message ID: ${message.id}, Type: ${message.type}`);

    // Step 1: Check if message has already been processed
    const alreadyProcessed = await this.db.hasProcessed(message.id);
    if (alreadyProcessed) {
      console.warn(`[Processor] Message ID '${message.id}' already processed. Skipping.`);
      return false;
    }

    // Step 2: Execute business logic (should be wrapped in a transaction with markAsProcessed in real-world)
    try {
      console.log(`[Processor] Executing business logic for message ID '${message.id}'...`);
      await processingLogic(message.payload);

      // Step 3: Mark message as processed (THIS SHOULD BE ATOMIC WITH STEP 2 IN REAL DB)
      await this.db.markAsProcessed(message.id);
      console.log(`[Processor] Successfully processed and marked message ID '${message.id}'.`);
      return true;
    } catch (error) {
      console.error(`[Processor] Error processing message ID '${message.id}':`, error);
      // In a real system, you might retry, send to DLQ, etc.
      throw error; // Re-throw to indicate failure
    }
  }
}

// --- Usage Example ---
const mockDb = new MockDatabase();
const processor = new IdempotentMessageProcessor(mockDb);

// Simulate a service that handles 'OrderCreated' events
const handleOrderCreated = async (orderPayload: { orderId: string; userId: string; amount: number }) => {
  console.log(`  [OrderService] Creating order ${orderPayload.orderId} for user ${orderPayload.userId} with amount ${orderPayload.amount}`);
  // Simulate writing to an orders table
  await mockDb.updateApplicationData(`order:${orderPayload.orderId}`, {
    ...orderPayload,
    status: 'PENDING',
    createdAt: new Date(),
  });
  console.log(`  [OrderService] Order ${orderPayload.orderId} created.`);
};

// Simulate a service that handles 'InventoryReserved' events
const handleInventoryReserved = async (inventoryPayload: { productId: string; quantity: number }) => {
  console.log(`  [InventoryService] Reserving ${inventoryPayload.quantity} of product ${inventoryPayload.productId}`);
  const currentStock = (await mockDb.getApplicationData(`stock:${inventoryPayload.productId}`)) || 100; // Start with 100
  if (currentStock < inventoryPayload.quantity) {
    throw new Error("Insufficient stock");
  }
  await mockDb.updateApplicationData(`stock:${inventoryPayload.productId}`, currentStock - inventoryPayload.quantity);
  console.log(`  [InventoryService] Reserved ${inventoryPayload.quantity} of product ${inventoryPayload.productId}. New stock: ${currentStock - inventoryPayload.quantity}`);
};


async function runSimulation() {
  const message1: Message = {
    id: uuidv4(),
    type: "OrderCreated",
    payload: { orderId: "ORD-001", userId: "user-abc", amount: 99.99 },
    timestamp: new Date(),
  };

  const message2: Message = {
    id: uuidv4(),
    type: "InventoryReserved",
    payload: { productId: "PROD-X", quantity: 5 },
    timestamp: new Date(),
  };

  // Scenario 1: Process OrderCreated message once
  await processor.process(message1, handleOrderCreated);

  // Scenario 2: Simulate duplicate OrderCreated message
  console.log("\n--- Simulating duplicate message for ORD-001 ---");
  await processor.process(message1, handleOrderCreated); // Same message ID

  // Scenario 3: Process InventoryReserved message
  await processor.process(message2, handleInventoryReserved);

  // Scenario 4: Simulate duplicate InventoryReserved message
  console.log("\n--- Simulating duplicate message for PROD-X ---");
  await processor.process(message2, handleInventoryReserved);

  // Scenario 5: Process a new, unique InventoryReserved message
  const message3: Message = {
    id: uuidv4(),
    type: "InventoryReserved",
    payload: { productId: "PROD-X", quantity: 10 },
    timestamp: new Date(),
  };
  await processor.process(message3, handleInventoryReserved);

  // Check final state
  console.log("\n--- Final Application Data State ---");
  console.log("Order ORD-001:", await mockDb.getApplicationData("order:ORD-001"));
  console.log("Stock PROD-X:", await mockDb.getApplicationData("stock:PROD-X"));
}

runSimulation().catch(console.error);