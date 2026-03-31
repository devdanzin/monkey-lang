import { describe, it } from 'node:test'; import assert from 'node:assert/strict';
import { clamp, lerp, degToRad, radToDeg, gcd, lcm, isPrime, factorial, fibonacci, mean, median, variance, stddev, sum, round } from '../src/index.js';
describe('math', () => {
  it('clamp', () => { assert.equal(clamp(5, 0, 10), 5); assert.equal(clamp(-1, 0, 10), 0); assert.equal(clamp(15, 0, 10), 10); });
  it('lerp', () => assert.equal(lerp(0, 10, 0.5), 5));
  it('degToRad', () => assert.ok(Math.abs(degToRad(180) - Math.PI) < 1e-10));
  it('radToDeg', () => assert.equal(radToDeg(Math.PI), 180));
  it('gcd', () => assert.equal(gcd(12, 8), 4));
  it('lcm', () => assert.equal(lcm(4, 6), 12));
  it('isPrime', () => { assert.ok(isPrime(7)); assert.ok(isPrime(97)); assert.ok(!isPrime(4)); assert.ok(!isPrime(1)); });
  it('factorial', () => assert.equal(factorial(10), 3628800));
  it('fibonacci', () => { assert.equal(fibonacci(0), 0); assert.equal(fibonacci(10), 55); });
  it('mean', () => assert.equal(mean([1, 2, 3, 4, 5]), 3));
  it('median', () => { assert.equal(median([1, 2, 3]), 2); assert.equal(median([1, 2, 3, 4]), 2.5); });
  it('variance', () => assert.equal(variance([2, 4, 4, 4, 5, 5, 7, 9]), 4));
  it('stddev', () => assert.equal(stddev([2, 4, 4, 4, 5, 5, 7, 9]), 2));
  it('sum', () => assert.equal(sum([1, 2, 3]), 6));
  it('round', () => assert.equal(round(3.14159, 2), 3.14));
});
