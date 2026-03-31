import { describe, it } from 'node:test'; import assert from 'node:assert/strict';
import { DependencyResolver } from '../src/index.js';
describe('resolve', () => {
  it('simple chain', () => { const r = new DependencyResolver(); r.add('a', ['b']); r.add('b', ['c']); r.add('c', []); assert.deepEqual(r.resolve('a'), ['c', 'b', 'a']); });
  it('diamond', () => { const r = new DependencyResolver(); r.add('a', ['b', 'c']); r.add('b', ['d']); r.add('c', ['d']); r.add('d', []); const res = r.resolve('a'); assert.equal(res.indexOf('d') < res.indexOf('b'), true); });
  it('cycle throws', () => { const r = new DependencyResolver(); r.add('a', ['b']); r.add('b', ['a']); assert.throws(() => r.resolve('a'), /Circular/); });
  it('unknown throws', () => { const r = new DependencyResolver(); r.add('a', ['b']); assert.throws(() => r.resolve('a'), /Unknown/); });
});
describe('resolveAll', () => { it('all packages', () => { const r = new DependencyResolver(); r.add('a', ['b']); r.add('b', []); r.add('c', []); assert.equal(r.resolveAll().length, 3); }); });
describe('queries', () => {
  it('dependsOn', () => { const r = new DependencyResolver(); r.add('a', ['b', 'c']); r.add('b', []); r.add('c', []); assert.deepEqual(r.dependsOn('a'), ['b', 'c']); });
  it('dependedBy', () => { const r = new DependencyResolver(); r.add('a', ['b']); r.add('c', ['b']); r.add('b', []); assert.deepEqual(r.dependedBy('b'), ['a', 'c']); });
  it('hasCycle', () => { const r = new DependencyResolver(); r.add('a', ['b']); r.add('b', ['a']); assert.ok(r.hasCycle()); });
});
