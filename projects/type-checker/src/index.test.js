// index.test.js — Comprehensive tests for Hindley-Milner type checker

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  TVar, TCon, Scheme, Subst, Expr,
  TInt, TBool, TString, TUnit,
  tFun, tList, tPair,
  ftv, ftvScheme, ftvEnv,
  unify, generalize, instantiate,
  infer, typeOf, typeCheck,
  parse, resetFresh, freshVar,
} = require('./index.js');

describe('Types', () => {
  it('TVar toString', () => {
    assert.equal(new TVar('a').toString(), 'a');
  });

  it('TCon toString (simple)', () => {
    assert.equal(TInt.toString(), 'Int');
    assert.equal(TBool.toString(), 'Bool');
  });

  it('TCon toString (function)', () => {
    assert.equal(tFun(TInt, TBool).toString(), '(Int -> Bool)');
  });

  it('TCon toString (nested function)', () => {
    assert.equal(tFun(TInt, tFun(TInt, TInt)).toString(), '(Int -> (Int -> Int))');
  });

  it('TCon toString (parameterized)', () => {
    assert.equal(tList(TInt).toString(), 'List<Int>');
    assert.equal(tPair(TInt, TBool).toString(), 'Pair<Int, Bool>');
  });
});

describe('Substitution', () => {
  it('empty substitution does nothing', () => {
    const s = Subst.empty();
    assert.equal(s.apply(TInt).toString(), 'Int');
  });

  it('single substitution replaces var', () => {
    const s = Subst.single('a', TInt);
    assert.equal(s.apply(new TVar('a')).toString(), 'Int');
  });

  it('leaves unrelated vars alone', () => {
    const s = Subst.single('a', TInt);
    assert.equal(s.apply(new TVar('b')).toString(), 'b');
  });

  it('applies to function types', () => {
    const s = Subst.single('a', TInt);
    const t = tFun(new TVar('a'), TBool);
    assert.equal(s.apply(t).toString(), '(Int -> Bool)');
  });

  it('composes substitutions', () => {
    const s1 = Subst.single('a', TInt);
    const s2 = Subst.single('b', new TVar('a'));
    const composed = s1.compose(s2);
    assert.equal(composed.apply(new TVar('b')).toString(), 'Int');
  });

  it('apply to scheme respects bound vars', () => {
    const s = Subst.single('a', TInt);
    const scheme = new Scheme(['a'], new TVar('a'));
    const result = s.applyScheme(scheme);
    // 'a' is bound in the scheme, so substitution shouldn't apply
    assert.equal(result.type.kind, 'TVar');
    assert.equal(result.type.name, 'a');
  });
});

describe('Free Type Variables', () => {
  it('ftv of TVar', () => {
    assert.deepEqual(ftv(new TVar('a')), new Set(['a']));
  });

  it('ftv of TCon (no args)', () => {
    assert.deepEqual(ftv(TInt), new Set());
  });

  it('ftv of function type', () => {
    const t = tFun(new TVar('a'), new TVar('b'));
    assert.deepEqual(ftv(t), new Set(['a', 'b']));
  });

  it('ftv of scheme excludes bound vars', () => {
    const scheme = new Scheme(['a'], tFun(new TVar('a'), new TVar('b')));
    assert.deepEqual(ftvScheme(scheme), new Set(['b']));
  });
});

describe('Unification', () => {
  it('unifies identical types', () => {
    const s = unify(TInt, TInt);
    assert.ok(s);
  });

  it('unifies TVar with type', () => {
    const s = unify(new TVar('a'), TInt);
    assert.equal(s.apply(new TVar('a')).toString(), 'Int');
  });

  it('unifies type with TVar', () => {
    const s = unify(TInt, new TVar('a'));
    assert.equal(s.apply(new TVar('a')).toString(), 'Int');
  });

  it('unifies function types', () => {
    const t1 = tFun(new TVar('a'), TBool);
    const t2 = tFun(TInt, new TVar('b'));
    const s = unify(t1, t2);
    assert.equal(s.apply(new TVar('a')).toString(), 'Int');
    assert.equal(s.apply(new TVar('b')).toString(), 'Bool');
  });

  it('fails on mismatched types', () => {
    assert.throws(() => unify(TInt, TBool), /Cannot unify/);
  });

  it('fails on mismatched type constructors', () => {
    assert.throws(() => unify(tList(TInt), tPair(TInt, TBool)), /Cannot unify/);
  });

  it('detects infinite types (occurs check)', () => {
    assert.throws(() => unify(new TVar('a'), tFun(new TVar('a'), TInt)), /Infinite type/);
  });

  it('unifies list types', () => {
    const s = unify(tList(new TVar('a')), tList(TInt));
    assert.equal(s.apply(new TVar('a')).toString(), 'Int');
  });
});

describe('Generalize / Instantiate', () => {
  it('generalizes free vars not in env', () => {
    resetFresh();
    const env = new Map();
    const type = tFun(new TVar('a'), new TVar('a'));
    const scheme = generalize(env, type);
    assert.ok(scheme.vars.includes('a'));
  });

  it('does not generalize env vars', () => {
    const env = new Map([['x', new Scheme([], new TVar('a'))]]);
    const type = tFun(new TVar('a'), new TVar('b'));
    const scheme = generalize(env, type);
    assert.ok(!scheme.vars.includes('a'));
    assert.ok(scheme.vars.includes('b'));
  });

  it('instantiate creates fresh vars', () => {
    resetFresh();
    const scheme = new Scheme(['a'], tFun(new TVar('a'), new TVar('a')));
    const t1 = instantiate(scheme);
    const t2 = instantiate(scheme);
    // Both should have fresh vars, but different from 'a'
    assert.notEqual(t1.toString(), t2.toString());
  });
});

describe('Type Inference — Literals', () => {
  it('infers Int', () => {
    assert.equal(typeOf(Expr.Int(42)).toString(), 'Int');
  });

  it('infers Bool', () => {
    assert.equal(typeOf(Expr.Bool(true)).toString(), 'Bool');
  });

  it('infers String', () => {
    assert.equal(typeOf(Expr.Str('hello')).toString(), 'String');
  });

  it('infers Unit', () => {
    assert.equal(typeOf(Expr.Unit()).toString(), 'Unit');
  });
});

describe('Type Inference — Lambda', () => {
  it('infers identity function', () => {
    resetFresh();
    const t = typeOf(Expr.Lam('x', Expr.Var('x')));
    assert.ok(t.toString().includes('->'));
    // Should be (t0 -> t0) or similar
    assert.equal(t.args[0].name, t.args[1].name);
  });

  it('infers function with arithmetic', () => {
    const t = typeOf(Expr.Lam('x', Expr.BinOp('+', Expr.Var('x'), Expr.Int(1))));
    assert.equal(t.toString(), '(Int -> Int)');
  });

  it('infers curried function', () => {
    const t = typeOf(
      Expr.Lam('x', Expr.Lam('y', Expr.BinOp('+', Expr.Var('x'), Expr.Var('y'))))
    );
    assert.equal(t.toString(), '(Int -> (Int -> Int))');
  });
});

describe('Type Inference — Application', () => {
  it('infers function application', () => {
    const t = typeOf(
      Expr.App(Expr.Lam('x', Expr.BinOp('+', Expr.Var('x'), Expr.Int(1))), Expr.Int(5))
    );
    assert.equal(t.toString(), 'Int');
  });

  it('rejects type mismatch in application', () => {
    assert.throws(() =>
      typeOf(Expr.App(Expr.Lam('x', Expr.BinOp('+', Expr.Var('x'), Expr.Int(1))), Expr.Bool(true))),
    /Cannot unify/);
  });
});

describe('Type Inference — Let', () => {
  it('infers let binding', () => {
    const t = typeOf(
      Expr.Let('x', Expr.Int(42), Expr.BinOp('+', Expr.Var('x'), Expr.Int(1)))
    );
    assert.equal(t.toString(), 'Int');
  });

  it('infers let-polymorphism', () => {
    // let id = fn x => x in (id 5, id true) — id should be polymorphic
    resetFresh();
    const t = typeOf(
      Expr.Let('id', Expr.Lam('x', Expr.Var('x')),
        Expr.Pair(
          Expr.App(Expr.Var('id'), Expr.Int(5)),
          Expr.App(Expr.Var('id'), Expr.Bool(true))
        )
      )
    );
    assert.ok(t.toString().includes('Int'));
    assert.ok(t.toString().includes('Bool'));
  });
});

describe('Type Inference — LetRec', () => {
  it('infers recursive function', () => {
    // letrec fact = fn n => if n == 0 then 1 else n * fact (n - 1) in fact
    const t = typeOf(
      Expr.LetRec('fact',
        Expr.Lam('n',
          Expr.If(
            Expr.BinOp('==', Expr.Var('n'), Expr.Int(0)),
            Expr.Int(1),
            Expr.BinOp('*', Expr.Var('n'),
              Expr.App(Expr.Var('fact'), Expr.BinOp('-', Expr.Var('n'), Expr.Int(1))))
          )
        ),
        Expr.Var('fact')
      )
    );
    assert.equal(t.toString(), '(Int -> Int)');
  });
});

describe('Type Inference — If', () => {
  it('infers if-then-else', () => {
    const t = typeOf(
      Expr.If(Expr.Bool(true), Expr.Int(1), Expr.Int(2))
    );
    assert.equal(t.toString(), 'Int');
  });

  it('rejects non-bool condition', () => {
    assert.throws(() =>
      typeOf(Expr.If(Expr.Int(1), Expr.Int(1), Expr.Int(2))),
    /Cannot unify/);
  });

  it('rejects mismatched branches', () => {
    assert.throws(() =>
      typeOf(Expr.If(Expr.Bool(true), Expr.Int(1), Expr.Bool(false))),
    /Cannot unify/);
  });
});

describe('Type Inference — BinOp', () => {
  it('arithmetic returns Int', () => {
    assert.equal(typeOf(Expr.BinOp('+', Expr.Int(1), Expr.Int(2))).toString(), 'Int');
  });

  it('comparison returns Bool', () => {
    assert.equal(typeOf(Expr.BinOp('<', Expr.Int(1), Expr.Int(2))).toString(), 'Bool');
  });

  it('logical returns Bool', () => {
    assert.equal(typeOf(Expr.BinOp('&&', Expr.Bool(true), Expr.Bool(false))).toString(), 'Bool');
  });

  it('rejects arithmetic on non-Int', () => {
    assert.throws(() => typeOf(Expr.BinOp('+', Expr.Bool(true), Expr.Int(1))), /Cannot unify/);
  });

  it('rejects logical on non-Bool', () => {
    assert.throws(() => typeOf(Expr.BinOp('&&', Expr.Int(1), Expr.Bool(true))), /Cannot unify/);
  });
});

describe('Type Inference — Lists', () => {
  it('infers empty list', () => {
    const t = typeOf(Expr.List([]));
    assert.ok(t.toString().startsWith('List'));
  });

  it('infers list of Ints', () => {
    const t = typeOf(Expr.List([Expr.Int(1), Expr.Int(2), Expr.Int(3)]));
    assert.equal(t.toString(), 'List<Int>');
  });

  it('rejects heterogeneous list', () => {
    assert.throws(() => typeOf(Expr.List([Expr.Int(1), Expr.Bool(true)])), /Cannot unify/);
  });
});

describe('Type Inference — Pairs', () => {
  it('infers pair', () => {
    const t = typeOf(Expr.Pair(Expr.Int(1), Expr.Bool(true)));
    assert.equal(t.toString(), 'Pair<Int, Bool>');
  });
});

describe('Type Inference — Errors', () => {
  it('rejects unbound variable', () => {
    assert.throws(() => typeOf(Expr.Var('x')), /Unbound variable/);
  });

  it('rejects applying non-function', () => {
    assert.throws(() => typeOf(Expr.App(Expr.Int(1), Expr.Int(2))), /Cannot unify/);
  });
});

describe('Type Inference — from source', () => {
  it('typeCheck simple', () => {
    assert.equal(typeCheck('42'), 'Int');
    assert.equal(typeCheck('true'), 'Bool');
  });

  it('typeCheck arithmetic', () => {
    assert.equal(typeCheck('1 + 2'), 'Int');
  });

  it('typeCheck comparison', () => {
    assert.equal(typeCheck('1 < 2'), 'Bool');
  });

  it('typeCheck if', () => {
    assert.equal(typeCheck('if true then 1 else 2'), 'Int');
  });

  it('typeCheck let', () => {
    assert.equal(typeCheck('let x = 5 in x + 1'), 'Int');
  });

  it('typeCheck lambda', () => {
    const t = typeCheck('fn x => x + 1');
    assert.equal(t, '(Int -> Int)');
  });
});

describe('Scheme toString', () => {
  it('no forall for monomorphic', () => {
    const s = new Scheme([], TInt);
    assert.equal(s.toString(), 'Int');
  });

  it('forall for polymorphic', () => {
    const s = new Scheme(['a'], tFun(new TVar('a'), new TVar('a')));
    assert.ok(s.toString().includes('forall'));
  });
});
