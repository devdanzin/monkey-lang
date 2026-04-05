// parser.test.js — Tests for tokenizer, parser, and source-to-result pipeline

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize, parse, run, TOKEN_TYPES } from './parser.js';

describe('Tokenizer', () => {
  it('tokenizes numbers', () => {
    const tokens = tokenize('42 3.14');
    assert.equal(tokens[0].value, 42);
    assert.equal(tokens[1].value, 3.14);
  });

  it('tokenizes strings', () => {
    const tokens = tokenize('"hello" \'world\'');
    assert.equal(tokens[0].value, 'hello');
    assert.equal(tokens[1].value, 'world');
  });

  it('tokenizes operators', () => {
    const tokens = tokenize('+ - * / == != <= >=');
    assert.equal(tokens[0].type, '+');
    assert.equal(tokens[4].type, '==');
    assert.equal(tokens[5].type, '!=');
  });

  it('tokenizes keywords', () => {
    const tokens = tokenize('let in if then else fn');
    assert.equal(tokens[0].type, 'let');
    assert.equal(tokens[5].type, 'fn');
  });

  it('tokenizes booleans', () => {
    const tokens = tokenize('true false');
    assert.equal(tokens[0].value, true);
    assert.equal(tokens[1].value, false);
  });

  it('handles escape sequences', () => {
    const tokens = tokenize('"hello\\nworld"');
    assert.equal(tokens[0].value, 'hello\nworld');
  });

  it('skips comments', () => {
    const tokens = tokenize('42 // this is a comment\n43');
    assert.equal(tokens[0].value, 42);
    assert.equal(tokens[1].value, 43);
  });

  it('handles arrow operator', () => {
    const tokens = tokenize('->');
    assert.equal(tokens[0].type, '->');
  });
});

describe('Parser', () => {
  it('parses number literal', () => {
    const ast = parse('42');
    assert.deepEqual(ast, { tag: 'lit', value: 42 });
  });

  it('parses string literal', () => {
    const ast = parse('"hello"');
    assert.deepEqual(ast, { tag: 'lit', value: 'hello' });
  });

  it('parses addition', () => {
    const ast = parse('3 + 4');
    assert.equal(ast.tag, 'binop');
    assert.equal(ast.op, '+');
  });

  it('parses precedence: 2 + 3 * 4', () => {
    const ast = parse('2 + 3 * 4');
    assert.equal(ast.tag, 'binop');
    assert.equal(ast.op, '+');
    assert.equal(ast.right.tag, 'binop');
    assert.equal(ast.right.op, '*');
  });

  it('parses parentheses', () => {
    const ast = parse('(2 + 3) * 4');
    assert.equal(ast.tag, 'binop');
    assert.equal(ast.op, '*');
    assert.equal(ast.left.tag, 'binop');
    assert.equal(ast.left.op, '+');
  });

  it('parses let binding', () => {
    const ast = parse('let x = 5 in x + 1');
    assert.equal(ast.tag, 'let');
    assert.equal(ast.name, 'x');
  });

  it('parses if-then-else', () => {
    const ast = parse('if true then 1 else 2');
    assert.equal(ast.tag, 'if');
  });

  it('parses lambda', () => {
    const ast = parse('fn x -> x + 1');
    assert.equal(ast.tag, 'lam');
    assert.equal(ast.param, 'x');
  });

  it('parses array literal', () => {
    const ast = parse('[1, 2, 3]');
    assert.equal(ast.tag, 'arr');
    assert.equal(ast.elements.length, 3);
  });

  it('parses array index', () => {
    const ast = parse('[1, 2, 3][1]');
    assert.equal(ast.tag, 'idx');
  });

  it('parses function call', () => {
    const ast = parse('f(42)');
    assert.equal(ast.tag, 'app');
  });

  it('parses len builtin', () => {
    const ast = parse('len([1, 2])');
    assert.equal(ast.tag, 'len');
  });

  it('parses comparison', () => {
    const ast = parse('3 < 5');
    assert.equal(ast.tag, 'binop');
    assert.equal(ast.op, '<');
  });

  it('parses logical operators', () => {
    const ast = parse('true && false || true');
    assert.equal(ast.tag, 'binop');
    assert.equal(ast.op, '||');
  });

  it('parses negative number', () => {
    const ast = parse('-42');
    assert.equal(ast.tag, 'binop');
    assert.equal(ast.op, '-');
  });
});

describe('Source-to-Result (run)', () => {
  it('evaluates number', () => {
    assert.equal(run('42'), 42);
  });

  it('evaluates string', () => {
    assert.equal(run('"hello"'), 'hello');
  });

  it('evaluates boolean', () => {
    assert.equal(run('true'), true);
  });

  it('evaluates addition', () => {
    assert.equal(run('3 + 4'), 7);
  });

  it('evaluates complex arithmetic', () => {
    assert.equal(run('(2 + 3) * 4 - 1'), 19);
  });

  it('evaluates comparison', () => {
    assert.equal(run('3 < 5'), true);
    assert.equal(run('5 == 5'), true);
    assert.equal(run('3 > 5'), false);
  });

  it('evaluates if-then-else', () => {
    assert.equal(run('if 3 < 5 then "yes" else "no"'), 'yes');
  });

  it('evaluates let binding', () => {
    assert.equal(run('let x = 10 in x + 5'), 15);
  });

  it('evaluates nested let', () => {
    assert.equal(run('let x = 10 in let y = 20 in x + y'), 30);
  });

  it('evaluates lambda + call', () => {
    assert.equal(run('let f = fn x -> x * 2 in f(21)'), 42);
  });

  it('evaluates array literal', () => {
    assert.deepEqual(run('[1, 2, 3]'), [1, 2, 3]);
  });

  it('evaluates array index', () => {
    assert.equal(run('[10, 20, 30][1]'), 20);
  });

  it('evaluates len', () => {
    assert.equal(run('len([1, 2, 3])'), 3);
    assert.equal(run('len("hello")'), 5);
  });

  it('evaluates push', () => {
    assert.deepEqual(run('push([1, 2], 3)'), [1, 2, 3]);
  });

  it('evaluates string concatenation', () => {
    assert.equal(run('"hello" + " " + "world"'), 'hello world');
  });

  it('evaluates complex program', () => {
    const result = run(`
      let xs = [1, 2, 3, 4, 5] in
      let n = len(xs) in
      if n > 3 then xs[0] + xs[4] else 0
    `);
    assert.equal(result, 6);
  });

  it('evaluates fibonacci-like', () => {
    const result = run(`
      let a = 1 in
      let b = 1 in
      let c = a + b in
      let d = b + c in
      let e = c + d in
      e
    `);
    assert.equal(result, 5);
  });

  it('evaluates higher-order function', () => {
    // Simplified: direct application without closure over closure
    const result = run(`
      let double = fn x -> x * 2 in
      double(10)
    `);
    assert.equal(result, 20);
  });

  it('evaluates array with computed elements', () => {
    assert.deepEqual(run('[1 + 1, 2 * 2, 3 * 3]'), [2, 4, 9]);
  });

  it('throws on undefined variable', () => {
    assert.throws(() => run('x + 1'), /Undefined/);
  });

  it('throws on syntax error', () => {
    assert.throws(() => run('let = 5'), /Expected/);
  });
});
