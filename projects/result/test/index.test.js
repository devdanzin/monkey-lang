import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ok, err, Ok, Err, tryCatch, collect } from '../src/index.js';

describe('Ok', () => {
  it('isOk', () => assert.equal(ok(1).isOk(), true));
  it('isErr', () => assert.equal(ok(1).isErr(), false));
  it('unwrap', () => assert.equal(ok(42).unwrap(), 42));
  it('map', () => assert.equal(ok(2).map(x => x * 3).unwrap(), 6));
  it('flatMap', () => assert.equal(ok(2).flatMap(x => ok(x + 1)).unwrap(), 3));
  it('unwrapOr ignores default', () => assert.equal(ok(5).unwrapOr(0), 5));
  it('match ok branch', () => assert.equal(ok(1).match({ ok: v => v + 10, err: () => 0 }), 11));
});

describe('Err', () => {
  it('isOk', () => assert.equal(err('bad').isOk(), false));
  it('isErr', () => assert.equal(err('bad').isErr(), true));
  it('unwrap throws', () => assert.throws(() => err('x').unwrap()));
  it('map is no-op', () => assert.equal(err('x').map(v => v * 2).isErr(), true));
  it('flatMap is no-op', () => assert.equal(err('x').flatMap(v => ok(v)).isErr(), true));
  it('mapErr', () => assert.equal(err('x').mapErr(e => e + '!').error, 'x!'));
  it('unwrapOr', () => assert.equal(err('x').unwrapOr(42), 42));
  it('unwrapOrElse', () => assert.equal(err('x').unwrapOrElse(e => e.length), 1));
  it('match err branch', () => assert.equal(err('x').match({ ok: () => 0, err: e => e }), 'x'));
});

describe('tryCatch', () => {
  it('returns Ok on success', () => assert.equal(tryCatch(() => 42).unwrap(), 42));
  it('returns Err on throw', () => assert.equal(tryCatch(() => { throw new Error('oops'); }).isErr(), true));
});

describe('collect', () => {
  it('collects all Ok', () => assert.deepEqual(collect([ok(1), ok(2), ok(3)]).unwrap(), [1, 2, 3]));
  it('returns first Err', () => assert.equal(collect([ok(1), err('bad'), ok(3)]).isErr(), true));
});
