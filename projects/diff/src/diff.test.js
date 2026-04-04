import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { lcs, myersDiff, diffLines, diffWords, unifiedDiff, applyPatch, merge3 } from './diff.js';

describe('LCS', () => {
  it('finds longest common subsequence', () => {
    assert.deepStrictEqual(lcs(['a','b','c','d'], ['a','c','d','b']), ['a','c','d']);
  });
  it('empty input', () => {
    assert.deepStrictEqual(lcs([], ['a','b']), []);
  });
  it('identical', () => {
    assert.deepStrictEqual(lcs(['a','b'], ['a','b']), ['a','b']);
  });
  it('no common', () => {
    assert.deepStrictEqual(lcs(['a','b'], ['c','d']), []);
  });
});

describe('Myers Diff', () => {
  it('identical arrays', () => {
    const edits = myersDiff(['a','b','c'], ['a','b','c']);
    assert.ok(edits.every(e => e.type === 'equal'));
  });
  it('insertion', () => {
    const edits = myersDiff(['a','c'], ['a','b','c']);
    const insert = edits.find(e => e.type === 'insert');
    assert.ok(insert);
    assert.equal(insert.value, 'b');
  });
  it('deletion', () => {
    const edits = myersDiff(['a','b','c'], ['a','c']);
    const del = edits.find(e => e.type === 'delete');
    assert.ok(del);
    assert.equal(del.value, 'b');
  });
  it('replacement', () => {
    const edits = myersDiff(['a','b'], ['a','c']);
    assert.ok(edits.some(e => e.type === 'delete' && e.value === 'b'));
    assert.ok(edits.some(e => e.type === 'insert' && e.value === 'c'));
  });
  it('empty to non-empty', () => {
    const edits = myersDiff([], ['a','b']);
    assert.equal(edits.filter(e => e.type === 'insert').length, 2);
  });
});

describe('diffLines', () => {
  it('detects line changes', () => {
    const edits = diffLines('a\nb\nc', 'a\nx\nc');
    assert.ok(edits.some(e => e.type === 'delete' && e.value === 'b'));
    assert.ok(edits.some(e => e.type === 'insert' && e.value === 'x'));
  });
});

describe('diffWords', () => {
  it('detects word changes', () => {
    const edits = diffWords('hello world', 'hello earth');
    assert.ok(edits.some(e => e.type === 'delete' && e.value === 'world'));
    assert.ok(edits.some(e => e.type === 'insert' && e.value === 'earth'));
  });
});

describe('Unified Diff', () => {
  it('generates unified format', () => {
    const result = unifiedDiff('a.txt', 'b.txt', 'hello\nworld', 'hello\nearth');
    assert.ok(result.includes('--- a.txt'));
    assert.ok(result.includes('+++ b.txt'));
    assert.ok(result.includes('-world'));
    assert.ok(result.includes('+earth'));
    assert.ok(result.includes('@@'));
  });
  it('returns empty for identical', () => {
    assert.equal(unifiedDiff('a', 'b', 'same', 'same'), '');
  });
});

describe('Apply Patch', () => {
  it('applies edits to recreate new version', () => {
    const edits = myersDiff(['a','b','c'], ['a','x','c']);
    const result = applyPatch(null, edits);
    assert.deepStrictEqual(result, ['a','x','c']);
  });
});

describe('3-way Merge', () => {
  it('clean merge (no conflicts)', () => {
    const base = 'a\nb\nc';
    const ours = 'a\nx\nc';
    const theirs = 'a\nb\ny';
    const { result, conflicts } = merge3(base, ours, theirs);
    assert.equal(conflicts, 0);
    assert.ok(result.includes('x'));
    assert.ok(result.includes('y'));
  });
  it('detects conflicts', () => {
    const base = 'a\nb\nc';
    const ours = 'a\nx\nc';
    const theirs = 'a\ny\nc';
    const { result, conflicts } = merge3(base, ours, theirs);
    assert.ok(conflicts > 0);
    assert.ok(result.includes('<<<<<<<'));
    assert.ok(result.includes('>>>>>>>'));
  });
});
