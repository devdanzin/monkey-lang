import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { XorShift128, Random } from './random.js';

describe('XorShift128', () => {
  it('produces numbers', () => { const rng = new XorShift128(42); assert.ok(typeof rng.next() === 'number'); });
  it('deterministic with same seed', () => { const a = new XorShift128(42); const b = new XorShift128(42); assert.equal(a.next(), b.next()); assert.equal(a.next(), b.next()); });
  it('different seeds differ', () => { const a = new XorShift128(1); const b = new XorShift128(2); assert.notEqual(a.next(), b.next()); });
  it('float in [0,1)', () => { const rng = new XorShift128(42); for (let i = 0; i < 100; i++) { const f = rng.float(); assert.ok(f >= 0 && f < 1); } });
  it('int in range', () => { const rng = new XorShift128(42); for (let i = 0; i < 100; i++) { const n = rng.int(1, 6); assert.ok(n >= 1 && n <= 6); } });
});

describe('Random', () => {
  it('float range', () => { const r = new Random(42); for (let i = 0; i < 50; i++) { const f = r.float(5, 10); assert.ok(f >= 5 && f <= 10); } });
  it('int range', () => { const r = new Random(42); for (let i = 0; i < 50; i++) assert.ok(r.int(0, 10) <= 10); });
  it('bool', () => { const r = new Random(42); let trues = 0; for (let i = 0; i < 1000; i++) if (r.bool()) trues++; assert.ok(trues > 300 && trues < 700); });
  it('gaussian mean', () => { const r = new Random(42); let sum = 0; for (let i = 0; i < 1000; i++) sum += r.gaussian(100, 15); assert.ok(Math.abs(sum / 1000 - 100) < 5); });
});

describe('pick/sample', () => {
  it('pick returns item', () => { const r = new Random(42); assert.ok(['a','b','c'].includes(r.pick(['a','b','c']))); });
  it('sample returns n items', () => { const r = new Random(42); const s = r.sample([1,2,3,4,5], 3); assert.equal(s.length, 3); });
  it('sample no duplicates', () => { const r = new Random(42); const s = r.sample([1,2,3,4,5], 5); assert.equal(new Set(s).size, 5); });
});

describe('shuffle', () => {
  it('preserves elements', () => { const r = new Random(42); const s = r.shuffle([1,2,3,4,5]); assert.deepStrictEqual(s.sort(), [1,2,3,4,5]); });
  it('deterministic', () => { const a = new Random(42).shuffle([1,2,3,4,5]); const b = new Random(42).shuffle([1,2,3,4,5]); assert.deepStrictEqual(a, b); });
  it('actually shuffles', () => { const r = new Random(42); const s = r.shuffle([1,2,3,4,5,6,7,8,9,10]); assert.notDeepStrictEqual(s, [1,2,3,4,5,6,7,8,9,10]); });
});

describe('weighted', () => {
  it('respects weights', () => {
    const r = new Random(42);
    const counts = { a: 0, b: 0 };
    for (let i = 0; i < 1000; i++) {
      const val = r.weighted([{ value: 'a', weight: 9 }, { value: 'b', weight: 1 }]);
      counts[val]++;
    }
    assert.ok(counts.a > counts.b * 5); // a should be much more common
  });
});

describe('dice', () => {
  it('1d6', () => { const r = new Random(42); for (let i = 0; i < 50; i++) { const v = r.dice('1d6'); assert.ok(v >= 1 && v <= 6); } });
  it('2d6', () => { const r = new Random(42); const v = r.dice('2d6'); assert.ok(v >= 2 && v <= 12); });
  it('1d20+5', () => { const r = new Random(42); const v = r.dice('1d20+5'); assert.ok(v >= 6 && v <= 25); });
  it('invalid', () => { assert.throws(() => new Random(42).dice('bad')); });
});

describe('string', () => {
  it('correct length', () => { assert.equal(new Random(42).string(10).length, 10); });
  it('deterministic', () => { assert.equal(new Random(42).string(10), new Random(42).string(10)); });
  it('custom charset', () => { const s = new Random(42).string(20, '01'); assert.ok(s.split('').every(c => c === '0' || c === '1')); });
});
