import { describe, it } from 'node:test'; import assert from 'node:assert/strict';
import { left, right, tryCatch, fromNullable } from '../src/index.js';
describe('Right', () => {
  it('isRight', () => assert.ok(right(42).isRight));
  it('unwrap', () => assert.equal(right(42).unwrap(), 42));
  it('map', () => assert.equal(right(5).map(x => x * 2).unwrap(), 10));
  it('flatMap', () => assert.equal(right(5).flatMap(x => right(x * 2)).unwrap(), 10));
  it('match', () => assert.equal(right(42).match({ right: x => x, left: () => 0 }), 42));
});
describe('Left', () => {
  it('isLeft', () => assert.ok(left('err').isLeft));
  it('unwrap throws', () => assert.throws(() => left('err').unwrap()));
  it('unwrapLeft', () => assert.equal(left('err').unwrapLeft(), 'err'));
  it('map skips', () => assert.ok(left('err').map(x => x * 2).isLeft));
  it('mapLeft', () => assert.equal(left('err').mapLeft(s => s.toUpperCase()).unwrapLeft(), 'ERR'));
  it('match', () => assert.equal(left('err').match({ right: () => 1, left: x => x }), 'err'));
});
describe('tryCatch', () => { it('success', () => assert.ok(tryCatch(() => 42).isRight)); it('error', () => assert.ok(tryCatch(() => { throw new Error(); }).isLeft)); });
describe('fromNullable', () => { it('null → left', () => assert.ok(fromNullable(null).isLeft)); it('value → right', () => assert.ok(fromNullable(42).isRight)); });
