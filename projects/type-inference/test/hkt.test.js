import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  infer, unify, TVar, TConst, TFun, TApp, THKApp, TForall, TQualified, TConstraint,
  tInt, tBool, tString,
  intLit, boolLit, strLit, varRef, lam, app, letExpr,
  classMethodRef,
  TypeClass, TypeClassInstance, ClassEnv,
  defaultClassEnv, defaultEnv,
  registerFunctorClass, registerApplicativeClass, registerMonadClass,
  registerMaybeInstances, registerListInstances,
  Star, KArrow, star, kArrow, defaultKindEnv, inferKind,
  freshTypeVar, resetTypeVarCounter,
} from '../src/index.js';

// Build a class env with Functor/Applicative/Monad + Maybe/List instances
function hktClassEnv() {
  let ce = defaultClassEnv();
  registerFunctorClass(ce);
  registerApplicativeClass(ce);
  registerMonadClass(ce);
  registerMaybeInstances(ce);
  registerListInstances(ce);
  return ce;
}

function inferHKT(expr, env = defaultEnv(), classEnv = hktClassEnv()) {
  resetTypeVarCounter();
  return infer(expr, env, classEnv);
}

describe('Higher-Kinded Types', () => {
  describe('THKApp type', () => {
    it('represents f a', () => {
      const f = new TVar('f');
      const a = new TVar('a');
      const fa = new THKApp(f, [a]);
      assert.equal(fa.toString(), 'f a');
    });

    it('represents f a b', () => {
      const f = new TVar('f');
      const a = new TVar('a');
      const b = new TVar('b');
      const fab = new THKApp(f, [a, b]);
      assert.equal(fab.toString(), 'f a b');
    });

    it('collects free vars from constructor and args', () => {
      const fa = new THKApp(new TVar('f'), [new TVar('a')]);
      assert.deepEqual([...fa.freeVars()].sort(), ['a', 'f']);
    });

    it('applies substitution to constructor', () => {
      const fa = new THKApp(new TVar('f'), [new TVar('a')]);
      const result = fa.apply(new Map([['f', new TConst('Maybe')]]));
      // Should become TApp('Maybe', [TVar('a')])
      assert.ok(result instanceof TApp);
      assert.equal(result.name, 'Maybe');
    });

    it('applies substitution to args', () => {
      const fa = new THKApp(new TVar('f'), [new TVar('a')]);
      const result = fa.apply(new Map([['a', tInt]]));
      assert.ok(result instanceof THKApp);
      assert.equal(result.args[0].toString(), 'Int');
    });
  });

  describe('THKApp unification', () => {
    it('unifies two THKApps with same constructor', () => {
      const fa = new THKApp(new TVar('f'), [tInt]);
      const ga = new THKApp(new TVar('f'), [new TVar('a')]);
      const s = unify(fa, ga);
      assert.equal(s.get('a').toString(), 'Int');
    });

    it('unifies THKApp with TApp', () => {
      // f Int ~ Maybe Int → f = Maybe
      const fa = new THKApp(new TVar('f'), [tInt]);
      const maybeInt = new TApp('Maybe', [tInt]);
      const s = unify(fa, maybeInt);
      assert.equal(s.get('f').toString(), 'Maybe');
    });

    it('unifies THKApp with TApp resolving both constructor and arg', () => {
      const fa = new THKApp(new TVar('f'), [new TVar('a')]);
      const listBool = new TApp('List', [tBool]);
      const s = unify(fa, listBool);
      assert.equal(s.get('f').toString(), 'List');
      assert.equal(s.get('a').toString(), 'Bool');
    });
  });

  describe('HKT class declarations', () => {
    it('Functor class exists', () => {
      const ce = hktClassEnv();
      assert.ok(ce.getClass('Functor'));
      assert.ok(ce.getClass('Functor').methods.has('fmap'));
    });

    it('Applicative class exists with Functor superclass', () => {
      const ce = hktClassEnv();
      const app = ce.getClass('Applicative');
      assert.ok(app);
      assert.ok(app.methods.has('pure'));
      assert.ok(app.methods.has('ap'));
      assert.deepEqual(app.superclasses, ['Functor']);
    });

    it('Monad class exists with Applicative superclass', () => {
      const ce = hktClassEnv();
      const m = ce.getClass('Monad');
      assert.ok(m);
      assert.ok(m.methods.has('bind'));
      assert.ok(m.methods.has('return_'));
      assert.deepEqual(m.superclasses, ['Applicative']);
    });
  });

  describe('HKT instances', () => {
    it('Maybe is a Functor', () => {
      const ce = hktClassEnv();
      assert.ok(ce.entails(new TConstraint('Functor', new TConst('Maybe'))));
    });

    it('List is a Functor', () => {
      const ce = hktClassEnv();
      assert.ok(ce.entails(new TConstraint('Functor', new TConst('List'))));
    });

    it('Maybe is a Monad', () => {
      const ce = hktClassEnv();
      assert.ok(ce.entails(new TConstraint('Monad', new TConst('Maybe'))));
    });

    it('Int is not a Functor', () => {
      const ce = hktClassEnv();
      assert.ok(!ce.entails(new TConstraint('Functor', tInt)));
    });
  });

  describe('HKT method inference', () => {
    it('fmap has qualified type: Functor f => (a -> b) -> f a -> f b', () => {
      const result = inferHKT(classMethodRef('Functor', 'fmap'));
      assert.ok(result instanceof TQualified);
      assert.equal(result.constraints.length, 1);
      assert.equal(result.constraints[0].className, 'Functor');
      // The type should be (a -> b) -> f a -> f b
      assert.ok(result.type instanceof TFun);
    });

    it('pure has qualified type: Applicative f => a -> f a', () => {
      const result = inferHKT(classMethodRef('Applicative', 'pure'));
      assert.ok(result instanceof TQualified);
      assert.equal(result.constraints[0].className, 'Applicative');
    });

    it('bind has qualified type: Monad m => m a -> (a -> m b) -> m b', () => {
      const result = inferHKT(classMethodRef('Monad', 'bind'));
      assert.ok(result instanceof TQualified);
      assert.equal(result.constraints[0].className, 'Monad');
    });
  });

  describe('HKT method application', () => {
    it('fmap applied to Maybe resolves Functor constraint', () => {
      // fmap (fn x => x + 1) (Just 1) — but we simplify:
      // Just use: let f = fn g => fn ma => fmap g ma
      // Then apply with concrete type to resolve
      const env = defaultEnv();
      // Add Just :: a -> Maybe a
      const a = new TVar('_a');
      env.bindings.set('Just', new TForall(['_a'], new TFun(a, new TApp('Maybe', [a]))));

      // fmap (fn x => x) (Just 42) — simplified
      const expr = app(
        app(classMethodRef('Functor', 'fmap'), lam('x', varRef('x'))),
        app(varRef('Just'), intLit(42))
      );
      const result = inferHKT(expr, env);
      // Should resolve to Maybe Int (Functor Maybe is satisfied)
      const str = result.toString();
      assert.ok(str.includes('Maybe') && str.includes('Int'), `Expected Maybe Int, got ${str}`);
    });

    it('pure wraps a value in a Functor context', () => {
      const result = inferHKT(classMethodRef('Applicative', 'pure'));
      assert.ok(result instanceof TQualified);
      // pure :: Applicative f => a -> f a
      const fnType = result.type;
      assert.ok(fnType instanceof TFun);
    });
  });

  describe('Kind inference with HKT', () => {
    it('Maybe has kind * -> *', () => {
      const ke = defaultKindEnv();
      assert.ok(ke.lookup('Maybe').equals(kArrow(star, star)));
    });

    it('THKApp f a with f : * -> * has kind *', () => {
      const ke = defaultKindEnv().extend('f', kArrow(star, star));
      const fa = new TApp('f', [tInt]);
      // For kind checking purposes, we'd need to register f as a type constructor
      // This is more of a conceptual test
      assert.ok(inferKind(fa, ke).equals(star));
    });
  });
});
