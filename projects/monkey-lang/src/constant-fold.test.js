import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import * as ast from './ast.js';
import { constantFold } from './constant-fold.js';

function fold(input) {
  const program = new Parser(new Lexer(input)).parseProgram();
  constantFold(program);
  const last = program.statements[program.statements.length - 1];
  return last.expression || last;
}

describe('Constant Folding', () => {
  describe('integer arithmetic', () => {
    it('folds addition', () => {
      const r = fold('2 + 3');
      assert.ok(r instanceof ast.IntegerLiteral);
      assert.equal(r.value, 5);
    });
    it('folds subtraction', () => {
      const r = fold('10 - 3');
      assert.equal(r.value, 7);
    });
    it('folds multiplication', () => {
      const r = fold('4 * 5');
      assert.equal(r.value, 20);
    });
    it('folds division', () => {
      const r = fold('10 / 3');
      assert.equal(r.value, 3);
    });
    it('folds modulo', () => {
      const r = fold('10 % 3');
      assert.equal(r.value, 1);
    });
    it('folds nested arithmetic', () => {
      const r = fold('(2 + 3) * (4 - 1)');
      assert.equal(r.value, 15);
    });
    it('does not divide by zero', () => {
      const r = fold('10 / 0');
      assert.ok(r instanceof ast.InfixExpression);
    });
  });

  describe('comparisons', () => {
    it('folds less than', () => {
      const r = fold('1 < 2');
      assert.ok(r instanceof ast.BooleanLiteral);
      assert.equal(r.value, true);
    });
    it('folds equality', () => {
      const r = fold('5 == 5');
      assert.equal(r.value, true);
    });
    it('folds inequality', () => {
      const r = fold('3 != 4');
      assert.equal(r.value, true);
    });
  });

  describe('string operations', () => {
    it('folds string concatenation', () => {
      const r = fold('"hello" + " world"');
      assert.ok(r instanceof ast.StringLiteral);
      assert.equal(r.value, 'hello world');
    });
    it('folds string equality', () => {
      const r = fold('"abc" == "abc"');
      assert.equal(r.value, true);
    });
  });

  describe('prefix operations', () => {
    it('folds negation', () => {
      const r = fold('-5');
      assert.equal(r.value, -5);
    });
    it('folds boolean not', () => {
      const r = fold('!true');
      assert.equal(r.value, false);
    });
    it('folds integer not', () => {
      const r = fold('!0');
      assert.equal(r.value, true);
    });
  });

  describe('identity optimizations', () => {
    it('x + 0 → x', () => {
      const r = fold('let x = 5; x + 0');
      assert.ok(r instanceof ast.Identifier);
    });
    it('x * 1 → x', () => {
      const r = fold('let x = 5; x * 1');
      assert.ok(r instanceof ast.Identifier);
    });
    it('x * 0 → 0', () => {
      const r = fold('let x = 5; x * 0');
      assert.equal(r.value, 0);
    });
    it('0 + x → x', () => {
      const r = fold('let x = 5; 0 + x');
      assert.ok(r instanceof ast.Identifier);
    });
  });

  describe('boolean operations', () => {
    it('folds && ', () => {
      const r = fold('true && false');
      assert.equal(r.value, false);
    });
    it('folds ||', () => {
      const r = fold('false || true');
      assert.equal(r.value, true);
    });
  });

  describe('dead branch elimination', () => {
    it('eliminates false branch', () => {
      const r = fold('if (true) { 42 } else { 99 }');
      // Should be reduced to the consequence block
      assert.ok(r instanceof ast.BlockStatement);
    });
    it('eliminates true branch', () => {
      const r = fold('if (false) { 42 } else { 99 }');
      assert.ok(r instanceof ast.BlockStatement);
    });
  });

  describe('preserves non-constant expressions', () => {
    it('does not fold variable expressions', () => {
      const r = fold('let x = 5; x + 1');
      assert.ok(r instanceof ast.InfixExpression);
    });
    it('does not fold function calls', () => {
      const r = fold('len([1, 2, 3])');
      assert.ok(r instanceof ast.CallExpression);
    });
  });
});
