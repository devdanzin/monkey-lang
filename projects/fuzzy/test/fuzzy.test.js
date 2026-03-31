import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { levenshtein, similarity, fuzzyMatch, fuzzySearch, closestMatch, damerauLevenshtein } from '../src/index.js';

describe('levenshtein', () => {
  it('identical', () => assert.equal(levenshtein('hello', 'hello'), 0));
  it('one change', () => assert.equal(levenshtein('cat', 'hat'), 1));
  it('kitten/sitting', () => assert.equal(levenshtein('kitten', 'sitting'), 3));
  it('empty', () => assert.equal(levenshtein('', 'abc'), 3));
});
describe('similarity', () => {
  it('identical = 1', () => assert.equal(similarity('abc', 'abc'), 1));
  it('totally different', () => assert.ok(similarity('abc', 'xyz') < 1));
  it('both empty = 1', () => assert.equal(similarity('', ''), 1));
});
describe('fuzzyMatch', () => {
  it('matches subsequence', () => { const r = fuzzyMatch('abc', 'aXbYcZ'); assert.equal(r.match, true); });
  it('no match', () => assert.equal(fuzzyMatch('xyz', 'abc').match, false));
  it('case insensitive', () => assert.equal(fuzzyMatch('abc', 'ABC').match, true));
});
describe('fuzzySearch', () => {
  it('ranks results', () => {
    const items = ['apple', 'application', 'apply', 'banana'];
    const results = fuzzySearch('app', items);
    assert.ok(results.length >= 3);
    assert.equal(results[0].item.startsWith('app'), true);
  });
  it('with key', () => {
    const items = [{ name: 'Alice' }, { name: 'Bob' }];
    const results = fuzzySearch('ali', items, { key: 'name' });
    assert.equal(results.length, 1);
    assert.equal(results[0].item.name, 'Alice');
  });
});
describe('closestMatch', () => {
  it('finds closest', () => {
    const r = closestMatch('helo', ['hello', 'world', 'help']);
    assert.equal(r.match, 'hello');
    assert.equal(r.distance, 1);
  });
});
describe('damerauLevenshtein', () => {
  it('handles transpositions', () => {
    assert.equal(damerauLevenshtein('ab', 'ba'), 1); // Transposition
    assert.equal(levenshtein('ab', 'ba'), 2); // Regular Levenshtein = 2
  });
});
