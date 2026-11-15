/**
 * day37-raft-node-abstract.ts
 * Provides a conceptual abstract class for a Raft node, outlining its core responsibilities
 * and the RPC handlers it must implement.
 */

import {
  RaftNodeState,
  LogEntry,
  RequestVoteArgs,
  RequestVoteReply,
  AppendEntriesArgs,
  AppendEntriesReply,
  PersistentState,
  VolatileStateAllServers,
  VolatileStateLeader,
} from './raft-types';

export abstract class AbstractRaftNode {
  protected nodeId: string;
  protected clusterSize: number;
  protected peers: string[]; // Other node IDs in the cluster

  // Persistent state (must be saved to stable storage)
  protected currentTerm: number;
  protected votedFor: string | null;
  protected log: LogEntry[];

  // Volatile state on all servers
  protected commitIndex: number;
  protected lastApplied: number;

  // Volatile state on leaders (reinitialized after election)
  protected nextIndex: Map<string, number>;
  protected matchIndex: Map<string, number>;

  protected state: RaftNodeState;

  protected electionTimeout: NodeJS.Timeout | null = null;
  protected heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(nodeId: string, peers: string[]) {
    this.nodeId = nodeId;
    this.peers = peers;
    this.clusterSize = peers.length + 1;

    // Initialize persistent state
    this.currentTerm = 0;
    this.votedFor = null;
    this.log = [];

    // Initialize volatile state
    this.commitIndex = 0;
    this.lastApplied = 0;

    // Initialize leader-specific volatile state
    this.nextIndex = new Map<string, number>();
    this.matchIndex = new Map<string, number>();

    this.state = RaftNodeState.Follower; // All nodes start as followers

    this.startElectionTimer(); // Start initial election timer
  }

  /**
   * Abstract method to simulate sending an RPC to another node.
   * In a real implementation, this would involve network calls.
   */
  protected abstract sendRPC<TArgs, TReply>(targetNodeId: string, rpcName: string, args: TArgs): Promise<TReply>;

  /**
   * Abstract method to simulate persisting state to stable storage.
   */
  protected abstract persistState(): void;

  /**
   * Abstract method to simulate loading state from stable storage.
   */
  protected abstract loadState(): PersistentState;

  /**
   * Handles incoming RequestVote RPCs.
   * This method defines the logic for a node to decide whether to grant a vote.
   */
  public abstract handleRequestVote(args: RequestVoteArgs): Promise<RequestVoteReply>;

  /**
   * Handles incoming AppendEntries RPCs.
   * This method defines the logic for a node to append log entries or respond to heartbeats.
   */
  public abstract handleAppendEntries(args: AppendEntriesArgs): Promise<AppendEntriesReply>;

  /**
   * Transitions the node to a new state and performs necessary cleanup/setup.
   */
  protected transitionTo(newState: RaftNodeState): void {
    console.log(`Node ${this.nodeId}: Transitioning from ${this.state} to ${newState}`);
    this.state = newState;

    // Clear existing timers
    if (this.electionTimeout) clearTimeout(this.electionTimeout);
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);

    switch (newState) {
      case RaftNodeState.Follower:
        this.votedFor = null; // Reset votedFor for new terms or if reverting from candidate
        this.startElectionTimer();
        break;
      case RaftNodeState.Candidate:
        // Logic for starting an election (increment term, vote for self, send RequestVote RPCs)
        this.startElection();
        this.startElectionTimer(); // Candidate also needs an election timer
        break;
      case RaftNodeState.Leader:
        // Logic for a new leader (initialize nextIndex/matchIndex, send initial heartbeats)
        this.initLeaderState();
        this.startHeartbeatInterval();
        break;
    }
  }

  /**
   * Starts or resets the election timer.
   * If it expires, the node becomes a candidate.
   */
  protected startElectionTimer(): void {
    if (this.electionTimeout) clearTimeout(this.electionTimeout);
    const timeout = Math.floor(Math.random() * 150) + 150; // 150-300ms
    this.electionTimeout = setTimeout(() => {
      if (this.state !== RaftNodeState.Leader) {
        this.transitionTo(RaftNodeState.Candidate);
      }
    }, timeout);
  }

  /**
   * Starts the heartbeat interval for leaders.
   */
  protected startHeartbeatInterval(): void {
    // Implement sending empty AppendEntries RPCs periodically
    // This will be detailed in log replication.
  }

  /**
   * Logic for a candidate starting an election.
   */
  protected abstract startElection(): void;

  /**
   * Logic for a new leader initializing its state.
   */
  protected abstract initLeaderState(): void;

  /**
   * Helper to get the index of the last log entry.
   */
  protected getLastLogIndex(): number {
    return this.log.length > 0 ? this.log[this.log.length - 1].index : 0;
  }

  /**
   * Helper to get the term of the last log entry.
   */
  protected getLastLogTerm(): number {
    return this.log.length > 0 ? this.log[this.log.length - 1].term : 0;
  }
}
