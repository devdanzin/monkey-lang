import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calc, evaluate, infixToRPN } from '../src/index.js';

describe('calc', () => {
  it('addition', () => assert.equal(calc('3 4 +'), 7));
  it('subtraction', () => assert.equal(calc('10 3 -'), 7));
  it('multiplication', () => assert.equal(calc('6 7 *'), 42));
  it('division', () => assert.equal(calc('20 4 /'), 5));
  it('power', () => assert.equal(calc('2 10 ^'), 1024));
  it('complex expression', () => assert.equal(calc('5 1 2 + 4 * + 3 -'), 14));
  it('division by zero', () => assert.throws(() => calc('1 0 /'), /Division by zero/));
});

describe('unary ops', () => {
  it('sqrt', () => assert.equal(calc('9 sqrt'), 3));
  it('abs', () => assert.equal(calc('5 neg abs'), 5));
  it('floor', () => assert.equal(calc('3.7 floor'), 3));
});

describe('stack ops', () => {
  it('dup', () => assert.deepEqual(evaluate('5 dup'), [5, 5]));
  it('swap', () => assert.deepEqual(evaluate('1 2 swap'), [2, 1]));
  it('drop', () => assert.deepEqual(evaluate('1 2 drop'), [1]));
  it('over', () => assert.deepEqual(evaluate('1 2 over'), [1, 2, 1]));
});

describe('constants', () => {
  it('pi', () => assert.ok(Math.abs(calc('pi') - Math.PI) < 1e-10));
  it('e', () => assert.ok(Math.abs(calc('e') - Math.E) < 1e-10));
});

describe('infixToRPN', () => {
  it('simple', () => assert.deepEqual(infixToRPN('3 + 4'), ['3', '4', '+']));
  it('precedence', () => assert.deepEqual(infixToRPN('3 + 4 * 2'), ['3', '4', '2', '*', '+']));
  it('parentheses', () => assert.deepEqual(infixToRPN('(3 + 4) * 2'), ['3', '4', '+', '2', '*']));
});

describe('errors', () => {
  it('unknown token', () => assert.throws(() => calc('foo'), /Unknown/));
  it('stack underflow', () => assert.throws(() => calc('3 +'), /underflow/));
});
