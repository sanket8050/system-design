import { ParticipantVote, TwoPhaseCommitParticipant } from './2pc-coordinator';

enum ParticipantLocalState {
  IDLE = 'IDLE',
  PREPARED = 'PREPARED',
  COMMITTED = 'COMMITTED',
  ABORTED = 'ABORTED'
}

class GenericTwoPhaseCommitParticipant implements TwoPhaseCommitParticipant {
  public name: string;
  private localStates: Map<string, ParticipantLocalState> = new Map();
  private preparedData: Map<string, any> = new Map();

  constructor(name: string) {
    this.name = name;
    console.log(`Participant ${this.name} initialized.`);
  }

  async prepare(transactionId: string, data: any): Promise<ParticipantVote> {
    console.log(`Participant ${this.name}: Received prepare for ${transactionId}. Data:`, data);
    // Simulate validation and resource locking
    // For demonstration, let's say 'fail_prepare' in data makes it abort
    if (data.fail_prepare === this.name) {
      console.log(`Participant ${this.name}: Simulating prepare failure for ${transactionId}.`);
      this.localStates.set(transactionId, ParticipantLocalState.ABORTED);
      return ParticipantVote.ABORT;
    }

    // Simulate some async work
    await new Promise(resolve => setTimeout(resolve, 100));

    this.preparedData.set(transactionId, data); // Store data for commit
    this.localStates.set(transactionId, ParticipantLocalState.PREPARED);
    console.log(`Participant ${this.name}: Voted COMMIT for ${transactionId}.`);
    return ParticipantVote.COMMIT;
  }

  async commit(transactionId: string): Promise<boolean> {
    console.log(`Participant ${this.name}: Received commit for ${transactionId}.`);
    if (this.localStates.get(transactionId) !== ParticipantLocalState.PREPARED) {
      console.warn(`Participant ${this.name}: Not in PREPARED state for ${transactionId}. Cannot commit.`);
      return false;
    }

    // Simulate applying changes and releasing resources
    await new Promise(resolve => setTimeout(resolve, 50));
    console.log(`Participant ${this.name}: Successfully committed ${transactionId}. Applied data:`, this.preparedData.get(transactionId));
    this.localStates.set(transactionId, ParticipantLocalState.COMMITTED);
    this.preparedData.delete(transactionId); // Clean up
    return true;
  }

  async abort(transactionId: string): Promise<boolean> {
    console.log(`Participant ${this.name}: Received abort for ${transactionId}.`);
    // Simulate rolling back changes and releasing resources
    await new Promise(resolve => setTimeout(resolve, 50));
    console.log(`Participant ${this.name}: Successfully aborted ${transactionId}. Rolled back data.`);
    this.localStates.set(transactionId, ParticipantLocalState.ABORTED);
    this.preparedData.delete(transactionId); // Clean up
    return true;
  }
}

export { GenericTwoPhaseCommitParticipant };
