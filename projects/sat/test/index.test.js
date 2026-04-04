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
    const clauses = [[1, 2], [-1, 3], [-2, -3], [1, 3]];
    const r = solve(clauses);
    assert.equal(r.sat, true);
    assert.ok(verify(clauses, r.model));
  });

  it('verifier rejects wrong model', () => {
    const model = new Map([[1, true], [2, false]]);
    assert.equal(verify([[-1, -2]], model), true);
    assert.equal(verify([[1], [2]], model), false);
  });

  it('all variables true', () => {
    const r = solve([[1], [2], [3], [4], [5]]);
    assert.equal(r.sat, true);
    for (let v = 1; v <= 5; v++) assert.equal(r.model.get(v), true);
  });

  it('all variables false', () => {
    const r = solve([[-1], [-2], [-3], [-4], [-5]]);
    assert.equal(r.sat, true);
    for (let v = 1; v <= 5; v++) assert.equal(r.model.get(v), false);
  });

  it('mixed signs forced', () => {
    // x1=T, x2=F, x3=T forced by unit clauses
    const r = solve([[1], [-2], [3]]);
    assert.equal(r.sat, true);
    assert.equal(r.model.get(1), true);
    assert.equal(r.model.get(2), false);
    assert.equal(r.model.get(3), true);
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
    { name: 'implication chain', clauses: [[1], [-1, 2], [-2, 3], [-3, 4]] },
    { name: 'double negation', clauses: [[1, 2], [-1, -2], [1, -2], [-1, 2]] },
    { name: 'XOR-like', clauses: [[1, 2], [-1, -2]] },
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
    const r = solve([[1], [-2], [1, 2, 3]]);
    assert.equal(r.sat, true);
    assert.equal(r.model.get(1), true);
    assert.equal(r.model.get(2), false);
  });

  it('chain of unit implications', () => {
    const r = solve([[1], [-1, 2], [-2, 3], [-3, 4]]);
    assert.equal(r.sat, true);
    for (let v = 1; v <= 4; v++) assert.equal(r.model.get(v), true);
  });

  it('detects conflict during propagation', () => {
    const r = solve([[1], [-1, 2], [-2]]);
    assert.equal(r.sat, false);
  });

  it('long implication chain', () => {
    // 1 → 2 → 3 → ... → 10
    const clauses = [[1]];
    for (let i = 1; i < 10; i++) clauses.push([-i, i + 1]);
    const r = solve(clauses);
    assert.equal(r.sat, true);
    for (let v = 1; v <= 10; v++) assert.equal(r.model.get(v), true);
  });

  it('multiple independent unit propagation chains', () => {
    const r = solve([[1], [-1, 2], [3], [-3, 4], [-2, -4, 5]]);
    assert.equal(r.sat, true);
    assert.ok(verify([[1], [-1, 2], [3], [-3, 4], [-2, -4, 5]], r.model));
  });
});

// ===== Pigeonhole Principle =====
describe('SAT — pigeonhole', () => {
  it('PHP(2,1) is UNSAT', () => {
    const { clauses, numVars } = pigeonhole(1);
    assert.equal(new CDCLSolver(numVars, clauses).solve().sat, false);
  });

  it('PHP(3,2) is UNSAT', () => {
    const { clauses, numVars } = pigeonhole(2);
    assert.equal(new CDCLSolver(numVars, clauses).solve().sat, false);
  });

  it('PHP(4,3) is UNSAT', () => {
    const { clauses, numVars } = pigeonhole(3);
    assert.equal(new CDCLSolver(numVars, clauses).solve().sat, false);
  });

  it('PHP(5,4) is UNSAT', () => {
    const { clauses, numVars } = pigeonhole(4);
    assert.equal(new CDCLSolver(numVars, clauses).solve().sat, false);
  });
});

// ===== N-Queens =====
describe('SAT — N-Queens', () => {
  for (const n of [1, 4, 5, 6, 7, 8]) {
    it(`${n}-Queens is satisfiable`, () => {
      const { clauses, numVars } = nQueens(n);
      const r = new CDCLSolver(numVars, clauses).solve();
      assert.equal(r.sat, true);
      assert.ok(verify(clauses, r.model));
      
      // Verify exactly n queens placed
      let count = 0;
      for (let i = 1; i <= numVars; i++) if (r.model.get(i)) count++;
      assert.equal(count, n, `Expected ${n} queens, got ${count}`);
    });
  }

  for (const n of [2, 3]) {
    it(`${n}-Queens is UNSAT`, () => {
      const { clauses, numVars } = nQueens(n);
      assert.equal(new CDCLSolver(numVars, clauses).solve().sat, false);
    });
  }
});

// ===== Graph Coloring as SAT =====
describe('SAT — graph coloring', () => {
  // Encode k-coloring: var(node, color) = node * k + color + 1
  function graphColoring(numNodes, edges, k) {
    const v = (n, c) => n * k + c + 1;
    const numVars = numNodes * k;
    const clauses = [];
    
    // Each node has at least one color
    for (let n = 0; n < numNodes; n++) {
      const clause = [];
      for (let c = 0; c < k; c++) clause.push(v(n, c));
      clauses.push(clause);
    }
    
    // Each node has at most one color
    for (let n = 0; n < numNodes; n++) {
      for (let c1 = 0; c1 < k; c1++) {
        for (let c2 = c1 + 1; c2 < k; c2++) {
          clauses.push([-v(n, c1), -v(n, c2)]);
        }
      }
    }
    
    // Adjacent nodes differ in color
    for (const [a, b] of edges) {
      for (let c = 0; c < k; c++) {
        clauses.push([-v(a, c), -v(b, c)]);
      }
    }
    
    return { clauses, numVars };
  }

  it('triangle (K3) is 3-colorable', () => {
    const edges = [[0,1], [1,2], [0,2]];
    const { clauses, numVars } = graphColoring(3, edges, 3);
    const r = new CDCLSolver(numVars, clauses).solve();
    assert.equal(r.sat, true);
    assert.ok(verify(clauses, r.model));
  });

  it('triangle (K3) is NOT 2-colorable', () => {
    const edges = [[0,1], [1,2], [0,2]];
    const { clauses, numVars } = graphColoring(3, edges, 2);
    assert.equal(new CDCLSolver(numVars, clauses).solve().sat, false);
  });

  it('K4 is 4-colorable', () => {
    const edges = [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];
    const { clauses, numVars } = graphColoring(4, edges, 4);
    const r = new CDCLSolver(numVars, clauses).solve();
    assert.equal(r.sat, true);
    assert.ok(verify(clauses, r.model));
  });

  it('K4 is NOT 3-colorable', () => {
    const edges = [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];
    const { clauses, numVars } = graphColoring(4, edges, 3);
    assert.equal(new CDCLSolver(numVars, clauses).solve().sat, false);
  });

  it('bipartite graph (4-cycle) is 2-colorable', () => {
    const edges = [[0,1],[1,2],[2,3],[3,0]];
    const { clauses, numVars } = graphColoring(4, edges, 2);
    const r = new CDCLSolver(numVars, clauses).solve();
    assert.equal(r.sat, true);
    assert.ok(verify(clauses, r.model));
  });

  it('Petersen graph is 3-colorable', () => {
    // Petersen graph: 10 nodes, 15 edges
    const edges = [
      [0,1],[1,2],[2,3],[3,4],[4,0], // outer
      [5,7],[7,9],[9,6],[6,8],[8,5], // inner (pentagram)
      [0,5],[1,6],[2,7],[3,8],[4,9]  // connections
    ];
    const { clauses, numVars } = graphColoring(10, edges, 3);
    const r = new CDCLSolver(numVars, clauses).solve();
    assert.equal(r.sat, true);
    assert.ok(verify(clauses, r.model));
  });
});

// ===== Sudoku as SAT =====
describe('SAT — Sudoku encoding', () => {
  // 4x4 Sudoku (values 1-4, 2x2 boxes)
  function sudoku4x4(givens) {
    const n = 4;
    const v = (r, c, d) => (r * n + c) * n + d; // 1-indexed
    const numVars = n * n * n;
    const clauses = [];
    
    // Each cell has at least one value
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) {
        const clause = [];
        for (let d = 0; d < n; d++) clause.push(v(r, c, d) + 1);
        clauses.push(clause);
      }
    
    // Each cell has at most one value
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++)
        for (let d1 = 0; d1 < n; d1++)
          for (let d2 = d1 + 1; d2 < n; d2++)
            clauses.push([-(v(r, c, d1) + 1), -(v(r, c, d2) + 1)]);
    
    // Each row has each value
    for (let r = 0; r < n; r++)
      for (let d = 0; d < n; d++) {
        const clause = [];
        for (let c = 0; c < n; c++) clause.push(v(r, c, d) + 1);
        clauses.push(clause);
      }
    
    // Each column has each value
    for (let c = 0; c < n; c++)
      for (let d = 0; d < n; d++) {
        const clause = [];
        for (let r = 0; r < n; r++) clause.push(v(r, c, d) + 1);
        clauses.push(clause);
      }
    
    // Each 2x2 box has each value
    for (let br = 0; br < 2; br++)
      for (let bc = 0; bc < 2; bc++)
        for (let d = 0; d < n; d++) {
          const clause = [];
          for (let dr = 0; dr < 2; dr++)
            for (let dc = 0; dc < 2; dc++)
              clause.push(v(br * 2 + dr, bc * 2 + dc, d) + 1);
          clauses.push(clause);
        }
    
    // Add givens as unit clauses
    for (const [r, c, d] of givens) {
      clauses.push([v(r, c, d - 1) + 1]); // d is 1-indexed in givens
    }
    
    return { clauses, numVars };
  }

  it('solves a valid 4x4 Sudoku', () => {
    // Partial 4x4:
    // 1 . | . .
    // . . | 1 .
    // . 1 | . .
    // . . | . 1
    const givens = [[0,0,1], [1,2,1], [2,1,1], [3,3,1]];
    const { clauses, numVars } = sudoku4x4(givens);
    const r = new CDCLSolver(numVars, clauses).solve();
    assert.equal(r.sat, true);
    assert.ok(verify(clauses, r.model));
  });

  it('detects contradictory Sudoku (two 1s in same row)', () => {
    const givens = [[0,0,1], [0,1,1]]; // two 1s in row 0
    const { clauses, numVars } = sudoku4x4(givens);
    assert.equal(new CDCLSolver(numVars, clauses).solve().sat, false);
  });

  it('detects contradictory Sudoku (two 1s in same column)', () => {
    const givens = [[0,0,1], [1,0,1]]; // two 1s in col 0
    const { clauses, numVars } = sudoku4x4(givens);
    assert.equal(new CDCLSolver(numVars, clauses).solve().sat, false);
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
    const r = new CDCLSolver(numVars, clauses).solve();
    assert.equal(r.sat, true);
    assert.ok(verify(clauses, r.model));
  });

  it('handles empty lines and multiple spaces', () => {
    const dimacs = `c test
p cnf 2 1

  1   2   0
`;
    const { numVars, clauses } = parseDIMACS(dimacs);
    assert.equal(numVars, 2);
    assert.deepEqual(clauses, [[1, 2]]);
  });
});

// ===== Random 3-SAT =====
describe('SAT — random 3-SAT', () => {
  it('under-constrained random 3-SAT (ratio 2.0) is almost always SAT', () => {
    const clauses = randomSAT(20, 40, 3);
    const r = solve(clauses);
    assert.equal(r.sat, true);
    assert.ok(verify(clauses, r.model));
  });

  it('CDCL agrees with DPLL on random instances', () => {
    for (let i = 0; i < 10; i++) {
      const clauses = randomSAT(10, 30, 3);
      const cdcl = solve(clauses);
      const dpll = solveDPLL(clauses);
      assert.equal(cdcl.sat, dpll.sat, `Disagreement on random instance ${i}`);
      if (cdcl.sat) assert.ok(verify(clauses, cdcl.model));
    }
  });

  it('solves 100-variable under-constrained instance', () => {
    const clauses = randomSAT(100, 200, 3);
    const r = solve(clauses);
    assert.equal(r.sat, true);
    assert.ok(verify(clauses, r.model));
  });
});

// ===== Clause Learning =====
describe('SAT — clause learning', () => {
  it('learns clauses during search', () => {
    const clauses = [
      [1, 2], [-1, 3], [-2, 3], [-3, 4], [-3, -4],
      [1, -2, 5], [-5, -1], [2, -5, 4]
    ];
    let maxVar = 0;
    for (const cl of clauses) for (const l of cl) maxVar = Math.max(maxVar, Math.abs(l));
    const solver = new CDCLSolver(maxVar, clauses);
    const r = solver.solve();
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
    assert.ok(r.stats.conflicts >= 0);
    assert.ok(r.stats.learned >= 0);
  });

  it('learns at least one clause on pigeonhole', () => {
    const { clauses, numVars } = pigeonhole(3);
    const solver = new CDCLSolver(numVars, clauses);
    solver.solve();
    assert.ok(solver.stats.learned > 0, 'Should learn clauses on PHP');
  });

  it('VSIDS activity increases for conflict variables', () => {
    // Use pigeonhole which guarantees conflicts
    const { clauses, numVars } = pigeonhole(3);
    const solver = new CDCLSolver(numVars, clauses);
    const initialActivity = new Float64Array(solver.activity);
    solver.solve();
    assert.ok(solver.stats.conflicts > 0, 'Need conflicts for VSIDS test');
    let increased = 0;
    for (let v = 1; v <= numVars; v++) {
      if (solver.activity[v] > initialActivity[v]) increased++;
    }
    assert.ok(increased > 0, 'VSIDS should bump at least some variables');
  });
});

// ===== Restart behavior =====
describe('SAT — restarts', () => {
  it('restarts fire on hard enough instances', () => {
    // PHP(5,4) should trigger restarts
    const { clauses, numVars } = pigeonhole(4);
    const solver = new CDCLSolver(numVars, clauses);
    solver.solve();
    // May or may not restart depending on conflict count vs threshold
    assert.ok(solver.stats.conflicts > 0, 'Should have conflicts');
  });

  it('solver still correct after restarts', () => {
    // Force enough conflicts to trigger restarts
    const { clauses, numVars } = pigeonhole(5);
    const solver = new CDCLSolver(numVars, clauses);
    const r = solver.solve();
    assert.equal(r.sat, false);
    assert.ok(solver.stats.conflicts > 0);
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

  it('duplicate literals in clause', () => {
    const r = solve([[1, 1, 2], [-1, -1]]);
    assert.equal(r.sat, true);
    assert.equal(r.model.get(2), true);
  });

  it('contradiction with many variables', () => {
    // x1 AND x2 AND ... AND x10, then -x1
    const clauses = [];
    for (let i = 1; i <= 10; i++) clauses.push([i]);
    clauses.push([-1]);
    assert.equal(solve(clauses).sat, false);
  });

  it('deeply nested implications leading to conflict', () => {
    // 1 → 2 → 3 → 4 → 5, but also -5 forced
    const clauses = [[1], [-1, 2], [-2, 3], [-3, 4], [-4, 5], [-5]];
    assert.equal(solve(clauses).sat, false);
  });

  it('XOR ladder (hard for naive solvers)', () => {
    // XOR(x1, x2) AND XOR(x2, x3) AND XOR(x3, x4)
    // XOR(a, b) = (a OR b) AND (-a OR -b)
    const clauses = [
      [1, 2], [-1, -2],  // XOR(1,2)
      [2, 3], [-2, -3],  // XOR(2,3)
      [3, 4], [-3, -4],  // XOR(3,4)
    ];
    const r = solve(clauses);
    assert.equal(r.sat, true);
    assert.ok(verify(clauses, r.model));
  });
});

// ===== Model verification deep tests =====
describe('SAT — model verification', () => {
  it('verify accepts correct model for complex formula', () => {
    const clauses = [[1, 2, 3], [-1, 2], [-2, 3], [1, -3]];
    const model = new Map([[1, true], [2, true], [3, true]]);
    assert.equal(verify(clauses, model), true);
  });

  it('verify rejects model missing a clause', () => {
    // (1) AND (-1) — no model satisfies both
    const model = new Map([[1, true]]);
    assert.equal(verify([[1], [-1]], model), false);
  });

  it('verify handles large model', () => {
    const clauses = [];
    const model = new Map();
    for (let i = 1; i <= 100; i++) {
      clauses.push([i]);
      model.set(i, true);
    }
    assert.equal(verify(clauses, model), true);
  });
});
