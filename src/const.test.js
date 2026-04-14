import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import { monkeyEval } from './evaluator.js';
import { Environment } from './object.js';

function run(input) {
  const l = new Lexer(input);
  const p = new Parser(l);
  const prog = p.parseProgram();
  if (p.errors.length > 0) throw new Error('Parse: ' + p.errors.join(', '));
  return monkeyEval(prog, new Environment());
}

describe('const declarations', () => {
  it('basic const binding', () => {
    const result = run('const x = 42; x');
    assert.equal(result.value, 42);
  });

  it('const with expression', () => {
    const result = run('const x = 2 + 3; x');
    assert.equal(result.value, 5);
  });

  it('const prevents reassignment via set', () => {
    const result = run('const x = 42; set x = 10; x');
    assert.ok(result.inspect().includes('Cannot reassign const'));
  });

  it('const with compound assignment', () => {
    const result = run('const x = 42; set x += 1; x');
    assert.ok(result.inspect().includes('Cannot reassign const'));
  });

  it('let is still mutable', () => {
    const result = run('let x = 42; set x = 10; x');
    assert.equal(result.value, 10);
  });

  it('const in function scope', () => {
    const result = run('let f = fn() { const y = 99; y }; f()');
    assert.equal(result.value, 99);
  });

  it('const does not leak to outer scope', () => {
    const result = run('let f = fn() { const y = 99; y }; f(); y');
    assert.ok(result.inspect().includes('identifier not found'));
  });

  it('const with string', () => {
    const result = run('const greeting = "hello"; greeting');
    assert.equal(result.value, 'hello');
  });

  it('const with array', () => {
    const result = run('const arr = [1, 2, 3]; arr[1]');
    assert.equal(result.value, 2);
  });

  it('const with hash', () => {
    const result = run('const h = {"key": "value"}; h["key"]');
    assert.equal(result.value, 'value');
  });

  it('const toString round-trip', () => {
    const l = new Lexer('const x = 42;');
    const p = new Parser(l);
    const prog = p.parseProgram();
    assert.ok(prog.toString().includes('const'));
  });

  it('multiple const bindings', () => {
    const result = run('const a = 1; const b = 2; const c = a + b; c');
    assert.equal(result.value, 3);
  });
});
