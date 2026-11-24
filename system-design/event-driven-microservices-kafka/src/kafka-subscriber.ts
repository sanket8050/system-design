import { Kafka, Consumer, EachMessagePayload, logLevel } from 'kafkajs';
import { EventPayload } from './shared/event-types';

/**
 * A type for the message handler function.
 * It receives the parsed event payload and the raw message payload.
 */
export type MessageHandler<T extends EventPayload> = (event: T, rawPayload: EachMessagePayload) => Promise<void>;

/**
 * Represents a generic Kafka event subscriber.
 * Encapsulates Kafka consumer logic for subscribing to topics and processing events.
 */
export class KafkaSubscriber {
  private kafka: Kafka;
  private consumer: Consumer;
  private isConnected: boolean = false;
  private running: boolean = false;

  constructor(clientId: string, brokers: string[], groupId: string) {
    this.kafka = new Kafka({
      clientId: clientId,
      brokers: brokers,
      logLevel: logLevel.INFO,
    });
    this.consumer = this.kafka.consumer({ groupId: groupId });
  }

  /**
   * Connects the Kafka consumer to the broker.
   */
  public async connect(): Promise<void> {
    if (this.isConnected) {
      console.warn('Kafka subscriber is already connected.');
      return;
    }
    try {
      await this.consumer.connect();
      this.isConnected = true;
      this.running = true;
      console.log(`Kafka consumer for client '${this.kafka.options.clientId}' (Group: ${this.consumer.groupId}) connected successfully.`);
    } catch (error) {
      console.error('Failed to connect Kafka consumer:', error);
      throw error;
    }
  }

  /**
   * Disconnects the Kafka consumer from the broker.
   * Ensures graceful shutdown by stopping the consumer process first.
   */
  public async disconnect(): Promise<void> {
    if (!this.isConnected) {
      console.warn('Kafka subscriber is not connected, skipping disconnect.');
      return;
    }
    try {
      this.running = false; // Signal to stop processing
      await this.consumer.stop(); // Stop fetching messages
      await this.consumer.disconnect();
      this.isConnected = false;
      console.log(`Kafka consumer for client '${this.kafka.options.clientId}' (Group: ${this.consumer.groupId}) disconnected.`);
    } catch (error) {
      console.error('Failed to disconnect Kafka consumer:', error);
    }
  }

  /**
   * Subscribes to one or more Kafka topics and starts message consumption.
   * @param topics An array of topic names to subscribe to.
   * @param handler The asynchronous function to process each event.
   *                It should be idempotent if at-least-once semantics are used.
   */
  public async subscribe<T extends EventPayload>(topics: string[], handler: MessageHandler<T>): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Kafka subscriber is not connected. Call connect() first.');
    }

    await this.consumer.subscribe({ topics: topics.map(t => ({ topic: t })), fromBeginning: false });
    console.log(`Subscribed to topics: ${topics.join(', ')}`);

    await this.consumer.run({
      eachMessage: async (payload: EachMessagePayload) => {
        if (!this.running) {
          console.log('Consumer stopping, skipping message processing.');
          return;
        }

        const { topic, partition, message } = payload;
        let event: T | null = null;

        try {
          if (!message.value) {
            console.warn(`Received message with no value on topic ${topic}, partition ${partition}, offset ${message.offset}. Skipping.`);
            // Commit offset for invalid message to avoid reprocessing
            await this.consumer.commitOffsets([{ topic, partition, offset: (parseInt(message.offset) + 1).toString() }]);
            return;
          }
          event = JSON.parse(message.value.toString()) as T;
          console.log(`Processing event '${event.type}' (ID: ${event.id}) from topic '${topic}' (Partition: ${partition}, Offset: ${message.offset})`);

          await handler(event, payload);

          // Manually commit offset after successful processing (at-least-once semantic)
          await this.consumer.commitOffsets([{ topic, partition, offset: (parseInt(message.offset) + 1).toString() }]);
          console.log(`Successfully processed and committed offset for event '${event.type}' (ID: ${event.id})`);
        } catch (error) {
          console.error(`Error processing message from topic ${topic}, partition ${partition}, offset ${message.offset}:`, error);
          if (event) {
            console.error(`Failed event details: Type=${event.type}, ID=${event.id}`);
          }
          // IMPORTANT: If you don't commit here, the message will be re-processed.
          // Depending on your error handling strategy (DLQ, retries), you might not commit.
          // For simple at-least-once, we let it be retried by Kafka on restart or rebalance.
          // For more advanced scenarios, consider a Dead Letter Queue (DLQ).
        }
      },
    });
  }

  /**
   * Gracefully shuts down the subscriber, handling OS signals.
   */
  public async startGracefulShutdown(): Promise<void> {
    ['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach(signal =>
      process.on(signal, async () => {
        try {
          console.log(`Received signal ${signal}. Initiating graceful shutdown...`);
          await this.disconnect();
          process.exit(0);
        } catch (error) {
          console.error(`Error during graceful shutdown for signal ${signal}:`, error);
          process.exit(1);
        }
      })
    );
  }
}

// Example Usage (run this with a local Kafka broker and publisher)
// To run:
// 1. npm install kafkajs
// 2. ts-node src/kafka-subscriber.ts

// const run = async () => {
//   const subscriber = new KafkaSubscriber(
//     'inventory-service-subscriber',
//     ['localhost:9092'],
//     'inventory-service-group'
//   );

//   const orderPlacedHandler: MessageHandler<EventPayload> = async (event, rawPayload) => {
//     if (event.type === 'OrderPlaced') {
//       console.log(`Inventory service received OrderPlaced event: ${JSON.stringify(event.data)}`);
//       // Simulate inventory deduction logic
//       await new Promise(resolve => setTimeout(resolve, Math.random() * 500)); // Simulate async work
//       if (Math.random() < 0.1) { // Simulate transient error 10% of the time
//         throw new Error('Simulated inventory deduction failure!');
//       }
//       console.log(`Inventory updated for order ${event.data.orderId}`);
//     } else {
//       console.log(`Inventory service received unknown event type: ${event.type}`);
//     }
//   };

//   try {
//     await subscriber.connect();
//     await subscriber.startGracefulShutdown(); // Set up signal handlers

//     await subscriber.subscribe(['orders', 'users'], orderPlacedHandler);
//     // Keep the process running indefinitely
//     console.log('Kafka subscriber is running. Press Ctrl+C to stop.');
//   } catch (error) {
//     console.error('Subscriber example failed:', error);
//     await subscriber.disconnect();
//     process.exit(1);
//   }
// };

// run();
