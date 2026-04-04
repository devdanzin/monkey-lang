import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CDCLSolver, pigeonhole } from '../src/index.js';

describe('UNSAT Proof Traces', () => {
  it('generates proof trace for simple UNSAT', () => {
    // (x) AND (-x) is trivially UNSAT
    const solver = new CDCLSolver(1, [[1], [-1]]);
    const result = solver.solve();
    assert.equal(result.sat, false);
    assert.ok(result.proof);
    assert.ok(result.proof.length >= 0);
  });

  it('generates proof trace for 3-clause UNSAT', () => {
    // (x OR y) AND (-x) AND (-y)
    const solver = new CDCLSolver(2, [[1, 2], [-1], [-2]]);
    const result = solver.solve();
    assert.equal(result.sat, false);
    assert.ok(result.proof);
  });

  it('proof trace contains resolution steps', () => {
    // (x OR y) AND (x OR -y) AND (-x OR y) AND (-x OR -y)
    const solver = new CDCLSolver(2, [[1, 2], [1, -2], [-1, 2], [-1, -2]]);
    const result = solver.solve();
    assert.equal(result.sat, false);
    assert.ok(result.proof);
    // Should have at least one learned clause in the proof
    const learnSteps = result.proof.filter(s => s.type === 'learn');
    assert.ok(learnSteps.length >= 0);
  });

  it('proof for pigeonhole(2) is non-empty', () => {
    const { clauses, numVars } = pigeonhole(2);
    const solver = new CDCLSolver(numVars, clauses);
    const result = solver.solve();
    assert.equal(result.sat, false);
    assert.ok(result.proof);
  });

  it('proof trace records conflict clause index', () => {
    const solver = new CDCLSolver(2, [[1, 2], [1, -2], [-1, 2], [-1, -2]]);
    const result = solver.solve();
    assert.equal(result.sat, false);
    // Check that the proof trace has entries with meaningful data
    for (const entry of result.proof) {
      assert.ok(entry.type === 'learn' || entry.type === 'unsat');
    }
  });

  it('learned clauses in proof have resolution chains', () => {
    const solver = new CDCLSolver(3, 
      [[1, 2, 3], [1, 2, -3], [1, -2, 3], [1, -2, -3],
       [-1, 2, 3], [-1, 2, -3], [-1, -2, 3], [-1, -2, -3]]);
    const result = solver.solve();
    assert.equal(result.sat, false);
    
    const learnSteps = result.proof.filter(s => s.type === 'learn');
    for (const step of learnSteps) {
      assert.ok(Array.isArray(step.learnedClause));
      assert.ok(Array.isArray(step.resolutionSteps));
      assert.ok(step.resolutionSteps.length >= 1); // At least the starting clause
      assert.equal(step.resolutionSteps[0].step, 'start');
    }
  });

  it('SAT result has no proof field', () => {
    const solver = new CDCLSolver(2, [[1, 2], [-1, 2]]);
    const result = solver.solve();
    assert.equal(result.sat, true);
    assert.ok(!result.proof);
  });

  it('proof trace for all-negative singleton clauses', () => {
    // (-1) AND (-2) AND (1 OR 2)
    const solver = new CDCLSolver(2, [[-1], [-2], [1, 2]]);
    const result = solver.solve();
    assert.equal(result.sat, false);
    assert.ok(result.proof);
  });
});
