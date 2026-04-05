// parser-compile.test.js — Parser and compilation tests
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { run } from './parser.js';

describe('Parser and Compilation', () => {
  it('integer literal', () => assert.equal(run('42'), 42));
  it('addition', () => assert.equal(run('1 + 2'), 3));
  it('multiplication', () => assert.equal(run('3 * 4'), 12));
  it('subtraction', () => assert.equal(run('10 - 3'), 7));
  it('division', () => assert.equal(run('20 / 4'), 5));
  it('precedence: + vs *', () => assert.equal(run('2 + 3 * 4'), 14));
  it('let expression', () => assert.equal(run('let x = 5 in x + 1'), 6));
  it('nested let', () => assert.equal(run('let x = 1 in let y = 2 in x + y'), 3));
  it('lambda + application', () => assert.equal(run('let f = fn x -> x + 1 in f(5)'), 6));
  it('if true', () => assert.equal(run('if true then 1 else 2'), 1));
  it('if false', () => assert.equal(run('if false then 1 else 2'), 2));
  it('boolean true', () => assert.equal(run('true'), true));
  it('boolean false', () => assert.equal(run('false'), false));
  it('string literal', () => assert.equal(run('"hello"'), 'hello'));
  it('less than', () => assert.equal(run('1 < 2'), true));
  it('equality', () => assert.equal(run('1 == 1'), true));
  it('double function', () => assert.equal(run('let double = fn x -> x * 2 in double(21)'), 42));
  it('modulo', () => assert.equal(run('17 % 5'), 2));
  it('array literal', () => assert.deepEqual(run('[1, 2, 3]'), [1, 2, 3]));
  it('empty array', () => assert.deepEqual(run('[]'), []));
});
