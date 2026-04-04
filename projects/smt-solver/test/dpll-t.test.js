import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { 
  DPLLTSolver, parseSexp, parseSmtLib, sexpToLiteral, solveSmt,
  term, eq, neq 
} from '../src/index.js';

// ===== S-Expression Parser =====
describe('S-Expression parser', () => {
  it('parses atoms', () => {
    const r = parseSexp('hello world 42');
    assert.deepEqual(r, ['hello', 'world', 42]);
  });

  it('parses nested lists', () => {
    const r = parseSexp('(a (b c) d)');
    assert.deepEqual(r, [['a', ['b', 'c'], 'd']]);
  });

  it('parses SMT-LIB declare-fun', () => {
    const r = parseSexp('(declare-fun f (Int) Int)');
    assert.deepEqual(r, [['declare-fun', 'f', ['Int'], 'Int']]);
  });

  it('handles comments', () => {
    const r = parseSexp('; comment\n(a b)');
    assert.deepEqual(r, [['a', 'b']]);
  });

  it('handles empty list', () => {
    const r = parseSexp('()');
    assert.deepEqual(r, [[]]);
  });

  it('handles string literals', () => {
    const r = parseSexp('(set-info :source "test")');
    assert.deepEqual(r, [['set-info', ':source', { type: 'string', value: 'test' }]]);
  });
});

// ===== SMT-LIB Parser =====
describe('SMT-LIB parser', () => {
  it('parses declarations and assertions', () => {
    const input = `
      (declare-const a Int)
      (declare-const b Int)
      (assert (= a b))
      (check-sat)
    `;
    const { declarations, assertions } = parseSmtLib(input);
    assert.equal(declarations.size, 2);
    assert.equal(assertions.length, 1);
  });

  it('parses status info', () => {
    const input = `
      (set-info :status sat)
      (assert (= a b))
    `;
    const { status } = parseSmtLib(input);
    assert.equal(status, 'sat');
  });
});

// ===== DPLL(T) Integration =====
describe('DPLL(T) — basic', () => {
  it('satisfies simple equality: a = b', () => {
    const solver = new DPLLTSolver();
    const a = term('a'), b = term('b');
    solver.euf.register(a);
    solver.euf.register(b);
    solver.assert(eq(a, b));
    
    const r = solver.solve();
    assert.equal(r.sat, true);
  });

  it('detects contradiction: a = b AND a ≠ b', () => {
    const solver = new DPLLTSolver();
    const a = term('a'), b = term('b');
    solver.euf.register(a);
    solver.euf.register(b);
    solver.assert(eq(a, b));
    solver.assert(neq(a, b));
    
    const r = solver.solve();
    assert.equal(r.sat, false);
  });

  it('detects transitivity contradiction: a=b, b=c, a≠c', () => {
    const solver = new DPLLTSolver();
    const a = term('a'), b = term('b'), c = term('c');
    solver.euf.register(a);
    solver.euf.register(b);
    solver.euf.register(c);
    solver.assert(eq(a, b));
    solver.assert(eq(b, c));
    solver.assert(neq(a, c));
    
    const r = solver.solve();
    assert.equal(r.sat, false);
  });

  it('satisfies consistent theory: a=b, b=c, c≠d', () => {
    const solver = new DPLLTSolver();
    const a = term('a'), b = term('b'), c = term('c'), d = term('d');
    solver.euf.register(a); solver.euf.register(b);
    solver.euf.register(c); solver.euf.register(d);
    solver.assert(eq(a, b));
    solver.assert(eq(b, c));
    solver.assert(neq(c, d));
    
    const r = solver.solve();
    assert.equal(r.sat, true);
  });

  it('congruence contradiction: a=b, f(a)≠f(b)', () => {
    const solver = new DPLLTSolver();
    const a = term('a'), b = term('b');
    const fa = term('f', a), fb = term('f', b);
    solver.euf.register(fa); solver.euf.register(fb);
    solver.assert(eq(a, b));
    solver.assert(neq(fa, fb));
    
    const r = solver.solve();
    assert.equal(r.sat, false);
  });

  it('congruence consistent: a≠b, f(a)=f(b)', () => {
    // f could be a constant function
    const solver = new DPLLTSolver();
    const a = term('a'), b = term('b');
    const fa = term('f', a), fb = term('f', b);
    solver.euf.register(fa); solver.euf.register(fb);
    solver.assert(neq(a, b));
    solver.assert(eq(fa, fb));
    
    const r = solver.solve();
    assert.equal(r.sat, true);
  });
});

describe('DPLL(T) — Boolean + Theory', () => {
  it('AND of equalities', () => {
    const solver = new DPLLTSolver();
    const a = term('a'), b = term('b'), c = term('c');
    solver.euf.register(a); solver.euf.register(b); solver.euf.register(c);
    
    solver.assert({
      type: 'and',
      children: [eq(a, b), eq(b, c)]
    });
    
    const r = solver.solve();
    assert.equal(r.sat, true);
  });

  it('AND with contradiction', () => {
    const solver = new DPLLTSolver();
    const a = term('a'), b = term('b');
    solver.euf.register(a); solver.euf.register(b);
    
    solver.assert({
      type: 'and',
      children: [eq(a, b), neq(a, b)]
    });
    
    const r = solver.solve();
    assert.equal(r.sat, false);
  });

  it('OR of equalities (disjunction)', () => {
    const solver = new DPLLTSolver();
    const a = term('a'), b = term('b'), c = term('c');
    solver.euf.register(a); solver.euf.register(b); solver.euf.register(c);
    
    // (a=b OR b=c) — should be SAT
    solver.assert({
      type: 'or',
      children: [eq(a, b), eq(b, c)]
    });
    
    const r = solver.solve();
    assert.equal(r.sat, true);
  });

  it('implication: a=b => f(a)=f(b) is always SAT', () => {
    const solver = new DPLLTSolver();
    const a = term('a'), b = term('b');
    const fa = term('f', a), fb = term('f', b);
    solver.euf.register(fa); solver.euf.register(fb);
    
    solver.assert({
      type: 'implies',
      left: eq(a, b),
      right: eq(fa, fb)
    });
    
    const r = solver.solve();
    assert.equal(r.sat, true);
  });
});

// ===== SMT-LIB End-to-End =====
describe('SMT-LIB end-to-end', () => {
  it('simple SAT: a = b', () => {
    const r = solveSmt(`
      (set-logic QF_UF)
      (declare-const a Bool)
      (declare-const b Bool)
      (assert (= a b))
      (check-sat)
    `);
    assert.equal(r.sat, true);
  });

  it('simple UNSAT: a = b, a ≠ b', () => {
    const r = solveSmt(`
      (set-logic QF_UF)
      (declare-const a Int)
      (declare-const b Int)
      (assert (= a b))
      (assert (not (= a b)))
      (check-sat)
    `);
    assert.equal(r.sat, false);
  });

  it('transitivity UNSAT: a=b, b=c, a≠c', () => {
    const r = solveSmt(`
      (set-logic QF_UF)
      (declare-const a Int)
      (declare-const b Int)
      (declare-const c Int)
      (assert (= a b))
      (assert (= b c))
      (assert (not (= a c)))
      (check-sat)
    `);
    assert.equal(r.sat, false);
  });

  it('congruence UNSAT via SMT-LIB', () => {
    const r = solveSmt(`
      (set-logic QF_UF)
      (declare-fun f (Int) Int)
      (declare-const a Int)
      (declare-const b Int)
      (assert (= a b))
      (assert (not (= (f a) (f b))))
      (check-sat)
    `);
    assert.equal(r.sat, false);
  });

  it('distinct SAT', () => {
    const r = solveSmt(`
      (set-logic QF_UF)
      (declare-const a Int)
      (declare-const b Int)
      (assert (distinct a b))
      (check-sat)
    `);
    assert.equal(r.sat, true);
  });

  it('conjunction via SMT-LIB', () => {
    const r = solveSmt(`
      (set-logic QF_UF)
      (declare-const a Int)
      (declare-const b Int)
      (declare-const c Int)
      (assert (and (= a b) (= b c) (not (= a c))))
      (check-sat)
    `);
    assert.equal(r.sat, false);
  });

  it('nested functions SAT', () => {
    const r = solveSmt(`
      (set-logic QF_UF)
      (declare-fun f (Int) Int)
      (declare-const a Int)
      (declare-const b Int)
      (assert (= a b))
      (assert (= (f (f a)) (f (f b))))
      (check-sat)
    `);
    assert.equal(r.sat, true);
  });
});
