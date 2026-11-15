/**
 * day37-raft-types.ts
 * Defines core TypeScript types for a Raft consensus algorithm implementation.
 * These types represent the state and messages exchanged between Raft nodes.
 */

export enum RaftNodeState {
  Follower = 'Follower',
  Candidate = 'Candidate',
  Leader = 'Leader',
}

/**
 * Represents a single log entry in the Raft log.
 * Each entry contains a command to be applied to the state machine
 * and the term in which it was received by the leader.
 */
export interface LogEntry {
  term: number;
  index: number; // For internal tracking, usually implicit from array index but explicit for clarity
  command: string; // The actual command, e.g., 'SET key=value'
}

/**
 * Arguments for the RequestVote RPC.
 * Sent by candidates to solicit votes from other nodes.
 */
export interface RequestVoteArgs {
  term: number;         // Candidate's term
  candidateId: string;  // ID of the candidate requesting vote
  lastLogIndex: number; // Index of candidate's last log entry
  lastLogTerm: number;  // Term of candidate's last log entry
}

/**
 * Reply for the RequestVote RPC.
 * Sent by followers in response to a RequestVoteArgs message.
 */
export interface RequestVoteReply {
  term: number;       // Current term of the responding node, for candidate to update itself
  voteGranted: boolean; // True if candidate received vote
}

/**
 * Arguments for the AppendEntries RPC.
 * Sent by leaders to replicate log entries and as heartbeats.
 */
export interface AppendEntriesArgs {
  term: number;           // Leader's term
  leaderId: string;       // ID of the leader
  prevLogIndex: number;   // Index of log entry immediately preceding new ones
  prevLogTerm: number;    // Term of prevLogIndex entry
  entries: LogEntry[];    // Log entries to store (empty for heartbeat)
  leaderCommit: number;   // Leader's commitIndex
}

/**
 * Reply for the AppendEntries RPC.
 * Sent by followers in response to an AppendEntriesArgs message.
 */
export interface AppendEntriesReply {
  term: number;         // Current term of the responding node, for leader to update itself
  success: boolean;     // True if follower contained entry matching prevLogIndex and prevLogTerm
  conflictTerm?: number; // Optional: Term of conflicting entry if success is false
  conflictIndex?: number; // Optional: First index of conflictTerm if success is false
}

/**
 * Represents the persistent state of a Raft node.
 * Must be saved to stable storage before responding to RPCs.
 */
export interface PersistentState {
  currentTerm: number;      // Latest term server has seen
  votedFor: string | null;  // CandidateId that received vote in current term (or null if none)
  log: LogEntry[];          // Log entries
}

/**
 * Represents the volatile state on all servers.
 */
export interface VolatileStateAllServers {
  commitIndex: number;      // Index of highest log entry known to be committed
  lastApplied: number;      // Index of highest log entry applied to state machine
}

/**
 * Represents the volatile state on leaders.
 */
export interface VolatileStateLeader {
  nextIndex: Map<string, number>; // For each server, index of the next log entry to send to that server
  matchIndex: Map<string, number>; // For each server, index of the highest log entry known to be replicated on that server
}
