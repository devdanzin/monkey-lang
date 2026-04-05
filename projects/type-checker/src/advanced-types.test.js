// advanced-types.test.js — Advanced type inference tests
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const {
  Expr, TInt, TBool, TString,
  tFun, tList, tPair,
  typeOf, resetFresh,
} = require('./index.js');

describe('Advanced Type Inference', () => {
  beforeEach(() => resetFresh());

  it('list of integers', () => {
    const e = Expr.List([Expr.Int(1), Expr.Int(2), Expr.Int(3)]);
    const t = typeOf(e);
    assert.ok(t.toString().includes('Int'));
  });

  it('pair of int and bool', () => {
    const e = Expr.Pair(Expr.Int(1), Expr.Bool(true));
    const t = typeOf(e);
    assert.ok(t.toString().includes('Int'));
    assert.ok(t.toString().includes('Bool'));
  });

  it('nested pairs', () => {
    const e = Expr.Pair(Expr.Pair(Expr.Int(1), Expr.Int(2)), Expr.Int(3));
    const t = typeOf(e);
    assert.ok(t.toString().includes('Int'));
  });

  it('compose two functions', () => {
    // compose = \f -> \g -> \x -> f(g(x))
    // But need multi-arg... let's do simpler
    const e = Expr.Let('f', Expr.Lam('x', Expr.BinOp('+', Expr.Var('x'), Expr.Int(1))),
      Expr.Let('g', Expr.Lam('x', Expr.BinOp('*', Expr.Var('x'), Expr.Int(2))),
        Expr.App(Expr.Var('f'), Expr.App(Expr.Var('g'), Expr.Int(5)))));
    assert.equal(typeOf(e).toString(), 'Int');
  });

  it('boolean operators', () => {
    const e = Expr.BinOp('&&', Expr.Bool(true), Expr.Bool(false));
    assert.equal(typeOf(e).toString(), 'Bool');
  });

  it('or operator', () => {
    const e = Expr.BinOp('||', Expr.Bool(true), Expr.Bool(false));
    assert.equal(typeOf(e).toString(), 'Bool');
  });

  it('comparison of integers', () => {
    const e = Expr.BinOp('>', Expr.Int(5), Expr.Int(3));
    assert.equal(typeOf(e).toString(), 'Bool');
  });

  it('if-then-else with functions', () => {
    const e = Expr.If(Expr.Bool(true),
      Expr.Lam('x', Expr.BinOp('+', Expr.Var('x'), Expr.Int(1))),
      Expr.Lam('x', Expr.BinOp('*', Expr.Var('x'), Expr.Int(2))));
    const t = typeOf(e);
    assert.equal(t.toString(), '(Int -> Int)');
  });

  it('recursive factorial type', () => {
    // letrec fact = \n -> if n == 0 then 1 else n * fact(n - 1) in fact
    const e = Expr.LetRec('fact',
      Expr.Lam('n', Expr.If(
        Expr.BinOp('==', Expr.Var('n'), Expr.Int(0)),
        Expr.Int(1),
        Expr.BinOp('*', Expr.Var('n'),
          Expr.App(Expr.Var('fact'), Expr.BinOp('-', Expr.Var('n'), Expr.Int(1)))))),
      Expr.Var('fact'));
    const t = typeOf(e);
    assert.equal(t.toString(), '(Int -> Int)');
  });

  it('apply recursive function', () => {
    const e = Expr.LetRec('fact',
      Expr.Lam('n', Expr.If(
        Expr.BinOp('==', Expr.Var('n'), Expr.Int(0)),
        Expr.Int(1),
        Expr.BinOp('*', Expr.Var('n'),
          Expr.App(Expr.Var('fact'), Expr.BinOp('-', Expr.Var('n'), Expr.Int(1)))))),
      Expr.App(Expr.Var('fact'), Expr.Int(5)));
    assert.equal(typeOf(e).toString(), 'Int');
  });

  it('higher-order: map type', () => {
    // let apply = \f -> \x -> f x in apply type
    const e = Expr.Lam('f', Expr.Lam('x', Expr.App(Expr.Var('f'), Expr.Var('x'))));
    const t = typeOf(e);
    assert.ok(t.toString().includes('->'));
  });

  it('int equality is bool', () => {
    assert.equal(typeOf(Expr.BinOp('==', Expr.Int(1), Expr.Int(2))).toString(), 'Bool');
  });

  it('string concat type error with int', () => {
    assert.throws(() => typeOf(Expr.BinOp('+', Expr.Str('hello'), Expr.Int(1))));
  });

  it('bool arithmetic type error', () => {
    assert.throws(() => typeOf(Expr.BinOp('*', Expr.Bool(true), Expr.Int(1))));
  });

  it('applying int to int fails', () => {
    assert.throws(() => typeOf(Expr.App(Expr.Int(1), Expr.Int(2))));
  });

  it('nested if preserves type', () => {
    const e = Expr.If(Expr.Bool(true),
      Expr.If(Expr.Bool(false), Expr.Int(1), Expr.Int(2)),
      Expr.Int(3));
    assert.equal(typeOf(e).toString(), 'Int');
  });

  it('let with if', () => {
    const e = Expr.Let('x', Expr.If(Expr.Bool(true), Expr.Int(1), Expr.Int(2)),
      Expr.BinOp('+', Expr.Var('x'), Expr.Int(10)));
    assert.equal(typeOf(e).toString(), 'Int');
  });

  it('function type annotation', () => {
    const f = Expr.Lam('x', Expr.BinOp('+', Expr.Var('x'), Expr.Int(1)));
    assert.equal(typeOf(f).toString(), '(Int -> Int)');
  });

  it('double application', () => {
    const e = Expr.Let('f', Expr.Lam('x', Expr.BinOp('+', Expr.Var('x'), Expr.Int(1))),
      Expr.App(Expr.Var('f'), Expr.App(Expr.Var('f'), Expr.Int(0))));
    assert.equal(typeOf(e).toString(), 'Int');
  });

  it('unused variable in let', () => {
    const e = Expr.Let('unused', Expr.Bool(true), Expr.Int(42));
    assert.equal(typeOf(e).toString(), 'Int');
  });
});
