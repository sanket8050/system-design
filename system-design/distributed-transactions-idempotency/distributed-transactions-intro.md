# Distributed Transactions: The Atomicity Challenge

Achieving atomicity (the 'A' in ACID) across multiple independent services or data stores is one of the toughest problems in distributed systems. Unlike a monolithic application where a single database transaction can guarantee all-or-nothing changes, microservices introduce network latency, partial failures, and independent data stores.

**The Core Problem:**
Imagine an `Order` service, a `Payment` service, and an `Inventory` service. When a user places an order:
1.  Order service creates an order.
2.  Payment service processes payment.
3.  Inventory service deducts stock.

If any of these steps fail *after* a previous step succeeded, you're left in an inconsistent state (e.g., payment taken, but no stock deducted). Reversing previous steps manually is complex and error-prone.

**Why Traditional ACID Transactions Don't Scale:**
*   **Single Database:** ACID guarantees are typically bound to a single transactional resource manager.
*   **Two-Phase Commit (2PC):** While a protocol for distributed ACID, it's notorious for its synchronous blocking nature, performance overhead, and single point of failure (the coordinator). Rarely used in high-throughput, modern microservices.
*   **Network Latency & Partitions:** Distributed systems are inherently unreliable. Keeping distributed locks for long periods across services is a recipe for deadlocks and poor availability.

Instead, we often lean towards **BASE** (Basically Available, Soft state, Eventual consistency) and embrace **eventual consistency** paired with patterns like **Saga** and strong **idempotency** guarantees. The goal shifts from "all or nothing *now*" to "all or nothing *eventually*".
