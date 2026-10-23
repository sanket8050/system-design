import { v4 as uuidv4 } from 'uuid';

export type SagaId = string;
export type StepName = string;
export type CommandType = string;
export type EventType = string;
export type ParticipantId = string;

/**
 * Represents a command that an orchestrator sends to a participant service.
 */
export interface SagaCommand {
  sagaId: SagaId;
  commandType: CommandType;
  targetParticipantId: ParticipantId;
  payload: any;
}

/**
 * Represents an event that a participant service publishes after completing a local transaction.
 */
export interface SagaEvent {
  sagaId: SagaId;
  eventType: EventType;
  sourceParticipantId: ParticipantId;
  payload: any;
  isError: boolean;
  errorMessage?: string;
}

/**
 * Defines a single step in a Saga workflow.
 */
export interface SagaStep {
  name: StepName;
  command: (sagaData: any) => SagaCommand; // Function to create the command for this step
  onSuccessEvent: EventType; // Event expected on success
  onFailureEvent: EventType; // Event expected on failure
  compensationCommand?: (sagaData: any) => SagaCommand; // Command to undo this step
}

/**
 * Defines the overall workflow for a Saga.
 */
export interface SagaDefinition {
  name: string;
  steps: SagaStep[];
  initialState: any; // Initial data structure for the saga
}

/**
 * Represents the current state of a Saga instance.
 */
export interface SagaInstance {
  id: SagaId;
  definitionName: string;
  currentState: StepName | 'STARTED' | 'COMPLETED' | 'FAILED';
  currentStepIndex: number;
  sagaData: any; // Data that flows through the saga
  createdAt: Date;
  updatedAt: Date;
  history: Array<{ step: StepName; status: 'SUCCESS' | 'FAILURE' | 'COMPENSATED'; timestamp: Date; event?: SagaEvent; }>;
}

/**
 * Interface for a Saga Orchestrator service.
 * This service manages the state and progression of Sagas.
 */
export interface ISagaOrchestrator {
  /**
   * Registers a new Saga definition with the orchestrator.
   * @param definition The SagaDefinition to register.
   */
  registerSaga(definition: SagaDefinition): void;

  /**
   * Starts a new instance of a registered Saga.
   * @param sagaDefinitionName The name of the Saga definition to start.
   * @param initialPayload Initial data for the saga.
   * @returns The ID of the started Saga instance.
   */
  startSaga(sagaDefinitionName: string, initialPayload: any): Promise<SagaId>;

  /**
   * Processes an incoming event from a participant service.
   * This method drives the Saga forward or initiates compensation.
   * @param event The SagaEvent received from a participant.
   */
  processEvent(event: SagaEvent): Promise<void>;

  /**
   * Retrieves the current state of a specific Saga instance.
   * @param sagaId The ID of the Saga instance.
   * @returns The SagaInstance or null if not found.
   */
  getSagaInstance(sagaId: SagaId): Promise<SagaInstance | null>;

  /**
   * Publishes a command to a message broker or directly to a participant.
   * This is an internal helper method for the orchestrator.
   * @param command The SagaCommand to publish.
   */
  publishCommand(command: SagaCommand): Promise<void>;
}

// Example Saga Definition (Order Placement)
/*
const orderPlacementSagaDefinition: SagaDefinition = {
  name: 'OrderPlacementSaga',
  initialState: { orderId: '', userId: '', items: [], totalAmount: 0, paymentProcessed: false, inventoryReserved: false },
  steps: [
    {
      name: 'CreateOrder',
      command: (sagaData) => ({
        sagaId: sagaData.id,
        commandType: 'CREATE_ORDER',
        targetParticipantId: 'OrderService',
        payload: { userId: sagaData.userId, items: sagaData.items, totalAmount: sagaData.totalAmount },
      }),
      onSuccessEvent: 'ORDER_CREATED',
      onFailureEvent: 'ORDER_CREATION_FAILED',
      compensationCommand: (sagaData) => ({
        sagaId: sagaData.id,
        commandType: 'CANCEL_ORDER',
        targetParticipantId: 'OrderService',
        payload: { orderId: sagaData.orderId },
      }),
    },
    {
      name: 'ReserveInventory',
      command: (sagaData) => ({
        sagaId: sagaData.id,
        commandType: 'RESERVE_INVENTORY',
        targetParticipantId: 'InventoryService',
        payload: { orderId: sagaData.orderId, items: sagaData.items },
      }),
      onSuccessEvent: 'INVENTORY_RESERVED',
      onFailureEvent: 'INVENTORY_RESERVATION_FAILED',
      compensationCommand: (sagaData) => ({
        sagaId: sagaData.id,
        commandType: 'RELEASE_INVENTORY',
        targetParticipantId: 'InventoryService',
        payload: { orderId: sagaData.orderId },
      }),
    },
    {
      name: 'ProcessPayment',
      command: (sagaData) => ({
        sagaId: sagaData.id,
        commandType: 'PROCESS_PAYMENT',
        targetParticipantId: 'PaymentService',
        payload: { userId: sagaData.userId, orderId: sagaData.orderId, amount: sagaData.totalAmount },
      }),
      onSuccessEvent: 'PAYMENT_PROCESSED',
      onFailureEvent: 'PAYMENT_FAILED',
      // No compensation for payment, as it's typically a refund process outside saga scope or handled by payment gateway.
      // For simplicity, we might just mark order as failed and inform user.
    },
    {
      name: 'ConfirmOrder',
      command: (sagaData) => ({
        sagaId: sagaData.id,
        commandType: 'CONFIRM_ORDER',
        targetParticipantId: 'OrderService',
        payload: { orderId: sagaData.orderId },
      }),
      onSuccessEvent: 'ORDER_CONFIRMED',
      onFailureEvent: 'ORDER_CONFIRMATION_FAILED',
      // No compensation needed here, as the order is already confirmed or failed.
    },
  ],
};
*/