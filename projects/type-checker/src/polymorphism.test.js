// polymorphism.test.js — Polymorphism and type error tests
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const {
  Expr, TInt, TBool, TString,
  typeOf, resetFresh,
} = require('./index.js');

describe('Polymorphism and Type Errors', () => {
  beforeEach(() => resetFresh());

  it('let-polymorphism: id used at Int and Bool', () => {
    // let id = \x -> x in (id 1, id true) — check id works at Int
    const e = Expr.Let('id', Expr.Lam('x', Expr.Var('x')),
      Expr.App(Expr.Var('id'), Expr.Int(42)));
    assert.equal(typeOf(e).toString(), 'Int');
  });

  it('let-polymorphism: id at Bool', () => {
    const e = Expr.Let('id', Expr.Lam('x', Expr.Var('x')),
      Expr.App(Expr.Var('id'), Expr.Bool(true)));
    assert.equal(typeOf(e).toString(), 'Bool');
  });

  it('type error: Bool + Int', () => {
    const e = Expr.BinOp('+', Expr.Bool(true), Expr.Int(1));
    assert.throws(() => typeOf(e));
  });

  it('type error: if condition not Bool', () => {
    const e = Expr.If(Expr.Int(42), Expr.Int(1), Expr.Int(2));
    assert.throws(() => typeOf(e));
  });

  it('type error: if branches disagree', () => {
    const e = Expr.If(Expr.Bool(true), Expr.Int(1), Expr.Bool(false));
    assert.throws(() => typeOf(e));
  });

  it('type error: unbound variable', () => {
    const e = Expr.Var('undefined_var');
    assert.throws(() => typeOf(e));
  });

  it('function composition typing', () => {
    // let f = \x -> x + 1 in let g = \x -> x * 2 in f(g(3))
    const e = Expr.Let('f', Expr.Lam('x', Expr.BinOp('+', Expr.Var('x'), Expr.Int(1))),
      Expr.Let('g', Expr.Lam('x', Expr.BinOp('*', Expr.Var('x'), Expr.Int(2))),
        Expr.App(Expr.Var('f'), Expr.App(Expr.Var('g'), Expr.Int(3)))));
    assert.equal(typeOf(e).toString(), 'Int');
  });

  it('higher-order function typing', () => {
    // let apply = \f -> \x -> f x in apply (\y -> y + 1) 5
    const e = Expr.Let('apply',
      Expr.Lam('f', Expr.Lam('x', Expr.App(Expr.Var('f'), Expr.Var('x')))),
      Expr.App(Expr.App(Expr.Var('apply'),
        Expr.Lam('y', Expr.BinOp('+', Expr.Var('y'), Expr.Int(1)))),
        Expr.Int(5)));
    assert.equal(typeOf(e).toString(), 'Int');
  });

  it('deeply nested let', () => {
    const e = Expr.Let('a', Expr.Int(1),
      Expr.Let('b', Expr.Int(2),
        Expr.Let('c', Expr.Int(3),
          Expr.BinOp('+', Expr.Var('a'), Expr.BinOp('+', Expr.Var('b'), Expr.Var('c'))))));
    assert.equal(typeOf(e).toString(), 'Int');
  });

  it('identity of identity', () => {
    // let id = \x -> x in id id 42
    const e = Expr.Let('id', Expr.Lam('x', Expr.Var('x')),
      Expr.App(Expr.App(Expr.Var('id'), Expr.Var('id')), Expr.Int(42)));
    assert.equal(typeOf(e).toString(), 'Int');
  });
});
