// builtins.test.js — Comprehensive builtin function tests
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import { monkeyEval } from './evaluator.js';
import { Environment, MonkeyInteger, MonkeyString, MonkeyArray, MonkeyError, NULL } from './object.js';
import { Compiler } from './compiler.js';
import { VM } from './vm.js';

function runInterp(input) {
  const l = new Lexer(input);
  const p = new Parser(l);
  return monkeyEval(p.parseProgram(), new Environment());
}

function runVM(input) {
  const l = new Lexer(input);
  const p = new Parser(l);
  const c = new Compiler();
  c.compile(p.parseProgram());
  const vm = new VM(c.bytecode());
  vm.run();
  return vm.lastPoppedStackElem();
}

function both(input) {
  const interp = runInterp(input);
  const vm = runVM(input);
  assert.equal(interp.inspect(), vm.inspect(), `Parity failed for: ${input}`);
  return vm;
}

describe('Builtin functions (comprehensive)', () => {
  describe('len', () => {
    it('string length', () => assert.equal(both('len("hello")').value, 5));
    it('empty string', () => assert.equal(both('len("")').value, 0));
    it('array length', () => assert.equal(both('len([1, 2, 3])').value, 3));
    it('empty array', () => assert.equal(both('len([])').value, 0));
  });

  describe('first', () => {
    it('first of array', () => assert.equal(both('first([1, 2, 3])').value, 1));
    it('first of empty', () => assert.equal(both('first([])'), NULL));
  });

  describe('last', () => {
    it('last of array', () => assert.equal(both('last([1, 2, 3])').value, 3));
    it('last of empty', () => assert.equal(both('last([])'), NULL));
  });

  describe('rest', () => {
    it('rest of array', () => {
      const r = both('rest([1, 2, 3])');
      assert.equal(r.elements.length, 2);
      assert.equal(r.elements[0].value, 2);
    });
    it('rest of empty', () => assert.equal(both('rest([])'), NULL));
    it('rest of single', () => assert.equal(both('len(rest([1]))').value, 0));
  });

  describe('push', () => {
    it('push to array', () => {
      const r = both('push([1, 2], 3)');
      assert.equal(r.elements.length, 3);
      assert.equal(r.elements[2].value, 3);
    });
    it('push to empty', () => {
      const r = both('push([], 1)');
      assert.equal(r.elements.length, 1);
    });
  });

  describe('type', () => {
    it('integer type', () => assert.equal(both('type(42)').value, 'INTEGER'));
    it('string type', () => assert.equal(both('type("hi")').value, 'STRING'));
    it('boolean type', () => assert.equal(both('type(true)').value, 'BOOLEAN'));
    it('array type', () => assert.equal(both('type([])').value, 'ARRAY'));
    it('null type', () => assert.equal(both('type(if (false) { 1 })').value, 'NULL'));
    it('function type', () => {
      const interp = runInterp('type(fn() { 1 })');
      const vm = runVM('type(fn() { 1 })');
      assert.ok(interp.value === 'FUNCTION');
      assert.ok(vm.value === 'CLOSURE');
    });
  });

  describe('str', () => {
    it('integer to string', () => assert.equal(both('str(42)').value, '42'));
    it('string to string', () => assert.equal(both('str("hello")').value, 'hello'));
    it('boolean to string', () => assert.equal(both('str(true)').value, 'true'));
  });

  describe('int', () => {
    it('parse string to int', () => assert.equal(both('int("123")').value, 123));
    it('parse negative', () => assert.equal(both('int("-42")').value, -42));
    it('identity for integer', () => assert.equal(both('int(42)').value, 42));
    it('invalid string returns null', () => assert.equal(both('int("abc")'), NULL));
  });

  describe('format', () => {
    it('string substitution', () => assert.equal(both('format("Hello %s!", "world")').value, 'Hello world!'));
    it('integer substitution', () => assert.equal(both('format("x = %d", 42)').value, 'x = 42'));
    it('multiple substitutions', () => assert.equal(both('format("%s: %d", "score", 100)').value, 'score: 100'));
    it('escaped percent', () => assert.equal(both('format("100%%")').value, '100%'));
  });

  describe('range', () => {
    it('range(5)', () => {
      const r = both('range(5)');
      assert.equal(r.elements.length, 5);
      assert.equal(r.elements[0].value, 0);
      assert.equal(r.elements[4].value, 4);
    });
    it('range(1, 5)', () => {
      const r = both('range(1, 5)');
      assert.equal(r.elements.length, 4);
      assert.equal(r.elements[0].value, 1);
    });
    it('range with step', () => {
      const r = both('range(0, 10, 3)');
      assert.equal(r.elements.length, 4); // 0, 3, 6, 9
    });
    it('range descending', () => {
      const r = both('range(5, 0, -1)');
      assert.equal(r.elements.length, 5); // 5, 4, 3, 2, 1
    });
    it('empty range', () => {
      const r = both('range(0)');
      assert.equal(r.elements.length, 0);
    });
  });
});
