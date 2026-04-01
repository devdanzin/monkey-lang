import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import { getLoopBound, countUnrollable, MAX_UNROLL } from './loop-unroll.js';
import * as ast from './ast.js';

function parse(input) {
  return new Parser(new Lexer(input)).parseProgram();
}

function getFirstFor(prog) {
  for (const stmt of prog.statements) {
    if (stmt.expression instanceof ast.ForExpression) return stmt.expression;
  }
  return null;
}

describe('Loop Unrolling Detection', () => {
  it('detects simple constant-bound loop', () => {
    const prog = parse('for (let i = 0; i < 5; i = i + 1) { puts(i) }');
    const forExpr = getFirstFor(prog);
    assert.equal(getLoopBound(forExpr), 5);
  });

  it('rejects variable-bound loop', () => {
    const prog = parse('let n = 10; for (let i = 0; i < n; i = i + 1) { puts(i) }');
    const forExpr = getFirstFor(prog);
    assert.equal(getLoopBound(forExpr), null);
  });

  it('rejects loop starting from non-zero', () => {
    const prog = parse('for (let i = 1; i < 5; i = i + 1) { puts(i) }');
    const forExpr = getFirstFor(prog);
    assert.equal(getLoopBound(forExpr), null);
  });

  it('rejects loop exceeding MAX_UNROLL', () => {
    const prog = parse(`for (let i = 0; i < ${MAX_UNROLL + 1}; i = i + 1) { puts(i) }`);
    const forExpr = getFirstFor(prog);
    assert.equal(getLoopBound(forExpr), null);
  });

  it('accepts loop at MAX_UNROLL exactly', () => {
    const prog = parse(`for (let i = 0; i < ${MAX_UNROLL}; i = i + 1) { puts(i) }`);
    const forExpr = getFirstFor(prog);
    assert.equal(getLoopBound(forExpr), MAX_UNROLL);
  });

  it('counts unrollable loops in program', () => {
    const prog = parse(`
      for (let i = 0; i < 3; i = i + 1) { puts(i) }
      for (let j = 0; j < 5; j = j + 1) { puts(j) }
      for (let k = 0; k < 100; k = k + 1) { puts(k) }
    `);
    assert.equal(countUnrollable(prog), 2); // k loop too large
  });

  it('detects nested unrollable loops', () => {
    const prog = parse(`
      for (let i = 0; i < 3; i = i + 1) {
        for (let j = 0; j < 4; j = j + 1) {
          puts(i + j)
        }
      }
    `);
    assert.equal(countUnrollable(prog), 2);
  });
});
