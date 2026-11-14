// system-design/event-driven-architecture-patterns/simple-event-bus.ts

type EventCallback<T = any> = (payload: T) => void;

interface EventMap {
  [eventName: string]: EventCallback[];
}

/**
 * A basic in-memory event bus for local application-level eventing.
 * Not suitable for distributed systems (use a message broker for that).
 */
class SimpleEventBus {
  private listeners: EventMap = {};

  /**
   * Subscribes a callback function to a specific event.
   * @param eventName The name of the event to listen for.
   * @param callback The function to call when the event is emitted.
   */
  public on<T = any>(eventName: string, callback: EventCallback<T>): void {
    if (!this.listeners[eventName]) {
      this.listeners[eventName] = [];
    }
    this.listeners[eventName].push(callback);
    console.log(`[EventBus] Listener registered for '${eventName}'`);
  }

  /**
   * Unsubscribes a callback function from a specific event.
   * @param eventName The name of the event to stop listening for.
   * @param callback The specific callback function to remove.
   */
  public off<T = any>(eventName: string, callback: EventCallback<T>): void {
    if (!this.listeners[eventName]) {
      return;
    }
    this.listeners[eventName] = this.listeners[eventName].filter(
      (cb) => cb !== callback
    );
    console.log(`[EventBus] Listener unregistered for '${eventName}'`);
  }

  /**
   * Emits an event, calling all subscribed callbacks with the provided payload.
   * @param eventName The name of the event to emit.
   * @param payload The data associated with the event.
   */
  public emit<T = any>(eventName: string, payload: T): void {
    if (!this.listeners[eventName]) {
      console.warn(`[EventBus] No listeners for event '${eventName}'`);
      return;
    }
    console.log(`[EventBus] Emitting event '${eventName}' with payload:`, payload);
    this.listeners[eventName].forEach((callback) => {
      try {
        callback(payload);
      } catch (error) {
        console.error(
          `[EventBus] Error in listener for '${eventName}':`,
          error
        );
      }
    });
  }
}

// --- Usage Example ---
interface UserRegisteredEvent {
  userId: string;
  email: string;
  timestamp: Date;
}

const eventBus = new SimpleEventBus();

const emailServiceListener = (event: UserRegisteredEvent) => {
  console.log(`[EmailService] Sending welcome email to ${event.email}`);
};

const analyticsServiceListener = (event: UserRegisteredEvent) => {
  console.log(`[AnalyticsService] Tracking new user: ${event.userId}`);
};

eventBus.on("UserRegistered", emailServiceListener);
eventBus.on("UserRegistered", analyticsServiceListener);

// Simulate a user registration
eventBus.emit("UserRegistered", {
  userId: "user-123",
  email: "john.doe@example.com",
  timestamp: new Date(),
});

// Simulate another event with no listeners
eventBus.emit("ProductPurchased", { productId: "prod-456", userId: "user-123" });

// Unsubscribe analytics service
eventBus.off("UserRegistered", analyticsServiceListener);

// Simulate another user registration
eventBus.emit("UserRegistered", {
  userId: "user-124",
  email: "jane.smith@example.com",
  timestamp: new Date(),
});