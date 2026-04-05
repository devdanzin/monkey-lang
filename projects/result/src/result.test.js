import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Some, None, Option, Ok, Err, tryCatch, tryCatchAsync } from './result.js';

describe('Option - Some', () => {
  it('isSome/isNone', () => { assert.ok(Some(42).isSome); assert.ok(!Some(42).isNone); });
  it('unwrap', () => { assert.equal(Some(42).unwrap(), 42); });
  it('unwrapOr', () => { assert.equal(Some(42).unwrapOr(0), 42); });
  it('map', () => { assert.equal(Some(5).map(x => x * 2).unwrap(), 10); });
  it('flatMap', () => { assert.equal(Some(5).flatMap(x => Some(x + 1)).unwrap(), 6); });
  it('filter pass', () => { assert.ok(Some(5).filter(x => x > 3).isSome); });
  it('filter fail', () => { assert.ok(Some(5).filter(x => x > 10).isNone); });
  it('match', () => { assert.equal(Some(42).match({ some: v => v, none: () => 0 }), 42); });
  it('and', () => { assert.equal(Some(1).and(Some(2)).unwrap(), 2); });
  it('or', () => { assert.equal(Some(1).or(Some(2)).unwrap(), 1); });
  it('toResult', () => { assert.ok(Some(42).toResult('err').isOk); });
});

describe('Option - None', () => {
  it('isSome/isNone', () => { assert.ok(None.isNone); assert.ok(!None.isSome); });
  it('unwrap throws', () => { assert.throws(() => None.unwrap()); });
  it('unwrapOr', () => { assert.equal(None.unwrapOr(42), 42); });
  it('unwrapOrElse', () => { assert.equal(None.unwrapOrElse(() => 42), 42); });
  it('map returns None', () => { assert.ok(None.map(x => x * 2).isNone); });
  it('flatMap returns None', () => { assert.ok(None.flatMap(x => Some(x)).isNone); });
  it('match', () => { assert.equal(None.match({ some: v => v, none: () => 0 }), 0); });
  it('toResult', () => { assert.ok(None.toResult('error').isErr); });
});

describe('Option constructor', () => {
  it('null -> None', () => { assert.ok(Option(null).isNone); });
  it('undefined -> None', () => { assert.ok(Option(undefined).isNone); });
  it('value -> Some', () => { assert.ok(Option(42).isSome); });
  it('0 -> Some', () => { assert.ok(Option(0).isSome); });
  it('empty string -> Some', () => { assert.ok(Option('').isSome); });
});

describe('Result - Ok', () => {
  it('isOk/isErr', () => { assert.ok(Ok(42).isOk); assert.ok(!Ok(42).isErr); });
  it('unwrap', () => { assert.equal(Ok(42).unwrap(), 42); });
  it('map', () => { assert.equal(Ok(5).map(x => x * 2).unwrap(), 10); });
  it('mapErr skips', () => { assert.equal(Ok(5).mapErr(() => 'err').unwrap(), 5); });
  it('andThen', () => { assert.equal(Ok(5).andThen(x => Ok(x + 1)).unwrap(), 6); });
  it('orElse returns self', () => { assert.equal(Ok(5).orElse(() => Ok(0)).unwrap(), 5); });
  it('match', () => { assert.equal(Ok(42).match({ ok: v => v, err: () => 0 }), 42); });
  it('toOption', () => { assert.ok(Ok(42).toOption().isSome); });
});

describe('Result - Err', () => {
  it('isOk/isErr', () => { assert.ok(Err('fail').isErr); assert.ok(!Err('fail').isOk); });
  it('unwrap throws', () => { assert.throws(() => Err('fail').unwrap()); });
  it('unwrapOr', () => { assert.equal(Err('fail').unwrapOr(42), 42); });
  it('unwrapErr', () => { assert.equal(Err('fail').unwrapErr(), 'fail'); });
  it('map skips', () => { assert.ok(Err('fail').map(x => x * 2).isErr); });
  it('mapErr', () => { assert.equal(Err('fail').mapErr(e => e.toUpperCase()).unwrapErr(), 'FAIL'); });
  it('andThen skips', () => { assert.ok(Err('fail').andThen(() => Ok(1)).isErr); });
  it('orElse', () => { assert.equal(Err('fail').orElse(e => Ok(42)).unwrap(), 42); });
  it('match', () => { assert.equal(Err('fail').match({ ok: () => 0, err: e => e }), 'fail'); });
  it('toOption', () => { assert.ok(Err('fail').toOption().isNone); });
});

describe('tryCatch', () => {
  it('success', () => { assert.ok(tryCatch(() => 42).isOk); assert.equal(tryCatch(() => 42).unwrap(), 42); });
  it('error', () => { assert.ok(tryCatch(() => { throw new Error('boom'); }).isErr); });
});

describe('tryCatchAsync', () => {
  it('success', async () => { const r = await tryCatchAsync(async () => 42); assert.equal(r.unwrap(), 42); });
  it('error', async () => { const r = await tryCatchAsync(async () => { throw new Error('boom'); }); assert.ok(r.isErr); });
});
