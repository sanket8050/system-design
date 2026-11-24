/**
 * Represents the base structure for any event payload in our system.
 * All events should adhere to this interface to ensure consistency and traceability.
 */
export interface EventPayload {
  /** A unique identifier for this specific event occurrence. */
  id: string;
  /** The type of event (e.g., 'UserCreated', 'OrderPlaced'). Used for routing and processing logic. */
  type: string;
  /** ISO 8601 timestamp when the event occurred. */
  timestamp: string;
  /** The actual data payload of the event, specific to its type. */
  data: Record<string, any>;
}

/**
 * Example specific event: UserCreatedEvent.
 * Extends EventPayload and narrows down the 'data' field for type safety.
 */
export interface UserCreatedEvent extends EventPayload {
  type: 'UserCreated';
  data: {
    userId: string;
    username: string;
    email: string;
    // Add other user-specific fields
  };
}

/**
 * Example specific event: OrderPlacedEvent.
 * Extends EventPayload and narrows down the 'data' field for type safety.
 */
export interface OrderPlacedEvent extends EventPayload {
  type: 'OrderPlaced';
  data: {
    orderId: string;
    userId: string;
    amount: number;
    items: string[]; // Just item IDs for simplicity
    // Add other order-specific fields
  };
}

/**
 * Example specific event: ProductStockUpdatedEvent.
 */
export interface ProductStockUpdatedEvent extends EventPayload {
  type: 'ProductStockUpdated';
  data: {
    productId: string;
    newStockLevel: number;
    // Add other relevant fields
  };
}

// Add more specific event types as your domain evolves.
// This approach allows for a common event structure while providing strong typing for specific event data.
