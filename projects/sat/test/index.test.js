const { test } = require('node:test');
const assert = require('node:assert/strict');
const { solve, verify, parseDIMACS } = require('../src/index.js');

test('simple satisfiable', () => {
  // (x1 OR x2) AND (NOT x1 OR x2)
  const result = solve([[1, 2], [-1, 2]]);
  assert.equal(result.sat, true);
  assert.ok(verify([[1, 2], [-1, 2]], result.model));
});

test('unsatisfiable', () => {
  // (x) AND (NOT x)
  const result = solve([[1], [-1]]);
  assert.equal(result.sat, false);
});

test('unit clause', () => {
  const result = solve([[1], [1, 2], [-2, 3]]);
  assert.equal(result.sat, true);
  assert.equal(result.model.get(1), true);
});

test('pure literal', () => {
  // x1 appears only positive
  const result = solve([[1, 2], [1, -2]]);
  assert.equal(result.sat, true);
});

test('3-SAT instance', () => {
  const clauses = [
    [1, 2, 3],
    [-1, 2, 3],
    [1, -2, 3],
    [1, 2, -3],
    [-1, -2, 3],
    [-1, 2, -3],
    [1, -2, -3],
  ];
  const result = solve(clauses);
  assert.equal(result.sat, true);
  assert.ok(verify(clauses, result.model));
});

test('all negative — unsatisfiable', () => {
  // Each variable must be both true and false
  const result = solve([[1], [2], [-1, -2]]);
  assert.equal(result.sat, false);
});

test('verify — correct model', () => {
  const clauses = [[1, 2], [-1, 3]];
  const model = new Map([[1, true], [2, true], [3, true]]);
  assert.ok(verify(clauses, model));
});

test('verify — incorrect model', () => {
  const clauses = [[1], [-1]];
  const model = new Map([[1, true]]);
  assert.ok(!verify(clauses, model));
});

test('parseDIMACS', () => {
  const input = `c comment
p cnf 3 2
1 2 0
-1 3 0`;
  const clauses = parseDIMACS(input);
  assert.deepEqual(clauses, [[1, 2], [-1, 3]]);
});

test('larger instance', () => {
  // 5 variables, 10 clauses
  const clauses = [
    [1, -2, 3], [-1, 2, 4], [2, -3, 5],
    [-1, -4, 5], [1, 3, -5], [-2, 4, -5],
    [1, 2, -4], [-3, 4, 5], [1, -2, -5],
    [-1, 3, 4],
  ];
  const result = solve(clauses);
  assert.equal(result.sat, true);
  assert.ok(verify(clauses, result.model));
});
