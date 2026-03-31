const { test } = require('node:test');
const assert = require('node:assert/strict');
const { diff, diffLines, diffChars, unified, patch, editDistance } = require('../src/index.js');

test('identical sequences', () => {
  const edits = diff(['a', 'b', 'c'], ['a', 'b', 'c']);
  assert.ok(edits.every(e => e.type === 'equal'));
  assert.equal(edits.length, 3);
});

test('insert', () => {
  const edits = diff(['a', 'c'], ['a', 'b', 'c']);
  const types = edits.map(e => e.type);
  assert.ok(types.includes('insert'));
  assert.equal(patch(null, edits).join(''), 'abc');
});

test('delete', () => {
  const edits = diff(['a', 'b', 'c'], ['a', 'c']);
  const types = edits.map(e => e.type);
  assert.ok(types.includes('delete'));
  assert.equal(patch(null, edits).join(''), 'ac');
});

test('completely different', () => {
  const edits = diff(['a', 'b'], ['c', 'd']);
  assert.equal(patch(null, edits).join(''), 'cd');
});

test('empty sequences', () => {
  assert.deepEqual(diff([], []), []);
  const edits = diff([], ['a']);
  assert.equal(edits.length, 1);
  assert.equal(edits[0].type, 'insert');
});

test('diffLines', () => {
  const edits = diffLines('line1\nline2\nline3', 'line1\nchanged\nline3');
  const insertCount = edits.filter(e => e.type === 'insert').length;
  const deleteCount = edits.filter(e => e.type === 'delete').length;
  assert.ok(insertCount > 0);
  assert.ok(deleteCount > 0);
});

test('unified format', () => {
  const edits = diff(['a', 'b', 'c'], ['a', 'd', 'c']);
  const output = unified(edits);
  assert.ok(output.includes(' a'));
  assert.ok(output.includes('-b'));
  assert.ok(output.includes('+d'));
});

test('diffChars', () => {
  const edits = diffChars('kitten', 'sitting');
  assert.ok(edits.length > 0);
  assert.equal(patch(null, edits).join(''), 'sitting');
});

test('editDistance', () => {
  assert.equal(editDistance('kitten', 'sitting'), editDistance('kitten', 'sitting'));
  assert.ok(editDistance('abc', 'abc') === 0);
  assert.ok(editDistance('abc', 'xyz') > 0);
});

test('patch reconstructs target', () => {
  const a = ['the', 'quick', 'brown', 'fox'];
  const b = ['the', 'slow', 'brown', 'cat'];
  const edits = diff(a, b);
  assert.deepEqual(patch(a, edits), b);
});
