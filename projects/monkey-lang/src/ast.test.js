// AST round-trip tests
//
// Verifies that AST node toString() methods produce source that re-parses
// into a structurally equivalent AST. The check is "fixed-point on the
// second serialization": parse → toString → parse → toString and assert
// the two toString outputs match. This proves the serialization is a
// stable round-trip: any further parse/serialize cycle produces no drift.

import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

function parse(input) {
  const l = new Lexer(input);
  const p = new Parser(l);
  const program = p.parseProgram();
  if (p.errors.length > 0) {
    throw new Error(`Parser errors for ${JSON.stringify(input)}:\n${p.errors.join('\n')}`);
  }
  return program;
}

function assertRoundTrip(input) {
  const prog1 = parse(input);
  const s1 = prog1.toString();
  let prog2;
  try {
    prog2 = parse(s1);
  } catch (e) {
    throw new Error(
      `Round-trip failed: serialization did not re-parse.\n` +
      `  input:        ${JSON.stringify(input)}\n` +
      `  serialized:   ${JSON.stringify(s1)}\n` +
      `  parser error: ${e.message}`
    );
  }
  const s2 = prog2.toString();
  assert.equal(
    s1, s2,
    `Round-trip diverged at fixed point.\n` +
    `  input: ${JSON.stringify(input)}\n` +
    `  s1:    ${JSON.stringify(s1)}\n` +
    `  s2:    ${JSON.stringify(s2)}`
  );
}

describe('AST round-trip', () => {
  describe('basic statements', () => {
    const cases = [
      'let x = 5;',
      'const y = 42;',
      'let foo = bar;',
      'return 1;',
      'return x + y;',
      '5;',
      'foo;',
      'true;',
      'false;',
      'null;',
    ];
    for (const c of cases) {
      it(c, () => assertRoundTrip(c));
    }
  });

  describe('arithmetic and operator precedence', () => {
    const cases = [
      '1 + 2;',
      '1 + 2 * 3;',
      '(1 + 2) * 3;',
      '-a * b;',
      'a + b + c;',
      'a + b * c + d / e - f;',
      'a < b == c > d;',
      '!true == false;',
      '5 % 2;',
    ];
    for (const c of cases) {
      it(c, () => assertRoundTrip(c));
    }
  });

  describe('strings with escapes', () => {
    const cases = [
      '"hello";',
      '"";',
      '"tab\\there";',
      '"newline\\nhere";',
      '"quote\\"here";',
      '"backslash\\\\here";',
      '"mixed: \\t\\n\\r\\\\\\"";',
    ];
    for (const c of cases) {
      it(c, () => assertRoundTrip(c));
    }
  });

  describe('arrays and hashes', () => {
    const cases = [
      '[];',
      '[1, 2, 3];',
      '[1, "two", true];',
      '[[1, 2], [3, 4]];',
      '{"a": 1, "b": 2};',
      '{1: "one", 2: "two"};',
      '[1, 2, 3][0];',
      '{"key": "value"}["key"];',
    ];
    for (const c of cases) {
      it(c, () => assertRoundTrip(c));
    }
  });

  describe('functions and calls', () => {
    const cases = [
      'fn(x) { x + 1; };',
      'fn() { return 42; };',
      'fn(x, y) { return x + y; };',
      'let add = fn(a, b) { a + b; }; add(1, 2);',
      'fn(x: int) -> int { x };',
      'fn(x: int, y: string) -> bool { true };',
    ];
    for (const c of cases) {
      it(c, () => assertRoundTrip(c));
    }
  });

  describe('control flow', () => {
    const cases = [
      'if (x > 0) { x };',
      'if (x > 0) { x } else { -x };',
      'if (a < b) { return a; } else { return b; };',
      'while (i < 10) { i = i + 1; };',
      'for (let i = 0; i < 10; i = i + 1) { puts(i); };',
      'for (x in [1, 2, 3]) { puts(x); };',
      'do { i = i + 1; } while (i < 5);',
    ];
    for (const c of cases) {
      it(c, () => assertRoundTrip(c));
    }
  });

  describe('break and continue', () => {
    const cases = [
      'while (true) { break; };',
      'while (true) { continue; };',
      'for (let i = 0; i < 10; i = i + 1) { if (i == 5) { break; }; };',
    ];
    for (const c of cases) {
      it(c, () => assertRoundTrip(c));
    }
  });

  describe('destructuring', () => {
    const cases = [
      'let [a, b] = [1, 2];',
      'let [x, _, z] = [1, 2, 3];',
      'let {a, b} = {"a": 1, "b": 2};',
      'let {x} = {"x": 42};',
    ];
    for (const c of cases) {
      it(c, () => assertRoundTrip(c));
    }
  });

  describe('match expressions', () => {
    const cases = [
      'match (x) { 1 => "one", 2 => "two", _ => "other" };',
      'match (n) { int(i) => i, _ => 0 };',
      'match (v) { 1 | 2 | 3 => "small", _ => "big" };',
      'match (x) { n when n > 0 => "pos", _ => "neg" };',
    ];
    for (const c of cases) {
      it(c, () => assertRoundTrip(c));
    }
  });

  describe('template literals', () => {
    const cases = [
      '`hello`;',
      '`hello ${name}`;',
      '`${a} + ${b} = ${a + b}`;',
      '`literal $ dollar`;',
    ];
    for (const c of cases) {
      it(c, () => assertRoundTrip(c));
    }
  });

  describe('miscellaneous expressions', () => {
    const cases = [
      'x ? y : z;',
      'a == b ? "yes" : "no";',
      'arr[0:5];',
      'arr[1:];',
      'arr[:5];',
      'a..b;',
      '1..10;',
      'a ?? b;',
      'a?.[b];',
      'f(...args);',
      '[...xs, ...ys];',
    ];
    for (const c of cases) {
      it(c, () => assertRoundTrip(c));
    }
  });

  describe('compound assignment', () => {
    const cases = [
      'let x = 0; x += 1;',
      'let x = 10; x -= 1;',
      'let x = 5; x *= 2;',
      'let x = 100; x /= 5;',
    ];
    for (const c of cases) {
      it(c, () => assertRoundTrip(c));
    }
  });

  describe('imports and enums', () => {
    const cases = [
      'import "math";',
      'import "math" as m;',
      'import "math" for sin, cos;',
      'enum Color { Red, Green, Blue };',
    ];
    for (const c of cases) {
      it(c, () => assertRoundTrip(c));
    }
  });

  describe('nested complex programs', () => {
    const cases = [
      // Recursive fibonacci
      'let fib = fn(n) { if (n < 2) { return n; } return fib(n - 1) + fib(n - 2); }; puts(fib(10));',
      // Closure
      'let counter = fn() { let n = 0; fn() { n = n + 1; n } }; let c = counter(); puts(c());',
      // Higher-order
      'let map = fn(arr, f) { let result = []; for (x in arr) { result = push(result, f(x)); }; result }; map([1, 2, 3], fn(x) { x * 2 });',
      // Mixed
      'let xs = [1, 2, 3]; let total = 0; for (x in xs) { total = total + x; }; puts(total);',
    ];
    for (const c of cases) {
      it(c.slice(0, 60) + '...', () => assertRoundTrip(c));
    }
  });
});
