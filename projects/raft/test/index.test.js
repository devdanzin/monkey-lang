import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Cluster, RaftNode, State, LogEntry } from '../src/index.js';

describe('Raft — node basics', () => {
  it('starts as follower', () => {
    const cluster = new Cluster(3);
    for (const node of cluster.nodes) {
      assert.equal(node.state, State.FOLLOWER);
      assert.equal(node.currentTerm, 0);
    }
  });

  it('cluster has correct size', () => {
    const cluster = new Cluster(5);
    assert.equal(cluster.nodes.length, 5);
    assert.equal(cluster.size, 5);
  });
});

describe('Raft — leader election', () => {
  it('node becomes leader with majority', () => {
    const cluster = new Cluster(3);
    cluster.triggerElection(0);
    
    assert.equal(cluster.nodes[0].state, State.LEADER);
    assert.equal(cluster.nodes[0].currentTerm, 1);
  });

  it('leader is recognized by cluster', () => {
    const cluster = new Cluster(3);
    cluster.triggerElection(0);
    
    const leader = cluster.getLeader();
    assert.ok(leader);
    assert.equal(leader.id, 0);
  });

  it('term increments on election', () => {
    const cluster = new Cluster(3);
    cluster.triggerElection(0);
    assert.equal(cluster.nodes[0].currentTerm, 1);
  });

  it('node votes for itself', () => {
    const cluster = new Cluster(3);
    cluster.triggerElection(0);
    assert.equal(cluster.nodes[0].votedFor, 0);
  });

  it('5-node cluster election', () => {
    const cluster = new Cluster(5);
    cluster.triggerElection(2);
    assert.equal(cluster.nodes[2].state, State.LEADER);
  });

  it('new election with higher term wins', () => {
    const cluster = new Cluster(3);
    cluster.triggerElection(0);
    assert.equal(cluster.nodes[0].state, State.LEADER);
    
    // Node 1 starts new election with higher term
    cluster.nodes[1].currentTerm = 1; // match current
    cluster.triggerElection(1);
    assert.equal(cluster.nodes[1].state, State.LEADER);
    assert.equal(cluster.nodes[1].currentTerm, 2);
  });
});

describe('Raft — log replication', () => {
  it('leader appends to its log', () => {
    const cluster = new Cluster(3);
    cluster.triggerElection(0);
    
    cluster.submit('set x=1');
    assert.equal(cluster.nodes[0].log.length, 1);
    assert.equal(cluster.nodes[0].log[0].command, 'set x=1');
  });

  it('replicates to followers', () => {
    const cluster = new Cluster(3);
    cluster.triggerElection(0);
    
    cluster.submit('set x=1');
    
    // All nodes should have the entry
    for (const node of cluster.nodes) {
      assert.equal(node.log.length, 1);
    }
  });

  it('commits when majority has entry', () => {
    const cluster = new Cluster(3);
    cluster.triggerElection(0);
    
    cluster.submit('set x=1');
    
    const leader = cluster.getLeader();
    assert.equal(leader.commitIndex, 0);
  });

  it('applies committed entries', () => {
    const cluster = new Cluster(3);
    cluster.triggerElection(0);
    
    cluster.submit('set x=1');
    cluster.submit('set y=2');
    
    const leader = cluster.getLeader();
    assert.deepEqual(leader.applied, ['set x=1', 'set y=2']);
  });

  it('followers apply on next heartbeat', () => {
    const cluster = new Cluster(3);
    cluster.triggerElection(0);
    
    cluster.submit('cmd1');
    cluster.submit('cmd2');
    
    // Followers should have applied entries after replication
    for (const node of cluster.nodes) {
      assert.ok(node.applied.length >= 1, `Node ${node.id} should have applied entries`);
    }
  });

  it('multiple commands maintain order', () => {
    const cluster = new Cluster(3);
    cluster.triggerElection(0);
    
    cluster.submit('a');
    cluster.submit('b');
    cluster.submit('c');
    
    const leader = cluster.getLeader();
    assert.deepEqual(leader.applied, ['a', 'b', 'c']);
    assert.equal(leader.log.length, 3);
  });
});

describe('Raft — term management', () => {
  it('rejects requests from old terms', () => {
    const cluster = new Cluster(3);
    cluster.triggerElection(0); // term 1
    
    // Old-term append entries should be rejected
    const reply = cluster.nodes[1].handleAppendEntries({
      term: 0, leaderId: 99,
      prevLogIndex: -1, prevLogTerm: 0,
      entries: [], leaderCommit: -1,
    });
    assert.equal(reply.success, false);
  });

  it('steps down when seeing higher term', () => {
    const cluster = new Cluster(3);
    cluster.triggerElection(0);
    assert.equal(cluster.nodes[0].state, State.LEADER);
    
    // Simulate higher-term request
    cluster.nodes[0].handleAppendEntries({
      term: 5, leaderId: 1,
      prevLogIndex: -1, prevLogTerm: 0,
      entries: [], leaderCommit: -1,
    });
    assert.equal(cluster.nodes[0].state, State.FOLLOWER);
    assert.equal(cluster.nodes[0].currentTerm, 5);
  });
});

describe('Raft — vote request handling', () => {
  it('grants vote to first candidate', () => {
    const cluster = new Cluster(3);
    const reply = cluster.nodes[1].handleRequestVote({
      term: 1, candidateId: 0,
      lastLogIndex: -1, lastLogTerm: 0,
    });
    assert.equal(reply.voteGranted, true);
  });

  it('rejects vote if already voted', () => {
    const cluster = new Cluster(3);
    cluster.nodes[1].handleRequestVote({
      term: 1, candidateId: 0,
      lastLogIndex: -1, lastLogTerm: 0,
    });
    const reply = cluster.nodes[1].handleRequestVote({
      term: 1, candidateId: 2,
      lastLogIndex: -1, lastLogTerm: 0,
    });
    assert.equal(reply.voteGranted, false);
  });

  it('grants vote to same candidate again', () => {
    const cluster = new Cluster(3);
    cluster.nodes[1].handleRequestVote({
      term: 1, candidateId: 0,
      lastLogIndex: -1, lastLogTerm: 0,
    });
    const reply = cluster.nodes[1].handleRequestVote({
      term: 1, candidateId: 0,
      lastLogIndex: -1, lastLogTerm: 0,
    });
    assert.equal(reply.voteGranted, true);
  });
});

describe('Raft — non-leader rejects commands', () => {
  it('follower cannot append', () => {
    const cluster = new Cluster(3);
    assert.equal(cluster.nodes[0].appendCommand('cmd'), false);
  });
});
