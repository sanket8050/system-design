/**
 * @file Defines a generic interface for a Distributed Transaction Coordinator.
 * This abstraction helps in conceptualizing how a saga orchestrator or a custom
 * distributed transaction manager might function.
 */

/**
 * Represents a single step in a distributed transaction.
 * Each step has an action to perform and a corresponding compensation action
 * to undo the effects if the transaction fails at a later stage.
 */
export interface TransactionStep {
  name: string; // Unique name for the step (e.g., 'ProcessPayment', 'ReserveInventory')
  action: () => Promise<any>; // The primary operation to perform
  compensation: () => Promise<any>; // The undo operation for this step
  status?: 'PENDING' | 'COMPLETED' | 'FAILED' | 'COMPENSATED'; // Current status of the step
  result?: any; // Result of the action, if successful
  error?: any; // Error object, if the action or compensation failed
}

/**
 * Interface for a Distributed Transaction Coordinator.
 * This coordinator is responsible for managing the lifecycle of a distributed transaction,
 * executing steps, handling failures, and triggering compensation logic.
 */
export interface DistributedTransactionCoordinator {
  /**
   * Initializes a new distributed transaction with a unique ID and a sequence of steps.
   * @param transactionId A unique identifier for the transaction.
   * @param steps An ordered array of TransactionStep objects.
   */
  startTransaction(transactionId: string, steps: TransactionStep[]): Promise<void>;

  /**
   * Executes a specific step within an ongoing transaction.
   * @param transactionId The ID of the transaction.
   * @param stepName The name of the step to execute.
   */
  executeStep(transactionId: string, stepName: string): Promise<void>;

  /**
   * Executes the compensation logic for a specific step within an ongoing transaction.
   * This is typically called during a rollback.
   * @param transactionId The ID of the transaction.
   * @param stepName The name of the step to compensate.
   */
  compensateStep(transactionId: string, stepName: string): Promise<void>;

  /**
   * Marks the transaction as successfully completed after all steps are executed.
   * @param transactionId The ID of the transaction.
   */
  commitTransaction(transactionId: string): Promise<void>;

  /**
   * Initiates a rollback for the transaction, executing compensation actions for completed steps.
   * @param transactionId The ID of the transaction.
   */
  rollbackTransaction(transactionId: string): Promise<void>;

  /**
   * Retrieves the current status of a distributed transaction.
   * @param transactionId The ID of the transaction.
   * @returns The current status: 'IN_PROGRESS', 'COMPLETED', 'FAILED', or 'ROLLED_BACK'.
   */
  getStatus(transactionId: string): Promise<'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'ROLLED_BACK'>;

  /**
   * Persists the current state of the transaction. Essential for recovery after failures.
   * (Not explicitly in methods, but implied for a robust implementation)
   */
  // persistState(transactionId: string, state: TransactionState): Promise<void>;

  /**
   * Recovers the state of a transaction after a crash.
   * (Not explicitly in methods, but implied for a robust implementation)
   */
  // recoverTransaction(transactionId: string): Promise<void>;
}
