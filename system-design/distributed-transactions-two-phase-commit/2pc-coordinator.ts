enum ParticipantVote {
  COMMIT = 'COMMIT',
  ABORT = 'ABORT'
}

enum TransactionState {
  PENDING = 'PENDING',
  PREPARING = 'PREPARING',
  PREPARED = 'PREPARED',
  COMMITTING = 'COMMITTING',
  COMMITTED = 'COMMITTED',
  ABORTING = 'ABORTING',
  ABORTED = 'ABORTED'
}

interface TransactionContext {
  id: string;
  data: any;
  state: TransactionState;
  participants: string[];
  votes: Map<string, ParticipantVote>;
}

interface TwoPhaseCommitParticipant {
  name: string;
  prepare(transactionId: string, data: any): Promise<ParticipantVote>;
  commit(transactionId: string): Promise<boolean>;
  abort(transactionId: string): Promise<boolean>;
}

class TwoPhaseCommitCoordinator {
  private participants: Map<string, TwoPhaseCommitParticipant> = new Map();
  private transactions: Map<string, TransactionContext> = new Map();

  constructor() {
    console.log('2PC Coordinator initialized.');
  }

  addParticipant(participant: TwoPhaseCommitParticipant): void {
    if (this.participants.has(participant.name)) {
      console.warn(`Participant ${participant.name} already registered.`);
      return;
    }
    this.participants.set(participant.name, participant);
    console.log(`Participant ${participant.name} added.`);
  }

  async executeTransaction(data: any): Promise<TransactionState> {
    const transactionId = `txn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const participantNames = Array.from(this.participants.keys());

    const context: TransactionContext = {
      id: transactionId,
      data,
      state: TransactionState.PENDING,
      participants: participantNames,
      votes: new Map()
    };
    this.transactions.set(transactionId, context);

    console.log(`\n--- Starting transaction ${transactionId} ---`);
    console.log(`Coordinator: Initiating prepare phase for ${transactionId}`);
    context.state = TransactionState.PREPARING;

    try {
      // Phase 1: Prepare
      const preparePromises = Array.from(this.participants.values()).map(async p => {
        try {
          const vote = await p.prepare(transactionId, data);
          context.votes.set(p.name, vote);
          console.log(`Coordinator: Participant ${p.name} voted: ${vote}`);
          return vote;
        } catch (error) {
          console.error(`Coordinator: Participant ${p.name} failed during prepare:`, error);
          context.votes.set(p.name, ParticipantVote.ABORT);
          return ParticipantVote.ABORT;
        }
      });

      const allVotes = await Promise.all(preparePromises);
      const globalCommit = allVotes.every(vote => vote === ParticipantVote.COMMIT);

      context.state = TransactionState.PREPARED;

      if (globalCommit) {
        console.log(`Coordinator: All participants voted COMMIT. Initiating commit phase for ${transactionId}`);
        context.state = TransactionState.COMMITTING;
        // Phase 2: Commit
        const commitPromises = Array.from(this.participants.values()).map(p => p.commit(transactionId));
        await Promise.all(commitPromises);
        context.state = TransactionState.COMMITTED;
        console.log(`Coordinator: Transaction ${transactionId} COMMITTED successfully.`);
      } else {
        console.log(`Coordinator: One or more participants voted ABORT. Initiating abort phase for ${transactionId}`);
        context.state = TransactionState.ABORTING;
        // Phase 2: Abort
        const abortPromises = Array.from(this.participants.values()).map(p => p.abort(transactionId));
        await Promise.all(abortPromises);
        context.state = TransactionState.ABORTED;
        console.log(`Coordinator: Transaction ${transactionId} ABORTED.`);
      }
    } catch (error) {
      console.error(`Coordinator: Error during transaction ${transactionId}:`, error);
      context.state = TransactionState.ABORTING;
      // Ensure abort is called on all participants even if prepare failed for some
      const abortPromises = Array.from(this.participants.values()).map(p => p.abort(transactionId));
      await Promise.all(abortPromises);
      context.state = TransactionState.ABORTED;
      console.log(`Coordinator: Transaction ${transactionId} ABORTED due to an unhandled error.`);
    }

    console.log(`--- Transaction ${transactionId} finished with state: ${context.state} ---`);
    return context.state;
  }
}

export { TwoPhaseCommitCoordinator, ParticipantVote, TransactionState, TwoPhaseCommitParticipant };
