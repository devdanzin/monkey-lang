import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { diff, diffLines, diffChars, formatUnified, applyEdits, editDistance, EQUAL, INSERT, DELETE } from '../src/index.js';

describe('diff — arrays', () => {
  it('identical arrays', () => {
    const result = diff(['a', 'b', 'c'], ['a', 'b', 'c']);
    assert.ok(result.every(e => e.type === EQUAL));
    assert.equal(result.length, 3);
  });

  it('empty to non-empty', () => {
    const result = diff([], ['a', 'b']);
    assert.equal(result.length, 2);
    assert.ok(result.every(e => e.type === INSERT));
  });

  it('non-empty to empty', () => {
    const result = diff(['a', 'b'], []);
    assert.equal(result.length, 2);
    assert.ok(result.every(e => e.type === DELETE));
  });

  it('both empty', () => {
    assert.deepEqual(diff([], []), []);
  });

  it('simple change', () => {
    const result = diff(['a', 'b', 'c'], ['a', 'x', 'c']);
    const types = result.map(e => e.type);
    assert.ok(types.includes(EQUAL));
    assert.ok(types.includes(DELETE) || types.includes(INSERT));
  });

  it('insertion', () => {
    const result = diff(['a', 'c'], ['a', 'b', 'c']);
    const inserts = result.filter(e => e.type === INSERT);
    assert.equal(inserts.length, 1);
    assert.equal(inserts[0].value, 'b');
  });

  it('deletion', () => {
    const result = diff(['a', 'b', 'c'], ['a', 'c']);
    const deletes = result.filter(e => e.type === DELETE);
    assert.equal(deletes.length, 1);
    assert.equal(deletes[0].value, 'b');
  });
});

describe('diffChars', () => {
  it('character-level diff', () => {
    const result = diffChars('hello', 'hallo');
    const changes = result.filter(e => e.type !== EQUAL);
    assert.ok(changes.length > 0);
  });

  it('identical strings', () => {
    const result = diffChars('same', 'same');
    assert.ok(result.every(e => e.type === EQUAL));
  });
});

describe('diffLines', () => {
  it('line-level diff', () => {
    const result = diffLines('line1\nline2\nline3', 'line1\nchanged\nline3');
    const changes = result.filter(e => e.type !== EQUAL);
    assert.ok(changes.length > 0);
  });
});

describe('formatUnified', () => {
  it('formats diff output', () => {
    const edits = diff(['a', 'b', 'c'], ['a', 'x', 'c']);
    const output = formatUnified(edits);
    assert.ok(output.includes(' a'));
    assert.ok(output.includes(' c'));
  });
});

describe('applyEdits', () => {
  it('reconstructs new array', () => {
    const a = ['a', 'b', 'c'];
    const b = ['a', 'x', 'c'];
    const edits = diff(a, b);
    assert.deepEqual(applyEdits(edits), b);
  });

  it('works for empty → content', () => {
    const edits = diff([], ['hello']);
    assert.deepEqual(applyEdits(edits), ['hello']);
  });

  it('works for content → empty', () => {
    const edits = diff(['hello'], []);
    assert.deepEqual(applyEdits(edits), []);
  });
});

describe('editDistance', () => {
  it('identical = 0', () => {
    assert.equal(editDistance(['a', 'b'], ['a', 'b']), 0);
  });

  it('one insertion = 1', () => {
    assert.equal(editDistance(['a'], ['a', 'b']), 1);
  });

  it('one deletion = 1', () => {
    assert.equal(editDistance(['a', 'b'], ['a']), 1);
  });

  it('replace = 2 (delete + insert)', () => {
    assert.equal(editDistance(['a'], ['b']), 2);
  });

  it('character edit distance', () => {
    const d = editDistance([...'kitten'], [...'sitting']);
    assert.ok(d > 0);
  });
});
