const { test } = require('node:test');
const assert = require('node:assert/strict');
const { BloomClock } = require('../src/index.js');

test('tick records events', () => {
  const bc = new BloomClock(64, 3, 'node-a');
  assert.equal(bc.eventCount, 0);
  bc.tick('evt-1');
  assert.equal(bc.eventCount, 1);
  assert.ok(bc.popCount() > 0);
});

test('contains checks membership', () => {
  const bc = new BloomClock(256, 3, 'node-a');
  bc.tick('hello');
  bc.tick('world');
  assert.ok(bc.contains('hello'));
  assert.ok(bc.contains('world'));
  // Not added — should (very likely) not be found
  // Use large filter to minimize FP
  let falsePositives = 0;
  for (let i = 0; i < 20; i++) {
    if (bc.contains(`not-added-${i}`)) falsePositives++;
  }
  assert.ok(falsePositives < 10, 'Too many false positives');
});

test('merge combines causal histories', () => {
  const a = new BloomClock(128, 3, 'a');
  const b = new BloomClock(128, 3, 'b');
  a.tick('a1');
  b.tick('b1');

  const merged = a.clone();
  merged.merge(b);

  assert.ok(merged.contains('a1'));
  assert.ok(merged.contains('b1'));
  assert.ok(merged.popCount() >= a.popCount());
  assert.ok(merged.popCount() >= b.popCount());
});

test('happenedBefore — causal ordering', () => {
  const a = new BloomClock(128, 3, 'a');
  a.tick('e1');
  
  const b = a.clone();
  b.tick('e2');

  // a happened before b (a's bits are subset of b's bits)
  assert.ok(a.happenedBefore(b));
  assert.ok(!b.happenedBefore(a));
});

test('compare — equal clocks', () => {
  const a = new BloomClock(128, 3, 'a');
  a.tick('e1');
  const b = a.clone();
  assert.equal(a.compare(b), 'equal');
});

test('compare — before/after', () => {
  const a = new BloomClock(128, 3, 'a');
  a.tick('e1');
  const b = a.clone();
  b.tick('e2');
  assert.equal(a.compare(b), 'before');
  assert.equal(b.compare(a), 'after');
});

test('compare — concurrent events', () => {
  const a = new BloomClock(256, 3, 'a');
  const b = new BloomClock(256, 3, 'b');
  // Independent events on different nodes
  a.tick('a-only-1');
  a.tick('a-only-2');
  b.tick('b-only-1');
  b.tick('b-only-2');
  assert.equal(a.compare(b), 'concurrent');
});

test('merge preserves causality', () => {
  const a = new BloomClock(128, 3, 'a');
  a.tick('e1');
  
  const b = a.clone(); // b knows about e1
  b.nodeId = 'b';
  b.tick('e2');

  const c = a.clone(); // c knows about e1
  c.nodeId = 'c';
  c.tick('e3');

  // Merge b and c → should know about e1, e2, e3
  const merged = b.clone();
  merged.merge(c);

  assert.ok(a.happenedBefore(merged));
  assert.ok(b.happenedBefore(merged));
  assert.ok(c.happenedBefore(merged));
});

test('serialize and deserialize roundtrip', () => {
  const bc = new BloomClock(128, 4, 'node-x');
  bc.tick('alpha');
  bc.tick('beta');

  const data = bc.serialize();
  const restored = BloomClock.deserialize(data);

  assert.equal(restored.size, 128);
  assert.equal(restored.hashCount, 4);
  assert.equal(restored.nodeId, 'node-x');
  assert.equal(restored.eventCount, 2);
  assert.ok(restored.contains('alpha'));
  assert.ok(restored.contains('beta'));
  assert.deepEqual(restored.bits, bc.bits);
});

test('estimateFPR increases with more events', () => {
  const bc = new BloomClock(64, 3, 'node');
  const fpr0 = bc.estimateFPR();
  assert.equal(fpr0, 0);

  for (let i = 0; i < 10; i++) bc.tick(`evt-${i}`);
  const fpr10 = bc.estimateFPR();
  
  for (let i = 10; i < 30; i++) bc.tick(`evt-${i}`);
  const fpr30 = bc.estimateFPR();

  assert.ok(fpr10 > fpr0);
  assert.ok(fpr30 > fpr10);
});

test('popCount accuracy', () => {
  const bc = new BloomClock(64, 1, 'node');
  assert.equal(bc.popCount(), 0);
  // With hashCount=1, each tick sets exactly 1 bit (may overlap)
  bc.tick('a');
  assert.ok(bc.popCount() >= 1);
});

test('size mismatch throws on merge', () => {
  const a = new BloomClock(64, 3, 'a');
  const b = new BloomClock(128, 3, 'b');
  assert.throws(() => a.merge(b), /Size mismatch/);
});

test('distributed scenario — 3 nodes exchanging messages', () => {
  const alice = new BloomClock(256, 3, 'alice');
  const bob = new BloomClock(256, 3, 'bob');
  const charlie = new BloomClock(256, 3, 'charlie');

  // Alice does local work
  alice.tick('alice:login');
  alice.tick('alice:write-doc');

  // Alice sends message to Bob (Bob merges Alice's clock)
  bob.merge(alice.clone());
  bob.tick('bob:recv-from-alice');
  bob.tick('bob:process');

  // Bob sends to Charlie
  charlie.merge(bob.clone());
  charlie.tick('charlie:recv-from-bob');

  // Causal chain: alice → bob → charlie
  assert.equal(alice.compare(bob), 'before');
  assert.equal(bob.compare(charlie), 'before');
  assert.equal(alice.compare(charlie), 'before');

  // Alice and Charlie are causally related through Bob
  assert.ok(alice.happenedBefore(charlie));
});
