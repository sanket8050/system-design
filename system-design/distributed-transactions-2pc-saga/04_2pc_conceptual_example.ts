/**
 * 04_2pc_conceptual_example.ts
 * A high-level, conceptual implementation of a Two-Phase Commit (2PC) protocol.
 * This example focuses on the flow and interfaces, not production-ready details.
 */

enum TransactionState {
  PENDING,
  PREPARED,
  COMMITTED,
  ABORTED,
}

enum Vote {
  COMMIT,
  ABORT,
}

interface Participant {
  id: string;
  prepare(): Promise<Vote>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

class TwoPhaseCommitCoordinator {
  private participants: Participant[];
  private transactionId: string;
  private state: TransactionState;

  constructor(transactionId: string, participants: Participant[]) {
    this.transactionId = transactionId;
    this.participants = participants;
    this.state = TransactionState.PENDING;
    console.log(`[Coordinator ${this.transactionId}] Initialized with ${participants.length} participants.`);
  }

  async executeTransaction(): Promise<boolean> {
    console.log(`[Coordinator ${this.transactionId}] Starting transaction.`);
    try {
      // Phase 1: Prepare
      const prepareVotes = await Promise.all(this.participants.map(p => p.prepare()));
      const allPrepared = prepareVotes.every(vote => vote === Vote.COMMIT);

      if (!allPrepared) {
        console.log(`[Coordinator ${this.transactionId}] At least one participant voted ABORT. Proceeding to global ABORT.`);
        this.state = TransactionState.ABORTED;
        await Promise.all(this.participants.map(p => p.rollback()));
        console.log(`[Coordinator ${this.transactionId}] Global ABORT completed.`);
        return false;
      }

      this.state = TransactionState.PREPARED;
      console.log(`[Coordinator ${this.transactionId}] All participants PREPARED. Proceeding to global COMMIT.`);

      // Phase 2: Commit
      await Promise.all(this.participants.map(p => p.commit()));
      this.state = TransactionState.COMMITTED;
      console.log(`[Coordinator ${this.transactionId}] Global COMMIT completed.`);
      return true;

    } catch (error: any) {
      console.error(`[Coordinator ${this.transactionId}] Error during transaction: ${error.message}. Initiating global ABORT.`);
      this.state = TransactionState.ABORTED;
      await Promise.all(this.participants.map(p => p.rollback()));
      console.log(`[Coordinator ${this.transactionId}] Global ABORT completed due to error.`);
      return false;
    }
  }
}

// --- Mock Participant Implementations ---

class MockServiceParticipant implements Participant {
  id: string;
  private shouldFailPrepare: boolean;
  private shouldFailCommit: boolean;
  private localState: string = 'initial';

  constructor(id: string, failPrepare: boolean = false, failCommit: boolean = false) {
    this.id = id;
    this.shouldFailPrepare = failPrepare;
    this.shouldFailCommit = failCommit;
  }

  async prepare(): Promise<Vote> {
    console.log(`[Participant ${this.id}] Receiving PREPARE request.`);
    if (this.shouldFailPrepare) {
      console.log(`[Participant ${this.id}] Decided to VOTE_ABORT (simulated failure).`);
      return Vote.ABORT;
    }
    // Simulate doing work, acquiring locks, logging intent
    this.localState = 'prepared';
    console.log(`[Participant ${this.id}] Voted VOTE_COMMIT.`);
    return Vote.COMMIT;
  }

  async commit(): Promise<void> {
    console.log(`[Participant ${this.id}] Receiving COMMIT request.`);
    if (this.shouldFailCommit) {
      console.error(`[Participant ${this.id}] Failed to commit (simulated failure).`);
      throw new Error(`Commit failure in ${this.id}`);
    }
    // Simulate finalizing local transaction, releasing locks
    this.localState = 'committed';
    console.log(`[Participant ${this.id}] Committed local transaction.`);
  }

  async rollback(): Promise<void> {
    console.log(`[Participant ${this.id}] Receiving ROLLBACK request.`);
    // Simulate undoing local transaction, releasing locks
    this.localState = 'rolledback';
    console.log(`[Participant ${this.id}] Rolled back local transaction.`);
  }

  getCurrentState(): string {
    return this.localState;
  }
}

// --- Test Scenarios ---

async function run2PCScenario(scenarioName: string, participants: Participant[]) {
  console.log(`\n--- Running 2PC Scenario: ${scenarioName} ---`);
  const coordinator = new TwoPhaseCommitCoordinator(`TX-${Date.now()}`, participants);
  const success = await coordinator.executeTransaction();
  console.log(`Scenario Result: ${success ? 'SUCCESS' : 'FAILURE'}`);
  participants.forEach(p => {
    if (p instanceof MockServiceParticipant) {
      console.log(`Participant ${p.id} final state: ${p.getCurrentState()}`);
    }
  });
}

// Scenario 1: All participants commit successfully
(async () => {
  const p1 = new MockServiceParticipant('ServiceA');
  const p2 = new MockServiceParticipant('ServiceB');
  await run2PCScenario('All Success', [p1, p2]);
})();

// Scenario 2: One participant fails during prepare phase -> Global Abort
(async () => {
  const p3 = new MockServiceParticipant('ServiceC');
  const p4 = new MockServiceParticipant('ServiceD', true); // ServiceD fails to prepare
  await run2PCScenario('Prepare Failure', [p3, p4]);
})();

// Scenario 3: One participant fails during commit phase -> Global Abort (due to error handling)
// Note: In real 2PC, if a participant fails during commit after voting COMMIT, it's a critical error.
// The coordinator would retry or mark it as heuristic commit/abort. Here, we simplify to immediate abort.
(async () => {
  const p5 = new MockServiceParticipant('ServiceE');
  const p6 = new MockServiceParticipant('ServiceF', false, true); // ServiceF fails to commit
  await run2PCScenario('Commit Failure', [p5, p6]);
})();
