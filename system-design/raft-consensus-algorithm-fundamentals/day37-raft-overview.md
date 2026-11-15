## Day 37: Raft Consensus Algorithm Overview

**Goal:** Understand how distributed systems maintain consistency and fault tolerance. Raft is a popular algorithm for achieving distributed consensus, designed for understandability.

### Why Raft?

Distributed systems need to agree on a single state, even with node failures or network partitions. Paxos is notoriously complex; Raft aims for equivalent fault tolerance and performance but with significantly better understandability.

### Key Concepts:

1.  **States:** A Raft node can be in one of three states:
    *   **Follower:** Passive, responds to requests from leaders and candidates. Most nodes are followers.
    *   **Candidate:** Actively seeking to become leader. Initiates elections.
    *   **Leader:** Handles all client requests, replicates log entries to followers. Only one leader at a time.

2.  **Terms:** Raft divides time into _terms_. Each term is an arbitrarily increasing integer. A term begins with an election. If a candidate wins, it becomes leader for that term. Terms act as a logical clock.

3.  **Log:** A sequence of commands that are applied to a state machine. Each entry has an index and a term number. Log entries are immutable once committed.

4.  **RPCs (Remote Procedure Calls):**
    *   `RequestVote(term, candidateId, lastLogIndex, lastLogTerm)`: Sent by candidates to request votes from other nodes.
    *   `AppendEntries(term, leaderId, prevLogIndex, prevLogTerm, entries[], leaderCommit)`: Sent by leaders to replicate log entries and as heartbeats (empty `entries[]`).

### How it works (High-Level):

*   **Leader Election:** When a leader fails or doesn't send heartbeats, followers time out and become candidates, initiating a new election (incrementing their term and requesting votes).
*   **Log Replication:** The elected leader receives client commands, appends them to its log, and then replicates them to followers using `AppendEntries` RPCs. Once a majority of nodes have acknowledged an entry, the leader can safely commit it.
*   **Safety:** Raft guarantees that once an entry is committed, it will eventually be applied by all state machines and will never be rolled back.

This forms the foundation. Next, we'll look at the data structures for these components.