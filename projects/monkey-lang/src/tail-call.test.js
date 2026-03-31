import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import { isTailRecursive, countTailRecursive, optimizeTailCall } from './tail-call.js';
import * as ast from './ast.js';

function parse(input) {
  return new Parser(new Lexer(input)).parseProgram();
}

describe('Tail Call Detection', () => {
  it('detects simple tail recursion', () => {
    const prog = parse(`
      let f = fn(n) {
        if (n == 0) { 0 } else { f(n - 1) }
      }
    `);
    assert.equal(countTailRecursive(prog), 1);
  });

  it('detects factorial tail recursion', () => {
    const prog = parse(`
      let factorial = fn(n, acc) {
        if (n <= 1) { acc } else { factorial(n - 1, n * acc) }
      }
    `);
    assert.equal(countTailRecursive(prog), 1);
  });

  it('does not detect non-tail recursion', () => {
    const prog = parse(`
      let fib = fn(n) {
        if (n < 2) { n } else { fib(n - 1) + fib(n - 2) }
      }
    `);
    // fib(n-1) + fib(n-2) is NOT a tail call (addition after call)
    assert.equal(countTailRecursive(prog), 0);
  });

  it('does not detect non-recursive functions', () => {
    const prog = parse(`
      let add = fn(a, b) { a + b }
    `);
    assert.equal(countTailRecursive(prog), 0);
  });

  it('detects tail call in else branch', () => {
    const prog = parse(`
      let loop = fn(i, max) {
        if (i >= max) { i } else { loop(i + 1, max) }
      }
    `);
    assert.equal(countTailRecursive(prog), 1);
  });

  it('detects tail call with return statement', () => {
    const prog = parse(`
      let f = fn(n) {
        if (n == 0) { return 0 }
        return f(n - 1)
      }
    `);
    assert.equal(countTailRecursive(prog), 1);
  });
});

describe('Tail Call Marking', () => {
  it('marks tail calls on AST nodes', () => {
    const prog = parse(`
      let countdown = fn(n) {
        if (n == 0) { 0 } else { countdown(n - 1) }
      }
    `);
    optimizeTailCall(prog);
    
    // The function should be marked as optimized
    const fn = prog.statements[0].value;
    assert.ok(fn._tailCallOptimized, 'Function should be marked as optimized');
  });

  it('marks the tail call expression', () => {
    const prog = parse(`
      let f = fn(n) {
        if (n == 0) { 0 } else { f(n - 1) }
      }
    `);
    optimizeTailCall(prog);
    
    // Find the tail call in the else branch
    const fn = prog.statements[0].value;
    const ifExpr = fn.body.statements[0].expression;
    const altBlock = ifExpr.alternative;
    const tailCallStmt = altBlock.statements[0];
    const callExpr = tailCallStmt.expression;
    
    assert.ok(callExpr._isTailCall, 'Call should be marked as tail call');
  });

  it('does not mark non-tail calls', () => {
    const prog = parse(`
      let fib = fn(n) {
        if (n < 2) { n } else { fib(n - 1) + fib(n - 2) }
      }
    `);
    optimizeTailCall(prog);
    
    // Neither call should be marked (they're not in tail position)
    const fn = prog.statements[0].value;
    assert.ok(!fn._tailCallOptimized);
  });

  it('handles multiple functions', () => {
    const prog = parse(`
      let tail = fn(n) { if (n == 0) { 0 } else { tail(n - 1) } };
      let notTail = fn(n) { if (n < 2) { n } else { notTail(n - 1) + notTail(n - 2) } };
      let alsoTail = fn(n, acc) { if (n == 0) { acc } else { alsoTail(n - 1, acc + n) } };
    `);
    const count = countTailRecursive(prog);
    assert.equal(count, 2); // tail and alsoTail
    
    optimizeTailCall(prog);
    assert.ok(prog.statements[0].value._tailCallOptimized);
    assert.ok(!prog.statements[1].value._tailCallOptimized);
    assert.ok(prog.statements[2].value._tailCallOptimized);
  });
});
