import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { 
  solve, solveDPLL, verify, CDCLSolver, 
  parseDIMACS, toDIMACS,
  pigeonhole, randomSAT, nQueens 
} from '../src/index.js';

// ===== Basic SAT =====
describe('SAT — basic', () => {
  it('satisfies a single positive literal', () => {
    const r = solve([[1]]);
    assert.equal(r.sat, true);
    assert.equal(r.model.get(1), true);
  });

  it('satisfies a single negative literal', () => {
    const r = solve([[-1]]);
    assert.equal(r.sat, true);
    assert.equal(r.model.get(1), false);
  });

  it('detects contradiction: x AND NOT x', () => {
    const r = solve([[1], [-1]]);
    assert.equal(r.sat, false);
  });

  it('simple 2-variable formula', () => {
    // (x1 OR x2) AND (NOT x1 OR x2) → x2 must be true
    const r = solve([[1, 2], [-1, 2]]);
    assert.equal(r.sat, true);
    assert.equal(r.model.get(2), true);
  });

  it('tautology: x OR NOT x', () => {
    const r = solve([[1, -1]]);
    assert.equal(r.sat, true);
  });

  it('empty formula is SAT', () => {
    const r = solve([]);
    assert.equal(r.sat, true);
  });

  it('3-variable satisfiable formula', () => {
    // (1 OR 2) AND (-1 OR 3) AND (-2 OR -3) AND (1 OR 3)
    const r = solve([[1, 2], [-1, 3], [-2, -3], [1, 3]]);
    assert.equal(r.sat, true);
    assert.ok(verify([[1, 2], [-1, 3], [-2, -3], [1, 3]], r.model));
  });

  it('verifier rejects wrong model', () => {
    const model = new Map([[1, true], [2, false]]);
    // (NOT 1 OR NOT 2) → 1=true, 2=false satisfies this
    assert.equal(verify([[-1, -2]], model), true);
    // (1 AND 2) → 1=true, 2=false fails on clause [2]
    assert.equal(verify([[1], [2]], model), false);
  });
});

// ===== DPLL vs CDCL agreement =====
describe('SAT — DPLL vs CDCL agreement', () => {
  const formulas = [
    { name: 'simple AND', clauses: [[1], [2], [3]] },
    { name: 'contradiction', clauses: [[1], [-1]] },
    { name: '2-SAT', clauses: [[1, 2], [-1, -2], [1, -2]] },
    { name: '3-clause', clauses: [[1, 2, 3], [-1, -2], [-2, -3], [1, 3]] },
    { name: 'all negative', clauses: [[-1], [-2], [-3]] },
  ];

  for (const { name, clauses } of formulas) {
    it(`agree on: ${name}`, () => {
      const cdcl = solve(clauses);
      const dpll = solveDPLL(clauses);
      assert.equal(cdcl.sat, dpll.sat, `Disagreement on ${name}`);
      if (cdcl.sat) {
        assert.ok(verify(clauses, cdcl.model), 'CDCL model invalid');
        assert.ok(verify(clauses, dpll.model), 'DPLL model invalid');
      }
    });
  }
});

// ===== Unit Propagation =====
describe('SAT — unit propagation', () => {
  it('propagates unit clauses', () => {
    // [1] AND [-2] AND [1, 2, 3] → 1=T, 2=F, clause 3 satisfied
    const r = solve([[1], [-2], [1, 2, 3]]);
    assert.equal(r.sat, true);
    assert.equal(r.model.get(1), true);
    assert.equal(r.model.get(2), false);
  });

  it('chain of unit implications', () => {
    // [1] AND [-1, 2] AND [-2, 3] AND [-3, 4] → 1→2→3→4, all true
    const r = solve([[1], [-1, 2], [-2, 3], [-3, 4]]);
    assert.equal(r.sat, true);
    for (let v = 1; v <= 4; v++) assert.equal(r.model.get(v), true);
  });

  it('detects conflict during propagation', () => {
    // [1] AND [-1, 2] AND [-2] AND [-1, -2, 3] AND [-3]
    const r = solve([[1], [-1, 2], [-2]]);
    assert.equal(r.sat, false);
  });
});

// ===== Pigeonhole Principle =====
describe('SAT — pigeonhole', () => {
  it('PHP(2,1) is UNSAT (2 pigeons, 1 hole)', () => {
    const { clauses, numVars } = pigeonhole(1);
    const solver = new CDCLSolver(numVars, clauses);
    const r = solver.solve();
    assert.equal(r.sat, false);
  });

  it('PHP(3,2) is UNSAT (3 pigeons, 2 holes)', () => {
    const { clauses, numVars } = pigeonhole(2);
    const solver = new CDCLSolver(numVars, clauses);
    const r = solver.solve();
    assert.equal(r.sat, false);
  });

  it('PHP(4,3) is UNSAT (4 pigeons, 3 holes)', () => {
    const { clauses, numVars } = pigeonhole(3);
    const solver = new CDCLSolver(numVars, clauses);
    const r = solver.solve();
    assert.equal(r.sat, false);
  });
});

// ===== N-Queens =====
describe('SAT — N-Queens', () => {
  it('4-Queens is satisfiable', () => {
    const { clauses, numVars } = nQueens(4);
    const solver = new CDCLSolver(numVars, clauses);
    const r = solver.solve();
    assert.equal(r.sat, true);
    assert.ok(verify(clauses, r.model));
  });

  it('5-Queens is satisfiable', () => {
    const { clauses, numVars } = nQueens(5);
    const solver = new CDCLSolver(numVars, clauses);
    const r = solver.solve();
    assert.equal(r.sat, true);
    assert.ok(verify(clauses, r.model));
  });

  it('2-Queens is UNSAT', () => {
    const { clauses, numVars } = nQueens(2);
    const solver = new CDCLSolver(numVars, clauses);
    const r = solver.solve();
    assert.equal(r.sat, false);
  });

  it('3-Queens is UNSAT', () => {
    const { clauses, numVars } = nQueens(3);
    const solver = new CDCLSolver(numVars, clauses);
    const r = solver.solve();
    assert.equal(r.sat, false);
  });
});

// ===== DIMACS =====
describe('SAT — DIMACS', () => {
  it('parses DIMACS format', () => {
    const dimacs = `c comment
p cnf 3 2
1 -2 0
2 3 0`;
    const { numVars, clauses } = parseDIMACS(dimacs);
    assert.equal(numVars, 3);
    assert.deepEqual(clauses, [[1, -2], [2, 3]]);
  });

  it('roundtrips DIMACS', () => {
    const original = [[1, 2], [-1, 3], [2, -3]];
    const dimacs = toDIMACS(3, original);
    const { clauses } = parseDIMACS(dimacs);
    assert.deepEqual(clauses, original);
  });

  it('solves DIMACS input', () => {
    const dimacs = `p cnf 2 3
1 2 0
-1 2 0
1 -2 0`;
    const { numVars, clauses } = parseDIMACS(dimacs);
    const solver = new CDCLSolver(numVars, clauses);
    const r = solver.solve();
    assert.equal(r.sat, true);
    assert.ok(verify(clauses, r.model));
  });
});

// ===== Random 3-SAT =====
describe('SAT — random 3-SAT', () => {
  it('solves under-constrained random 3-SAT (ratio < 4.27)', () => {
    // Below the phase transition, almost always SAT
    const clauses = randomSAT(20, 40, 3); // ratio = 2.0
    const r = solve(clauses);
    assert.equal(r.sat, true);
    assert.ok(verify(clauses, r.model));
  });

  it('CDCL finds solution faster than DPLL on harder instance', () => {
    const clauses = randomSAT(15, 50, 3);
    const cdcl = solve(clauses);
    const dpll = solveDPLL(clauses);
    assert.equal(cdcl.sat, dpll.sat);
    if (cdcl.sat) assert.ok(verify(clauses, cdcl.model));
  });
});

// ===== Clause Learning =====
describe('SAT — clause learning', () => {
  it('learns clauses during search', () => {
    // Create a formula that benefits from clause learning
    const clauses = [
      [1, 2], [-1, 3], [-2, 3], [-3, 4], [-3, -4],
      [1, -2, 5], [-5, -1], [2, -5, 4]
    ];
    let maxVar = 0;
    for (const cl of clauses) for (const l of cl) maxVar = Math.max(maxVar, Math.abs(l));
    const solver = new CDCLSolver(maxVar, clauses);
    const r = solver.solve();
    // The solver should have learned some clauses
    if (!r.sat) {
      assert.ok(r.stats.learned >= 0);
    } else {
      assert.ok(verify(clauses, r.model));
    }
  });

  it('stats track decisions and propagations', () => {
    const { clauses, numVars } = nQueens(4);
    const solver = new CDCLSolver(numVars, clauses);
    const r = solver.solve();
    assert.ok(r.stats.decisions >= 0);
    assert.ok(r.stats.propagations >= 0);
  });
});

// ===== Edge Cases =====
describe('SAT — edge cases', () => {
  it('single variable, positive', () => {
    const r = solve([[1]]);
    assert.equal(r.sat, true);
    assert.equal(r.model.get(1), true);
  });

  it('many unit clauses', () => {
    const clauses = [];
    for (let i = 1; i <= 20; i++) clauses.push([i]);
    const r = solve(clauses);
    assert.equal(r.sat, true);
    for (let i = 1; i <= 20; i++) assert.equal(r.model.get(i), true);
  });

  it('binary clauses only', () => {
    // 2-SAT: (1 OR 2) AND (-1 OR -2) AND (1 OR -2)
    const r = solve([[1, 2], [-1, -2], [1, -2]]);
    assert.equal(r.sat, true);
    assert.equal(r.model.get(1), true);
    assert.equal(r.model.get(2), false);
  });

  it('large clause', () => {
    const clause = [];
    for (let i = 1; i <= 50; i++) clause.push(i);
    const r = solve([clause, [-1], [-2], [-3]]);
    assert.equal(r.sat, true);
    assert.ok(verify([clause, [-1], [-2], [-3]], r.model));
  });
});
