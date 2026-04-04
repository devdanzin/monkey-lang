import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { solveSmtCombined, CombinedSMTSolver, ArithLiteral } from '../src/combined.js';

describe('Combined SMT — arithmetic via SMT-LIB', () => {
  it('simple upper bound: x <= 10', () => {
    const r = solveSmtCombined(`
      (set-logic QF_IDL)
      (declare-const x Int)
      (assert (<= x 10))
      (check-sat)
    `);
    assert.equal(r.sat, true);
  });

  it('contradictory bounds: x <= 3, x >= 5', () => {
    const r = solveSmtCombined(`
      (set-logic QF_IDL)
      (declare-const x Int)
      (assert (<= x 3))
      (assert (>= x 5))
      (check-sat)
    `);
    assert.equal(r.sat, false);
  });

  it('difference constraint: x - y <= 5', () => {
    const r = solveSmtCombined(`
      (set-logic QF_IDL)
      (declare-const x Int)
      (declare-const y Int)
      (assert (<= (- x y) 5))
      (check-sat)
    `);
    assert.equal(r.sat, true);
  });

  it('transitivity UNSAT: x-y<=1, y-z<=1, z-x<=-3', () => {
    const r = solveSmtCombined(`
      (set-logic QF_IDL)
      (declare-const x Int)
      (declare-const y Int)
      (declare-const z Int)
      (assert (<= (- x y) 1))
      (assert (<= (- y z) 1))
      (assert (<= (- z x) -3))
      (check-sat)
    `);
    assert.equal(r.sat, false);
  });

  it('consistent chain: x-y<=3, y-z<=2, z-x>=-6', () => {
    const r = solveSmtCombined(`
      (set-logic QF_IDL)
      (declare-const x Int)
      (declare-const y Int)
      (declare-const z Int)
      (assert (<= (- x y) 3))
      (assert (<= (- y z) 2))
      (assert (>= (- z x) -6))
      (check-sat)
    `);
    assert.equal(r.sat, true);
  });

  it('equality: x = y + 5', () => {
    const r = solveSmtCombined(`
      (set-logic QF_IDL)
      (declare-const x Int)
      (declare-const y Int)
      (assert (= x (+ y 5)))
      (check-sat)
    `);
    assert.equal(r.sat, true);
    if (r.model) {
      const x = r.model.get('x') ?? 0;
      const y = r.model.get('y') ?? 0;
      assert.equal(x - y, 5);
    }
  });

  it('model extraction with bounds', () => {
    const r = solveSmtCombined(`
      (set-logic QF_IDL)
      (declare-const x Int)
      (assert (<= x 10))
      (assert (>= x 5))
      (check-sat)
    `);
    assert.equal(r.sat, true);
    if (r.model) {
      const x = r.model.get('x') ?? 0;
      assert.ok(x >= 5, `x=${x} should be >= 5`);
      assert.ok(x <= 10, `x=${x} should be <= 10`);
    }
  });
});

describe('Combined SMT — scheduling', () => {
  it('task scheduling: A before B, both within deadline', () => {
    const r = solveSmtCombined(`
      (set-logic QF_IDL)
      (declare-const a_start Int)
      (declare-const a_end Int)
      (declare-const b_start Int)
      (declare-const b_end Int)
      ; A takes 2 units
      (assert (= a_end (+ a_start 2)))
      ; B takes 3 units
      (assert (= b_end (+ b_start 3)))
      ; A before B
      (assert (<= a_end b_start))
      ; Both start at or after time 0
      (assert (>= a_start 0))
      ; Deadline: B finishes by 10
      (assert (<= b_end 10))
      (check-sat)
    `);
    assert.equal(r.sat, true);
  });

  it('impossible schedule: too many tasks for deadline', () => {
    const r = solveSmtCombined(`
      (set-logic QF_IDL)
      (declare-const a_start Int)
      (declare-const a_end Int)
      (declare-const b_start Int)
      (declare-const b_end Int)
      ; A takes 5 units
      (assert (= a_end (+ a_start 5)))
      ; B takes 6 units
      (assert (= b_end (+ b_start 6)))
      ; A before B
      (assert (<= a_end b_start))
      ; Both start at or after time 0
      (assert (>= a_start 0))
      ; Deadline: B finishes by 10 (5+6=11 > 10, impossible)
      (assert (<= b_end 10))
      (check-sat)
    `);
    assert.equal(r.sat, false);
  });
});
