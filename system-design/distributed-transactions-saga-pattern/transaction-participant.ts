import { v4 as uuidv4 } from 'uuid';

export type TransactionId = string;
export type ParticipantId = string;

export enum TransactionState {
  PENDING = 'PENDING',
  PREPARED = 'PREPARED',
  COMMITTED = 'COMMITTED',
  ROLLED_BACK = 'ROLLED_BACK',
  FAILED = 'FAILED',
}

interface TransactionOperation {
  type: string;
  payload: any;
}

/**
 * Represents a service that can participate in a distributed transaction.
 * It tracks its own state for a given transaction ID.
 */
export class TransactionParticipant {
  private participantId: ParticipantId;
  private transactionStates: Map<TransactionId, TransactionState> = new Map();
  private pendingOperations: Map<TransactionId, TransactionOperation[]> = new Map();

  constructor(id: ParticipantId) {
    this.participantId = id;
    console.log(`[${this.participantId}] Initialized.`);
  }

  public getId(): ParticipantId {
    return this.participantId;
  }

  /**
   * Simulates the 'prepare' phase of a 2PC. The participant checks if it can perform the operation.
   * If successful, it locks resources and stores the operation, but doesn't commit yet.
   * @param transactionId Unique ID for the transaction.
   * @param operation The operation to be performed.
   * @returns true if prepared successfully, false otherwise.
   */
  public async prepare(transactionId: TransactionId, operation: TransactionOperation): Promise<boolean> {
    console.log(`[${this.participantId}] Transaction ${transactionId}: Preparing for operation type '${operation.type}'...`);

    if (this.transactionStates.has(transactionId) && this.transactionStates.get(transactionId) !== TransactionState.PENDING) {
      console.warn(`[${this.participantId}] Transaction ${transactionId}: Already in state ${this.transactionStates.get(transactionId)}. Cannot prepare.`);
      return false;
    }

    // Simulate some business logic check or resource lock
    const success = Math.random() > 0.1; // 90% chance of success

    if (success) {
      this.transactionStates.set(transactionId, TransactionState.PREPARED);
      this.pendingOperations.set(transactionId, [operation]); // Store operation for later commit
      console.log(`[${this.participantId}] Transaction ${transactionId}: PREPARED successfully.`);
      return true;
    } else {
      this.transactionStates.set(transactionId, TransactionState.FAILED);
      console.error(`[${this.participantId}] Transaction ${transactionId}: FAILED to prepare.`);
      return false;
    }
  }

  /**
   * Simulates the 'commit' phase. The participant makes the prepared operation permanent.
   * @param transactionId Unique ID for the transaction.
   * @returns true if committed successfully, false otherwise.
   */
  public async commit(transactionId: TransactionId): Promise<boolean> {
    console.log(`[${this.participantId}] Transaction ${transactionId}: Committing...`);

    if (this.transactionStates.get(transactionId) !== TransactionState.PREPARED) {
      console.warn(`[${this.participantId}] Transaction ${transactionId}: Not in PREPARED state. Cannot commit.`);
      return false;
    }

    // Simulate applying the operation to the actual data store
    const operations = this.pendingOperations.get(transactionId) || [];
    operations.forEach(op => {
      console.log(`[${this.participantId}] Executing actual commit for operation:`, op);
      // Actual business logic to persist changes
    });

    this.transactionStates.set(transactionId, TransactionState.COMMITTED);
    this.pendingOperations.delete(transactionId);
    console.log(`[${this.participantId}] Transaction ${transactionId}: COMMITTED successfully.`);
    return true;
  }

  /**
   * Simulates the 'rollback' phase. The participant undoes any prepared changes.
   * @param transactionId Unique ID for the transaction.
   * @returns true if rolled back successfully, false otherwise.
   */
  public async rollback(transactionId: TransactionId): Promise<boolean> {
    console.log(`[${this.participantId}] Transaction ${transactionId}: Rolling back...`);

    if (!this.transactionStates.has(transactionId) || this.transactionStates.get(transactionId) === TransactionState.COMMITTED) {
      console.warn(`[${this.participantId}] Transaction ${transactionId}: Not in a state to rollback or already committed.`);
      return false;
    }

    // Simulate undoing or discarding prepared changes
    this.transactionStates.set(transactionId, TransactionState.ROLLED_BACK);
    this.pendingOperations.delete(transactionId);
    console.log(`[${this.participantId}] Transaction ${transactionId}: ROLLED_BACK successfully.`);
    return true;
  }

  public getTransactionState(transactionId: TransactionId): TransactionState | undefined {
    return this.transactionStates.get(transactionId);
  }
}

// Example usage (for testing purposes)
/*
async function runParticipantExample() {
  const participant = new TransactionParticipant('InventoryService');
  const txId = uuidv4();
  const operation = { type: 'DECREMENT_STOCK', payload: { itemId: 'sku123', quantity: 5 } };

  const prepared = await participant.prepare(txId, operation);
  if (prepared) {
    await participant.commit(txId);
  } else {
    await participant.rollback(txId);
  }

  console.log(`Final state for ${txId}: ${participant.getTransactionState(txId)}`);
}

runParticipantExample();
*/