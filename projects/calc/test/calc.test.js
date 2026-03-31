import { describe, it } from 'node:test'; import assert from 'node:assert/strict';
import { evaluate } from '../src/index.js';
describe('basic', () => {
  it('addition', () => assert.equal(evaluate('2 + 3'), 5));
  it('subtraction', () => assert.equal(evaluate('10 - 3'), 7));
  it('multiplication', () => assert.equal(evaluate('4 * 5'), 20));
  it('division', () => assert.equal(evaluate('15 / 3'), 5));
  it('modulo', () => assert.equal(evaluate('10 % 3'), 1));
  it('power', () => assert.equal(evaluate('2 ^ 10'), 1024));
  it('precedence', () => assert.equal(evaluate('2 + 3 * 4'), 14));
  it('parentheses', () => assert.equal(evaluate('(2 + 3) * 4'), 20));
  it('nested parens', () => assert.equal(evaluate('((2 + 3) * (4 - 1))'), 15));
  it('unary minus', () => assert.equal(evaluate('-5 + 3'), -2));
});
describe('functions', () => {
  it('sqrt', () => assert.equal(evaluate('sqrt(9)'), 3));
  it('abs', () => assert.equal(evaluate('abs(-5)'), 5));
  it('min', () => assert.equal(evaluate('min(3, 7)'), 3));
  it('max', () => assert.equal(evaluate('max(3, 7)'), 7));
});
describe('variables', () => {
  it('basic', () => assert.equal(evaluate('x + 1', { x: 5 }), 6));
  it('pi', () => assert.ok(Math.abs(evaluate('pi') - Math.PI) < 1e-10));
});
describe('errors', () => {
  it('division by zero', () => assert.throws(() => evaluate('1 / 0'), /Division/));
  it('unknown var', () => assert.throws(() => evaluate('x'), /Unknown/));
});
