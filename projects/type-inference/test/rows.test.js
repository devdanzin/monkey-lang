import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  infer, unify, TVar, TFun, TRecord, TRowEmpty, TRowExtend,
  tInt, tBool, tString,
  intLit, boolLit, strLit, varRef, lam, app, letExpr,
  record, recordLit, recordAccess, recordExtend, recordRestrict,
  defaultEnv, freshTypeVar, resetTypeVarCounter, UnificationError,
} from '../src/index.js';

function inferExpr(expr) {
  resetTypeVarCounter();
  return infer(expr);
}

describe('Row Polymorphism', () => {
  describe('Record types', () => {
    it('builds closed record type', () => {
      const t = record({ name: tString, age: tInt });
      assert.ok(t instanceof TRecord);
      assert.ok(t.row instanceof TRowExtend);
      assert.equal(t.row.label, 'name');
    });

    it('builds open record type with tail', () => {
      const r = new TVar('r');
      const t = record({ name: tString }, r);
      assert.ok(t instanceof TRecord);
      const str = t.toString();
      assert.ok(str.includes('name'), `Expected 'name' in ${str}`);
      assert.ok(str.includes('r'), `Expected row var in ${str}`);
    });

    it('toString shows closed record nicely', () => {
      const t = record({ name: tString, age: tInt });
      const s = t.toString();
      assert.ok(s.includes('name: String'));
      assert.ok(s.includes('age: Int'));
    });
  });

  describe('Record inference', () => {
    it('infers type of record literal', () => {
      const expr = recordLit({ x: intLit(1), y: boolLit(true) });
      const result = inferExpr(expr);
      assert.ok(result instanceof TRecord);
      const str = result.toString();
      assert.ok(str.includes('x: Int'), `Expected x: Int in ${str}`);
      assert.ok(str.includes('y: Bool'), `Expected y: Bool in ${str}`);
    });

    it('infers type of nested record literal', () => {
      const expr = recordLit({
        name: strLit("Henry"),
        pos: recordLit({ x: intLit(0), y: intLit(0) })
      });
      const result = inferExpr(expr);
      const str = result.toString();
      assert.ok(str.includes('name: String'));
      assert.ok(str.includes('x: Int'));
    });
  });

  describe('Record access', () => {
    it('infers type of field access on known record', () => {
      // { x: 1, y: true }.x : Int
      const expr = recordAccess(recordLit({ x: intLit(1), y: boolLit(true) }), 'x');
      const result = inferExpr(expr);
      assert.equal(result.toString(), 'Int');
    });

    it('infers type of another field', () => {
      const expr = recordAccess(recordLit({ x: intLit(1), y: boolLit(true) }), 'y');
      const result = inferExpr(expr);
      assert.equal(result.toString(), 'Bool');
    });

    it('infers polymorphic record access function', () => {
      // fn r => r.name : { name: a | r } -> a
      const expr = lam('r', recordAccess(varRef('r'), 'name'));
      const result = inferExpr(expr);
      assert.ok(result instanceof TFun);
      assert.ok(result.from instanceof TRecord, `Expected record input, got ${result.from}`);
      // The function should accept any record with a 'name' field
    });

    it('polymorphic access works on different records', () => {
      // let getName = fn r => r.name in getName { name: "hello", age: 42 }
      const expr = letExpr('getName',
        lam('r', recordAccess(varRef('r'), 'name')),
        app(varRef('getName'), recordLit({ name: strLit("hello"), age: intLit(42) }))
      );
      const result = inferExpr(expr);
      assert.equal(result.toString(), 'String');
    });

    it('polymorphic access preserves extra fields', () => {
      // let getName = fn r => r.name in getName { name: 42, x: true }
      const expr = letExpr('getName',
        lam('r', recordAccess(varRef('r'), 'name')),
        app(varRef('getName'), recordLit({ name: intLit(42), x: boolLit(true) }))
      );
      const result = inferExpr(expr);
      assert.equal(result.toString(), 'Int');
    });

    it('rejects access on record without the field', () => {
      // { x: 1 }.y — should fail
      const expr = recordAccess(recordLit({ x: intLit(1) }), 'y');
      assert.throws(() => inferExpr(expr));
    });
  });

  describe('Record extension', () => {
    it('extends a record with a new field', () => {
      // { x: 1 } with z = true  →  { z: Bool, x: Int }
      const expr = recordExtend(recordLit({ x: intLit(1) }), 'z', boolLit(true));
      const result = inferExpr(expr);
      assert.ok(result instanceof TRecord);
      const str = result.toString();
      assert.ok(str.includes('z: Bool'), `Expected z: Bool in ${str}`);
      assert.ok(str.includes('x: Int'), `Expected x: Int in ${str}`);
    });

    it('polymorphic extension function', () => {
      // fn r => r with tag = true : { ... | r } -> { tag: Bool, ... | r }
      const expr = lam('r', recordExtend(varRef('r'), 'tag', boolLit(true)));
      const result = inferExpr(expr);
      assert.ok(result instanceof TFun);
      assert.ok(result.to instanceof TRecord);
    });
  });

  describe('Record restriction', () => {
    it('removes a field from a record', () => {
      // { x: 1, y: true } without x  →  { y: Bool }
      const expr = recordRestrict(recordLit({ x: intLit(1), y: boolLit(true) }), 'x');
      const result = inferExpr(expr);
      assert.ok(result instanceof TRecord);
      const str = result.toString();
      assert.ok(str.includes('y: Bool'), `Expected y: Bool in ${str}`);
      assert.ok(!str.includes('x:'), `Unexpected x in ${str}`);
    });

    it('restriction of non-existent field fails', () => {
      const expr = recordRestrict(recordLit({ x: intLit(1) }), 'z');
      assert.throws(() => inferExpr(expr));
    });
  });

  describe('Row unification', () => {
    it('unifies two identical closed records', () => {
      const r1 = record({ x: tInt, y: tBool });
      const r2 = record({ x: tInt, y: tBool });
      const s = unify(r1, r2);
      assert.ok(s.size === 0);
    });

    it('unifies records with same labels in different order', () => {
      const r1 = record({ x: tInt, y: tBool });
      const r2 = record({ y: tBool, x: tInt });
      const s = unify(r1, r2);
      // Should succeed
      assert.ok(s !== null);
    });

    it('fails to unify records with different labels', () => {
      const r1 = record({ x: tInt });
      const r2 = record({ y: tInt });
      assert.throws(() => unify(r1, r2));
    });

    it('unifies open row with closed row', () => {
      resetTypeVarCounter();
      const r = new TVar('r');
      const open = record({ x: tInt }, r);
      const closed = record({ x: tInt, y: tBool });
      const s = unify(open, closed);
      assert.ok(s.size > 0);
    });

    it('unifies open row with larger closed row', () => {
      resetTypeVarCounter();
      const r = new TVar('r');
      const open = record({ name: tString }, r);
      const closed = record({ name: tString, age: tInt, email: tString });
      const s = unify(open, closed);
      assert.ok(s.size > 0);
    });
  });

  describe('Row polymorphism with let', () => {
    it('access function works on different-shaped records (width subtyping)', () => {
      // let getX = fn r => r.x in
      // let a = getX { x: 1 } in
      // let b = getX { x: 2, y: true } in
      // a + b
      const expr = letExpr('getX',
        lam('r', recordAccess(varRef('r'), 'x')),
        letExpr('a',
          app(varRef('getX'), recordLit({ x: intLit(1) })),
          letExpr('b',
            app(varRef('getX'), recordLit({ x: intLit(2), y: boolLit(true) })),
            { tag: 'binop', op: '+', left: varRef('a'), right: varRef('b') }
          )
        )
      );
      const result = inferExpr(expr);
      assert.equal(result.toString(), 'Int');
    });

    it('passes record through functions preserving extra fields', () => {
      // let addTag = fn r => r with tag = true in
      // let r = addTag { name: "x" } in
      // r.name
      const expr = letExpr('addTag',
        lam('r', recordExtend(varRef('r'), 'tag', boolLit(true))),
        letExpr('r',
          app(varRef('addTag'), recordLit({ name: strLit("x") })),
          recordAccess(varRef('r'), 'name')
        )
      );
      const result = inferExpr(expr);
      assert.equal(result.toString(), 'String');
    });

    it('can access newly added field after extension', () => {
      // let addTag = fn r => r with tag = true in
      // let r = addTag { name: "x" } in
      // r.tag
      const expr = letExpr('addTag',
        lam('r', recordExtend(varRef('r'), 'tag', boolLit(true))),
        letExpr('r',
          app(varRef('addTag'), recordLit({ name: strLit("x") })),
          recordAccess(varRef('r'), 'tag')
        )
      );
      const result = inferExpr(expr);
      assert.equal(result.toString(), 'Bool');
    });
  });
});
