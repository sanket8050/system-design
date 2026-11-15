## Day 37: Raft Log Replication

Once a leader is elected, its primary responsibility is to accept client requests and replicate them consistently across the cluster. This is handled by the `AppendEntries` RPC.

### Leader's Role in Log Replication:

1.  **Client Request:** A client sends a command to the leader (e.g., `SET x=10`).
2.  **Append to Leader's Log:** The leader appends the command as a new `LogEntry` to its local log, assigning it the current term and a new index.
3.  **Broadcast `AppendEntries`:** The leader sends `AppendEntries` RPCs to all followers. Each `AppendEntries` message contains:
    *   The new log entries to be replicated (can be empty for heartbeats).
    *   `prevLogIndex` and `prevLogTerm`: The index and term of the log entry immediately preceding the new entries. This is crucial for consistency checking.
    *   `leaderCommit`: The leader's `commitIndex` (highest index known to be committed).

4.  **Heartbeats:** The leader periodically sends empty `AppendEntries` RPCs to all followers. This serves two purposes:
    *   To maintain its authority and prevent followers from timing out and starting new elections.
    *   To quickly propagate `leaderCommit` updates, even when no new client requests are coming in.

### Follower's Role in Log Replication:

When a follower receives an `AppendEntries` RPC:

1.  **Term Check:** If `message.term < currentTerm`, the follower immediately rejects the RPC and returns its `currentTerm`. The leader then steps down if its term is stale.
2.  **Consistency Check:** The follower checks if its log contains an entry at `prevLogIndex` with `prevLogTerm`.
    *   **If not found (or terms don't match):** The follower rejects the RPC (`success: false`). This indicates a log inconsistency. The `AppendEntriesReply` might include `conflictTerm` and `conflictIndex` to help the leader quickly backtrack.
    *   **If found:** The follower's log is consistent with the leader up to `prevLogIndex`.

3.  **Append New Entries:** If the consistency check passes:
    *   The follower deletes any existing log entries starting from `prevLogIndex + 1` that conflict with the new entries from the leader.
    *   It then appends any new entries provided in the `AppendEntries` RPC to its log.

4.  **Commit Entries:** If `leaderCommit > commitIndex`, the follower updates its `commitIndex` to `min(leaderCommit, index of last new entry)`. Any entries up to `commitIndex` can then be applied to the state machine.

### Leader Handling of `AppendEntries` Replies:

*   **Success:** If a follower replies with `success: true`:
    *   The leader updates `nextIndex[followerId]` to `index of last new entry + 1`.
    *   The leader updates `matchIndex[followerId]` to `index of last new entry`.
*   **Failure (`success: false`):** If a follower replies with `success: false`:
    *   The leader decrements `nextIndex[followerId]` and retries the `AppendEntries` RPC. This effectively backtracks the leader's `nextIndex` for that follower until a matching log entry is found (log consistency check passes). This process is how the leader eventually brings a lagging follower up-to-date.

### Committing Entries (Leader):

A leader commits an entry at `log[i]` if:

1.  It has been replicated to a **majority** of servers.
2.  The entry was created in the leader's **currentTerm**.

This two-part rule (majority + current term) is a critical safety property to prevent issues where a former leader commits stale entries. Once an entry is committed, it's considered durable and will eventually be applied by all state machines.