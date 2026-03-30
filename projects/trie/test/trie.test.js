import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Trie } from '../src/index.js';

describe('Insert and search', () => {
  it('inserts and finds words', () => {
    const t = new Trie();
    t.insert('hello').insert('help').insert('world');
    assert.equal(t.has('hello'), true);
    assert.equal(t.has('help'), true);
    assert.equal(t.has('hel'), false);
    assert.equal(t.size, 3);
  });
  it('stores values', () => {
    const t = new Trie();
    t.insert('key', 42);
    assert.equal(t.search('key'), 42);
    assert.equal(t.search('nope'), undefined);
  });
});

describe('startsWith', () => {
  it('checks prefix', () => {
    const t = new Trie();
    t.insert('hello').insert('help');
    assert.equal(t.startsWith('hel'), true);
    assert.equal(t.startsWith('wor'), false);
  });
});

describe('autocomplete', () => {
  it('returns matching words', () => {
    const t = new Trie();
    ['apple', 'app', 'application', 'banana', 'apply'].forEach(w => t.insert(w));
    const results = t.autocomplete('app');
    assert.equal(results.length, 4);
    assert.ok(results.includes('app'));
    assert.ok(results.includes('apple'));
    assert.ok(results.includes('application'));
    assert.ok(results.includes('apply'));
  });
  it('respects limit', () => {
    const t = new Trie();
    for (let i = 0; i < 100; i++) t.insert(`word${i}`);
    assert.equal(t.autocomplete('word', 5).length, 5);
  });
  it('empty prefix returns all', () => {
    const t = new Trie();
    t.insert('a').insert('b').insert('c');
    assert.equal(t.autocomplete('').length, 3);
  });
});

describe('delete', () => {
  it('removes word', () => {
    const t = new Trie();
    t.insert('hello').insert('help');
    assert.equal(t.delete('hello'), true);
    assert.equal(t.has('hello'), false);
    assert.equal(t.has('help'), true);
    assert.equal(t.size, 1);
  });
  it('returns false for missing', () => {
    const t = new Trie();
    assert.equal(t.delete('nope'), false);
  });
});

describe('countPrefix', () => {
  it('counts words with prefix', () => {
    const t = new Trie();
    ['hello', 'help', 'heap', 'world'].forEach(w => t.insert(w));
    assert.equal(t.countPrefix('he'), 3);
    assert.equal(t.countPrefix('hel'), 2);
    assert.equal(t.countPrefix('z'), 0);
  });
});

describe('words', () => {
  it('returns all words sorted', () => {
    const t = new Trie();
    ['cat', 'car', 'card', 'care'].forEach(w => t.insert(w));
    const words = t.words();
    assert.equal(words.length, 4);
    assert.ok(words.includes('cat'));
    assert.ok(words.includes('care'));
  });
});

describe('longestCommonPrefix', () => {
  it('finds LCP', () => {
    const t = new Trie();
    ['flower', 'flow', 'flight'].forEach(w => t.insert(w));
    assert.equal(t.longestCommonPrefix(), 'fl');
  });
  it('empty for no common prefix', () => {
    const t = new Trie();
    ['dog', 'cat'].forEach(w => t.insert(w));
    assert.equal(t.longestCommonPrefix(), '');
  });
});

describe('clear', () => {
  it('empties trie', () => {
    const t = new Trie();
    t.insert('a').insert('b');
    t.clear();
    assert.equal(t.size, 0);
    assert.equal(t.has('a'), false);
  });
});
