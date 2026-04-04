import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  Star, KArrow, star, kArrow,
  KindEnv, defaultKindEnv, inferKind, checkKind,
  TVar, TConst, TFun, TApp, TList, TTuple, TRecord, TRowEmpty,
  tInt, tBool, tString,
  record,
} from '../src/index.js';

describe('Kind System', () => {
  describe('Kind representation', () => {
    it('Star toString', () => {
      assert.equal(star.toString(), '*');
    });

    it('KArrow toString', () => {
      assert.equal(kArrow(star, star).toString(), '* -> *');
    });

    it('nested KArrow toString', () => {
      assert.equal(kArrow(kArrow(star, star), star).toString(), '(* -> *) -> *');
    });

    it('right-associative KArrow toString', () => {
      assert.equal(kArrow(star, kArrow(star, star)).toString(), '* -> * -> *');
    });

    it('Star equals Star', () => {
      assert.ok(star.equals(new Star()));
    });

    it('KArrow equality', () => {
      assert.ok(kArrow(star, star).equals(kArrow(star, star)));
      assert.ok(!kArrow(star, star).equals(star));
    });
  });

  describe('Kind environment', () => {
    it('default env has base types at kind *', () => {
      const ke = defaultKindEnv();
      assert.ok(ke.lookup('Int').equals(star));
      assert.ok(ke.lookup('Bool').equals(star));
      assert.ok(ke.lookup('String').equals(star));
    });

    it('default env has List at kind * -> *', () => {
      const ke = defaultKindEnv();
      assert.ok(ke.lookup('List').equals(kArrow(star, star)));
    });

    it('default env has Maybe at kind * -> *', () => {
      const ke = defaultKindEnv();
      assert.ok(ke.lookup('Maybe').equals(kArrow(star, star)));
    });

    it('default env has Either at kind * -> * -> *', () => {
      const ke = defaultKindEnv();
      assert.ok(ke.lookup('Either').equals(kArrow(star, kArrow(star, star))));
    });

    it('extends with new binding', () => {
      const ke = defaultKindEnv().extend('Tree', kArrow(star, star));
      assert.ok(ke.lookup('Tree').equals(kArrow(star, star)));
    });
  });

  describe('Kind inference', () => {
    it('Int has kind *', () => {
      assert.ok(inferKind(tInt).equals(star));
    });

    it('Bool has kind *', () => {
      assert.ok(inferKind(tBool).equals(star));
    });

    it('Function type has kind *', () => {
      const funType = new TFun(tInt, tBool);
      assert.ok(inferKind(funType).equals(star));
    });

    it('TApp with fully applied constructor has kind *', () => {
      // Maybe Int : *
      const maybeInt = new TApp('Maybe', [tInt]);
      assert.ok(inferKind(maybeInt).equals(star));
    });

    it('TApp with partially applied constructor has higher kind', () => {
      // Either Int : * -> *
      const eitherInt = new TApp('Either', [tInt]);
      assert.ok(inferKind(eitherInt).equals(kArrow(star, star)));
    });

    it('TApp with fully applied Either has kind *', () => {
      // Either Int Bool : *
      const eitherIntBool = new TApp('Either', [tInt, tBool]);
      assert.ok(inferKind(eitherIntBool).equals(star));
    });

    it('List type has kind *', () => {
      const listInt = new TList(tInt);
      assert.ok(inferKind(listInt).equals(star));
    });

    it('Tuple type has kind *', () => {
      const tuple = new TTuple([tInt, tBool]);
      assert.ok(inferKind(tuple).equals(star));
    });

    it('Record type has kind *', () => {
      const rec = record({ name: tString, age: tInt });
      assert.ok(inferKind(rec).equals(star));
    });

    it('type variable defaults to kind *', () => {
      const a = new TVar('a');
      assert.ok(inferKind(a).equals(star));
    });

    it('type variable with explicit kind', () => {
      const ke = defaultKindEnv().extend('f', kArrow(star, star));
      const f = new TVar('f');
      assert.ok(inferKind(f, ke).equals(kArrow(star, star)));
    });
  });

  describe('Kind checking', () => {
    it('checkKind passes for kind *', () => {
      assert.ok(checkKind(tInt));
      assert.ok(checkKind(new TFun(tInt, tBool)));
      assert.ok(checkKind(new TApp('Maybe', [tInt])));
    });

    it('checkKind fails for partially applied constructor', () => {
      // Either Int has kind * -> *, not *
      assert.throws(() => checkKind(new TApp('Either', [tInt])));
    });

    it('rejects over-application', () => {
      // Maybe Int Bool — too many args
      assert.throws(() => inferKind(new TApp('Maybe', [tInt, tBool])));
    });

    it('rejects kind mismatch in application', () => {
      // If we try to use a * type where * -> * is expected
      const ke = defaultKindEnv().extend('Apply', kArrow(kArrow(star, star), star));
      // Apply Int — Int has kind *, but Apply expects * -> *
      assert.throws(() => inferKind(new TApp('Apply', [tInt]), ke));
    });

    it('accepts correct higher-kinded application', () => {
      const ke = defaultKindEnv().extend('Apply', kArrow(kArrow(star, star), star));
      // We need a way to pass Maybe (kind * -> *) to Apply
      // This requires treating Maybe as a type — use TConst for the constructor name
      const maybe = new TConst('Maybe');
      // Apply Maybe : *
      const result = inferKind(new TApp('Apply', [maybe]), ke);
      assert.ok(result.equals(star));
    });
  });

  describe('Higher-kinded type variables', () => {
    it('type variable with kind * -> * can be applied', () => {
      // f : * -> *, a : * → f a : *
      const ke = defaultKindEnv()
        .extend('f', kArrow(star, star))
        .extend('FApp', kArrow(kArrow(star, star), kArrow(star, star)));

      const f = new TConst('f');
      // We can check that f has kind * -> *
      assert.ok(inferKind(f, ke).equals(kArrow(star, star)));
    });
  });
});
