## Day 14: Distributed Transactions - The ACID Challenge

Today, I'm diving deep into distributed transactions, a beast often avoided but crucial to understand when building resilient distributed systems. The core challenge is maintaining ACID properties (Atomicity, Consistency, Isolation, Durability) across multiple, independent services or data stores.

### Why it's Hard

In a single monolithic application with a single database, ACID is largely handled by the DB itself. You start a transaction, perform operations, and commit or rollback. Easy.

In a distributed system, imagine transferring money between two bank accounts managed by different microservices (e.g., `AccountServiceA` and `AccountServiceB`).

1.  Debit `AccountA`.
2.  Credit `AccountB`.

What if step 1 succeeds, but step 2 fails due to a network error or `AccountServiceB` being down? You're left with an inconsistent state: money debited from A but not credited to B. This is a partial failure, and it breaks atomicity.

Traditional ACID guarantees are typically provided by a single resource manager. Extending this across multiple independent resources (different databases, message queues, external APIs) is complex.

### The Problem with 2-Phase Commit (2PC) for Microservices

Historically, distributed transaction protocols like XA (eXtended Architecture) and 2PC were used. While they offer strong consistency, they come with significant drawbacks in a modern microservices architecture:

*   **Blocking Operations**: Participants hold resources (locks) for the entire duration of the transaction, leading to potential deadlocks and reduced availability.
*   **Single Point of Failure**: The transaction coordinator is a SPOF. If it goes down after `prepare` but before `commit`, participants are left hanging.
*   **Performance Overhead**: High latency due to multiple network round trips and coordination.
*   **Tight Coupling**: Forces services to be aware of and coordinate with a central transaction manager, breaking service independence.

So, while 2PC gives strong consistency, its operational complexity and performance impact make it largely unsuitable for highly available, scalable microservices. We need other patterns, which I'll explore next.