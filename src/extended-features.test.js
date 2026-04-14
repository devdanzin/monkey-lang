// extended-features.test.js — Tests for all extended Monkey features
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import { monkeyEval } from './evaluator.js';
import { Environment, NULL } from './object.js';

function run(input) {
  const l = new Lexer(input);
  const p = new Parser(l);
  return monkeyEval(p.parseProgram(), new Environment());
}

describe('Extended Language Features', () => {
  describe('Comparison operators', () => {
    it('>= works', () => assert.equal(run('5 >= 5').inspect(), 'true'));
    it('<= works', () => assert.equal(run('5 <= 6').inspect(), 'true'));
    it('>= false', () => assert.equal(run('4 >= 5').inspect(), 'false'));
    it('<= false', () => assert.equal(run('6 <= 5').inspect(), 'false'));
  });

  describe('Logical operators', () => {
    it('&& true', () => assert.equal(run('true && true').inspect(), 'true'));
    it('&& false', () => assert.equal(run('true && false').inspect(), 'false'));
    it('|| true', () => assert.equal(run('false || true').inspect(), 'true'));
    it('|| false', () => assert.equal(run('false || false').inspect(), 'false'));
    it('short-circuit &&', () => assert.equal(run('false && (1/0)').inspect(), 'false'));
  });

  describe('String operations', () => {
    it('escape newline', () => assert.equal(run('len("a\\nb")').value, 3));
    it('string ==', () => assert.equal(run('"hello" == "hello"').inspect(), 'true'));
    it('string !=', () => assert.equal(run('"a" != "b"').inspect(), 'true'));
    it('string <', () => assert.equal(run('"abc" < "abd"').inspect(), 'true'));
    it('string *', () => assert.equal(run('"ha" * 3').value, 'hahaha'));
    it('split', () => assert.equal(run('len(split("a,b,c", ","))').value, 3));
    it('join', () => assert.equal(run('join(["a","b"], "-")').value, 'a-b'));
    it('trim', () => assert.equal(run('trim("  hi  ")').value, 'hi'));
    it('upper/lower', () => {
      assert.equal(run('upper("hello")').value, 'HELLO');
      assert.equal(run('lower("HELLO")').value, 'hello');
    });
  });

  describe('Array features', () => {
    it('negative index', () => assert.equal(run('[1,2,3][-1]').value, 3));
    it('negative index -2', () => assert.equal(run('[1,2,3][-2]').value, 2));
    it('slice [1:3]', () => assert.equal(run('len([1,2,3,4,5][1:3])').value, 2));
    it('slice [:2]', () => assert.equal(run('[1,2,3][:2]').inspect(), '[1, 2]'));
    it('slice [1:]', () => assert.equal(run('[1,2,3][1:]').inspect(), '[2, 3]'));
    it('sort', () => assert.equal(run('sort([3,1,2])').inspect(), '[1, 2, 3]'));
  });

  describe('Hash features', () => {
    it('keys', () => assert.equal(run('len(keys({"a": 1, "b": 2}))').value, 2));
    it('values', () => assert.equal(run('len(values({"a": 1, "b": 2}))').value, 2));
  });

  describe('Control flow', () => {
    it('while loop', () => assert.equal(run('let x = 0; while (x < 5) { set x = x + 1; } x').value, 5));
    it('for loop', () => assert.equal(run('let s = 0; for (let i = 0; i < 5; set i = i + 1) { set s = s + i; } s').value, 10));
    it('do/while', () => assert.equal(run('let x = 10; do { set x = x + 1; } while (false); x').value, 11));
    it('break', () => assert.equal(run('let x = 0; while (true) { set x = x + 1; if (x >= 3) { break; } } x').value, 3));
    it('continue', () => assert.equal(run('let s = 0; for (let i = 0; i < 5; set i = i + 1) { if (i == 2) { continue; } set s = s + i; } s').value, 8));
    it('for-in array', () => assert.equal(run('let s = 0; for (x in [1,2,3]) { set s = s + x; } s').value, 6));
    it('for-in with break', () => assert.equal(run('let s = 0; for (x in [1,2,3,4,5]) { if (x > 3) { break; } set s = s + x; } s').value, 6));
  });

  describe('Switch/case', () => {
    it('matches case', () => assert.equal(run('switch (2) { case 1: { "one" } case 2: { "two" } }').value, 'two'));
    it('default', () => assert.equal(run('switch (99) { case 1: { "one" } default: { "other" } }').value, 'other'));
    it('string match', () => assert.equal(run('switch ("hi") { case "hi": { 1 } case "bye": { 2 } }').value, 1));
  });

  describe('Ternary', () => {
    it('true branch', () => assert.equal(run('true ? 1 : 2').value, 1));
    it('false branch', () => assert.equal(run('false ? 1 : 2').value, 2));
    it('expression cond', () => assert.equal(run('5 > 3 ? "yes" : "no"').value, 'yes'));
  });

  describe('Try/catch', () => {
    it('catches error', () => assert.equal(run('try { 1 + true } catch (e) { "caught" }').value, 'caught'));
    it('throw/catch', () => assert.equal(run('try { throw "oops" } catch (e) { e }').value, 'oops'));
    it('no error', () => assert.equal(run('try { 42 } catch (e) { 0 }').value, 42));
  });

  describe('Higher-order functions', () => {
    it('map', () => assert.equal(run('map([1,2,3], fn(x) { x * 2 })').inspect(), '[2, 4, 6]'));
    it('filter', () => assert.equal(run('filter([1,2,3,4], fn(x) { x > 2 })').inspect(), '[3, 4]'));
    it('reduce', () => assert.equal(run('reduce([1,2,3], 0, fn(a,b) { a + b })').value, 6));
    it('sort with comparator', () => assert.equal(run('sort([1,3,2], fn(a,b) { b - a })').inspect(), '[3, 2, 1]'));
  });

  describe('Modules', () => {
    it('import math', () => {
      const r = run('let m = import("math"); m["abs"](-5)');
      assert.equal(r.value, 5);
    });
    it('import strings', () => {
      const r = run('let s = import("strings"); s["reverse"]("abc")');
      assert.equal(r.value, 'cba');
    });
  });

  describe('Range and format', () => {
    it('range(5)', () => assert.equal(run('len(range(5))').value, 5));
    it('range(1,5)', () => assert.equal(run('range(1,5)').inspect(), '[1, 2, 3, 4]'));
    it('format', () => assert.equal(run('format("Hello %s!", "world")').value, 'Hello world!'));
    it('int parse', () => assert.equal(run('int("42")').value, 42));
    it('str convert', () => assert.equal(run('str(42)').value, '42'));
  });
});
