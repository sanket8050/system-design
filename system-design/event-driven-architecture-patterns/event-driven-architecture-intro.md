# Day 36: Event-Driven Architecture (EDA) Introduction

EDA is a paradigm shift from traditional request/response. Instead of direct calls, services communicate asynchronously via events. This is crucial for building scalable, resilient, and loosely coupled microservice systems.

## Core Concepts

1.  **Events:** A record of something that happened. Immutable fact.
    *   **Domain Events:** Something happened within a specific bounded context (`OrderCreated`, `PaymentFailed`).
    *   **Integration Events:** Event published to notify other services of a state change in the publishing service's domain (`UserRegisteredIntegrationEvent`).
2.  **Event Producers (Publishers):** Services that publish events when a significant state change occurs. They don't care who consumes it.
3.  **Event Consumers (Subscribers):** Services that listen for and react to events. They are decoupled from producers.
4.  **Message Broker:** The intermediary responsible for reliably transporting events from producers to consumers (e.g., Kafka, RabbitMQ, AWS SQS/SNS). It ensures durability and often ordering guarantees.

## Why EDA?

*   **Decoupling:** Services don't need to know about each other's existence, only about the events they produce/consume. Reduces direct dependencies.
*   **Scalability:** Consumers can be scaled independently based on event load. Producers aren't blocked waiting for consumer responses.
*   **Resilience:** If a consumer is down, events can queue up in the broker and be processed later. Producers are unaffected.
*   **Real-time Processing:** Enables immediate reactions to system changes.
*   **Auditability:** Event streams can serve as an immutable log of all system changes.

## When to use?

*   Complex distributed systems.
*   Need for high scalability and resilience.
*   Asynchronous workflows are acceptable or required.
*   When integrating disparate systems.

**Opinion:** While powerful, EDA adds complexity. Don't jump into it for simple CRUD apps. Start with a clear understanding of your domain events.