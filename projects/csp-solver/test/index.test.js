import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CSP, sudoku, nQueens, graphColoring, mapColoring } from '../src/index.js';

// ===== Basic CSP =====
describe('CSP — basic', () => {
  it('solves single variable', () => {
    const csp = new CSP();
    csp.addVariable('x', [1, 2, 3]);
    const sol = csp.solve();
    assert.ok(sol);
    assert.ok([1, 2, 3].includes(sol.get('x')));
  });

  it('solves with fixed value', () => {
    const csp = new CSP();
    csp.addVariable('x', [1, 2, 3]);
    csp.fix('x', 2);
    const sol = csp.solve();
    assert.ok(sol);
    assert.equal(sol.get('x'), 2);
  });

  it('detects empty domain', () => {
    const csp = new CSP();
    csp.addVariable('x', []);
    const sol = csp.solve();
    assert.equal(sol, null);
  });

  it('solves all-different', () => {
    const csp = new CSP();
    csp.addVariable('x', [1, 2, 3]);
    csp.addVariable('y', [1, 2, 3]);
    csp.addVariable('z', [1, 2, 3]);
    csp.addAllDifferent(['x', 'y', 'z']);
    const sol = csp.solve();
    assert.ok(sol);
    assert.notEqual(sol.get('x'), sol.get('y'));
    assert.notEqual(sol.get('y'), sol.get('z'));
    assert.notEqual(sol.get('x'), sol.get('z'));
  });

  it('detects unsatisfiable all-different', () => {
    const csp = new CSP();
    csp.addVariable('x', [1, 2]);
    csp.addVariable('y', [1, 2]);
    csp.addVariable('z', [1, 2]);
    csp.addAllDifferent(['x', 'y', 'z']);
    const sol = csp.solve();
    assert.equal(sol, null);
  });

  it('custom constraint', () => {
    const csp = new CSP();
    csp.addVariable('x', [1, 2, 3, 4, 5]);
    csp.addVariable('y', [1, 2, 3, 4, 5]);
    csp.addConstraint(['x', 'y'], (a) => a.get('x') + a.get('y') === 5);
    const sol = csp.solve();
    assert.ok(sol);
    assert.equal(sol.get('x') + sol.get('y'), 5);
  });
});

// ===== AC-3 =====
describe('CSP — AC-3', () => {
  it('prunes impossible values', () => {
    const csp = new CSP();
    csp.addVariable('x', [1, 2, 3]);
    csp.addVariable('y', [2]);
    csp.addConstraint(['x', 'y'], (a) => a.get('x') !== a.get('y'));
    
    csp.ac3();
    
    const domX = csp.variables.get('x');
    assert.equal(domX.has(2), false, 'x=2 should be pruned');
    assert.equal(domX.has(1), true);
    assert.equal(domX.has(3), true);
  });

  it('propagates through chain', () => {
    const csp = new CSP();
    csp.addVariable('x', [1]);
    csp.addVariable('y', [1, 2]);
    csp.addVariable('z', [1, 2, 3]);
    csp.addConstraint(['x', 'y'], (a) => a.get('x') !== a.get('y'));
    csp.addConstraint(['y', 'z'], (a) => a.get('y') !== a.get('z'));
    
    csp.ac3();
    
    assert.equal(csp.variables.get('y').has(1), false); // y can't be 1
    assert.equal(csp.variables.get('z').has(2), false); // z can't be 2
  });

  it('detects domain wipeout', () => {
    const csp = new CSP();
    csp.addVariable('x', [1]);
    csp.addVariable('y', [1]);
    csp.addConstraint(['x', 'y'], (a) => a.get('x') !== a.get('y'));
    
    const result = csp.ac3();
    assert.equal(result, false);
  });
});

// ===== N-Queens =====
describe('CSP — N-Queens', () => {
  for (const n of [4, 5, 6, 8]) {
    it(`solves ${n}-Queens`, () => {
      const csp = nQueens(n);
      const sol = csp.solve();
      assert.ok(sol, `${n}-Queens should be solvable`);
      
      // Verify: all different columns
      const cols = [];
      for (let r = 0; r < n; r++) cols.push(sol.get(`q${r}`));
      assert.equal(new Set(cols).size, n, 'All columns should be different');
      
      // Verify: no diagonal conflicts
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          assert.notEqual(
            Math.abs(cols[i] - cols[j]),
            Math.abs(i - j),
            `Queens at rows ${i},${j} should not be on same diagonal`,
          );
        }
      }
    });
  }

  for (const n of [2, 3]) {
    it(`${n}-Queens is unsolvable`, () => {
      const csp = nQueens(n);
      assert.equal(csp.solve(), null);
    });
  }
});

// ===== Graph Coloring =====
describe('CSP — graph coloring', () => {
  it('colors triangle with 3 colors', () => {
    const csp = graphColoring(3, [[0,1],[1,2],[0,2]], 3);
    const sol = csp.solve();
    assert.ok(sol);
    assert.notEqual(sol.get('n0'), sol.get('n1'));
    assert.notEqual(sol.get('n1'), sol.get('n2'));
    assert.notEqual(sol.get('n0'), sol.get('n2'));
  });

  it('cannot color triangle with 2 colors', () => {
    const csp = graphColoring(3, [[0,1],[1,2],[0,2]], 2);
    assert.equal(csp.solve(), null);
  });

  it('colors bipartite graph with 2 colors', () => {
    const csp = graphColoring(4, [[0,1],[1,2],[2,3],[3,0]], 2);
    const sol = csp.solve();
    assert.ok(sol);
  });

  it('colors K4 with 4 colors', () => {
    const edges = [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];
    const csp = graphColoring(4, edges, 4);
    const sol = csp.solve();
    assert.ok(sol);
    for (const [a, b] of edges) {
      assert.notEqual(sol.get(`n${a}`), sol.get(`n${b}`));
    }
  });

  it('cannot color K4 with 3 colors', () => {
    const edges = [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];
    const csp = graphColoring(4, edges, 3);
    assert.equal(csp.solve(), null);
  });
});

// ===== Map Coloring =====
describe('CSP — map coloring', () => {
  it('colors Australia with 3 colors', () => {
    const regions = ['WA', 'NT', 'SA', 'Q', 'NSW', 'V', 'T'];
    const adjacency = [
      ['WA', 'NT'], ['WA', 'SA'],
      ['NT', 'SA'], ['NT', 'Q'],
      ['SA', 'Q'], ['SA', 'NSW'], ['SA', 'V'],
      ['Q', 'NSW'],
      ['NSW', 'V'],
    ];
    const csp = mapColoring(regions, adjacency, ['red', 'green', 'blue']);
    const sol = csp.solve();
    assert.ok(sol);
    
    for (const [a, b] of adjacency) {
      assert.notEqual(sol.get(a), sol.get(b), `${a} and ${b} should have different colors`);
    }
  });
});

// ===== Sudoku =====
describe('CSP — Sudoku', () => {
  it('solves easy Sudoku', () => {
    // Easy puzzle — many givens
    const grid = [
      [5,3,0, 0,7,0, 0,0,0],
      [6,0,0, 1,9,5, 0,0,0],
      [0,9,8, 0,0,0, 0,6,0],
      [8,0,0, 0,6,0, 0,0,3],
      [4,0,0, 8,0,3, 0,0,1],
      [7,0,0, 0,2,0, 0,0,6],
      [0,6,0, 0,0,0, 2,8,0],
      [0,0,0, 4,1,9, 0,0,5],
      [0,0,0, 0,8,0, 0,7,9],
    ];
    
    const csp = sudoku(grid);
    const sol = csp.solve();
    assert.ok(sol, 'Easy Sudoku should be solvable');
    
    // Verify all cells filled
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const val = sol.get(`r${r}c${c}`);
        assert.ok(val >= 1 && val <= 9, `Cell r${r}c${c} should be 1-9, got ${val}`);
      }
    }
    
    // Verify rows
    for (let r = 0; r < 9; r++) {
      const vals = new Set();
      for (let c = 0; c < 9; c++) vals.add(sol.get(`r${r}c${c}`));
      assert.equal(vals.size, 9, `Row ${r} should have 9 distinct values`);
    }
    
    // Verify columns
    for (let c = 0; c < 9; c++) {
      const vals = new Set();
      for (let r = 0; r < 9; r++) vals.add(sol.get(`r${r}c${c}`));
      assert.equal(vals.size, 9, `Column ${c} should have 9 distinct values`);
    }
  });
});
