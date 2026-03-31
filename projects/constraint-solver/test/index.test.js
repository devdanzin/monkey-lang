const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  CSP, allDiff, equals, notEquals, lessThan, sum, constraint,
  nQueens, mapColoring, sudoku,
} = require('../src/index.js');

test('simple 2-variable CSP', () => {
  const csp = new CSP();
  csp.addVariable('X', [1, 2, 3]);
  csp.addVariable('Y', [1, 2, 3]);
  const ne = notEquals('X', 'Y');
  csp.addConstraint(ne.vars, ne.check);
  const lt = lessThan('X', 'Y');
  csp.addConstraint(lt.vars, lt.check);

  const sol = csp.solve();
  assert.ok(sol);
  assert.ok(sol.X < sol.Y);
  assert.notEqual(sol.X, sol.Y);
});

test('allDiff constraint', () => {
  const csp = new CSP();
  csp.addVariable('A', [1, 2, 3]);
  csp.addVariable('B', [1, 2, 3]);
  csp.addVariable('C', [1, 2, 3]);
  const ad = allDiff('A', 'B', 'C');
  csp.addConstraint(ad.vars, ad.check);
  // Also add pairwise for AC-3
  for (const [a, b] of [['A','B'],['A','C'],['B','C']]) {
    const ne = notEquals(a, b);
    csp.addConstraint(ne.vars, ne.check);
  }

  const sol = csp.solve();
  assert.ok(sol);
  assert.notEqual(sol.A, sol.B);
  assert.notEqual(sol.A, sol.C);
  assert.notEqual(sol.B, sol.C);
});

test('sum constraint', () => {
  const csp = new CSP();
  csp.addVariable('X', [1, 2, 3, 4, 5]);
  csp.addVariable('Y', [1, 2, 3, 4, 5]);
  const s = sum('X', 'Y', 7); // X + Y = 7
  csp.addConstraint(s.vars, s.check);

  const sol = csp.solve();
  assert.ok(sol);
  assert.equal(sol.X + sol.Y, 7);
});

test('unsolvable CSP returns null', () => {
  const csp = new CSP();
  csp.addVariable('X', [1]);
  csp.addVariable('Y', [1]);
  const ne = notEquals('X', 'Y');
  csp.addConstraint(ne.vars, ne.check);

  const sol = csp.solve();
  assert.equal(sol, null);
});

test('findAll solutions', () => {
  const csp = new CSP();
  csp.addVariable('X', [1, 2]);
  csp.addVariable('Y', [1, 2]);
  const ne = notEquals('X', 'Y');
  csp.addConstraint(ne.vars, ne.check);

  const solutions = csp.solve(true);
  assert.equal(solutions.length, 2);
  assert.ok(solutions.some(s => s.X === 1 && s.Y === 2));
  assert.ok(solutions.some(s => s.X === 2 && s.Y === 1));
});

test('4-Queens', () => {
  const csp = nQueens(4);
  const sol = csp.solve();
  assert.ok(sol, '4-Queens should be solvable');
  // Verify no conflicts
  const cols = [sol.Q0, sol.Q1, sol.Q2, sol.Q3];
  assert.equal(new Set(cols).size, 4, 'All columns unique');
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      assert.notEqual(Math.abs(cols[i] - cols[j]), Math.abs(i - j), 'No diagonal conflict');
    }
  }
});

test('8-Queens', () => {
  const csp = nQueens(8);
  const sol = csp.solve();
  assert.ok(sol, '8-Queens should be solvable');
  const cols = Array.from({ length: 8 }, (_, i) => sol[`Q${i}`]);
  assert.equal(new Set(cols).size, 8);
});

test('map coloring — Australia', () => {
  const csp = mapColoring(
    ['WA', 'NT', 'SA', 'QLD', 'NSW', 'VIC', 'TAS'],
    [['WA','NT'], ['WA','SA'], ['NT','SA'], ['NT','QLD'], ['SA','QLD'], ['SA','NSW'], ['SA','VIC'], ['QLD','NSW'], ['NSW','VIC']],
    ['red', 'green', 'blue']
  );
  const sol = csp.solve();
  assert.ok(sol);
  // Verify no neighbors share colors
  assert.notEqual(sol.WA, sol.NT);
  assert.notEqual(sol.WA, sol.SA);
  assert.notEqual(sol.NT, sol.SA);
  assert.notEqual(sol.SA, sol.QLD);
  assert.notEqual(sol.SA, sol.NSW);
  assert.notEqual(sol.SA, sol.VIC);
});

test('Sudoku — easy puzzle', () => {
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
  assert.ok(sol, 'Sudoku should be solvable');

  // Verify all rows have digits 1-9
  for (let r = 0; r < 9; r++) {
    const row = Array.from({ length: 9 }, (_, c) => sol[`R${r}C${c}`]);
    assert.equal(new Set(row).size, 9, `Row ${r} has all unique digits`);
  }
  // Verify given values are preserved
  assert.equal(sol.R0C0, 5);
  assert.equal(sol.R0C1, 3);
  assert.equal(sol.R0C4, 7);
});

test('AC-3 prunes domains', () => {
  const csp = new CSP();
  csp.addVariable('X', [1, 2, 3]);
  csp.addVariable('Y', [1]);
  const ne = notEquals('X', 'Y');
  csp.addConstraint(ne.vars, ne.check);

  const domains = new Map();
  for (const [k, v] of csp.variables) domains.set(k, new Set(v));
  csp.ac3(domains);

  // After AC-3, X's domain should not contain 1
  assert.ok(!domains.get('X').has(1));
  assert.ok(domains.get('X').has(2));
  assert.ok(domains.get('X').has(3));
});

test('equals constraint', () => {
  const csp = new CSP();
  csp.addVariable('X', [1, 2, 3]);
  csp.addVariable('Y', [1, 2, 3]);
  const eq = equals('X', 'Y');
  csp.addConstraint(eq.vars, eq.check);

  const solutions = csp.solve(true);
  assert.equal(solutions.length, 3);
  assert.ok(solutions.every(s => s.X === s.Y));
});

test('custom constraint', () => {
  const csp = new CSP();
  csp.addVariable('X', [1, 2, 3, 4, 5]);
  csp.addVariable('Y', [1, 2, 3, 4, 5]);
  // X * Y = 12
  const c = constraint(['X', 'Y'], a => a.X * a.Y === 12);
  csp.addConstraint(c.vars, c.check);

  const solutions = csp.solve(true);
  assert.ok(solutions.length > 0);
  assert.ok(solutions.every(s => s.X * s.Y === 12));
});
