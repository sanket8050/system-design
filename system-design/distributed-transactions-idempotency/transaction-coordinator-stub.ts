/**
 * @file This file provides a conceptual stub for a Two-Phase Commit (2PC) coordinator.
 *       It's not a runnable, production-ready implementation but illustrates the
 *       core logic of the prepare and commit/rollback phases.
 *       In reality, this would involve network calls and distributed logging.
 */

// A participant represents a service (e.g., OrderService, PaymentService)
interface I2PCParticipant {
  id: string;
  prepare(transactionId: string, payload: any): Promise<boolean>; // true for VOTE_COMMIT, false for VOTE_ABORT
  commit(transactionId: string): Promise<void>;
  rollback(transactionId: string): Promise<void>;
}

class TwoPhaseCommitCoordinator {
  private participants: I2PCParticipant[];
  private activeTransactions: Map<string, { status: 'pending' | 'prepared' | 'committed' | 'rolledback', participants: Set<string> }>;

  constructor(participants: I2PCParticipant[]) {
    this.participants = participants;
    this.activeTransactions = new Map();
  }

  /**
   * Initiates a distributed transaction.
   * @param transactionId Unique identifier for this transaction.
   * @param payload Data to be passed to participants for their local work.
   * @returns True if the transaction committed, false if rolled back.
   */
  public async initiateTransaction(transactionId: string, payload: any): Promise<boolean> {
    if (this.activeTransactions.has(transactionId)) {
      console.warn(`Transaction ${transactionId} already active.`);
      return false; // Or throw an error
    }

    this.activeTransactions.set(transactionId, { status: 'pending', participants: new Set(this.participants.map(p => p.id)) });
    console.log(`[Coordinator] Initiating transaction ${transactionId} with ${this.participants.length} participants.`);

    try {
      // Phase 1: Prepare
      const prepareResults = await Promise.all(
        this.participants.map(async (participant) => {
          try {
            console.log(`[Coordinator] Sending PREPARE to ${participant.id} for ${transactionId}.`);
            return { id: participant.id, success: await participant.prepare(transactionId, payload) };
          } catch (error) {
            console.error(`[Coordinator] Participant ${participant.id} failed PREPARE for ${transactionId}:`, error);
            return { id: participant.id, success: false };
          }
        })
      );

      const allPrepared = prepareResults.every(res => res.success);

      if (allPrepared) {
        this.activeTransactions.get(transactionId)!.status = 'prepared';
        console.log(`[Coordinator] All participants prepared for ${transactionId}. Initiating COMMIT.`);
        // Phase 2: Commit
        await Promise.all(
          this.participants.map(async (participant) => {
            try {
              console.log(`[Coordinator] Sending COMMIT to ${participant.id} for ${transactionId}.`);
              await participant.commit(transactionId);
            } catch (error) {
              console.error(`[Coordinator] Participant ${participant.id} failed COMMIT for ${transactionId}:`, error);
              // In a real 2PC, this is a critical state, requiring manual intervention or complex recovery.
              // For this stub, we'll just log.
            }
          })
        );
        this.activeTransactions.get(transactionId)!.status = 'committed';
        console.log(`[Coordinator] Transaction ${transactionId} COMMITTED successfully.`);
        return true;
      } else {
        console.log(`[Coordinator] Not all participants prepared for ${transactionId}. Initiating ROLLBACK.`);
        // Phase 2: Rollback
        await Promise.all(
          this.participants.map(async (participant) => {
            try {
              console.log(`[Coordinator] Sending ROLLBACK to ${participant.id} for ${transactionId}.`);
              await participant.rollback(transactionId);
            } catch (error) {
              console.error(`[Coordinator] Participant ${participant.id} failed ROLLBACK for ${transactionId}:`, error);
              // Similar to commit failure, this is a problem.
            }
          })
        );
        this.activeTransactions.get(transactionId)!.status = 'rolledback';
        console.log(`[Coordinator] Transaction ${transactionId} ROLLED BACK.`);
        return false;
      }
    } catch (error) {
      console.error(`[Coordinator] Unexpected error during transaction ${transactionId}:`, error);
      // Attempt to rollback all if an unexpected error occurs during prepare phase
      await Promise.all(
        this.participants.map(async (participant) => {
          try {
            console.log(`[Coordinator] Sending emergency ROLLBACK to ${participant.id} for ${transactionId}.`);
            await participant.rollback(transactionId);
          } catch (rollbackError) {
            console.error(`[Coordinator] Emergency ROLLBACK failed for ${participant.id}:`, rollbackError);
          }
        })
      );
      this.activeTransactions.get(transactionId)!.status = 'rolledback';
      return false;
    } finally {
      // In a real system, transaction state would be persisted and cleaned up carefully.
      // For this stub, simply remove from active map.
      this.activeTransactions.delete(transactionId);
    }
  }
}

// --- Example Participants (simplified for this stub) ---
class MockOrderParticipant implements I2PCParticipant {
  id = 'OrderService';
  private preparedState: Map<string, any> = new Map(); // Store state for prepare/commit

  async prepare(transactionId: string, payload: any): Promise<boolean> {
    console.log(`[OrderService - ${transactionId}] Preparing to create order for:`, payload.orderData);
    // Simulate checking inventory, validating data, etc.
    if (payload.orderData && payload.orderData.quantity > 0) {
      // Store local changes in a durable log/temp state
      this.preparedState.set(transactionId, { orderId: `mock-order-${Date.now()}`, ...payload.orderData });
      return true; // Vote commit
    }
    return false; // Vote abort
  }

  async commit(transactionId: string): Promise<void> {
    const order = this.preparedState.get(transactionId);
    if (order) {
      console.log(`[OrderService - ${transactionId}] Committing order:`, order.orderId);
      // Persist order to database
      this.preparedState.delete(transactionId);
    }
  }

  async rollback(transactionId: string): Promise<void> {
    console.log(`[OrderService - ${transactionId}] Rolling back order preparation.`);
    this.preparedState.delete(transactionId);
  }
}

class MockPaymentParticipant implements I2PCParticipant {
  id = 'PaymentService';
  private preparedState: Map<string, any> = new Map();

  async prepare(transactionId: string, payload: any): Promise<boolean> {
    console.log(`[PaymentService - ${transactionId}] Preparing to process payment for:`, payload.paymentData);
    // Simulate checking funds, external gateway pre-auth
    if (payload.paymentData && payload.paymentData.amount > 0) {
      this.preparedState.set(transactionId, { paymentId: `mock-payment-${Date.now()}`, ...payload.paymentData });
      return true;
    }
    return false;
  }

  async commit(transactionId: string): Promise<void> {
    const payment = this.preparedState.get(transactionId);
    if (payment) {
      console.log(`[PaymentService - ${transactionId}] Committing payment:`, payment.paymentId);
      // Finalize payment with gateway, persist to DB
      this.preparedState.delete(transactionId);
    }
  }

  async rollback(transactionId: string): Promise<void> {
    console.log(`[PaymentService - ${transactionId}] Rolling back payment preparation.`);
    this.preparedState.delete(transactionId);
  }
}
