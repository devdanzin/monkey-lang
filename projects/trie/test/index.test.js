import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Trie } from '../src/index.js';

describe('Trie — basic', () => {
  it('insert and search', () => {
    const t = new Trie();
    t.insert('hello');
    assert.equal(t.has('hello'), true);
    assert.equal(t.has('hell'), false);
    assert.equal(t.has('helloo'), false);
  });

  it('search returns value', () => {
    const t = new Trie();
    t.insert('key', 42);
    assert.equal(t.search('key'), 42);
    assert.equal(t.search('missing'), undefined);
  });

  it('tracks size', () => {
    const t = new Trie();
    t.insert('a'); t.insert('b'); t.insert('c');
    assert.equal(t.size, 3);
  });

  it('duplicate insert updates value', () => {
    const t = new Trie();
    t.insert('key', 1);
    t.insert('key', 2);
    assert.equal(t.search('key'), 2);
    assert.equal(t.size, 1);
  });
});

describe('Trie — startsWith', () => {
  it('prefix exists', () => {
    const t = new Trie();
    t.insert('apple'); t.insert('application');
    assert.equal(t.startsWith('app'), true);
    assert.equal(t.startsWith('apple'), true);
    assert.equal(t.startsWith('xyz'), false);
  });
});

describe('Trie — autocomplete', () => {
  it('finds all words with prefix', () => {
    const t = new Trie();
    ['apple', 'app', 'application', 'banana', 'apply'].forEach(w => t.insert(w));
    const results = t.autocomplete('app');
    assert.deepEqual(results.sort(), ['app', 'apple', 'application', 'apply']);
  });

  it('with limit', () => {
    const t = new Trie();
    ['cat', 'car', 'card', 'care'].forEach(w => t.insert(w));
    const results = t.autocomplete('ca', 2);
    assert.equal(results.length, 2);
  });

  it('empty prefix returns all', () => {
    const t = new Trie();
    ['a', 'b', 'c'].forEach(w => t.insert(w));
    assert.equal(t.autocomplete('').length, 3);
  });

  it('no matches', () => {
    const t = new Trie();
    t.insert('hello');
    assert.deepEqual(t.autocomplete('xyz'), []);
  });
});

describe('Trie — delete', () => {
  it('deletes word', () => {
    const t = new Trie();
    t.insert('hello');
    assert.equal(t.delete('hello'), true);
    assert.equal(t.has('hello'), false);
    assert.equal(t.size, 0);
  });

  it('delete returns false for missing', () => {
    const t = new Trie();
    assert.equal(t.delete('nope'), false);
  });

  it('delete preserves prefix words', () => {
    const t = new Trie();
    t.insert('app'); t.insert('apple');
    t.delete('apple');
    assert.equal(t.has('app'), true);
    assert.equal(t.has('apple'), false);
  });

  it('delete preserves longer words', () => {
    const t = new Trie();
    t.insert('app'); t.insert('apple');
    t.delete('app');
    assert.equal(t.has('apple'), true);
    assert.equal(t.has('app'), false);
  });
});

describe('Trie — utility', () => {
  it('words() returns all words', () => {
    const t = new Trie();
    ['dog', 'cat', 'car'].forEach(w => t.insert(w));
    assert.deepEqual(t.words().sort(), ['car', 'cat', 'dog']);
  });

  it('countPrefix', () => {
    const t = new Trie();
    ['apple', 'app', 'application'].forEach(w => t.insert(w));
    assert.equal(t.countPrefix('app'), 3);
    assert.equal(t.countPrefix('apple'), 1); // just "apple" (not "application")
  });

  it('longestCommonPrefix', () => {
    const t = new Trie();
    ['flower', 'flow', 'flight'].forEach(w => t.insert(w));
    assert.equal(t.longestCommonPrefix(), 'fl');
  });

  it('longestCommonPrefix all same', () => {
    const t = new Trie();
    ['abc', 'abc'].forEach(w => t.insert(w));
    assert.equal(t.longestCommonPrefix(), 'abc');
  });
});
