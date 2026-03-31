import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import { TypeInference, Types, TypeEnv } from './type-inference.js';

function inferTypes(input) {
  const lexer = new Lexer(input);
  const parser = new Parser(lexer);
  const program = parser.parseProgram();
  if (parser.errors.length > 0) throw new Error(parser.errors.join(', '));
  const ti = new TypeInference();
  ti.infer(program);
  return { program, ti };
}

function exprType(input) {
  const { program } = inferTypes(input);
  const lastStmt = program.statements[program.statements.length - 1];
  return lastStmt.inferredType || lastStmt.expression?.inferredType;
}

describe('Type Inference', () => {
  describe('literals', () => {
    it('integer literals', () => assert.equal(exprType('42'), Types.INT));
    it('boolean literals', () => assert.equal(exprType('true'), Types.BOOL));
    it('string literals', () => assert.equal(exprType('"hello"'), Types.STRING));
    it('array literals', () => assert.equal(exprType('[1, 2, 3]'), Types.ARRAY));
    it('hash literals', () => assert.equal(exprType('{1: 2}'), Types.HASH));
  });

  describe('variables', () => {
    it('infers type from assignment', () => {
      assert.equal(exprType('let x = 42; x'), Types.INT);
    });
    it('infers string from assignment', () => {
      assert.equal(exprType('let s = "hello"; s'), Types.STRING);
    });
    it('infers array from assignment', () => {
      assert.equal(exprType('let a = [1, 2]; a'), Types.ARRAY);
    });
    it('unknown for undefined variable', () => {
      assert.equal(exprType('x'), Types.UNKNOWN);
    });
  });

  describe('operators', () => {
    it('arithmetic → int', () => assert.equal(exprType('1 + 2'), Types.INT));
    it('string concat → string', () => assert.equal(exprType('"a" + "b"'), Types.STRING));
    it('comparison → bool', () => assert.equal(exprType('1 < 2'), Types.BOOL));
    it('equality → bool', () => assert.equal(exprType('1 == 2'), Types.BOOL));
    it('negation → int', () => assert.equal(exprType('-5'), Types.INT));
    it('not → bool', () => assert.equal(exprType('!true'), Types.BOOL));
    it('logical → bool', () => assert.equal(exprType('true && false'), Types.BOOL));
  });

  describe('functions', () => {
    it('function literal → function', () => {
      assert.equal(exprType('fn(x) { x + 1 }'), Types.FUNCTION);
    });
    it('len() → int', () => assert.equal(exprType('len([1, 2])'), Types.INT));
    it('str() → string', () => assert.equal(exprType('str(42)'), Types.STRING));
    it('push() → array', () => assert.equal(exprType('push([1], 2)'), Types.ARRAY));
    it('type() → string', () => assert.equal(exprType('type(42)'), Types.STRING));
  });

  describe('if expressions', () => {
    it('same branch types → that type', () => {
      assert.equal(exprType('if (true) { 1 } else { 2 }'), Types.INT);
    });
    it('different branch types → unknown', () => {
      assert.equal(exprType('if (true) { 1 } else { "hello" }'), Types.UNKNOWN);
    });
  });

  describe('index expressions', () => {
    it('string index → string', () => {
      assert.equal(exprType('let s = "hello"; s[0]'), Types.STRING);
    });
    it('array index → unknown', () => {
      assert.equal(exprType('let a = [1, 2]; a[0]'), Types.UNKNOWN);
    });
  });

  describe('warnings', () => {
    it('warns on arithmetic with non-integer', () => {
      const { ti } = inferTypes('let s = "hello"; s - 1');
      assert.ok(ti.warnings.length > 0);
    });
    it('warns on negation of non-integer', () => {
      const { ti } = inferTypes('let s = "hello"; -s');
      assert.ok(ti.warnings.length > 0);
    });
  });

  describe('TypeEnv', () => {
    it('child inherits parent bindings', () => {
      const parent = new TypeEnv();
      parent.set('x', Types.INT);
      const child = parent.child();
      assert.equal(child.get('x'), Types.INT);
    });
    it('child shadows parent', () => {
      const parent = new TypeEnv();
      parent.set('x', Types.INT);
      const child = parent.child();
      child.set('x', Types.STRING);
      assert.equal(child.get('x'), Types.STRING);
      assert.equal(parent.get('x'), Types.INT);
    });
  });
});
