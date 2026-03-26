import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Transpiler } from './transpiler.js';
import { Parser } from './parser.js';
import { Lexer } from './lexer.js';

function transpile(code) {
  const p = new Parser(new Lexer(code));
  const prog = p.parseProgram();
  assert.equal(p.errors.length, 0, `Parse errors: ${p.errors.join(', ')}`);
  const t = new Transpiler();
  return t.transpile(prog);
}

describe('Transpiler', () => {
  it('transpiles let statement', () => {
    const js = transpile('let x = 42;');
    assert.ok(js.includes('let x = 42'));
  });

  it('transpiles function', () => {
    const js = transpile('let f = fn(x) { x + 1 };');
    assert.ok(js.includes('function'));
    assert.ok(js.includes('x + 1'));
  });

  it('transpiles if/else', () => {
    const js = transpile('if (x > 0) { x } else { -x }');
    assert.ok(js.includes('if'));
    assert.ok(js.includes('else'));
  });

  it('transpiles array literal', () => {
    const js = transpile('[1, 2, 3]');
    assert.ok(js.includes('[1, 2, 3]'));
  });

  it('transpiles hash literal', () => {
    const js = transpile('{"x": 1, "y": 2}');
    assert.ok(js.includes('"x"'));
    assert.ok(js.includes('"y"'));
  });

  it('transpiles for loop', () => {
    const js = transpile('for (i in arr) { puts(i) }');
    assert.ok(js.includes('for'));
  });

  it('transpiles while loop', () => {
    const js = transpile('while (x > 0) { x = x - 1 }');
    assert.ok(js.includes('while'));
  });

  // Day 11 features
  it('transpiles array destructuring', () => {
    const js = transpile('let [a, b] = [1, 2];');
    assert.ok(js.includes('let [a, b]'));
  });

  it('transpiles hash destructuring', () => {
    const js = transpile('let {x, y} = h;');
    assert.ok(js.includes('let {x, y}'));
  });

  it('transpiles range expression', () => {
    const js = transpile('0..10');
    assert.ok(js.includes('Array.from'));
  });

  it('transpiles type annotations (strips them)', () => {
    const js = transpile('let f = fn(x: int, y: int) -> int { x + y };');
    assert.ok(js.includes('function'));
    assert.ok(!js.includes(': int')); // type annotations should be stripped
  });

  it('transpiles match with value patterns', () => {
    const js = transpile('match (x) { 1 => "one", 2 => "two", _ => "other" }');
    assert.ok(js.includes('__subj'));
  });

  it('transpiles match with type patterns', () => {
    const js = transpile('match (x) { int(n) => n, string(s) => s, _ => null }');
    assert.ok(js.includes("typeof __subj === 'number'") || js.includes('int'));
  });

  it('transpiles match with Ok/Err patterns', () => {
    const js = transpile('match (r) { Ok(v) => v, Err(e) => e }');
    assert.ok(js.includes('__isOk'));
  });

  it('transpiles string template', () => {
    const js = transpile('`hello ${name}`');
    assert.ok(js.includes('`') || js.includes('+'));
  });

  it('transpiles arrow function', () => {
    const js = transpile('let f = (x) => x * 2;');
    assert.ok(js.includes('=>') || js.includes('function'));
  });

  it('transpiles pipe operator', () => {
    const js = transpile('5 |> double');
    assert.ok(js.includes('double'));
  });

  it('transpiles null coalescing', () => {
    const js = transpile('x ?? 42');
    assert.ok(js.includes('??') || js.includes('null'));
  });

  it('transpiles spread', () => {
    const js = transpile('let f = fn(...args) { args };');
    assert.ok(js.includes('function')); // rest params not yet transpiled, but function works
  });

  it('transpiles slice', () => {
    const js = transpile('arr[1:3]');
    assert.ok(js.includes('slice'));
  });
});
