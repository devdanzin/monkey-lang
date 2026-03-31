import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { topoSort, topoSortDFS, allTopoOrders, hasCycle } from '../src/index.js';

const edges = [['a', 'b'], ['a', 'c'], ['b', 'd'], ['c', 'd']];

describe('topoSort (Kahn)', () => {
  it('basic', () => {
    const result = topoSort(edges);
    assert.equal(result.indexOf('a') < result.indexOf('b'), true);
    assert.equal(result.indexOf('a') < result.indexOf('c'), true);
    assert.equal(result.indexOf('b') < result.indexOf('d'), true);
  });
  it('cycle throws', () => assert.throws(() => topoSort([['a','b'],['b','a']]), /Cycle/));
  it('single node', () => assert.deepEqual(topoSort([['a','b']]), ['a', 'b']));
  it('linear chain', () => assert.deepEqual(topoSort([['a','b'],['b','c'],['c','d']]), ['a','b','c','d']));
});

describe('topoSortDFS', () => {
  it('basic', () => {
    const result = topoSortDFS(edges);
    assert.equal(result.indexOf('a') < result.indexOf('d'), true);
  });
  it('cycle throws', () => assert.throws(() => topoSortDFS([['a','b'],['b','c'],['c','a']]), /Cycle/));
});

describe('allTopoOrders', () => {
  it('finds all orderings', () => {
    const all = allTopoOrders([['a','b'],['a','c']]);
    assert.ok(all.length >= 2); // abc, acb both valid
    for (const order of all) assert.equal(order[0], 'a');
  });
});

describe('hasCycle', () => {
  it('no cycle', () => assert.equal(hasCycle(edges), false));
  it('has cycle', () => assert.equal(hasCycle([['a','b'],['b','a']]), true));
});
