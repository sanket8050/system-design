import { v4 as uuidv4 } from 'uuid';

type EventPayload<T> = {
  eventId: string;
  timestamp: string;
  eventType: string;
  payload: T;
  // A correlationId is useful for tracing events across services
  correlationId?: string;
};

/**
 * Simulates an Event Publisher service sending events to a message broker.
 * In a real-world scenario, this would integrate with Kafka, RabbitMQ, SQS, etc.
 */
class OrderServiceEventPublisher {
  private brokerEndpoint: string;

  constructor(brokerEndpoint: string) {
    this.brokerEndpoint = brokerEndpoint;
  }

  /**
   * Publishes an event to the configured message broker.
   * @param eventType The type of event (e.g., 'OrderCreated', 'OrderUpdated').
   * @param data The actual data payload for the event.
   * @param correlationId Optional ID for tracing related events.
   */
  public async publishEvent<T>(eventType: string, data: T, correlationId?: string): Promise<void> {
    const event: EventPayload<T> = {
      eventId: uuidv4(),
      timestamp: new Date().toISOString(),
      eventType,
      payload: data,
      correlationId: correlationId || uuidv4(), // Generate if not provided
    };

    try {
      // In a real application, this would be an actual API call to a message broker SDK
      console.log(`[${new Date().toLocaleTimeString()}] Publishing event to ${this.brokerEndpoint}:`);
      console.log(JSON.stringify(event, null, 2));
      // await this.messageBrokerClient.send(eventType, event);
      console.log(`Event '${eventType}' with ID '${event.eventId}' published successfully.`);
    } catch (error) {
      console.error(`Failed to publish event '${eventType}':`, error);
      // Implement retry logic, dead-letter queueing, etc., here
      throw error;
    }
  }

  /**
   * Example usage: Simulate an order creation.
   */
  public async createOrder(orderId: string, userId: string, items: string[], totalAmount: number): Promise<void> {
    console.log(`
--- Simulating Order Creation: ${orderId} ---`);
    const orderData = { orderId, userId, items, totalAmount, status: 'PENDING' };
    await this.publishEvent('OrderCreated', orderData, uuidv4());
    console.log(`Order ${orderId} created locally and 'OrderCreated' event sent.`);
  }

  public async updateOrderStatus(orderId: string, newStatus: string, updatedBy: string): Promise<void> {
    console.log(`
--- Simulating Order Status Update: ${orderId} to ${newStatus} ---`);
    const updateData = { orderId, newStatus, updatedBy, timestamp: new Date().toISOString() };
    await this.publishEvent('OrderStatusUpdated', updateData, uuidv4());
    console.log(`Order ${orderId} status updated locally and 'OrderStatusUpdated' event sent.`);
  }
}

// --- Demonstration ---
async function runDemo() {
  const publisher = new OrderServiceEventPublisher('kafka://order-events.internal:9092');

  await publisher.createOrder('ORD-2026-001', 'USR-456', ['Laptop', 'Mouse'], 1200);
  await publisher.updateOrderStatus('ORD-2026-001', 'PROCESSING', 'SystemUser');
}

runDemo();
