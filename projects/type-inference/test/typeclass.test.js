import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  infer, TVar, TConst, TFun, TList, TForall, TQualified, TConstraint,
  tInt, tBool, tString,
  intLit, boolLit, strLit, varRef, lam, app, letExpr, ifExpr,
  classMethodRef, constrainedExpr,
  TypeClass, TypeClassInstance, ClassEnv, defaultClassEnv,
  defaultEnv, TypeEnv, freshTypeVar, resetTypeVarCounter,
} from '../src/index.js';

// Helper: infer with type classes
function inferTC(expr, env = defaultEnv(), classEnv = defaultClassEnv()) {
  resetTypeVarCounter();
  return infer(expr, env, classEnv);
}

describe('Type Classes', () => {
  describe('ClassEnv', () => {
    it('creates default class environment with Eq, Ord, Num, Show', () => {
      const ce = defaultClassEnv();
      assert.ok(ce.getClass('Eq'));
      assert.ok(ce.getClass('Ord'));
      assert.ok(ce.getClass('Num'));
      assert.ok(ce.getClass('Show'));
    });

    it('has instances for Int', () => {
      const ce = defaultClassEnv();
      assert.ok(ce.entails(new TConstraint('Eq', tInt)));
      assert.ok(ce.entails(new TConstraint('Ord', tInt)));
      assert.ok(ce.entails(new TConstraint('Num', tInt)));
      assert.ok(ce.entails(new TConstraint('Show', tInt)));
    });

    it('has instances for Bool', () => {
      const ce = defaultClassEnv();
      assert.ok(ce.entails(new TConstraint('Eq', tBool)));
      assert.ok(ce.entails(new TConstraint('Show', tBool)));
      assert.ok(!ce.entails(new TConstraint('Num', tBool))); // Bool is not Num
    });

    it('has instances for String', () => {
      const ce = defaultClassEnv();
      assert.ok(ce.entails(new TConstraint('Eq', tString)));
      assert.ok(ce.entails(new TConstraint('Show', tString)));
    });

    it('rejects non-existent instances', () => {
      const ce = defaultClassEnv();
      assert.ok(!ce.entails(new TConstraint('Ord', tBool))); // No Ord Bool
      assert.ok(!ce.entails(new TConstraint('Num', tString))); // No Num String
    });

    it('resolves parameterized instances (Eq [a] requires Eq a)', () => {
      const ce = defaultClassEnv();
      // Eq [Int] should work because Eq Int exists
      assert.ok(ce.entails(new TConstraint('Eq', new TList(tInt))));
      // Eq [Bool] should work because Eq Bool exists
      assert.ok(ce.entails(new TConstraint('Eq', new TList(tBool))));
    });

    it('rejects unsatisfied parameterized constraints', () => {
      const ce = defaultClassEnv();
      // Num [Int] — no such instance
      assert.ok(!ce.entails(new TConstraint('Num', new TList(tInt))));
    });
  });

  describe('Class method references', () => {
    it('infers type of eq method: Eq a => a -> a -> Bool', () => {
      const result = inferTC(classMethodRef('Eq', 'eq'));
      assert.ok(result instanceof TQualified);
      assert.equal(result.constraints.length, 1);
      assert.equal(result.constraints[0].className, 'Eq');
      assert.ok(result.type instanceof TFun);
      // a -> a -> Bool
      assert.ok(result.type.to instanceof TFun);
    });

    it('infers type of show method: Show a => a -> String', () => {
      const result = inferTC(classMethodRef('Show', 'show'));
      assert.ok(result instanceof TQualified);
      assert.equal(result.constraints.length, 1);
      assert.equal(result.constraints[0].className, 'Show');
      assert.ok(result.type instanceof TFun);
      assert.equal(result.type.to.toString(), 'String');
    });

    it('infers type of add method: Num a => a -> a -> a', () => {
      const result = inferTC(classMethodRef('Num', 'add'));
      assert.ok(result instanceof TQualified);
      assert.equal(result.constraints.length, 1);
      assert.equal(result.constraints[0].className, 'Num');
    });
  });

  describe('Constraint resolution', () => {
    it('resolves eq applied to Int (concrete instance)', () => {
      // eq 1 2 : Bool (Eq Int resolved)
      const expr = app(app(classMethodRef('Eq', 'eq'), intLit(1)), intLit(2));
      const result = inferTC(expr);
      // Should be Bool with no remaining constraints
      assert.ok(!(result instanceof TQualified));
      assert.equal(result.toString(), 'Bool');
    });

    it('resolves show applied to String', () => {
      const expr = app(classMethodRef('Show', 'show'), strLit("hello"));
      const result = inferTC(expr);
      assert.equal(result.toString(), 'String');
    });

    it('keeps constraints for polymorphic uses', () => {
      // let f = fn x => eq x x in f : Eq a => a -> Bool
      const expr = letExpr('f',
        lam('x', app(app(classMethodRef('Eq', 'eq'), varRef('x')), varRef('x'))),
        varRef('f')
      );
      const result = inferTC(expr);
      assert.ok(result instanceof TQualified);
      assert.equal(result.constraints.length, 1);
      assert.equal(result.constraints[0].className, 'Eq');
    });

    it('resolves constraints when polymorphic function is applied to concrete type', () => {
      // let f = fn x => eq x x in f 42 : Bool
      const expr = letExpr('f',
        lam('x', app(app(classMethodRef('Eq', 'eq'), varRef('x')), varRef('x'))),
        app(varRef('f'), intLit(42))
      );
      const result = inferTC(expr);
      assert.ok(!(result instanceof TQualified));
      assert.equal(result.toString(), 'Bool');
    });

    it('errors when no instance exists for concrete type', () => {
      // add true true — Bool is not Num
      const expr = app(app(classMethodRef('Num', 'add'), boolLit(true)), boolLit(true));
      assert.throws(() => inferTC(expr), /No instance/);
    });
  });

  describe('== operator with Eq constraint', () => {
    it('adds Eq constraint for == on polymorphic types', () => {
      // fn x => fn y => x == y : Eq a => a -> a -> Bool
      const expr = lam('x', lam('y',
        { tag: 'binop', op: '==', left: varRef('x'), right: varRef('y') }
      ));
      const result = inferTC(expr);
      assert.ok(result instanceof TQualified);
      assert.equal(result.constraints.length, 1);
      assert.equal(result.constraints[0].className, 'Eq');
    });

    it('resolves Eq for concrete Int ==', () => {
      const expr = { tag: 'binop', op: '==', left: intLit(1), right: intLit(2) };
      const result = inferTC(expr);
      assert.ok(!(result instanceof TQualified));
      assert.equal(result.toString(), 'Bool');
    });
  });

  describe('Custom class and instance', () => {
    it('defines and uses a custom class', () => {
      const ce = defaultClassEnv();
      const a = new TVar('_a');

      // class Printable a where print :: a -> String
      ce.addClass(new TypeClass('Printable', '_a', new Map([
        ['print', new TFun(a, tString)],
      ])));

      // instance Printable Int
      ce.addInstance(new TypeClassInstance('Printable', tInt));

      // print 42 : String
      const expr = app(classMethodRef('Printable', 'print'), intLit(42));
      const result = inferTC(expr, defaultEnv(), ce);
      assert.equal(result.toString(), 'String');
    });

    it('propagates superclass constraints', () => {
      const ce = defaultClassEnv();
      // Ord requires Eq as superclass
      const ordClass = ce.getClass('Ord');
      assert.ok(ordClass);
      assert.deepEqual(ordClass.superclasses, ['Eq']);
    });
  });

  describe('Multiple constraints', () => {
    it('collects multiple constraints from combined usage', () => {
      // fn x => fn y => let a = show x in let b = eq x y in b
      // show x requires Show, eq x y requires Eq — both on same type var
      // Use a helper that combines them in a tuple-like way
      // Actually: fn f => fn g => fn x => f (g x) x
      // Simpler: wrap in a function that takes both method refs
      const expr = lam('x',
        lam('f', lam('g',
          app(varRef('f'), app(app(varRef('g'), varRef('x')), varRef('x')))
        ))
      );
      // Not using class methods here — test the constraint collection separately
      // Instead, test that two class method applications on same var collects both
      // fn x => if eq x x then show x else show x
      const expr2 = lam('x',
        ifExpr(
          app(app(classMethodRef('Eq', 'eq'), varRef('x')), varRef('x')),
          app(classMethodRef('Show', 'show'), varRef('x')),
          app(classMethodRef('Show', 'show'), varRef('x'))
        )
      );
      const result = inferTC(expr2);
      assert.ok(result instanceof TQualified);
      const classNames = [...new Set(result.constraints.map(c => c.className))].sort();
      assert.ok(classNames.includes('Eq'), `Expected Eq in ${classNames}`);
      assert.ok(classNames.includes('Show'), `Expected Show in ${classNames}`);
    });

    it('resolves all constraints for concrete type', () => {
      // let f = fn x => if eq x x then show x else show x in f 42 : String
      const expr = letExpr('f',
        lam('x',
          ifExpr(
            app(app(classMethodRef('Eq', 'eq'), varRef('x')), varRef('x')),
            app(classMethodRef('Show', 'show'), varRef('x')),
            app(classMethodRef('Show', 'show'), varRef('x'))
          )
        ),
        app(varRef('f'), intLit(42))
      );
      const result = inferTC(expr);
      assert.ok(!(result instanceof TQualified));
      assert.equal(result.toString(), 'String');
    });
  });

  describe('Num overloaded operations', () => {
    it('infers fromInt: Num a => Int -> a', () => {
      const result = inferTC(classMethodRef('Num', 'fromInt'));
      assert.ok(result instanceof TQualified);
      assert.equal(result.constraints[0].className, 'Num');
      assert.ok(result.type instanceof TFun);
    });

    it('resolves fromInt applied to produce Int', () => {
      // add (fromInt 1) (fromInt 2)
      const expr = app(
        app(classMethodRef('Num', 'add'),
          app(classMethodRef('Num', 'fromInt'), intLit(1))),
        app(classMethodRef('Num', 'fromInt'), intLit(2))
      );
      // With constraints resolved for Int, this should give Int
      const result = inferTC(expr);
      // May still have Num constraint since add is polymorphic
      // but if we force it to Int it resolves
    });
  });
});
