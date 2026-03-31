const { test } = require('node:test');
const assert = require('node:assert/strict');
const { MealyFST, MooreFST, compose, fromMapping } = require('../src/index.js');

test('Mealy FST — binary incrementer', () => {
  // Simple: 0→0, 1→1 (identity), but with carry logic
  const fst = new MealyFST();
  fst.addState('q0', { initial: true, accepting: true });
  fst.addTransition('q0', 'a', 'q0', 'x');
  fst.addTransition('q0', 'b', 'q0', 'y');
  
  const result = fst.run(['a', 'b', 'a']);
  assert.deepEqual(result.output, ['x', 'y', 'x']);
  assert.equal(result.accepted, true);
});

test('Mealy FST — not accepted', () => {
  const fst = new MealyFST();
  fst.addState('q0', { initial: true });
  fst.addState('q1', { accepting: true });
  fst.addTransition('q0', 'a', 'q1', 'x');
  
  const result = fst.run(['b']); // no transition for 'b'
  assert.equal(result.accepted, false);
});

test('Mealy FST — multi-state', () => {
  const fst = new MealyFST();
  fst.addState('even', { initial: true, accepting: true });
  fst.addState('odd');
  fst.addTransition('even', '1', 'odd', 'E→O');
  fst.addTransition('odd', '1', 'even', 'O→E');
  fst.addTransition('even', '0', 'even', 'E→E');
  fst.addTransition('odd', '0', 'odd', 'O→O');
  
  const result = fst.run(['1', '0', '1']);
  assert.deepEqual(result.output, ['E→O', 'O→O', 'O→E']);
  assert.equal(result.accepted, true);
});

test('Moore FST — output on states', () => {
  const fst = new MooreFST();
  fst.addState('off', { initial: true, output: 0 });
  fst.addState('on', { accepting: true, output: 1 });
  fst.addTransition('off', 'toggle', 'on');
  fst.addTransition('on', 'toggle', 'off');
  
  const result = fst.run(['toggle', 'toggle', 'toggle']);
  assert.deepEqual(result.output, [0, 1, 0, 1]); // includes initial state output
  assert.equal(result.state, 'on');
});

test('transduce', () => {
  const fst = fromMapping({ a: '1', b: '2', c: '3' });
  assert.deepEqual(fst.transduce(['a', 'b', 'c']), ['1', '2', '3']);
});

test('fromMapping', () => {
  const fst = fromMapping({ x: 'X', y: 'Y' });
  const result = fst.run(['x', 'y', 'x']);
  assert.deepEqual(result.output, ['X', 'Y', 'X']);
  assert.equal(result.accepted, true);
});

test('compose FSTs', () => {
  // FST A: a→1, b→2
  // FST B: 1→X, 2→Y
  // Composed: a→X, b→Y
  const fstA = fromMapping({ a: '1', b: '2' });
  const fstB = fromMapping({ '1': 'X', '2': 'Y' });
  const composed = compose(fstA, fstB);
  
  const result = composed.run(['a', 'b', 'a']);
  assert.deepEqual(result.output, ['X', 'Y', 'X']);
});

test('step method', () => {
  const fst = new MealyFST();
  fst.addState('q0', { initial: true });
  fst.addTransition('q0', 'a', 'q0', 'x');
  
  const t = fst.step('q0', 'a');
  assert.equal(t.next, 'q0');
  assert.equal(t.output, 'x');
  assert.equal(fst.step('q0', 'b'), null);
});
