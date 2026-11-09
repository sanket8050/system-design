/**
 * Day 31: Distributed Transactions - Two-Phase Commit (2PC)
 * File 2/5: A conceptual simulation of a 2PC coordinator and participants.
 * NOTE: This is a highly simplified example for understanding the mechanics.
 * Real-world 2PC implementations are far more complex, handle various failure
 * scenarios, and are often avoided in highly distributed microservice architectures
 * due to their blocking nature and single point of failure (the coordinator).
 */

enum TransactionState {
  PENDING,
  PREPARED,
  COMMITTED,
  ROLLED_BACK,
}

enum Vote {
  YES,
  NO,
}

interface Participant {
  id: string;
  prepare(): Promise<Vote>;
  commit(): Promise<boolean>;
  rollback(): Promise<boolean>;
}

class DatabaseServiceParticipant implements Participant {
  public id: string;
  private data: Record<string, any> = {};
  private pendingChanges: Record<string, any> | null = null;
  private shouldFailPrepare: boolean = false;

  constructor(id: string, initialData: Record<string, any> = {}) {
    this.id = id;
    this.data = { ...initialData };
  }

  public setPendingChanges(changes: Record<string, any>): void {
    this.pendingChanges = changes;
  }

  public setFailureMode(fail: boolean): void {
    this.shouldFailPrepare = fail;
  }

  async prepare(): Promise<Vote> {
    console.log(`[${this.id}] received PREPARE request.`);
    if (this.shouldFailPrepare) {
      console.log(`[${this.id}] deliberately failing PREPARE.`);
      this.pendingChanges = null;
      return Vote.NO;
    }
    if (this.pendingChanges) {
      // In a real scenario, this would involve logging, locking resources, etc.
      console.log(`[${this.id}] prepared for changes:`, this.pendingChanges);
      return Vote.YES;
    }
    return Vote.NO; // No changes to prepare
  }

  async commit(): Promise<boolean> {
    console.log(`[${this.id}] received COMMIT request.`);
    if (this.pendingChanges) {
      this.data = { ...this.data, ...this.pendingChanges };
      this.pendingChanges = null;
      console.log(`[${this.id}] committed changes. New data:`, this.data);
      return true;
    }
    console.log(`[${this.id}] no pending changes to commit.`);
    return false;
  }

  async rollback(): Promise<boolean> {
    console.log(`[${this.id}] received ROLLBACK request.`);
    if (this.pendingChanges) {
      // Discard pending changes
      this.pendingChanges = null;
      console.log(`[${this.id}] rolled back pending changes.`);
      return true;
    }
    console.log(`[${this.id}] no pending changes to roll back.`);
    return false;
  }

  public getData(): Record<string, any> {
    return { ...this.data };
  }
}

class TwoPhaseCommitCoordinator {
  private participants: Participant[];
  private transactionId: string;
  private state: TransactionState = TransactionState.PENDING;

  constructor(transactionId: string, participants: Participant[]) {
    this.transactionId = transactionId;
    this.participants = participants;
  }

  public async executeTransaction(): Promise<boolean> {
    console.log(`\n--- Starting 2PC Transaction: ${this.transactionId} ---`);

    // Phase 1: Prepare
    console.log(`[Coordinator] Phase 1: Sending PREPARE to all participants.`);
    const prepareVotes = await Promise.all(
      this.participants.map(p => p.prepare())
    );

    const allVotedYes = prepareVotes.every(vote => vote === Vote.YES);

    if (allVotedYes) {
      this.state = TransactionState.PREPARED;
      console.log(`[Coordinator] All participants PREPARED. Proceeding to COMMIT.`);
      // Phase 2: Commit
      const commitResults = await Promise.all(
        this.participants.map(p => p.commit())
      );
      if (commitResults.every(res => res)) {
        this.state = TransactionState.COMMITTED;
        console.log(`[Coordinator] All participants COMMITTED. Transaction successful.`);
        return true;
      } else {
        console.error(`[Coordinator] Some participants failed to COMMIT. This is a critical error in 2PC.`);
        // In a real system, this would trigger complex recovery or manual intervention.
        return false;
      }
    } else {
      console.log(`[Coordinator] Not all participants PREPARED. Sending ROLLBACK.`);
      // Phase 2: Rollback
      await Promise.all(this.participants.map(p => p.rollback()));
      this.state = TransactionState.ROLLED_BACK;
      console.log(`[Coordinator] All participants ROLLED BACK. Transaction aborted.`);
      return false;
    }
  }

  public getTransactionState(): TransactionState {
    return this.state;
  }
}

// --- Simulation --- //

// Scenario 1: Successful Transaction
console.log("\n=== Scenario 1: Successful Transaction ===");
const orderDb = new DatabaseServiceParticipant('OrderService', { orders: [] });
const inventoryDb = new DatabaseServiceParticipant('InventoryService', { stock: { productA: 10 } });

orderDb.setPendingChanges({ orders: [{ id: 'tx100', item: 'productA', qty: 1 }] });
inventoryDb.setPendingChanges({ stock: { productA: 9 } });

const coordinator1 = new TwoPhaseCommitCoordinator('tx100', [orderDb, inventoryDb]);
coordinator1.executeTransaction().then(success => {
  console.log(`Transaction tx100 result: ${success ? 'SUCCESS' : 'FAILURE'}`);
  console.log('OrderService data:', orderDb.getData());
  console.log('InventoryService data:', inventoryDb.getData());
});

// Scenario 2: Participant Failure During Prepare Phase
console.log("\n=== Scenario 2: Rollback due to Prepare Failure ===");
const userDb = new DatabaseServiceParticipant('UserService', { users: [{ id: 'user1' }] });
const paymentDb = new DatabaseServiceParticipant('PaymentService', { transactions: [] });

userDb.setPendingChanges({ users: [{ id: 'user1' }, { id: 'user2' }] });
paymentDb.setPendingChanges({ transactions: [{ id: 'pay200', amount: 50 }] });
paymentDb.setFailureMode(true); // Simulate a failure

const coordinator2 = new TwoPhaseCommitCoordinator('tx200', [userDb, paymentDb]);
coordinator2.executeTransaction().then(success => {
  console.log(`Transaction tx200 result: ${success ? 'SUCCESS' : 'FAILURE'}`);
  console.log('UserService data:', userDb.getData()); // Should be unchanged
  console.log('PaymentService data:', paymentDb.getData()); // Should be unchanged
});
