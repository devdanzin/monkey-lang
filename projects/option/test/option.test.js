import { describe, it } from 'node:test'; import assert from 'node:assert/strict';
import { some, none, from, tryCatch } from '../src/index.js';
describe('Some', () => {
  it('isSome', () => assert.ok(some(42).isSome));
  it('unwrap', () => assert.equal(some(42).unwrap(), 42));
  it('map', () => assert.equal(some(5).map(x => x * 2).unwrap(), 10));
  it('flatMap', () => assert.equal(some(5).flatMap(x => some(x * 2)).unwrap(), 10));
  it('filter pass', () => assert.ok(some(5).filter(x => x > 3).isSome));
  it('filter fail', () => assert.ok(some(5).filter(x => x > 10).isNone));
  it('match', () => assert.equal(some(42).match({ some: x => x, none: () => 0 }), 42));
});
describe('None', () => {
  it('isNone', () => assert.ok(none.isNone));
  it('unwrap throws', () => assert.throws(() => none.unwrap(), /None/));
  it('unwrapOr', () => assert.equal(none.unwrapOr(99), 99));
  it('map returns none', () => assert.ok(none.map(x => x).isNone));
  it('match', () => assert.equal(none.match({ some: () => 1, none: () => 0 }), 0));
});
describe('from', () => { it('null → none', () => assert.ok(from(null).isNone)); it('value → some', () => assert.equal(from(42).unwrap(), 42)); });
describe('tryCatch', () => { it('success', () => assert.equal(tryCatch(() => 42).unwrap(), 42)); it('error', () => assert.ok(tryCatch(() => { throw new Error(); }).isNone)); });
