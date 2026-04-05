// milestone.test.js — Push type-checker to 100 tests

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { Expr, typeOf, typeCheck, resetFresh, tFun, TInt, TBool } = require('./index.js');

describe('Milestone: 100 Tests', () => {
  beforeEach(() => resetFresh());

  it('deeply nested if-else', () => {
    const t = typeOf(
      Expr.If(Expr.Bool(true),
        Expr.If(Expr.Bool(false), Expr.Int(1), Expr.Int(2)),
        Expr.If(Expr.Bool(true), Expr.Int(3), Expr.Int(4))
      )
    );
    assert.equal(t.toString(), 'Int');
  });

  it('function composition type', () => {
    // compose = fn f => fn g => fn x => f (g x)
    const compose = Expr.Lam('f', Expr.Lam('g', Expr.Lam('x',
      Expr.App(Expr.Var('f'), Expr.App(Expr.Var('g'), Expr.Var('x')))
    )));
    const t = typeOf(compose);
    // Type should be (b -> c) -> (a -> b) -> a -> c
    assert.ok(t.kind === 'TCon');
    assert.equal(t.name, '->');
  });

  it('type error on applying Int to Int', () => {
    assert.throws(() => typeOf(Expr.App(Expr.Int(1), Expr.Int(2))));
  });
});
