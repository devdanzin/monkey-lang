// edge-cases.test.js — Edge cases and more type inference tests
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const {
  TVar, TCon, Scheme, Subst, Expr,
  TInt, TBool, TString, TUnit,
  tFun, tList, tPair, tTuple, tRecord,
  ftv, ftvScheme, ftvEnv,
  unify, generalize, instantiate,
  infer, typeOf, typeCheck,
  parse, resetFresh, freshVar,
} = require('./index.js');

describe('Type Inference Edge Cases', () => {
  beforeEach(() => resetFresh());

  // Literal types
  it('zero is Int', () => {
    assert.equal(typeOf(Expr.Int(0)).toString(), 'Int');
  });

  it('negative number is Int', () => {
    assert.equal(typeOf(Expr.Int(-42)).toString(), 'Int');
  });

  it('false is Bool', () => {
    assert.equal(typeOf(Expr.Bool(false)).toString(), 'Bool');
  });

  it('empty string is String', () => {
    assert.equal(typeOf(Expr.Str('')).toString(), 'String');
  });

  // Arithmetic
  it('addition of two ints', () => {
    const e = Expr.BinOp('+', Expr.Int(1), Expr.Int(2));
    assert.equal(typeOf(e).toString(), 'Int');
  });

  it('subtraction', () => {
    const e = Expr.BinOp('-', Expr.Int(10), Expr.Int(3));
    assert.equal(typeOf(e).toString(), 'Int');
  });

  it('multiplication', () => {
    const e = Expr.BinOp('*', Expr.Int(5), Expr.Int(4));
    assert.equal(typeOf(e).toString(), 'Int');
  });

  it('division', () => {
    const e = Expr.BinOp('/', Expr.Int(10), Expr.Int(2));
    assert.equal(typeOf(e).toString(), 'Int');
  });

  // Comparison
  it('equality returns Bool', () => {
    const e = Expr.BinOp('==', Expr.Int(1), Expr.Int(2));
    assert.equal(typeOf(e).toString(), 'Bool');
  });

  it('less than returns Bool', () => {
    const e = Expr.BinOp('<', Expr.Int(1), Expr.Int(2));
    assert.equal(typeOf(e).toString(), 'Bool');
  });

  // If-then-else
  it('if branches must agree', () => {
    const e = Expr.If(Expr.Bool(true), Expr.Int(1), Expr.Int(2));
    assert.equal(typeOf(e).toString(), 'Int');
  });

  it('if with bool branches', () => {
    const e = Expr.If(Expr.Bool(true), Expr.Bool(true), Expr.Bool(false));
    assert.equal(typeOf(e).toString(), 'Bool');
  });

  // Lambda
  it('constant function ignores arg', () => {
    const e = Expr.Lam('x', Expr.Int(42));
    const t = typeOf(e);
    assert.ok(t.toString().includes('Int'));
    assert.ok(t.toString().includes('->'));
  });

  it('function that adds 1', () => {
    const e = Expr.Lam('x', Expr.BinOp('+', Expr.Var('x'), Expr.Int(1)));
    assert.equal(typeOf(e).toString(), '(Int -> Int)');
  });

  // Application
  it('apply identity to Int', () => {
    const id = Expr.Lam('x', Expr.Var('x'));
    const e = Expr.App(id, Expr.Int(5));
    assert.equal(typeOf(e).toString(), 'Int');
  });

  it('apply identity to Bool', () => {
    const id = Expr.Lam('x', Expr.Var('x'));
    const e = Expr.App(id, Expr.Bool(true));
    assert.equal(typeOf(e).toString(), 'Bool');
  });

  // Let polymorphism
  it('let-bound id used at two types', () => {
    const e = Expr.Let('id', Expr.Lam('x', Expr.Var('x')),
      Expr.BinOp('+',
        Expr.App(Expr.Var('id'), Expr.Int(1)),
        Expr.App(Expr.Var('id'), Expr.Int(2))));
    assert.equal(typeOf(e).toString(), 'Int');
  });

  // Nested let
  it('nested let bindings', () => {
    const e = Expr.Let('x', Expr.Int(1),
      Expr.Let('y', Expr.Int(2),
        Expr.BinOp('+', Expr.Var('x'), Expr.Var('y'))));
    assert.equal(typeOf(e).toString(), 'Int');
  });

  it('let shadowing', () => {
    const e = Expr.Let('x', Expr.Int(1),
      Expr.Let('x', Expr.Bool(true), Expr.Var('x')));
    assert.equal(typeOf(e).toString(), 'Bool');
  });
});
