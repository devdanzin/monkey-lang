const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Forth } = require('../src/index.js');

test('basic arithmetic', () => {
  const f = new Forth();
  f.eval('3 4 +');
  assert.deepEqual(f.getStack(), [7]);
  f.reset();
  f.eval('10 3 -');
  assert.deepEqual(f.getStack(), [7]);
  f.reset();
  f.eval('6 7 *');
  assert.deepEqual(f.getStack(), [42]);
});

test('stack operations', () => {
  const f = new Forth();
  f.eval('1 2 swap');
  assert.deepEqual(f.getStack(), [2, 1]);
  f.reset();
  f.eval('1 2 dup');
  assert.deepEqual(f.getStack(), [1, 2, 2]);
  f.reset();
  f.eval('1 2 over');
  assert.deepEqual(f.getStack(), [1, 2, 1]);
  f.reset();
  f.eval('1 2 3 rot');
  assert.deepEqual(f.getStack(), [2, 3, 1]);
});

test('comparison', () => {
  const f = new Forth();
  f.eval('5 3 >');
  assert.deepEqual(f.getStack(), [-1]); // true
  f.reset();
  f.eval('3 5 >');
  assert.deepEqual(f.getStack(), [0]); // false
});

test('output', () => {
  const f = new Forth();
  const out = f.eval('42 . ." hello" cr');
  assert.ok(out.includes('42'));
  assert.ok(out.includes('hello'));
});

test('word definition', () => {
  const f = new Forth();
  f.eval(': square dup * ;');
  f.eval('5 square');
  assert.deepEqual(f.getStack(), [25]);
});

test('if...then', () => {
  const f = new Forth();
  f.eval(': check 0 > if ." positive" then ;');
  const out = f.eval('5 check');
  assert.ok(out.includes('positive'));
});

test('if...else...then', () => {
  const f = new Forth();
  f.eval(': sign 0 > if ." pos" else ." neg" then ;');
  const out1 = f.eval('5 sign');
  assert.ok(out1.includes('pos'));
  f.reset();
  const out2 = f.eval('-3 sign');
  assert.ok(out2.includes('neg'));
});

test('do loop', () => {
  const f = new Forth();
  // Simple do loop that uses i (loop index)
  f.eval('5 0 do i . loop');
  const out = f.getOutput();
  assert.ok(out.includes('0'));
  assert.ok(out.includes('4'));
});

test('variable', () => {
  const f = new Forth();
  f.eval('variable x');
  f.eval('42 x !');
  f.eval('x @');
  assert.deepEqual(f.getStack(), [42]);
});

test('constant', () => {
  const f = new Forth();
  f.eval('100 constant hundred');
  f.eval('hundred');
  assert.deepEqual(f.getStack(), [100]);
});

test('recursive word — factorial', () => {
  const f = new Forth();
  f.eval(': fact dup 1 > if dup 1 - fact * then ;');
  f.eval('5 fact');
  assert.deepEqual(f.getStack(), [120]);
});

test('comments', () => {
  const f = new Forth();
  f.eval('( this is a comment ) 42');
  assert.deepEqual(f.getStack(), [42]);
});

test('nested definition', () => {
  const f = new Forth();
  f.eval(': double 2 * ;');
  f.eval(': quadruple double double ;');
  f.eval('3 quadruple');
  assert.deepEqual(f.getStack(), [12]);
});
