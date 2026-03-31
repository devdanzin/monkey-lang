import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pipe, compose, curry, partial, memoize, once, identity, constant, flip, not, tap, juxt, converge, trampoline } from '../src/index.js';

describe('pipe', () => { it('left-to-right', () => assert.equal(pipe(x => x + 1, x => x * 2)(3), 8)); });
describe('compose', () => { it('right-to-left', () => assert.equal(compose(x => x * 2, x => x + 1)(3), 8)); });
describe('curry', () => {
  it('curries', () => { const add = curry((a, b) => a + b); assert.equal(add(1)(2), 3); assert.equal(add(1, 2), 3); });
});
describe('partial', () => { it('partially applies', () => { const add5 = partial((a, b) => a + b, 5); assert.equal(add5(3), 8); }); });
describe('memoize', () => {
  it('caches', () => { let calls = 0; const fn = memoize((x) => { calls++; return x * 2; }); fn(5); fn(5); assert.equal(calls, 1); assert.equal(fn(5), 10); });
});
describe('once', () => { it('runs once', () => { let n = 0; const fn = once(() => ++n); fn(); fn(); assert.equal(n, 1); }); });
describe('identity', () => { it('returns input', () => assert.equal(identity(42), 42)); });
describe('constant', () => { it('returns constant', () => assert.equal(constant(5)(), 5)); });
describe('flip', () => { it('flips args', () => assert.equal(flip((a, b) => a - b)(1, 5), 4)); });
describe('not', () => { it('negates', () => assert.equal(not(x => x > 3)(2), true)); });
describe('tap', () => { it('side effect', () => { let s; const r = tap(x => s = x)(42); assert.equal(s, 42); assert.equal(r, 42); }); });
describe('juxt', () => { it('applies all', () => assert.deepEqual(juxt(x => x + 1, x => x * 2)(3), [4, 6])); });
describe('converge', () => { it('combines', () => assert.equal(converge((a, b) => a + b, [x => x + 1, x => x * 2])(3), 4 + 6)); });
describe('trampoline', () => {
  it('prevents stack overflow', () => {
    const factorial = trampoline(function fact(n, acc = 1) { return n <= 1 ? acc : () => fact(n - 1, n * acc); });
    assert.equal(factorial(10), 3628800);
  });
});
