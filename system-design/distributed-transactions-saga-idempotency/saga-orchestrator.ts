import { Logger } from './utils/logger'; // Assume a logger utility exists

/**
 * Represents a single step in a Saga.
 * Each step has an action to perform and a compensating action to undo it.
 */
export interface SagaStep<TContext extends object> {
  name: string;
  execute: (context: TContext) => Promise<TContext>;
  compensate: (context: TContext) => Promise<TContext>;
}

/**
 * Represents the current state of a Saga execution.
 */
export interface SagaState<TContext extends object> {
  id: string; // Unique ID for this saga instance
  currentStepIndex: number; // The index of the last successfully executed step
  context: TContext; // Data passed between saga steps
  status: 'pending' | 'completed' | 'failed' | 'compensating';
  error?: string; // Error message if saga failed
}

/**
 * The Saga Orchestrator manages the execution flow of a Saga.
 * It knows the sequence of steps and triggers compensation if a step fails.
 */
export class SagaOrchestrator<TContext extends object> {
  private steps: SagaStep<TContext>[];
  private logger: Logger;

  constructor(steps: SagaStep<TContext>[], logger?: Logger) {
    if (!steps || steps.length === 0) {
      throw new Error('Saga must have at least one step.');
    }
    this.steps = steps;
    this.logger = logger || new Logger(); // Use a default logger if not provided
  }

  /**
   * Executes the Saga from the beginning or a specific state.
   * @param initialState The initial context for the saga or a saved SagaState to resume from.
   * @returns A promise that resolves with the final SagaState.
   */
  public async execute(initialState: Partial<SagaState<TContext>>): Promise<SagaState<TContext>> {
    let state: SagaState<TContext> = {
      id: initialState.id || `saga-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      currentStepIndex: initialState.currentStepIndex || 0,
      context: initialState.context || {} as TContext,
      status: initialState.status || 'pending',
    };

    this.logger.info(`Saga ${state.id} started with context:`, state.context);

    try {
      for (let i = state.currentStepIndex; i < this.steps.length; i++) {
        const step = this.steps[i];
        this.logger.info(`Saga ${state.id}: Executing step ${i + 1}/${this.steps.length} - ${step.name}`);
        state.context = await step.execute(state.context);
        state.currentStepIndex = i + 1; // Mark step as completed
        // Persist state here in a real-world scenario
      }
      state.status = 'completed';
      this.logger.info(`Saga ${state.id} completed successfully.`);
    } catch (error: any) {
      state.status = 'failed';
      state.error = error.message || 'Unknown error';
      this.logger.error(`Saga ${state.id} failed at step ${state.currentStepIndex}. Initiating compensation. Error:`, error);
      await this.compensate(state);
    }

    return state;
  }

  /**
   * Executes compensating transactions for steps that have already completed.
   * @param failedState The state of the saga when it failed.
   */
  private async compensate(failedState: SagaState<TContext>): Promise<void> {
    failedState.status = 'compensating';
    this.logger.warn(`Saga ${failedState.id}: Starting compensation for ${failedState.currentStepIndex} steps.`);

    // Iterate backwards from the last successfully completed step
    for (let i = failedState.currentStepIndex - 1; i >= 0; i--) {
      const step = this.steps[i];
      try {
        this.logger.warn(`Saga ${failedState.id}: Compensating step ${i + 1}/${this.steps.length} - ${step.name}`);
        failedState.context = await step.compensate(failedState.context);
        // Persist state here (e.g., mark step as compensated)
      } catch (compensationError: any) {
        this.logger.error(
          `Saga ${failedState.id}: Critical error during compensation for step ${step.name}. Manual intervention required. Error:`, 
          compensationError
        );
        // In a real system, alert operations and potentially retry compensation.
        // For now, we'll just log and continue trying to compensate other steps.
      }
    }
    this.logger.warn(`Saga ${failedState.id}: Compensation process completed (with potential errors).`);
  }
}

// Dummy Logger for demonstration
class Logger {
    info(...args: any[]) { console.log('[INFO]', ...args); }
    warn(...args: any[]) { console.warn('[WARN]', ...args); }
    error(...args: any[]) { console.error('[ERROR]', ...args); }
}
