import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  factorial, fibonacci, gcd, lcm, isPrime, sieve, power, modPow, sqrt,
  combinations, permutations, binomial, catalan, abs, clamp, lerp,
  degToRad, radToDeg, mean, median, variance, stddev,
} from './math.js';

const approx = (a, b, eps = 0.001) => Math.abs(a - b) < eps;

describe('factorial', () => {
  it('0! = 1', () => { assert.equal(factorial(0), 1n); });
  it('5! = 120', () => { assert.equal(factorial(5), 120n); });
  it('10!', () => { assert.equal(factorial(10), 3628800n); });
  it('20!', () => { assert.equal(factorial(20), 2432902008176640000n); });
});

describe('fibonacci', () => {
  it('fib(0) = 0', () => { assert.equal(fibonacci(0), 0); });
  it('fib(1) = 1', () => { assert.equal(fibonacci(1), 1); });
  it('fib(10) = 55', () => { assert.equal(fibonacci(10), 55); });
  it('fib(20) = 6765', () => { assert.equal(fibonacci(20), 6765); });
});

describe('gcd/lcm', () => {
  it('gcd(12, 8) = 4', () => { assert.equal(gcd(12, 8), 4); });
  it('gcd(17, 13) = 1', () => { assert.equal(gcd(17, 13), 1); });
  it('lcm(4, 6) = 12', () => { assert.equal(lcm(4, 6), 12); });
  it('lcm(3, 7) = 21', () => { assert.equal(lcm(3, 7), 21); });
});

describe('isPrime', () => {
  it('2 is prime', () => { assert.ok(isPrime(2)); });
  it('3 is prime', () => { assert.ok(isPrime(3)); });
  it('4 is not', () => { assert.ok(!isPrime(4)); });
  it('97 is prime', () => { assert.ok(isPrime(97)); });
  it('1 is not', () => { assert.ok(!isPrime(1)); });
});

describe('sieve', () => {
  it('primes up to 20', () => { assert.deepStrictEqual(sieve(20), [2,3,5,7,11,13,17,19]); });
  it('primes up to 10', () => { assert.deepStrictEqual(sieve(10), [2,3,5,7]); });
  it('count primes up to 100', () => { assert.equal(sieve(100).length, 25); });
});

describe('power', () => {
  it('2^10 = 1024', () => { assert.equal(power(2, 10), 1024); });
  it('3^0 = 1', () => { assert.equal(power(3, 0), 1); });
  it('2^-1 = 0.5', () => { assert.equal(power(2, -1), 0.5); });
});

describe('modPow', () => {
  it('2^10 mod 1000', () => { assert.equal(modPow(2, 10, 1000), 24); });
  it('3^100 mod 17', () => { assert.equal(modPow(3, 100, 17), 13); });
});

describe('sqrt', () => {
  it('sqrt(4) = 2', () => { assert.ok(approx(sqrt(4), 2)); });
  it('sqrt(2)', () => { assert.ok(approx(sqrt(2), 1.41421356)); });
  it('sqrt(0) = 0', () => { assert.equal(sqrt(0), 0); });
  it('sqrt(-1) = NaN', () => { assert.ok(isNaN(sqrt(-1))); });
});

describe('combinations/permutations', () => {
  it('C(5,2) = 10', () => { assert.equal(combinations(5, 2), 10); });
  it('C(10,3) = 120', () => { assert.equal(combinations(10, 3), 120); });
  it('P(5,2) = 20', () => { assert.equal(permutations(5, 2), 20); });
  it('binomial = combinations', () => { assert.equal(binomial(6, 3), combinations(6, 3)); });
  it('C(5,6) = 0', () => { assert.equal(combinations(5, 6), 0); });
});

describe('catalan', () => {
  it('catalan(0) = 1', () => { assert.equal(catalan(0), 1); });
  it('catalan(3) = 5', () => { assert.equal(catalan(3), 5); });
  it('catalan(5) = 42', () => { assert.equal(catalan(5), 42); });
});

describe('utility', () => {
  it('abs', () => { assert.equal(abs(-5), 5); assert.equal(abs(5), 5); });
  it('clamp', () => { assert.equal(clamp(5, 0, 10), 5); assert.equal(clamp(-5, 0, 10), 0); assert.equal(clamp(15, 0, 10), 10); });
  it('lerp', () => { assert.equal(lerp(0, 10, 0.5), 5); });
  it('degToRad', () => { assert.ok(approx(degToRad(180), Math.PI)); });
  it('radToDeg', () => { assert.ok(approx(radToDeg(Math.PI), 180)); });
});

describe('statistics', () => {
  it('mean', () => { assert.equal(mean([1,2,3,4,5]), 3); });
  it('median odd', () => { assert.equal(median([3,1,2]), 2); });
  it('median even', () => { assert.equal(median([1,2,3,4]), 2.5); });
  it('variance', () => { assert.equal(variance([2,4,4,4,5,5,7,9]), 4); });
  it('stddev', () => { assert.equal(stddev([2,4,4,4,5,5,7,9]), 2); });
});
