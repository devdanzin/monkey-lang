import { describe, it } from 'node:test'; import assert from 'node:assert/strict';
import { Xorshift32, Xorshift128, LCG, seedRandom } from '../src/index.js';
describe('Xorshift32', () => {
  it('deterministic', () => { const a = new Xorshift32(42); const b = new Xorshift32(42); assert.equal(a.next(), b.next()); });
  it('float 0-1', () => { const r = new Xorshift32(42); const f = r.float(); assert.ok(f >= 0 && f <= 1); });
  it('int range', () => { const r = new Xorshift32(42); const n = r.int(1, 10); assert.ok(n >= 1 && n <= 10); });
  it('different seeds differ', () => { assert.notEqual(new Xorshift32(1).next(), new Xorshift32(2).next()); });
});
describe('Xorshift128', () => { it('works', () => { const r = new Xorshift128(42); assert.ok(r.next() > 0); }); it('float', () => assert.ok(new Xorshift128(42).float() <= 1)); });
describe('LCG', () => { it('deterministic', () => { assert.equal(new LCG(42).next(), new LCG(42).next()); }); it('different seeds', () => assert.notEqual(new LCG(1).next(), new LCG(2).next())); });
describe('seedRandom', () => { it('reproducible', () => { const a = seedRandom(42); const b = seedRandom(42); assert.equal(a(), b()); }); });
