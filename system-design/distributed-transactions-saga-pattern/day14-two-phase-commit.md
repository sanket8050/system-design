## Day 14: Two-Phase Commit (2PC) Deep Dive

Following up on the introduction, let's dissect the Two-Phase Commit (2PC) protocol. This is a distributed algorithm that allows all participating nodes in a distributed system to agree to commit or abort a transaction.

### How 2PC Works

2PC involves a **coordinator** (or transaction manager) and multiple **participants** (or resource managers, e.g., databases, microservices).

#### Phase 1: Prepare Phase (Vote Request)

1.  **Coordinator sends `prepare`**: The coordinator sends a `prepare` message to all participants, along with the transaction details.
2.  **Participants vote**: Each participant performs the necessary operations locally but *does not commit* them. It typically locks the resources involved. It then responds to the coordinator:
    *   **`vote-commit`**: If the participant successfully prepared and is ready to commit.
    *   **`vote-abort`**: If the participant cannot prepare (e.g., insufficient funds, resource unavailable) or encounters an error.

#### Phase 2: Commit Phase (Decision)

1.  **Coordinator collects votes**: The coordinator waits for responses from all participants.
2.  **Coordinator decides**: 
    *   If *all* participants sent `vote-commit`, the coordinator sends a `global-commit` message to everyone.
    *   If *any* participant sent `vote-abort` (or failed to respond within a timeout), the coordinator sends a `global-abort` message to everyone.
3.  **Participants execute decision**: 
    *   Upon receiving `global-commit`, participants make their local changes permanent and release resources.
    *   Upon receiving `global-abort`, participants undo their local changes (rollback) and release resources.

### Advantages of 2PC

*   **Strong Consistency**: Ensures atomicity across distributed resources. Either all participants commit, or all abort.
*   **Simplicity (Conceptually)**: Easy to understand the basic flow.

### Disadvantages of 2PC (Why it's rarely used in modern microservices)

*   **Blocking Operations**: Participants hold locks on resources during the entire duration of the transaction (both phases). If the coordinator fails *after* participants have prepared but *before* sending `global-commit`/`global-abort`, participants remain blocked indefinitely, holding resources. This severely impacts availability.
*   **Single Point of Failure (SPOF)**: The coordinator is critical. If it fails, the entire transaction can hang or be left in an uncertain state, requiring manual intervention.
*   **Performance Overhead**: Multiple network round trips (at least 4: prepare request, prepare response, commit/abort request, commit/abort response) introduce significant latency.
*   **Tight Coupling**: Participants must communicate directly with the coordinator and follow its protocol, increasing coupling between services.
*   **Distributed Deadlocks**: Possible if multiple 2PC transactions concurrently involve overlapping sets of resources managed by different participants.

### When to Consider 2PC

In modern distributed systems, 2PC is generally avoided for business transactions spanning multiple microservices. Its blocking nature and SPOF are antithetical to high availability and scalability.

However, it's still relevant in specific contexts:

*   **Within a single distributed database system**: Many distributed relational databases use variations of 2PC internally for consistency.
*   **Enterprise Application Integration (EAI)**: In older, more tightly coupled enterprise environments using technologies like JTA/XA, it might still be present.

For most microservice architectures, we lean towards patterns that embrace eventual consistency, like the Saga pattern, which I'll look at next.