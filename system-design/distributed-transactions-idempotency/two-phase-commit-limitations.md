# Two-Phase Commit (2PC): A Distributed ACID Protocol & Its Pitfalls

Two-Phase Commit (2PC) is a distributed algorithm that guarantees atomicity across multiple participants. It's designed to ensure that either all participants in a distributed transaction commit their changes, or all abort (rollback).

## How it Works (Briefly)

1.  **Phase 1: Prepare Phase (Voting)**
    *   A **coordinator** sends a `PREPARE` message to all **participants**.
    *   Each participant attempts to perform the transaction's work locally and persists its changes in a durable log (e.g., write-ahead log), but *does not commit*.
    *   If a participant can successfully prepare, it replies `VOTE_COMMIT`. If not, `VOTE_ABORT`.

2.  **Phase 2: Commit/Rollback Phase (Decision)**
    *   If the coordinator receives `VOTE_COMMIT` from *all* participants:
        *   It sends a `GLOBAL_COMMIT` message to all participants.
        *   Participants then commit their local changes.
    *   If the coordinator receives *any* `VOTE_ABORT` (or a timeout):
        *   It sends a `GLOBAL_ABORT` message to all participants.
        *   Participants then rollback their local changes.

## Why We Rarely Use 2PC in Microservices

While providing strong consistency, 2PC comes with significant drawbacks that make it impractical for most modern, high-throughput microservice architectures:

1.  **Blocking Nature:** Participants hold locks on resources during the entire duration of the transaction (both phases). If the coordinator fails or a participant is slow, other participants remain blocked, leading to poor availability and throughput. This is the biggest killer.
2.  **Single Point of Failure (Coordinator):** If the coordinator crashes *after* sending `PREPARE` but *before* sending `GLOBAL_COMMIT/ABORT`, participants are left in an "in-doubt" state. They cannot unilaterally commit or rollback, waiting indefinitely for the coordinator to recover or for manual intervention. This requires complex recovery protocols.
3.  **Performance Overhead:** The synchronous communication and multiple network round trips (`PREPARE`, `VOTE`, `COMMIT/ABORT`) introduce significant latency.
4.  **Complexity:** Implementing 2PC correctly, including robust failure recovery, is extremely complex.
5.  **Scaling Issues:** The synchronous nature and resource locking limit the scalability of the system.

**My Take:**
Avoid 2PC for business logic in microservices. It's a relic of tightly coupled distributed transaction managers (like JTA/XA) and doesn't fit the independent, loosely coupled philosophy of microservices. For eventual consistency and higher availability, patterns like the Saga pattern are generally preferred.
