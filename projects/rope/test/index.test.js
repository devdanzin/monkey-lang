const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Rope } = require('../src/index.js');

test('create and toString', () => {
  const r = Rope.from('Hello, World!');
  assert.equal(r.toString(), 'Hello, World!');
  assert.equal(r.length, 13);
});

test('charAt', () => {
  const r = Rope.from('ABCDEF');
  assert.equal(r.charAt(0), 'A');
  assert.equal(r.charAt(5), 'F');
  assert.equal(r.charAt(3), 'D');
});

test('insert', () => {
  const r = Rope.from('Hello World');
  const r2 = r.insert(5, ',');
  assert.equal(r2.toString(), 'Hello, World');
  assert.equal(r.toString(), 'Hello World'); // original unchanged
});

test('delete', () => {
  const r = Rope.from('Hello, World!');
  const r2 = r.delete(5, 2); // remove ", "
  assert.equal(r2.toString(), 'HelloWorld!');
});

test('substring', () => {
  const r = Rope.from('Hello, World!');
  assert.equal(r.substring(0, 5), 'Hello');
  assert.equal(r.substring(7, 12), 'World');
});

test('concat', () => {
  const a = Rope.from('Hello');
  const b = Rope.from(' World');
  const c = a.concat(b);
  assert.equal(c.toString(), 'Hello World');
  assert.equal(c.length, 11);
});

test('indexOf', () => {
  const r = Rope.from('the quick brown fox');
  assert.equal(r.indexOf('quick'), 4);
  assert.equal(r.indexOf('xyz'), -1);
});

test('lines', () => {
  const r = Rope.from('line1\nline2\nline3');
  assert.deepEqual(r.lines(), ['line1', 'line2', 'line3']);
  assert.equal(r.lineAt(1), 'line2');
});

test('large text', () => {
  const text = 'A'.repeat(10000);
  const r = Rope.from(text);
  assert.equal(r.length, 10000);
  assert.equal(r.charAt(5000), 'A');
  
  const r2 = r.insert(5000, 'B');
  assert.equal(r2.length, 10001);
  assert.equal(r2.charAt(5000), 'B');
});

test('empty rope', () => {
  const r = Rope.from('');
  assert.equal(r.length, 0);
  assert.equal(r.toString(), '');
});

test('rebalance', () => {
  let r = Rope.from('');
  for (let i = 0; i < 100; i++) {
    r = r.insert(r.length, String.fromCharCode(65 + (i % 26)));
  }
  const rebalanced = r.rebalance();
  assert.equal(rebalanced.toString(), r.toString());
});
