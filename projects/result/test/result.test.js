import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Ok, Err, Result } from '../src/index.js';

describe('Ok', () => {
  it('isOk', () => assert.equal(Ok(42).isOk, true));
  it('unwrap', () => assert.equal(Ok(42).unwrap(), 42));
  it('map', () => assert.equal(Ok(5).map(x => x * 2).unwrap(), 10));
  it('andThen', () => assert.equal(Ok(5).andThen(x => Ok(x + 1)).unwrap(), 6));
});
describe('Err', () => {
  it('isErr', () => assert.equal(Err('oops').isErr, true));
  it('unwrap throws', () => assert.throws(() => Err('oops').unwrap()));
  it('unwrapOr', () => assert.equal(Err('oops').unwrapOr(42), 42));
  it('map skips', () => assert.equal(Err('e').map(x => x * 2).isErr, true));
  it('mapErr', () => assert.equal(Err('e').mapErr(e => e + '!').match({ Ok: () => '', Err: e => e }), 'e!'));
});
describe('from', () => {
  it('catches errors', () => assert.equal(Result.from(() => { throw 'oops'; }).isErr, true));
  it('wraps success', () => assert.equal(Result.from(() => 42).unwrap(), 42));
});
describe('match', () => {
  it('Ok branch', () => assert.equal(Ok(5).match({ Ok: v => v * 2, Err: () => 0 }), 10));
  it('Err branch', () => assert.equal(Err('x').match({ Ok: () => 0, Err: e => e }), 'x'));
});
describe('toString', () => {
  it('Ok', () => assert.equal(Ok(42).toString(), 'Ok(42)'));
  it('Err', () => assert.equal(Err('bad').toString(), 'Err(bad)'));
});
