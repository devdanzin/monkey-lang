import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  infer, unify, composeSubst, TVar, TConst, TFun, TList, TTuple, TForall, TApp,
  tInt, tBool, tString, tUnit,
  intLit, boolLit, strLit, varRef, lam, app, letExpr, ifExpr, binOp, letRec,
  matchExpr, matchCase, pVar, pLit, pCon, pWild,
  DataType,
  defaultEnv, generalize, TypeEnv, UnificationError,
  freshTypeVar, resetTypeVarCounter,
} from '../src/index.js';

// ===== Unification =====
describe('Unification', () => {
  it('unifies identical types', () => {
    const s = unify(tInt, tInt);
    assert.equal(s.size, 0);
  });

  it('unifies type variable with concrete type', () => {
    const a = new TVar('a');
    const s = unify(a, tInt);
    assert.equal(s.get('a').toString(), 'Int');
  });

  it('unifies function types', () => {
    const a = new TVar('a');
    const s = unify(new TFun(a, tBool), new TFun(tInt, tBool));
    assert.equal(s.get('a').toString(), 'Int');
  });

  it('unifies nested function types', () => {
    const a = new TVar('a');
    const b = new TVar('b');
    const t1 = new TFun(a, new TFun(b, a));
    const t2 = new TFun(tInt, new TFun(tBool, tInt));
    const s = unify(t1, t2);
    assert.equal(s.get('a').toString(), 'Int');
    assert.equal(s.get('b').toString(), 'Bool');
  });

  it('fails on incompatible types', () => {
    assert.throws(() => unify(tInt, tBool), UnificationError);
  });

  it('detects occurs check', () => {
    const a = new TVar('a');
    assert.throws(() => unify(a, new TFun(a, tInt)), UnificationError);
  });

  it('unifies list types', () => {
    const a = new TVar('a');
    const s = unify(new TList(a), new TList(tInt));
    assert.equal(s.get('a').toString(), 'Int');
  });

  it('unifies tuple types', () => {
    const a = new TVar('a');
    const s = unify(new TTuple([a, tBool]), new TTuple([tInt, tBool]));
    assert.equal(s.get('a').toString(), 'Int');
  });

  it('fails on tuple size mismatch', () => {
    assert.throws(
      () => unify(new TTuple([tInt]), new TTuple([tInt, tBool])),
      UnificationError,
    );
  });

  it('chains substitutions', () => {
    const a = new TVar('a');
    const b = new TVar('b');
    const s1 = unify(a, b);
    const s2 = unify(b.apply(s1), tInt);
    const combined = composeSubst(s2, s1);
    assert.equal(a.apply(combined).toString(), 'Int');
  });
});

// ===== Literal Inference =====
describe('Type inference — literals', () => {
  it('infers Int for integer literals', () => {
    assert.equal(infer(intLit(42)).toString(), 'Int');
  });

  it('infers Bool for boolean literals', () => {
    assert.equal(infer(boolLit(true)).toString(), 'Bool');
  });

  it('infers String for string literals', () => {
    assert.equal(infer(strLit('hello')).toString(), 'String');
  });
});

// ===== Variable Inference =====
describe('Type inference — variables', () => {
  it('looks up variable in environment', () => {
    const env = defaultEnv().extend('x', tInt);
    assert.equal(infer(varRef('x'), env).toString(), 'Int');
  });

  it('throws for unbound variable', () => {
    assert.throws(() => infer(varRef('undefined_var')), /Unbound variable/);
  });

  it('instantiates polymorphic variable', () => {
    // id : ∀a. a -> a
    const t = infer(varRef('id'));
    assert.ok(t instanceof TFun, 'id should be a function type');
  });
});

// ===== Lambda Inference =====
describe('Type inference — lambda', () => {
  it('infers identity function: fn x => x', () => {
    const t = infer(lam('x', varRef('x')));
    assert.ok(t instanceof TFun);
    assert.ok(t.from.equals(t.to), `Expected a -> a, got ${t}`);
  });

  it('infers constant function: fn x => 42', () => {
    const t = infer(lam('x', intLit(42)));
    assert.ok(t instanceof TFun);
    assert.equal(t.to.toString(), 'Int');
  });

  it('infers multi-arg function: fn x => fn y => x + y', () => {
    const t = infer(lam('x', lam('y', binOp('+', varRef('x'), varRef('y')))));
    assert.equal(t.toString(), 'Int -> Int -> Int');
  });
});

// ===== Application Inference =====
describe('Type inference — application', () => {
  it('infers result of identity applied to int', () => {
    // id(42) : Int
    const t = infer(app(varRef('id'), intLit(42)));
    assert.equal(t.toString(), 'Int');
  });

  it('infers result of negate', () => {
    // negate(42) : Int
    const t = infer(app(varRef('negate'), intLit(42)));
    assert.equal(t.toString(), 'Int');
  });

  it('fails when applying non-function', () => {
    assert.throws(() => infer(app(intLit(42), intLit(1))));
  });

  it('fails on argument type mismatch', () => {
    // negate(true) should fail — negate expects Int
    assert.throws(() => infer(app(varRef('negate'), boolLit(true))));
  });
});

// ===== Binary Operators =====
describe('Type inference — binary operators', () => {
  it('arithmetic: Int -> Int -> Int', () => {
    assert.equal(infer(binOp('+', intLit(1), intLit(2))).toString(), 'Int');
    assert.equal(infer(binOp('-', intLit(1), intLit(2))).toString(), 'Int');
    assert.equal(infer(binOp('*', intLit(1), intLit(2))).toString(), 'Int');
  });

  it('comparison: Int -> Int -> Bool', () => {
    assert.equal(infer(binOp('<', intLit(1), intLit(2))).toString(), 'Bool');
    assert.equal(infer(binOp('>', intLit(1), intLit(2))).toString(), 'Bool');
  });

  it('logical: Bool -> Bool -> Bool', () => {
    assert.equal(infer(binOp('&&', boolLit(true), boolLit(false))).toString(), 'Bool');
    assert.equal(infer(binOp('||', boolLit(true), boolLit(false))).toString(), 'Bool');
  });

  it('polymorphic equality: a -> a -> Bool', () => {
    assert.equal(infer(binOp('==', intLit(1), intLit(2))).toString(), 'Bool');
    assert.equal(infer(binOp('==', boolLit(true), boolLit(false))).toString(), 'Bool');
  });

  it('equality type mismatch fails', () => {
    assert.throws(() => infer(binOp('==', intLit(1), boolLit(true))));
  });

  it('arithmetic type mismatch fails', () => {
    assert.throws(() => infer(binOp('+', intLit(1), boolLit(true))));
  });
});

// ===== If-Then-Else =====
describe('Type inference — if-then-else', () => {
  it('infers matching branches', () => {
    const t = infer(ifExpr(boolLit(true), intLit(1), intLit(2)));
    assert.equal(t.toString(), 'Int');
  });

  it('fails on non-Bool condition', () => {
    assert.throws(() => infer(ifExpr(intLit(1), intLit(1), intLit(2))));
  });

  it('fails on mismatched branches', () => {
    assert.throws(() => infer(ifExpr(boolLit(true), intLit(1), boolLit(false))));
  });

  it('branches can be functions', () => {
    const t = infer(ifExpr(
      boolLit(true),
      lam('x', varRef('x')),
      lam('y', varRef('y')),
    ));
    assert.ok(t instanceof TFun);
  });
});

// ===== Let =====
describe('Type inference — let', () => {
  it('basic let', () => {
    // let x = 42 in x : Int
    const t = infer(letExpr('x', intLit(42), varRef('x')));
    assert.equal(t.toString(), 'Int');
  });

  it('let with function', () => {
    // let f = fn x => x in f(42) : Int
    const t = infer(letExpr('f', lam('x', varRef('x')), app(varRef('f'), intLit(42))));
    assert.equal(t.toString(), 'Int');
  });

  it('let-polymorphism: id used at different types', () => {
    // let id = fn x => x in (id(42), id(true))
    // id should be usable as both Int -> Int and Bool -> Bool
    const t = infer(
      letExpr('myId', lam('x', varRef('x')),
        // Use id at Int and then at Bool
        letExpr('a', app(varRef('myId'), intLit(42)),
          letExpr('b', app(varRef('myId'), boolLit(true)),
            varRef('b')
          )
        )
      )
    );
    assert.equal(t.toString(), 'Bool');
  });

  it('nested let', () => {
    // let x = 1 in let y = x + 1 in y : Int
    const t = infer(
      letExpr('x', intLit(1),
        letExpr('y', binOp('+', varRef('x'), intLit(1)),
          varRef('y')
        )
      )
    );
    assert.equal(t.toString(), 'Int');
  });
});

// ===== Let-Rec =====
describe('Type inference — let-rec', () => {
  it('recursive factorial', () => {
    // let rec fact = fn n => if n == 0 then 1 else n * fact(n-1) in fact
    const t = infer(
      letRec('fact',
        lam('n', ifExpr(
          binOp('==', varRef('n'), intLit(0)),
          intLit(1),
          binOp('*', varRef('n'), app(varRef('fact'), binOp('-', varRef('n'), intLit(1))))
        )),
        varRef('fact')
      )
    );
    assert.equal(t.toString(), 'Int -> Int');
  });

  it('recursive fibonacci', () => {
    const t = infer(
      letRec('fib',
        lam('n', ifExpr(
          binOp('<', varRef('n'), intLit(2)),
          varRef('n'),
          binOp('+',
            app(varRef('fib'), binOp('-', varRef('n'), intLit(1))),
            app(varRef('fib'), binOp('-', varRef('n'), intLit(2)))
          )
        )),
        varRef('fib')
      )
    );
    assert.equal(t.toString(), 'Int -> Int');
  });
});

// ===== Complex Expressions =====
describe('Type inference — complex', () => {
  it('higher-order function: apply', () => {
    // let apply = fn f => fn x => f(x) in apply
    const t = infer(
      letExpr('apply',
        lam('f', lam('x', app(varRef('f'), varRef('x')))),
        varRef('apply')
      )
    );
    // Should be (a -> b) -> a -> b
    assert.ok(t instanceof TFun);
    assert.ok(t.from instanceof TFun, `Expected function type, got ${t.from}`);
  });

  it('compose: fn f => fn g => fn x => f(g(x))', () => {
    const t = infer(
      letExpr('compose',
        lam('f', lam('g', lam('x', app(varRef('f'), app(varRef('g'), varRef('x')))))),
        varRef('compose')
      )
    );
    assert.ok(t instanceof TFun);
  });

  it('church numerals: zero and succ', () => {
    // zero = fn f => fn x => x
    // succ = fn n => fn f => fn x => f(n(f)(x))
    const t = infer(
      letExpr('zero', lam('f', lam('x', varRef('x'))),
        letExpr('succ', lam('n', lam('f', lam('x',
          app(varRef('f'), app(app(varRef('n'), varRef('f')), varRef('x')))
        ))),
          app(varRef('succ'), varRef('zero'))
        )
      )
    );
    assert.ok(t instanceof TFun);
  });
});

// ===== Generalization =====
describe('Generalization', () => {
  it('generalizes free variables', () => {
    resetTypeVarCounter();
    const a = new TVar('a');
    const t = new TFun(a, a);
    const env = new TypeEnv();
    const scheme = generalize(env, t);
    assert.ok(scheme instanceof TForall);
    assert.deepEqual(scheme.vars, ['a']);
  });

  it('does not generalize variables in environment', () => {
    const a = new TVar('a');
    const env = new TypeEnv(new Map([['x', a]]));
    const scheme = generalize(env, new TFun(a, tInt));
    assert.equal(scheme.vars.length, 0);
  });
});

// ===== Type Scheme Instantiation =====
describe('Type scheme instantiation', () => {
  it('instantiates with fresh variables', () => {
    resetTypeVarCounter();
    const scheme = new TForall(['a'], new TFun(new TVar('a'), new TVar('a')));
    const t1 = scheme.instantiate();
    const t2 = scheme.instantiate();
    // Both should be function types but with different variable names
    assert.ok(t1 instanceof TFun);
    assert.ok(t2 instanceof TFun);
    assert.notEqual(t1.from.name, t2.from.name);
  });
});

// ===== Data Types and Pattern Matching =====
describe('Data types', () => {
  it('creates Maybe type', () => {
    const a = new TVar('a');
    const maybe = new DataType('Maybe', ['a'], [
      { name: 'Nothing', fields: [] },
      { name: 'Just', fields: [a] },
    ]);
    
    const nothingType = maybe.constructorType('Nothing');
    assert.ok(nothingType instanceof TApp);
    assert.equal(nothingType.name, 'Maybe');
    
    const justType = maybe.constructorType('Just');
    assert.ok(justType instanceof TFun);
  });

  it('creates Bool-like type', () => {
    const boolType = new DataType('MyBool', [], [
      { name: 'MyTrue', fields: [] },
      { name: 'MyFalse', fields: [] },
    ]);
    
    const trueType = boolType.constructorType('MyTrue');
    assert.ok(trueType instanceof TApp);
    assert.equal(trueType.name, 'MyBool');
  });

  it('creates Pair type', () => {
    const a = new TVar('a');
    const b = new TVar('b');
    const pair = new DataType('Pair', ['a', 'b'], [
      { name: 'MkPair', fields: [a, b] },
    ]);
    
    const mkPairType = pair.constructorType('MkPair');
    assert.ok(mkPairType instanceof TFun);
    // Should be a -> b -> Pair a b
  });
});

describe('Pattern matching', () => {
  it('match on literal patterns', () => {
    // match 42 { 0 => true, x => false }
    const t = infer(
      matchExpr(intLit(42), [
        matchCase(pLit(0, 'int'), boolLit(true)),
        matchCase(pVar('x'), boolLit(false)),
      ])
    );
    assert.equal(t.toString(), 'Bool');
  });

  it('match binds variables', () => {
    // match 42 { x => x + 1 }
    const t = infer(
      matchExpr(intLit(42), [
        matchCase(pVar('x'), binOp('+', varRef('x'), intLit(1))),
      ])
    );
    assert.equal(t.toString(), 'Int');
  });

  it('match wildcard', () => {
    // match 42 { _ => true }
    const t = infer(
      matchExpr(intLit(42), [
        matchCase(pWild(), boolLit(true)),
      ])
    );
    assert.equal(t.toString(), 'Bool');
  });

  it('match branches must agree on type', () => {
    // match true { true => 1, false => "no" } — should fail
    assert.throws(() => infer(
      matchExpr(boolLit(true), [
        matchCase(pLit(true, 'bool'), intLit(1)),
        matchCase(pLit(false, 'bool'), strLit('no')),
      ])
    ));
  });

  it('match on constructor with environment', () => {
    // Set up Maybe constructors in env
    const a = new TVar('_a');
    const maybeA = new TApp('Maybe', [a]);
    const env = defaultEnv()
      .extend('Nothing', new TForall(['_a'], maybeA))
      .extend('Just', new TForall(['_a'], new TFun(a, maybeA)));
    
    // match Just(42) { Just(x) => x, Nothing => 0 }
    const t = infer(
      matchExpr(app(varRef('Just'), intLit(42)), [
        matchCase(pCon('Just', [pVar('x')]), varRef('x')),
        matchCase(pCon('Nothing', []), intLit(0)),
      ]),
      env,
    );
    assert.equal(t.toString(), 'Int');
  });

  it('match preserves polymorphism', () => {
    // match with identity in each branch
    const t = infer(
      matchExpr(boolLit(true), [
        matchCase(pLit(true, 'bool'), lam('x', varRef('x'))),
        matchCase(pLit(false, 'bool'), lam('y', varRef('y'))),
      ])
    );
    assert.ok(t instanceof TFun);
  });
});
