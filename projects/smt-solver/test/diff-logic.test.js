import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DiffLogicSolver, diff, upperBound, lowerBound, DifferenceConstraint } from '../src/diff-logic.js';

describe('DiffLogic — basic constraints', () => {
  it('single constraint is satisfiable', () => {
    const solver = new DiffLogicSolver();
    const conflict = solver.assertConstraint(diff('x', 'y', '<=', 5));
    assert.equal(conflict, null);
  });

  it('consistent chain: x-y<=3, y-z<=2 (implies x-z<=5)', () => {
    const solver = new DiffLogicSolver();
    assert.equal(solver.assertConstraint(diff('x', 'y', '<=', 3)), null);
    assert.equal(solver.assertConstraint(diff('y', 'z', '<=', 2)), null);
  });

  it('detects negative cycle: x-y<=1, y-x<=-2', () => {
    const solver = new DiffLogicSolver();
    assert.equal(solver.assertConstraint(diff('x', 'y', '<=', 1)), null);
    const conflict = solver.assertConstraint(diff('y', 'x', '<=', -2));
    assert.ok(conflict, 'Should detect negative cycle');
  });

  it('equality constraint: x-y=5', () => {
    const solver = new DiffLogicSolver();
    assert.equal(solver.assertConstraint(diff('x', 'y', '=', 5)), null);
    // Adds both x-y<=5 and y-x<=-5
  });

  it('contradictory equalities: x-y=5, x-y=3', () => {
    const solver = new DiffLogicSolver();
    assert.equal(solver.assertConstraint(diff('x', 'y', '=', 5)), null);
    const conflict = solver.assertConstraint(diff('x', 'y', '=', 3));
    assert.ok(conflict, 'x-y cannot be both 5 and 3');
  });

  it('strict inequality: x-y < 0, y-x < 0 → UNSAT', () => {
    const solver = new DiffLogicSolver();
    assert.equal(solver.assertConstraint(diff('x', 'y', '<', 0)), null);
    const conflict = solver.assertConstraint(diff('y', 'x', '<', 0));
    assert.ok(conflict, 'x < y and y < x is impossible');
  });

  it('greater-than: x-y > 3, y-x > -3 is consistent', () => {
    const solver = new DiffLogicSolver();
    assert.equal(solver.assertConstraint(diff('x', 'y', '>', 3)), null);
  });
});

describe('DiffLogic — absolute bounds', () => {
  it('upper bound: x <= 10', () => {
    const solver = new DiffLogicSolver();
    assert.equal(solver.assertConstraint(upperBound('x', 10)), null);
  });

  it('lower bound: x >= 5', () => {
    const solver = new DiffLogicSolver();
    assert.equal(solver.assertConstraint(lowerBound('x', 5)), null);
  });

  it('conflicting bounds: x <= 3, x >= 5 → UNSAT', () => {
    const solver = new DiffLogicSolver();
    assert.equal(solver.assertConstraint(upperBound('x', 3)), null);
    const conflict = solver.assertConstraint(lowerBound('x', 5));
    assert.ok(conflict, 'x cannot be both <= 3 and >= 5');
  });

  it('consistent bounds: x <= 10, x >= 5', () => {
    const solver = new DiffLogicSolver();
    assert.equal(solver.assertConstraint(upperBound('x', 10)), null);
    assert.equal(solver.assertConstraint(lowerBound('x', 5)), null);
  });
});

describe('DiffLogic — model extraction', () => {
  it('gets satisfying assignment', () => {
    const solver = new DiffLogicSolver();
    solver.assertConstraint(diff('x', 'y', '<=', 5));
    solver.assertConstraint(diff('y', 'z', '<=', 3));
    
    const model = solver.getModel();
    assert.ok(model);
    
    const x = model.get('x') ?? 0;
    const y = model.get('y') ?? 0;
    const z = model.get('z') ?? 0;
    assert.ok(x - y <= 5, `x-y=${x-y} should be <= 5`);
    assert.ok(y - z <= 3, `y-z=${y-z} should be <= 3`);
  });

  it('model respects equality', () => {
    const solver = new DiffLogicSolver();
    solver.assertConstraint(diff('x', 'y', '=', 5));
    
    const model = solver.getModel();
    assert.ok(model);
    
    const x = model.get('x') ?? 0;
    const y = model.get('y') ?? 0;
    assert.equal(x - y, 5);
  });

  it('model respects bounds', () => {
    const solver = new DiffLogicSolver();
    solver.assertConstraint(upperBound('x', 10));
    solver.assertConstraint(lowerBound('x', 5));
    
    const model = solver.getModel();
    assert.ok(model);
    
    const x = model.get('x');
    assert.ok(x <= 10, `x=${x} should be <= 10`);
    assert.ok(x >= 5, `x=${x} should be >= 5`);
  });
});

describe('DiffLogic — backtracking', () => {
  it('undoes constraint after backtrack', () => {
    const solver = new DiffLogicSolver();
    solver.assertConstraint(diff('x', 'y', '<=', 5));
    
    solver.pushLevel();
    solver.assertConstraint(diff('y', 'x', '<=', -10)); // x-y >= 10 → conflict with x-y <= 5
    const conflict = solver.checkConsistency();
    assert.ok(conflict);
    
    solver.popTo(0);
    const result = solver.checkConsistency();
    assert.equal(result, null, 'After backtrack, should be consistent');
  });

  it('multi-level backtrack', () => {
    const solver = new DiffLogicSolver();
    
    solver.pushLevel(); // level 1
    solver.assertConstraint(diff('x', 'y', '<=', 3));
    
    solver.pushLevel(); // level 2
    solver.assertConstraint(diff('y', 'z', '<=', 2));
    
    solver.pushLevel(); // level 3
    solver.assertConstraint(diff('z', 'x', '<=', -6)); // creates cycle: x-y<=3, y-z<=2, z-x<=-6 → sum=-1 < 0
    assert.ok(solver.checkConsistency());
    
    solver.popTo(2);
    assert.equal(solver.checkConsistency(), null);
    
    solver.popTo(1);
    assert.equal(solver.checkConsistency(), null);
  });
});

describe('DiffLogic — complex scenarios', () => {
  it('triangle: x-y<=3, y-z<=4, z-x<=2 (sum=9 >= 0, OK)', () => {
    const solver = new DiffLogicSolver();
    assert.equal(solver.assertConstraint(diff('x', 'y', '<=', 3)), null);
    assert.equal(solver.assertConstraint(diff('y', 'z', '<=', 4)), null);
    assert.equal(solver.assertConstraint(diff('z', 'x', '<=', 2)), null);
    // Sum of cycle weights = 3+4+2 = 9 >= 0, so consistent
  });

  it('tight triangle: x-y<=1, y-z<=1, z-x<=-3 → UNSAT', () => {
    const solver = new DiffLogicSolver();
    assert.equal(solver.assertConstraint(diff('x', 'y', '<=', 1)), null);
    assert.equal(solver.assertConstraint(diff('y', 'z', '<=', 1)), null);
    const conflict = solver.assertConstraint(diff('z', 'x', '<=', -3));
    assert.ok(conflict, 'Cycle weight 1+1+(-3) = -1 < 0');
  });

  it('many variables chain', () => {
    const solver = new DiffLogicSolver();
    for (let i = 0; i < 10; i++) {
      solver.assertConstraint(diff(`x${i+1}`, `x${i}`, '<=', 1));
    }
    // x10 - x0 <= 10 implied
    assert.equal(solver.checkConsistency(), null);
    
    // Now add x0 - x10 <= -11 → UNSAT (cycle weight = 10 + (-11) = -1)
    const conflict = solver.assertConstraint(diff('x0', 'x10', '<=', -11));
    assert.ok(conflict);
  });

  it('scheduling problem: task ordering', () => {
    // Task A finishes before B starts: B_start - A_end >= 0
    // Task B takes 3 units: B_end - B_start >= 3
    // Task A takes 2 units: A_end - A_start >= 2
    // Deadline: B_end <= 10
    const solver = new DiffLogicSolver();
    solver.assertConstraint(diff('B_start', 'A_end', '>=', 0));
    solver.assertConstraint(diff('B_end', 'B_start', '>=', 3));
    solver.assertConstraint(diff('A_end', 'A_start', '>=', 2));
    solver.assertConstraint(lowerBound('A_start', 0));
    solver.assertConstraint(upperBound('B_end', 10));
    
    assert.equal(solver.checkConsistency(), null);
    
    const model = solver.getModel();
    assert.ok(model);
    assert.ok(model.get('B_end') <= 10);
    assert.ok(model.get('B_end') - model.get('B_start') >= 3);
  });
});
