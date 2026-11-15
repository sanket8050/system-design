## Day 37: Raft Leader Election Process

The core of Raft's availability is its leader election mechanism. When no leader is present or a leader fails, nodes elect a new one.

### Election Timers & States:

1.  **Follower State:**
    *   Starts with an `election timeout` (e.g., 150-300ms, randomized to prevent split votes).
    *   If it receives valid `AppendEntries` (heartbeat or log entry) or `RequestVote` RPC from a current leader/candidate, it resets its timer and remains a follower.
    *   If the timer expires without valid communication, it transitions to **Candidate** state.

2.  **Candidate State:**
    *   **Increments `currentTerm`:** This is crucial. Each election attempt starts a new term.
    *   **Votes for itself:** Sets `votedFor` to its own ID for the new `currentTerm`.
    *   **Resets `election timeout`:** Starts a new election timer.
    *   **Sends `RequestVote` RPCs:** Broadcasts `RequestVote` messages to all other nodes.

### Rules for Granting Votes (by a Follower):

A follower will vote for a candidate `C` in term `T` if *all* of these conditions are met:

1.  `T >= currentTerm`: The candidate's term is at least as up-to-date as the follower's. If `T > currentTerm`, the follower updates its `currentTerm`.
2.  `votedFor` is null or `C` (if already voted for `C` in `T`). A follower votes only once per term.
3.  **Log Up-to-dateness:** The candidate's log is at least as up-to-date as the follower's. This is determined by comparing the `lastLogTerm` and `lastLogIndex`:
    *   If `candidate.lastLogTerm > follower.lastLogTerm`, candidate is more up-to-date.
    *   If `candidate.lastLogTerm == follower.lastLogTerm` and `candidate.lastLogIndex >= follower.lastLogIndex`, candidate is more up-to-date or equally up-to-date.

    *Why this rule?* To ensure that a leader always has all committed log entries. A node cannot become leader if its log is behind.

### Becoming a Leader:

A candidate becomes a leader if:

1.  It receives votes from a **majority** of nodes in the cluster for its current term.
2.  Upon becoming leader, it immediately sends `AppendEntries` heartbeats to all other servers to establish its authority and prevent new elections.

### Election Outcomes:

*   **Leader Elected:** A candidate gets a majority of votes.
*   **Another Leader Elected:** A candidate discovers another valid leader (e.g., receives `AppendEntries` with a term >= its own). It reverts to **Follower** state.
*   **Split Vote (No Leader):** No candidate receives a majority. This typically happens if multiple candidates start elections simultaneously. The election timers are randomized to reduce this chance. If it occurs, candidates will timeout, increment their terms, and start new elections.

Leader election is a critical component for fault tolerance, ensuring the system can recover from leader failures quickly and safely.