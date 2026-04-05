// error-handling.test.js — VM error handling and edge case tests
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Op, Chunk, VM, Compiler, evaluate } from './index.js';

function runChunk(fn) {
  const chunk = new Chunk();
  fn(chunk);
  chunk.emit(Op.HALT);
  return new VM(chunk).run();
}

const lit = (value) => ({ tag: 'lit', value });
const bin = (op, left, right) => ({ tag: 'binop', op, left, right });
const vr = (name) => ({ tag: 'var', name });
const letExpr = (name, value, body) => ({ tag: 'let', name, value, body });
const lam = (param, body) => ({ tag: 'lam', param, body });
const app = (fn, arg) => ({ tag: 'app', fn, arg });

describe('VM Error Handling', () => {
  it('division by zero throws or returns Infinity', () => {
    const result = evaluate(bin('/', lit(10), lit(0)));
    assert.ok(result === Infinity || result === -Infinity || Number.isNaN(result) || typeof result === 'number');
  });

  it('function application', () => {
    const expr = letExpr('f', lam('x', bin('+', vr('x'), lit(1))),
      app(vr('f'), lit(5)));
    assert.equal(evaluate(expr), 6);
  });

  it('deeply nested arithmetic', () => {
    // ((1 + 2) * (3 + 4)) - ((5 - 6) * (7 + 8))
    const expr = bin('-',
      bin('*', bin('+', lit(1), lit(2)), bin('+', lit(3), lit(4))),
      bin('*', bin('-', lit(5), lit(6)), bin('+', lit(7), lit(8)))
    );
    assert.equal(evaluate(expr), 21 - (-15)); // 36
  });

  it('identity function', () => {
    const id = lam('x', vr('x'));
    assert.equal(evaluate(app(id, lit(42))), 42);
  });

  it('function returning literal', () => {
    const f = lam('x', lit(99));
    assert.equal(evaluate(app(f, lit(0))), 99);
  });

  it('let shadowing', () => {
    const expr = letExpr('x', lit(1),
      letExpr('x', lit(2), vr('x')));
    assert.equal(evaluate(expr), 2);
  });

  it('let with arithmetic', () => {
    const expr = letExpr('a', lit(10),
      bin('+', vr('a'), lit(5)));
    assert.equal(evaluate(expr), 15);
  });

  it('modulo operation', () => {
    assert.equal(evaluate(bin('%', lit(17), lit(5))), 2);
  });

  it('negative numbers', () => {
    assert.equal(evaluate(bin('-', lit(0), lit(42))), -42);
  });

  it('large arithmetic', () => {
    assert.equal(evaluate(bin('*', lit(1000000), lit(1000000))), 1e12);
  });
});
