// ===== Raft Consensus Protocol Simulation =====
// Simplified but faithful implementation of Raft leader election and log replication

export const State = { FOLLOWER: 'follower', CANDIDATE: 'candidate', LEADER: 'leader' };

// ===== Log Entry =====

export class LogEntry {
  constructor(term, command, index) {
    this.term = term;
    this.command = command;
    this.index = index;
  }
}

// ===== Raft Node =====

export class RaftNode {
  constructor(id, cluster) {
    this.id = id;
    this.cluster = cluster;
    
    // Persistent state
    this.currentTerm = 0;
    this.votedFor = null;
    this.log = [];
    
    // Volatile state
    this.state = State.FOLLOWER;
    this.commitIndex = -1;
    this.lastApplied = -1;
    this.applied = []; // applied commands
    
    // Leader state
    this.nextIndex = {};   // peerId → next log index to send
    this.matchIndex = {};  // peerId → highest known replicated index
    
    // Election
    this.votes = new Set();
    this.electionTimer = 0;
    this.heartbeatTimer = 0;
    
    // Config
    this.electionTimeout = 150 + Math.floor(Math.random() * 150);
    this.heartbeatInterval = 50;
  }

  get lastLogIndex() { return this.log.length - 1; }
  get lastLogTerm() { return this.log.length > 0 ? this.log[this.log.length - 1].term : 0; }

  // ===== Election =====

  startElection() {
    this.state = State.CANDIDATE;
    this.currentTerm++;
    this.votedFor = this.id;
    this.votes = new Set([this.id]);
    this.electionTimer = 0;
    
    // Request votes from all peers
    const peers = this.cluster.getPeers(this.id);
    for (const peer of peers) {
      const reply = peer.handleRequestVote({
        term: this.currentTerm,
        candidateId: this.id,
        lastLogIndex: this.lastLogIndex,
        lastLogTerm: this.lastLogTerm,
      });
      
      if (reply.term > this.currentTerm) {
        this.currentTerm = reply.term;
        this.state = State.FOLLOWER;
        this.votedFor = null;
        return;
      }
      
      if (reply.voteGranted) {
        this.votes.add(peer.id);
      }
    }
    
    // Check if won
    if (this.votes.size > this.cluster.size / 2) {
      this.becomeLeader();
    }
  }

  handleRequestVote(req) {
    // Update term if behind
    if (req.term > this.currentTerm) {
      this.currentTerm = req.term;
      this.state = State.FOLLOWER;
      this.votedFor = null;
    }
    
    // Grant vote?
    const logUpToDate = req.lastLogTerm > this.lastLogTerm ||
      (req.lastLogTerm === this.lastLogTerm && req.lastLogIndex >= this.lastLogIndex);
    
    const canVote = req.term >= this.currentTerm && 
      (this.votedFor === null || this.votedFor === req.candidateId) &&
      logUpToDate;
    
    if (canVote) {
      this.votedFor = req.candidateId;
      this.electionTimer = 0; // reset election timer
      return { term: this.currentTerm, voteGranted: true };
    }
    
    return { term: this.currentTerm, voteGranted: false };
  }

  becomeLeader() {
    this.state = State.LEADER;
    this.cluster.currentLeader = this.id;
    
    // Initialize leader state
    for (const peer of this.cluster.getPeers(this.id)) {
      this.nextIndex[peer.id] = this.log.length;
      this.matchIndex[peer.id] = -1;
    }
    
    // Send initial heartbeats
    this.sendHeartbeats();
  }

  // ===== Log Replication =====

  appendCommand(command) {
    if (this.state !== State.LEADER) return false;
    
    const entry = new LogEntry(this.currentTerm, command, this.log.length);
    this.log.push(entry);
    
    // Replicate to peers
    this.replicateLog();
    
    return true;
  }

  replicateLog() {
    const peers = this.cluster.getPeers(this.id);
    
    for (const peer of peers) {
      const nextIdx = this.nextIndex[peer.id] || 0;
      const prevLogIndex = nextIdx - 1;
      const prevLogTerm = prevLogIndex >= 0 ? this.log[prevLogIndex].term : 0;
      const entries = this.log.slice(nextIdx);
      
      const reply = peer.handleAppendEntries({
        term: this.currentTerm,
        leaderId: this.id,
        prevLogIndex,
        prevLogTerm,
        entries,
        leaderCommit: this.commitIndex,
      });
      
      if (reply.term > this.currentTerm) {
        this.currentTerm = reply.term;
        this.state = State.FOLLOWER;
        this.votedFor = null;
        return;
      }
      
      if (reply.success) {
        this.nextIndex[peer.id] = this.log.length;
        this.matchIndex[peer.id] = this.log.length - 1;
      } else {
        // Decrement nextIndex and retry
        this.nextIndex[peer.id] = Math.max(0, (this.nextIndex[peer.id] || 1) - 1);
      }
    }
    
    // Update commit index
    this.updateCommitIndex();
  }

  updateCommitIndex() {
    // Find the highest N such that a majority has matchIndex >= N
    for (let n = this.log.length - 1; n > this.commitIndex; n--) {
      if (this.log[n].term !== this.currentTerm) continue;
      
      let count = 1; // count self
      for (const peer of this.cluster.getPeers(this.id)) {
      if ((this.matchIndex[peer.id] ?? -1) >= n) count++;
      }
      
      if (count > this.cluster.size / 2) {
        this.commitIndex = n;
        this.applyEntries();
        break;
      }
    }
  }

  handleAppendEntries(req) {
    // Update term
    if (req.term > this.currentTerm) {
      this.currentTerm = req.term;
      this.votedFor = null;
    }
    
    if (req.term < this.currentTerm) {
      return { term: this.currentTerm, success: false };
    }
    
    this.state = State.FOLLOWER;
    this.electionTimer = 0;
    
    // Check log consistency
    if (req.prevLogIndex >= 0) {
      if (req.prevLogIndex >= this.log.length) {
        return { term: this.currentTerm, success: false };
      }
      if (this.log[req.prevLogIndex].term !== req.prevLogTerm) {
        // Conflict: delete this and all following
        this.log = this.log.slice(0, req.prevLogIndex);
        return { term: this.currentTerm, success: false };
      }
    }
    
    // Append new entries
    for (const entry of req.entries) {
      if (entry.index < this.log.length) {
        if (this.log[entry.index].term !== entry.term) {
          this.log = this.log.slice(0, entry.index);
          this.log.push(entry);
        }
      } else {
        this.log.push(entry);
      }
    }
    
    // Update commit index
    if (req.leaderCommit > this.commitIndex) {
      this.commitIndex = Math.min(req.leaderCommit, this.log.length - 1);
      this.applyEntries();
    }
    
    return { term: this.currentTerm, success: true };
  }

  sendHeartbeats() {
    if (this.state !== State.LEADER) return;
    this.replicateLog();
  }

  applyEntries() {
    while (this.lastApplied < this.commitIndex) {
      this.lastApplied++;
      this.applied.push(this.log[this.lastApplied].command);
    }
  }
}

// ===== Cluster =====

export class Cluster {
  constructor(nodeCount) {
    this.nodes = [];
    this.currentLeader = null;
    this.size = nodeCount;
    
    for (let i = 0; i < nodeCount; i++) {
      this.nodes.push(new RaftNode(i, this));
    }
  }

  getPeers(nodeId) {
    return this.nodes.filter(n => n.id !== nodeId);
  }

  getLeader() {
    return this.nodes.find(n => n.state === State.LEADER) || null;
  }

  getNode(id) { return this.nodes[id]; }

  // Simulate: trigger election on a specific node
  triggerElection(nodeId) {
    this.nodes[nodeId].startElection();
  }

  // Submit command to leader
  submit(command) {
    const leader = this.getLeader();
    if (!leader) return false;
    return leader.appendCommand(command);
  }
}
