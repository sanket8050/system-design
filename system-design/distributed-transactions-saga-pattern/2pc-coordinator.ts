import { v4 as uuidv4 } from 'uuid';
import { TransactionParticipant, ParticipantId, TransactionId, TransactionState } from './transaction-participant';

interface TransactionOperation {
  type: string;
  payload: any;
}

/**
 * Represents a coordinator for a Two-Phase Commit (2PC) transaction.
 * It orchestrates the prepare and commit/rollback phases across multiple participants.
 */
export class TwoPhaseCommitCoordinator {
  private participants: TransactionParticipant[];
  private activeTransactions: Map<TransactionId, {
    operations: Map<ParticipantId, TransactionOperation>;
    preparedParticipants: Set<ParticipantId>;
    state: TransactionState;
  }> = new Map();

  constructor(participants: TransactionParticipant[]) {
    this.participants = participants;
    console.log(`[Coordinator] Initialized with ${participants.length} participants.`);
  }

  /**
   * Initiates a new distributed transaction.
   * @param participantOperations A map where keys are participant IDs and values are operations for that participant.
   * @returns The transaction ID if initiated successfully.
   */
  public async startTransaction(participantOperations: Map<ParticipantId, TransactionOperation>): Promise<TransactionId | null> {
    const transactionId = uuidv4();
    console.log(`[Coordinator] Starting new transaction: ${transactionId}`);

    this.activeTransactions.set(transactionId, {
      operations: participantOperations,
      preparedParticipants: new Set(),
      state: TransactionState.PENDING,
    });

    try {
      // Phase 1: Prepare
      const prepareResults = await Promise.all(
        this.participants.map(async p => {
          const operation = participantOperations.get(p.getId());
          if (!operation) {
            // Participant might not be involved in this specific transaction
            return { participantId: p.getId(), success: true };
          }
          const success = await p.prepare(transactionId, operation);
          return { participantId: p.getId(), success };
        })
      );

      const allPrepared = prepareResults.every(res => res.success);

      if (allPrepared) {
        console.log(`[Coordinator] Transaction ${transactionId}: All participants PREPARED. Proceeding to commit.`);
        this.activeTransactions.get(transactionId)!.state = TransactionState.PREPARED;
        // Phase 2: Commit
        await this.commitTransaction(transactionId);
        return transactionId;
      } else {
        console.error(`[Coordinator] Transaction ${transactionId}: Not all participants PREPARED. Rolling back.`);
        this.activeTransactions.get(transactionId)!.state = TransactionState.FAILED;
        // Phase 2: Rollback
        await this.rollbackTransaction(transactionId);
        return null;
      }
    } catch (error) {
      console.error(`[Coordinator] Transaction ${transactionId}: Error during transaction initiation:`, error);
      this.activeTransactions.get(transactionId)!.state = TransactionState.FAILED;
      await this.rollbackTransaction(transactionId);
      return null;
    }
  }

  private async commitTransaction(transactionId: TransactionId): Promise<void> {
    console.log(`[Coordinator] Transaction ${transactionId}: Sending COMMIT to all participants.`);
    await Promise.all(
      this.participants.map(p => p.commit(transactionId))
    );
    this.activeTransactions.get(transactionId)!.state = TransactionState.COMMITTED;
    console.log(`[Coordinator] Transaction ${transactionId}: Successfully COMMITTED.`);
    this.cleanupTransaction(transactionId);
  }

  private async rollbackTransaction(transactionId: TransactionId): Promise<void> {
    console.log(`[Coordinator] Transaction ${transactionId}: Sending ROLLBACK to all participants.`);
    await Promise.all(
      this.participants.map(p => p.rollback(transactionId))
    );
    this.activeTransactions.get(transactionId)!.state = TransactionState.ROLLED_BACK;
    console.log(`[Coordinator] Transaction ${transactionId}: Successfully ROLLED_BACK.`);
    this.cleanupTransaction(transactionId);
  }

  private cleanupTransaction(transactionId: TransactionId): void {
    this.activeTransactions.delete(transactionId);
    console.log(`[Coordinator] Transaction ${transactionId}: Cleaned up.`);
  }

  public getTransactionState(transactionId: TransactionId): TransactionState | undefined {
    return this.activeTransactions.get(transactionId)?.state;
  }
}

// Example Usage
/*
async function run2PCExample() {
  const inventoryService = new TransactionParticipant('InventoryService');
  const paymentService = new TransactionParticipant('PaymentService');
  const shippingService = new TransactionParticipant('ShippingService');

  const coordinator = new TwoPhaseCommitCoordinator([inventoryService, paymentService, shippingService]);

  // Scenario 1: Successful transaction
  console.log('\n--- Scenario 1: Successful Order ---');
  const successfulTxId = await coordinator.startTransaction(new Map([
    [inventoryService.getId(), { type: 'DECREMENT_STOCK', payload: { itemId: 'sku123', quantity: 2 } }],
    [paymentService.getId(), { type: 'PROCESS_PAYMENT', payload: { userId: 'user456', amount: 100 } }],
    [shippingService.getId(), { type: 'CREATE_SHIPMENT', payload: { userId: 'user456', address: '123 Main St' } }],
  ]));
  console.log(`Scenario 1 Result: Transaction ${successfulTxId} state: ${coordinator.getTransactionState(successfulTxId!)}`);

  // Scenario 2: Failed preparation (e.g., inventory out of stock)
  console.log('\n--- Scenario 2: Failed Order (Inventory) ---');
  // To simulate failure, we'd need to mock the participant's prepare method to fail.
  // For this example, let's assume one participant will randomly fail sometimes via its internal logic.
  const failedTxId = await coordinator.startTransaction(new Map([
    [inventoryService.getId(), { type: 'DECREMENT_STOCK', payload: { itemId: 'sku124', quantity: 1000 } }], // Likely to fail
    [paymentService.getId(), { type: 'PROCESS_PAYMENT', payload: { userId: 'user457', amount: 50 } }],
  ]));
  console.log(`Scenario 2 Result: Transaction ${failedTxId} state: ${failedTxId ? coordinator.getTransactionState(failedTxId!) : 'ABORTED'}`);
}

run2PCExample();
*/