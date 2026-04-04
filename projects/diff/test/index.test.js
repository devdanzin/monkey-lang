import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { diff, diffLines, unifiedDiff, applyPatch, editDistance, Op } from '../src/index.js';

describe('diff — basic', () => {
  it('identical sequences', () => {
    const ops = diff([1, 2, 3], [1, 2, 3]);
    assert.ok(ops.every(o => o.op === Op.EQUAL));
  });

  it('empty sequences', () => {
    assert.deepEqual(diff([], []), []);
  });

  it('insert only', () => {
    const ops = diff([], ['a', 'b']);
    assert.ok(ops.every(o => o.op === Op.INSERT));
    assert.equal(ops.length, 2);
  });

  it('delete only', () => {
    const ops = diff(['a', 'b'], []);
    assert.ok(ops.every(o => o.op === Op.DELETE));
  });

  it('mixed operations', () => {
    const ops = diff(['a', 'b', 'c'], ['a', 'x', 'c']);
    assert.equal(ops[0].op, Op.EQUAL);
    assert.ok(ops.some(o => o.op === Op.DELETE && o.value === 'b'));
    assert.ok(ops.some(o => o.op === Op.INSERT && o.value === 'x'));
  });

  it('strings work', () => {
    const ops = diff('abc'.split(''), 'axc'.split(''));
    assert.ok(ops.length > 0);
  });
});

describe('applyPatch', () => {
  it('reconstructs target from ops', () => {
    const a = ['a', 'b', 'c'];
    const b = ['a', 'x', 'c'];
    const ops = diff(a, b);
    assert.deepEqual(applyPatch(a, ops), b);
  });

  it('handles empty to something', () => {
    const ops = diff([], ['x', 'y']);
    assert.deepEqual(applyPatch([], ops), ['x', 'y']);
  });

  it('handles something to empty', () => {
    const ops = diff(['a', 'b'], []);
    assert.deepEqual(applyPatch(['a', 'b'], ops), []);
  });

  it('round-trip complex', () => {
    const a = 'the quick brown fox'.split(' ');
    const b = 'the slow brown dog'.split(' ');
    const ops = diff(a, b);
    assert.deepEqual(applyPatch(a, ops), b);
  });
});

describe('editDistance', () => {
  it('identical = 0', () => assert.equal(editDistance([1, 2, 3], [1, 2, 3]), 0));
  it('one insert', () => assert.equal(editDistance([1, 2], [1, 2, 3]), 1));
  it('one delete', () => assert.equal(editDistance([1, 2, 3], [1, 3]), 1));
  it('replace = delete + insert', () => assert.equal(editDistance(['a'], ['b']), 2));
});

describe('diffLines', () => {
  it('diffs text by lines', () => {
    const a = 'line1\nline2\nline3';
    const b = 'line1\nchanged\nline3';
    const ops = diffLines(a, b);
    assert.ok(ops.some(o => o.op === Op.DELETE && o.value === 'line2'));
    assert.ok(ops.some(o => o.op === Op.INSERT && o.value === 'changed'));
  });
});

describe('unifiedDiff', () => {
  it('generates unified format', () => {
    const a = 'line1\nline2\nline3';
    const b = 'line1\nchanged\nline3';
    const result = unifiedDiff(a, b);
    assert.ok(result.includes('---'));
    assert.ok(result.includes('+++'));
    assert.ok(result.includes('@@'));
    assert.ok(result.includes('-line2'));
    assert.ok(result.includes('+changed'));
  });

  it('no changes produces no hunks', () => {
    const result = unifiedDiff('same\n', 'same\n');
    assert.ok(!result.includes('@@'));
  });
});
