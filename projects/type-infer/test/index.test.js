const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  TVar, TFun, TCon, TPair, TList, tInt, tBool, tString,
  Var, Lam, App, Let, If, Pair, Fst, Snd, Fix, Ann, IntLit, BoolLit, StrLit,
  Subst, Scheme, TypeEnv, unify, infer, inferType, defaultEnv,
  typeToString, schemeToString, ftv, occursCheck, resetTypeVars,
} = require('../src/index.js');

// ==================== Type Basics ====================

test('type constructors', () => {
  assert.equal(typeToString(tInt), 'Int');
  assert.equal(typeToString(tBool), 'Bool');
  assert.equal(typeToString(TFun(tInt, tBool)), 'Int -> Bool');
  assert.equal(typeToString(TFun(TFun(tInt, tInt), tBool)), '(Int -> Int) -> Bool');
});

test('free type variables', () => {
  assert.deepEqual(ftv(tInt), new Set());
  assert.deepEqual(ftv(TVar('a')), new Set(['a']));
  assert.deepEqual(ftv(TFun(TVar('a'), TVar('b'))), new Set(['a', 'b']));
});

// ==================== Substitution ====================

test('substitution apply', () => {
  const s = Subst.single('a', tInt);
  assert.equal(typeToString(s.apply(TVar('a'))), 'Int');
  assert.equal(typeToString(s.apply(TVar('b'))), 'b');
  assert.equal(typeToString(s.apply(TFun(TVar('a'), TVar('b')))), 'Int -> b');
});

test('substitution compose', () => {
  const s1 = Subst.single('a', TVar('b'));
  const s2 = Subst.single('b', tInt);
  const composed = s2.compose(s1);
  assert.equal(typeToString(composed.apply(TVar('a'))), 'Int');
});

// ==================== Unification ====================

test('unify identical types', () => {
  const s = unify(tInt, tInt);
  assert.equal(s.map.size, 0);
});

test('unify type variable with concrete', () => {
  const s = unify(TVar('a'), tInt);
  assert.equal(typeToString(s.apply(TVar('a'))), 'Int');
});

test('unify function types', () => {
  const s = unify(TFun(TVar('a'), tBool), TFun(tInt, TVar('b')));
  assert.equal(typeToString(s.apply(TVar('a'))), 'Int');
  assert.equal(typeToString(s.apply(TVar('b'))), 'Bool');
});

test('unify fails on mismatch', () => {
  assert.throws(() => unify(tInt, tBool), /Type mismatch/);
});

test('occurs check prevents infinite types', () => {
  assert.throws(() => unify(TVar('a'), TFun(TVar('a'), tInt)), /Infinite type/);
});

test('unify pairs', () => {
  const s = unify(TPair(TVar('a'), tInt), TPair(tBool, TVar('b')));
  assert.equal(typeToString(s.apply(TVar('a'))), 'Bool');
  assert.equal(typeToString(s.apply(TVar('b'))), 'Int');
});

// ==================== Inference: Literals ====================

test('infer integer literal', () => {
  assert.equal(inferType(IntLit(42)), 'Int');
});

test('infer boolean literal', () => {
  assert.equal(inferType(BoolLit(true)), 'Bool');
});

test('infer string literal', () => {
  assert.equal(inferType(StrLit("hello")), 'String');
});

// ==================== Inference: Variables ====================

test('infer variable from env', () => {
  assert.equal(inferType(Var('+')), 'Int -> Int -> Int');
});

test('infer unbound variable throws', () => {
  assert.throws(() => inferType(Var('unknown')), /Unbound variable/);
});

// ==================== Inference: Lambda ====================

test('infer identity function', () => {
  const result = inferType(Lam('x', Var('x')));
  assert.equal(result, 't0 -> t0');
});

test('infer lambda with known operation', () => {
  // λx. x + 1 : Int -> Int
  const expr = Lam('x', App(App(Var('+'), Var('x')), IntLit(1)));
  assert.equal(inferType(expr), 'Int -> Int');
});

// ==================== Inference: Application ====================

test('infer function application', () => {
  // id 42 : Int
  const expr = App(Var('id'), IntLit(42));
  assert.equal(inferType(expr), 'Int');
});

test('infer curried application', () => {
  // (+) 1 2 : Int
  const expr = App(App(Var('+'), IntLit(1)), IntLit(2));
  assert.equal(inferType(expr), 'Int');
});

// ==================== Inference: Let ====================

test('infer let binding', () => {
  // let x = 42 in x : Int
  const expr = Let('x', IntLit(42), Var('x'));
  assert.equal(inferType(expr), 'Int');
});

test('let-polymorphism', () => {
  // let id = λx.x in (id 42, id true) — id is used at two different types
  const expr = Let('id', Lam('x', Var('x')),
    Pair(App(Var('id'), IntLit(42)), App(Var('id'), BoolLit(true)))
  );
  assert.equal(inferType(expr), '(Int, Bool)');
});

test('let nested', () => {
  // let x = 1 in let y = 2 in x + y : Int
  const expr = Let('x', IntLit(1),
    Let('y', IntLit(2),
      App(App(Var('+'), Var('x')), Var('y'))));
  assert.equal(inferType(expr), 'Int');
});

// ==================== Inference: If ====================

test('infer if expression', () => {
  // if true then 1 else 2 : Int
  const expr = If(BoolLit(true), IntLit(1), IntLit(2));
  assert.equal(inferType(expr), 'Int');
});

test('if branches must match', () => {
  // if true then 1 else "no" — type error
  const expr = If(BoolLit(true), IntLit(1), StrLit("no"));
  assert.throws(() => inferType(expr), /Type mismatch/);
});

test('if condition must be bool', () => {
  // if 42 then 1 else 2 — type error
  const expr = If(IntLit(42), IntLit(1), IntLit(2));
  assert.throws(() => inferType(expr), /Type mismatch/);
});

// ==================== Inference: Pairs ====================

test('infer pair', () => {
  const expr = Pair(IntLit(1), BoolLit(true));
  assert.equal(inferType(expr), '(Int, Bool)');
});

test('infer fst', () => {
  const expr = Fst(Pair(IntLit(1), BoolLit(true)));
  assert.equal(inferType(expr), 'Int');
});

test('infer snd', () => {
  const expr = Snd(Pair(IntLit(1), BoolLit(true)));
  assert.equal(inferType(expr), 'Bool');
});

// ==================== Inference: Fix ====================

test('infer fix (recursive functions)', () => {
  // fix (λf. λn. if n == 0 then 1 else n * f(n-1))
  // Should infer: Int -> Int
  const factorial = Fix(Lam('f', Lam('n',
    If(
      App(App(Var('=='), Var('n')), IntLit(0)),
      IntLit(1),
      App(App(Var('*'), Var('n')), App(Var('f'), App(App(Var('-'), Var('n')), IntLit(1))))
    )
  )));
  assert.equal(inferType(factorial), 'Int -> Int');
});

// ==================== Inference: Type Annotations ====================

test('annotation matches', () => {
  const expr = Ann(IntLit(42), tInt);
  assert.equal(inferType(expr), 'Int');
});

test('annotation mismatch throws', () => {
  const expr = Ann(IntLit(42), tBool);
  assert.throws(() => inferType(expr), /Type mismatch/);
});

// ==================== Scheme ====================

test('scheme instantiation creates fresh vars', () => {
  resetTypeVars();
  const scheme = new Scheme(['a'], TFun(TVar('a'), TVar('a')));
  const t1 = scheme.instantiate();
  const t2 = scheme.instantiate();
  // Both should be function types but with different var names
  assert.equal(t1.tag, 'TFun');
  assert.equal(t2.tag, 'TFun');
  assert.notEqual(t1.from.name, t2.from.name);
});

test('scheme to string', () => {
  const s = new Scheme(['a', 'b'], TFun(TVar('a'), TVar('b')));
  assert.equal(schemeToString(s), '∀ a b. a -> b');
});

// ==================== Complex Expressions ====================

test('compose function', () => {
  // let compose = λf.λg.λx. f(g(x)) in compose
  // Should get: (a -> b) -> (c -> a) -> c -> b
  const compose = Let('compose',
    Lam('f', Lam('g', Lam('x',
      App(Var('f'), App(Var('g'), Var('x')))
    ))),
    Var('compose')
  );
  const result = inferType(compose);
  // The exact variable names may differ, but structure should be right
  assert.ok(result.includes('->'));
  // Parse the structure: (a -> b) -> (c -> a) -> c -> b
  const parts = result.split(' -> ');
  assert.ok(parts.length >= 4, `Expected 4+ parts, got: ${result}`);
});

test('higher-order function', () => {
  // let apply = λf.λx. f(x) in apply (λn. n + 1) 5
  const expr = Let('apply',
    Lam('f', Lam('x', App(Var('f'), Var('x')))),
    App(App(Var('apply'), Lam('n', App(App(Var('+'), Var('n')), IntLit(1)))), IntLit(5))
  );
  assert.equal(inferType(expr), 'Int');
});

test('const function', () => {
  // let const = λa.λb.a in const
  const expr = Let('const',
    Lam('a', Lam('b', Var('a'))),
    Var('const')
  );
  const result = inferType(expr);
  // Should be: a -> b -> a  (with some var names)
  assert.ok(result.includes('->'));
});

test('flip function', () => {
  // let flip = λf.λx.λy. f y x in flip
  const expr = Let('flip',
    Lam('f', Lam('x', Lam('y',
      App(App(Var('f'), Var('y')), Var('x'))
    ))),
    Var('flip')
  );
  const result = inferType(expr);
  assert.ok(result.includes('->'));
});
