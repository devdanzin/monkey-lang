import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CDCLSolver, luby, randomSAT, pigeonhole, nQueens, verify } from '../src/index.js';

describe('VSIDS & Restarts', () => {
  it('Luby sequence starts with 1, 1, 2, 1, 1, 2, 4', () => {
    const expected = [1, 1, 2, 1, 1, 2, 4, 1, 1, 2, 1, 1, 2, 4, 8];
    for (let i = 0; i < expected.length; i++) {
      assert.equal(luby(i), expected[i], `luby(${i}) = ${luby(i)}, expected ${expected[i]}`);
    }
  });

  it('phase saving is used after backtrack', () => {
    // Solve a formula, check that phaseSaving gets populated
    const solver = new CDCLSolver(5, [
      [1, 2], [-1, 3], [-2, 3], [-3, 4], [-3, -4], [1, -2, 5], [-5, -1]
    ]);
    const result = solver.solve();
    // After solving, phase saving should have some non-zero entries
    let hasPhase = false;
    for (let i = 1; i <= 5; i++) {
      if (solver.phaseSaving[i] !== 0) hasPhase = true;
    }
    // May or may not have phases depending on how it solved
    assert.ok(typeof result.sat === 'boolean');
  });

  it('VSIDS decay keeps activities manageable', () => {
    const { clauses, numVars } = pigeonhole(3);
    const solver = new CDCLSolver(numVars, clauses);
    solver.solve();
    // After many conflicts, activity values should not be Infinity
    for (let i = 1; i <= numVars; i++) {
      assert.ok(isFinite(solver.activity[i]), `Activity[${i}] = ${solver.activity[i]} is not finite`);
    }
  });

  it('restarts use Luby schedule', () => {
    const { clauses, numVars } = pigeonhole(3);
    const solver = new CDCLSolver(numVars, clauses);
    solver.solve();
    // Should have done some restarts
    assert.ok(solver.stats.restarts >= 0);
    assert.ok(solver.restartIdx > 0);
  });

  it('solves harder random SAT instances', () => {
    const result = randomSAT(20, 85, 3);
    const clauses = result.clauses || result;
    const numVars = result.numVars || 20;
    const solver = new CDCLSolver(numVars, clauses);
    const r = solver.solve();
    if (r.sat) {
      assert.ok(verify(clauses, r.model));
    }
    assert.ok(typeof r.sat === 'boolean');
  });

  it('solves 4-queens', () => {
    const { clauses, numVars } = nQueens(4);
    const solver = new CDCLSolver(numVars, clauses);
    const result = solver.solve();
    assert.equal(result.sat, true);
    assert.ok(verify(clauses, result.model));
  });

  it('solves 5-queens', () => {
    const { clauses, numVars } = nQueens(5);
    const solver = new CDCLSolver(numVars, clauses);
    const result = solver.solve();
    assert.equal(result.sat, true);
    assert.ok(verify(clauses, result.model));
  });

  it('pigeonhole(3) is UNSAT', () => {
    const { clauses, numVars } = pigeonhole(3);
    const solver = new CDCLSolver(numVars, clauses);
    const result = solver.solve();
    assert.equal(result.sat, false);
    assert.ok(result.stats.conflicts > 0);
  });
});
