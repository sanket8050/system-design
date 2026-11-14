// system-design/event-driven-architecture-patterns/saga-orchestrator-example.ts

import { EventEmitter } from "events"; // Using Node.js EventEmitter for simplicity, real-world would use a message broker

// --- 1. Define Events and Commands ---

interface Event {
  type: string;
  sagaId: string;
  payload: any;
}

interface Command {
  type: string;
  sagaId: string;
  payload: any;
}

// Specific Events
interface CreditReservedEvent extends Event {
  type: "CreditReserved";
  payload: { userId: string; amount: number };
}

interface CreditReservationFailedEvent extends Event {
  type: "CreditReservationFailed";
  payload: { userId: string; amount: number; reason: string };
}

interface PaymentProcessedEvent extends Event {
  type: "PaymentProcessed";
  payload: { orderId: string; amount: number; transactionId: string };
}

interface PaymentFailedEvent extends Event {
  type: "PaymentFailed";
  payload: { orderId: string; amount: number; reason: string };
}

interface OrderApprovedEvent extends Event {
  type: "OrderApproved";
  payload: { orderId: string };
}

interface OrderRejectedEvent extends Event {
  type: "OrderRejected";
  payload: { orderId: string; reason: string };
}

// Specific Commands
interface ReserveCreditCommand extends Command {
  type: "ReserveCredit";
  payload: { userId: string; amount: number };
}

interface ProcessPaymentCommand extends Command {
  type: "ProcessPayment";
  payload: { orderId: string; amount: number };
}

interface ApproveOrderCommand extends Command {
  type: "ApproveOrder";
  payload: { orderId: string };
}

interface RejectOrderCommand extends Command {
  type: "RejectOrder";
  payload: { orderId: string; reason: string };
}

interface RefundPaymentCommand extends Command {
  type: "RefundPayment";
  payload: { orderId: string; transactionId: string };
}

// --- 2. Saga State and Definition ---

enum SagaStatus {
  Pending = "PENDING",
  InProgress = "IN_PROGRESS",
  Completed = "COMPLETED",
  Failed = "FAILED",
  Compensating = "COMPENSATING",
}

interface SagaState {
  sagaId: string;
  orderId: string;
  userId: string;
  amount: number;
  currentStep: number;
  status: SagaStatus;
  context: Record<string, any>; // To store intermediate data like transactionId
  history: string[]; // For debugging/audit
}

// A step in the saga, defining the command to send and expected events
interface SagaStep {
  command: (state: SagaState) => Command;
  onSuccess: string; // Event type for success
  onFailure: string; // Event type for failure (triggers compensation)
  compensationCommand?: (state: SagaState) => Command; // Command to undo this step
}

// Define the "CreateOrder" Saga
const CreateOrderSagaDefinition: SagaStep[] = [
  {
    // Step 0: Reserve Credit
    command: (state) => ({
      type: "ReserveCredit",
      sagaId: state.sagaId,
      payload: { userId: state.userId, amount: state.amount },
    }),
    onSuccess: "CreditReserved",
    onFailure: "CreditReservationFailed",
    compensationCommand: (state) => ({
      type: "RefundCredit", // Assuming a refund credit command exists
      sagaId: state.sagaId,
      payload: { userId: state.userId, amount: state.amount },
    }),
  },
  {
    // Step 1: Process Payment
    command: (state) => ({
      type: "ProcessPayment",
      sagaId: state.sagaId,
      payload: { orderId: state.orderId, amount: state.amount },
    }),
    onSuccess: "PaymentProcessed",
    onFailure: "PaymentFailed",
    compensationCommand: (state) => ({
      type: "RefundPayment",
      sagaId: state.sagaId,
      payload: { orderId: state.orderId, transactionId: state.context.transactionId },
    }),
  },
  {
    // Step 2: Approve Order
    command: (state) => ({
      type: "ApproveOrder",
      sagaId: state.sagaId,
      payload: { orderId: state.orderId },
    }),
    onSuccess: "OrderApproved",
    onFailure: "OrderApprovalFailed", // Assuming this could fail for some reason
    compensationCommand: (state) => ({
      type: "RejectOrder", // Compensate by rejecting the order
      sagaId: state.sagaId,
      payload: { orderId: state.orderId, reason: "Payment failed during saga" },
    }),
  },
];

// --- 3. Saga Orchestrator ---

class SagaOrchestrator {
  private sagas: Map<string, SagaState> = new Map();
  private eventEmitter: EventEmitter; // Acts as our message broker for commands/events

  constructor(eventEmitter: EventEmitter) {
    this.eventEmitter = eventEmitter;
    this.registerEventListeners();
  }

  private registerEventListeners() {
    // Listen for all events from participants
    this.eventEmitter.on("event", (event: Event) => this.handleEvent(event));
  }

  private publishCommand(command: Command) {
    console.log(`[Orchestrator] Publishing Command: ${command.type} for Saga ${command.sagaId}`);
    this.eventEmitter.emit("command", command); // Emit command for participants
  }

  public startSaga(orderId: string, userId: string, amount: number): SagaState {
    const sagaId = `saga-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const initialState: SagaState = {
      sagaId,
      orderId,
      userId,
      amount,
      currentStep: 0,
      status: SagaStatus.InProgress,
      context: {},
      history: [`Saga started for Order ${orderId}`],
    };
    this.sagas.set(sagaId, initialState);
    console.log(`[Orchestrator] Started new saga: ${sagaId}`);
    this.executeNextStep(initialState);
    return initialState;
  }

  private executeNextStep(state: SagaState) {
    if (state.status !== SagaStatus.InProgress) {
      console.warn(`[Orchestrator] Saga ${state.sagaId} is not in IN_PROGRESS state. Current: ${state.status}`);
      return;
    }

    const step = CreateOrderSagaDefinition[state.currentStep];
    if (!step) {
      state.status = SagaStatus.Completed;
      state.history.push("Saga completed successfully.");
      console.log(`[Orchestrator] Saga ${state.sagaId} completed.`);
      return;
    }

    const command = step.command(state);
    this.publishCommand(command);
    state.history.push(`Executing step ${state.currentStep}: ${command.type}`);
    this.sagas.set(state.sagaId, state); // Update state
  }

  private handleEvent(event: Event) {
    const state = this.sagas.get(event.sagaId);
    if (!state) {
      console.warn(`[Orchestrator] Received event for unknown saga: ${event.sagaId}`);
      return;
    }

    if (state.status === SagaStatus.Completed || state.status === SagaStatus.Failed) {
      console.warn(`[Orchestrator] Saga ${state.sagaId} already finished. Ignoring event ${event.type}.`);
      return;
    }

    const currentStep = CreateOrderSagaDefinition[state.currentStep];
    if (!currentStep) {
      console.error(`[Orchestrator] Saga ${state.sagaId} in invalid state: no current step defined.`);
      return;
    }

    state.history.push(`Received event: ${event.type}`);

    if (event.type === currentStep.onSuccess) {
      console.log(`[Orchestrator] Saga ${event.sagaId}: Step ${state.currentStep} succeeded with event ${event.type}`);
      // Update context with any data from the event (e.g., transaction ID)
      Object.assign(state.context, event.payload);
      state.currentStep++;
      this.executeNextStep(state);
    } else if (event.type === currentStep.onFailure) {
      console.error(`[Orchestrator] Saga ${event.sagaId}: Step ${state.currentStep} failed with event ${event.type}. Initiating compensation.`);
      state.status = SagaStatus.Compensating;
      state.history.push(`Step ${state.currentStep} failed. Initiating compensation.`);
      this.compensateSaga(state);
    } else {
      console.warn(`[Orchestrator] Saga ${event.sagaId}: Unexpected event ${event.type} for current step ${state.currentStep}.`);
    }
    this.sagas.set(state.sagaId, state); // Persist state changes
  }

  private compensateSaga(state: SagaState) {
    for (let i = state.currentStep; i >= 0; i--) {
      const step = CreateOrderSagaDefinition[i];
      if (step && step.compensationCommand) {
        const command = step.compensationCommand(state);
        this.publishCommand(command);
        state.history.push(`Compensating step ${i}: ${command.type}`);
      }
    }
    state.status = SagaStatus.Failed;
    state.history.push("Saga failed and compensation completed.");
    this.sagas.set(state.sagaId, state);
    console.log(`[Orchestrator] Saga ${state.sagaId} failed and compensated.`);
  }
}

// --- 4. Mock Service Participants (for demonstration) ---

class CustomerService {
  constructor(eventEmitter: EventEmitter) {
    eventEmitter.on("command", (command: Command) => this.handleCommand(command));
  }

  private async handleCommand(command: Command) {
    if (command.type === "ReserveCredit") {
      const { userId, amount } = command.payload;
      console.log(`[CustomerService] Attempting to reserve ${amount} for user ${userId}`);
      // Simulate async operation and potential failure
      await new Promise((resolve) => setTimeout(resolve, 100));
      if (Math.random() > 0.8) { // Simulate 20% failure rate
        console.error(`[CustomerService] Failed to reserve credit for user ${userId}`);
        this.publishEvent({
          type: "CreditReservationFailed",
          sagaId: command.sagaId,
          payload: { userId, amount, reason: "Insufficient credit" },
        });
      } else {
        console.log(`[CustomerService] Credit reserved for user ${userId}`);
        this.publishEvent({
          type: "CreditReserved",
          sagaId: command.sagaId,
          payload: { userId, amount },
        });
      }
    } else if (command.type === "RefundCredit") {
      const { userId, amount } = command.payload;
      console.log(`[CustomerService] Refunding ${amount} for user ${userId}`);
      await new Promise((resolve) => setTimeout(resolve, 50));
      // In a real system, you'd publish an event like 'CreditRefunded'
    }
  }

  private publishEvent(event: Event) {
    console.log(`[CustomerService] Publishing Event: ${event.type} for Saga ${event.sagaId}`);
    eventEmitter.emit("event", event);
  }
}

class PaymentService {
  constructor(eventEmitter: EventEmitter) {
    eventEmitter.on("command", (command: Command) => this.handleCommand(command));
  }

  private async handleCommand(command: Command) {
    if (command.type === "ProcessPayment") {
      const { orderId, amount } = command.payload;
      console.log(`[PaymentService] Processing payment of ${amount} for order ${orderId}`);
      await new Promise((resolve) => setTimeout(resolve, 150));
      if (Math.random() > 0.9) { // Simulate 10% failure rate
        console.error(`[PaymentService] Failed to process payment for order ${orderId}`);
        this.publishEvent({
          type: "PaymentFailed",
          sagaId: command.sagaId,
          payload: { orderId, amount, reason: "Payment gateway error" },
        });
      } else {
        const transactionId = `txn-${Date.now()}`;
        console.log(`[PaymentService] Payment processed for order ${orderId}, Txn: ${transactionId}`);
        this.publishEvent({
          type: "PaymentProcessed",
          sagaId: command.sagaId,
          payload: { orderId, amount, transactionId },
        });
      }
    } else if (command.type === "RefundPayment") {
      const { orderId, transactionId } = command.payload;
      console.log(`[PaymentService] Refunding payment for order ${orderId}, Txn: ${transactionId}`);
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  private publishEvent(event: Event) {
    console.log(`[PaymentService] Publishing Event: ${event.type} for Saga ${event.sagaId}`);
    eventEmitter.emit("event", event);
  }
}

class OrderService {
  constructor(eventEmitter: EventEmitter) {
    eventEmitter.on("command", (command: Command) => this.handleCommand(command));
  }

  private async handleCommand(command: Command) {
    if (command.type === "ApproveOrder") {
      const { orderId } = command.payload;
      console.log(`[OrderService] Approving order ${orderId}`);
      await new Promise((resolve) => setTimeout(resolve, 50));
      this.publishEvent({
        type: "OrderApproved",
        sagaId: command.sagaId,
        payload: { orderId },
      });
    } else if (command.type === "RejectOrder") {
      const { orderId, reason } = command.payload;
      console.log(`[OrderService] Rejecting order ${orderId} due to: ${reason}`);
      await new Promise((resolve) => setTimeout(resolve, 50));
      this.publishEvent({
        type: "OrderRejected",
        sagaId: command.sagaId,
        payload: { orderId, reason },
      });
    }
  }

  private publishEvent(event: Event) {
    console.log(`[OrderService] Publishing Event: ${event.type} for Saga ${event.sagaId}`);
    eventEmitter.emit("event", event);
  }
}

// --- 5. Orchestration Setup and Execution ---

const eventEmitter = new EventEmitter(); // This is our "message broker"
const orchestrator = new SagaOrchestrator(eventEmitter);

// Initialize participant services
new CustomerService(eventEmitter);
new PaymentService(eventEmitter);
new OrderService(eventEmitter);

console.log("\n--- Starting Saga 1 (Expected Success) ---");
orchestrator.startSaga("order-001", "user-A", 100);

// Give some time for the first saga to complete or fail
setTimeout(() => {
  console.log("\n--- Starting Saga 2 (Expected Failure/Compensation) ---");
  // This saga has a higher chance to fail at credit reservation or payment
  orchestrator.startSaga("order-002", "user-B", 250);
}, 1000);

setTimeout(() => {
  console.log("\n--- Saga States after execution ---");
  // In a real system, saga states would be persisted in a database
  // For this example, we just log the in-memory map.
  // console.log(orchestrator['sagas']);
}, 2000);