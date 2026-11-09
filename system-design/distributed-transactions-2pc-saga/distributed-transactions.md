# Day 31: Distributed Transactions - The Problem

## The Need for Consistency Across Services
When moving from monolithic architectures to microservices, we gain autonomy and scalability, but lose the ACID properties that a single database transaction provides out-of-the-box. Maintaining data consistency across multiple services, each with its own database, becomes a significant challenge.

### Core Problem
How do you ensure an operation that spans multiple services either fully completes across all services or fully rolls back, leaving no service in an inconsistent state?

### Challenges in Distributed Environments
1.  **Network Partitions:** The network is unreliable. Messages can be lost, delayed, or duplicated.
2.  **Partial Failures:** One service might fail while others succeed, leading to data inconsistencies.
3.  **Latency:** Coordinating across multiple network hops adds significant latency.
4.  **Consensus:** Reaching agreement among multiple independent participants on the outcome of a transaction.

### CAP Theorem Reminder
In a distributed system, you can only pick two of Consistency, Availability, and Partition Tolerance. For distributed transactions, we're primarily concerned with maintaining consistency in the face of partitions, which often means sacrificing some availability during a transaction.

### Traditional Approach: Two-Phase Commit (2PC)
2PC is a classic algorithm designed to provide atomicity across multiple participants. It's a blocking protocol that ensures all participants either commit or abort a transaction.

Next, we'll look at a simplified conceptual example of how 2PC works.