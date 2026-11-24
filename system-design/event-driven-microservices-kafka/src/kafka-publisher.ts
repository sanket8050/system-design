import { Kafka, Producer, logLevel } from 'kafkajs';
import { EventPayload } from './shared/event-types';

/**
 * Represents a generic Kafka event publisher.
 * Encapsulates Kafka producer logic for easy event publishing.
 */
export class KafkaPublisher {
  private kafka: Kafka;
  private producer: Producer;
  private isConnected: boolean = false;

  constructor(clientId: string, brokers: string[]) {
    this.kafka = new Kafka({
      clientId: clientId,
      brokers: brokers,
      logLevel: logLevel.INFO,
    });
    this.producer = this.kafka.producer();
  }

  /**
   * Connects the Kafka producer to the broker.
   */
  public async connect(): Promise<void> {
    if (this.isConnected) {
      console.warn('Kafka publisher is already connected.');
      return;
    }
    try {
      await this.producer.connect();
      this.isConnected = true;
      console.log(`Kafka producer for client '${this.kafka.options.clientId}' connected successfully.`);
    } catch (error) {
      console.error('Failed to connect Kafka producer:', error);
      throw error;
    }
  }

  /**
   * Disconnects the Kafka producer from the broker.
   */
  public async disconnect(): Promise<void> {
    if (!this.isConnected) {
      console.warn('Kafka publisher is not connected, skipping disconnect.');
      return;
    }
    try {
      await this.producer.disconnect();
      this.isConnected = false;
      console.log(`Kafka producer for client '${this.kafka.options.clientId}' disconnected.`);
    } catch (error) {
      console.error('Failed to disconnect Kafka producer:', error);
    }
  }

  /**
   * Publishes an event to a specified Kafka topic.
   * @param topic The Kafka topic to publish to.
   * @param event The event payload to publish. Must be serializable to JSON.
   * @param key An optional key for message partitioning. Messages with the same key go to the same partition.
   */
  public async publish<T extends EventPayload>(topic: string, event: T, key?: string): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Kafka publisher is not connected. Call connect() first.');
    }

    try {
      const messages = [
        {
          key: key,
          value: JSON.stringify(event),
          headers: { 'event-type': event.type, 'correlation-id': event.id },
        },
      ];

      await this.producer.send({
        topic: topic,
        messages: messages,
      });
      console.log(`Published event '${event.type}' (ID: ${event.id}) to topic '${topic}'`);
    } catch (error) {
      console.error(`Failed to publish event '${event.type}' to topic '${topic}':`, error);
      throw error;
    }
  }
}

// Example Usage (run this with a local Kafka broker, e.g., via Docker Compose)
// To run:
// 1. npm install kafkajs
// 2. ts-node src/kafka-publisher.ts

// const run = async () => {
//   const publisher = new KafkaPublisher('order-service-publisher', ['localhost:9092']);

//   try {
//     await publisher.connect();

//     const orderPlacedEvent: EventPayload = {
//       id: 'order-123',
//       type: 'OrderPlaced',
//       timestamp: new Date().toISOString(),
//       data: { orderId: 'O123', userId: 'U456', amount: 99.99, items: ['itemA', 'itemB'] },
//     };
//     await publisher.publish('orders', orderPlacedEvent, orderPlacedEvent.id);

//     const userCreatedEvent: EventPayload = {
//       id: 'user-789',
//       type: 'UserCreated',
//       timestamp: new Date().toISOString(),
//       data: { userId: 'U456', username: 'sanket.adsare', email: 'sanket@example.com' },
//     };
//     await publisher.publish('users', userCreatedEvent, userCreatedEvent.id);

//   } catch (error) {
//     console.error('Publisher example failed:', error);
//   } finally {
//     await publisher.disconnect();
//   }
// };

// run();
