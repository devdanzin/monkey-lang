const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  TVar, TCon, TInt, TBool, TString, TUnit,
  tFun, tList, tPair,
  Scheme, Subst, Expr,
  unify, generalize, instantiate,
  typeOf, typeCheck, parse, resetFresh,
} = require('../src/index.js');

test('integer literal', () => {
  assert.equal(typeCheck('42'), 'Int');
});

test('boolean literal', () => {
  assert.equal(typeCheck('true'), 'Bool');
});

test('string literal', () => {
  assert.equal(typeCheck('"hello"'), 'String');
});

test('arithmetic', () => {
  assert.equal(typeCheck('1 + 2'), 'Int');
  assert.equal(typeCheck('3 * 4'), 'Int');
});

test('comparison returns Bool', () => {
  assert.equal(typeCheck('1 == 2'), 'Bool');
  assert.equal(typeCheck('1 < 2'), 'Bool');
});

test('logic operators', () => {
  assert.equal(typeCheck('true && false'), 'Bool');
  assert.equal(typeCheck('true || false'), 'Bool');
});

test('identity function', () => {
  resetFresh();
  const ast = Expr.Lam('x', Expr.Var('x'));
  const t = typeOf(ast);
  // Should be (t0 -> t0)
  assert.equal(t.name, '->');
  assert.equal(t.args[0].name, t.args[1].name);
});

test('const function', () => {
  resetFresh();
  const ast = Expr.Lam('x', Expr.Lam('y', Expr.Var('x')));
  const t = typeOf(ast);
  // (a -> (b -> a))
  assert.equal(t.name, '->');
  assert.equal(t.args[1].name, '->');
});

test('function application', () => {
  // (fn x => x + 1) 5
  assert.equal(typeCheck('(fn x => x + 1) 5'), 'Int');
});

test('let polymorphism', () => {
  // let id = fn x => x in id 5
  resetFresh();
  const ast = Expr.Let('id', Expr.Lam('x', Expr.Var('x')),
    Expr.App(Expr.Var('id'), Expr.Int(5)));
  assert.equal(typeOf(ast).toString(), 'Int');
});

test('let polymorphism — use at different types', () => {
  // let id = fn x => x in (id 5, id true) — both should work
  resetFresh();
  const ast = Expr.Let('id', Expr.Lam('x', Expr.Var('x')),
    Expr.Pair(
      Expr.App(Expr.Var('id'), Expr.Int(5)),
      Expr.App(Expr.Var('id'), Expr.Bool(true))
    ));
  const t = typeOf(ast);
  assert.equal(t.name, 'Pair');
  assert.equal(t.args[0].toString(), 'Int');
  assert.equal(t.args[1].toString(), 'Bool');
});

test('if-then-else', () => {
  assert.equal(typeCheck('if true then 1 else 2'), 'Int');
});

test('if-then-else branch mismatch', () => {
  assert.throws(() => {
    resetFresh();
    typeOf(Expr.If(Expr.Bool(true), Expr.Int(1), Expr.Bool(false)));
  }, /Cannot unify/);
});

test('unbound variable', () => {
  assert.throws(() => typeCheck('x'), /Unbound variable/);
});

test('infinite type (occurs check)', () => {
  // fn x => x x
  resetFresh();
  assert.throws(() => {
    typeOf(Expr.Lam('x', Expr.App(Expr.Var('x'), Expr.Var('x'))));
  }, /Infinite type/);
});

test('letrec for recursion', () => {
  // letrec fact = fn n => if n == 0 then 1 else n * fact (n - 1) in fact 5
  resetFresh();
  const ast = Expr.LetRec('fact',
    Expr.Lam('n',
      Expr.If(
        Expr.BinOp('==', Expr.Var('n'), Expr.Int(0)),
        Expr.Int(1),
        Expr.BinOp('*', Expr.Var('n'),
          Expr.App(Expr.Var('fact'), Expr.BinOp('-', Expr.Var('n'), Expr.Int(1))))
      )
    ),
    Expr.App(Expr.Var('fact'), Expr.Int(5))
  );
  assert.equal(typeOf(ast).toString(), 'Int');
});

test('unification basics', () => {
  const s = unify(TInt, TInt);
  assert.equal(s.map.size, 0);
  
  assert.throws(() => unify(TInt, TBool), /Cannot unify/);
  
  const tv = new TVar('a');
  const s2 = unify(tv, TInt);
  assert.equal(s2.apply(tv).toString(), 'Int');
});

test('function type unification', () => {
  const a = new TVar('a');
  const b = new TVar('b');
  const s = unify(tFun(a, b), tFun(TInt, TBool));
  assert.equal(s.apply(a).toString(), 'Int');
  assert.equal(s.apply(b).toString(), 'Bool');
});

test('substitution composition', () => {
  const s1 = Subst.single('a', TInt);
  const s2 = Subst.single('b', new TVar('a'));
  const composed = s1.compose(s2);
  assert.equal(composed.apply(new TVar('b')).toString(), 'Int');
});

test('generalize and instantiate', () => {
  resetFresh();
  const env = new Map();
  const t = tFun(new TVar('a'), new TVar('a'));
  const scheme = generalize(env, t);
  assert.deepEqual(scheme.vars, ['a']);
  
  const inst = instantiate(scheme);
  assert.equal(inst.name, '->');
  assert.equal(inst.args[0].name, inst.args[1].name);
  assert.notEqual(inst.args[0].name, 'a'); // fresh name
});

test('list type', () => {
  resetFresh();
  const ast = Expr.List([Expr.Int(1), Expr.Int(2), Expr.Int(3)]);
  const t = typeOf(ast);
  assert.equal(t.toString(), 'List<Int>');
});

test('empty list', () => {
  resetFresh();
  const ast = Expr.List([]);
  const t = typeOf(ast);
  assert.equal(t.name, 'List');
});

test('pair type', () => {
  resetFresh();
  const ast = Expr.Pair(Expr.Int(1), Expr.Bool(true));
  const t = typeOf(ast);
  assert.equal(t.toString(), 'Pair<Int, Bool>');
});

test('higher-order function', () => {
  // fn f => fn x => f x
  resetFresh();
  const ast = Expr.Lam('f', Expr.Lam('x', Expr.App(Expr.Var('f'), Expr.Var('x'))));
  const t = typeOf(ast);
  // ((t0 -> t1) -> (t0 -> t1))
  assert.equal(t.name, '->');
  assert.equal(t.args[0].name, '->');
});

test('stdlib head/tail', () => {
  resetFresh();
  const ast = Expr.App(Expr.Var('head'), Expr.List([Expr.Int(1), Expr.Int(2)]));
  assert.equal(typeOf(ast).toString(), 'Int');
});

test('type annotation', () => {
  resetFresh();
  const ast = Expr.Ann(Expr.Int(42), TInt);
  assert.equal(typeOf(ast).toString(), 'Int');
  
  assert.throws(() => {
    typeOf(Expr.Ann(Expr.Int(42), TBool));
  }, /Cannot unify/);
});
