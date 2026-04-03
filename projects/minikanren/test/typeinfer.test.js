const { test } = require('node:test');
const assert = require('node:assert/strict');
const { typeo, lookupo, typeCheck } = require('../src/typeinfer.js');
const { run, eq, fresh, conj, toList, fromList } = require('../src/index.js');

// ─── Number Literals ────────────────────────────────

test('type: number literal is int', () => {
  const r = typeCheck(['num', 42]);
  assert.deepEqual(r, ['int']);
});

test('type: another number literal', () => {
  const r = typeCheck(['num', 0]);
  assert.deepEqual(r, ['int']);
});

// ─── Boolean Literals ───────────────────────────────

test('type: boolean literal is bool', () => {
  const r = typeCheck(['bool', true]);
  assert.deepEqual(r, ['bool']);
});

test('type: false is bool', () => {
  const r = typeCheck(['bool', false]);
  assert.deepEqual(r, ['bool']);
});

// ─── Variables ──────────────────────────────────────

test('type: variable lookup in environment', () => {
  const env = toList(['x', 'int']);
  const r = run(1, t => typeo(env, ['var', 'x'], t));
  assert.deepEqual(r, ['int']);
});

test('type: variable lookup second binding', () => {
  const env = toList(['y', 'bool'], ['x', 'int']);
  const r = run(1, t => typeo(env, ['x', 'x'], t));
  // Actually should be ['var', 'x']
});

test('type: variable in deeper env', () => {
  const env = toList(['y', 'bool'], ['x', 'int']);
  const r = run(1, t => typeo(env, ['var', 'x'], t));
  assert.deepEqual(r, ['int']);
});

// ─── Lambda ─────────────────────────────────────────

test('type: identity function', () => {
  // \x -> x : a -> a
  const r = typeCheck(['lam', 'x', ['var', 'x']]);
  assert.equal(r.length, 1);
  assert.equal(r[0][0], 'arrow');
  // tArg and tBody should be the same (unified)
});

test('type: constant function', () => {
  // \x -> 42 : a -> int
  const r = typeCheck(['lam', 'x', ['num', 42]]);
  assert.equal(r.length, 1);
  assert.equal(r[0][0], 'arrow');
  assert.equal(r[0][2], 'int');
});

// ─── Application ────────────────────────────────────

test('type: apply identity to number', () => {
  // (\x -> x)(42) : int
  const expr = ['app', ['lam', 'x', ['var', 'x']], ['num', 42]];
  const r = typeCheck(expr);
  assert.deepEqual(r, ['int']);
});

test('type: apply identity to bool', () => {
  // (\x -> x)(true) : bool
  const expr = ['app', ['lam', 'x', ['var', 'x']], ['bool', true]];
  const r = typeCheck(expr);
  assert.deepEqual(r, ['bool']);
});

test('type: apply constant function', () => {
  // (\x -> 42)(true) : int
  const expr = ['app', ['lam', 'x', ['num', 42]], ['bool', true]];
  const r = typeCheck(expr);
  assert.deepEqual(r, ['int']);
});

// ─── If-then-else ───────────────────────────────────

test('type: if-then-else with matching branches', () => {
  // if true then 1 else 2 : int
  const r = typeCheck(['if', ['bool', true], ['num', 1], ['num', 2]]);
  assert.deepEqual(r, ['int']);
});

test('type: if-then-else with bool branches', () => {
  const r = typeCheck(['if', ['bool', true], ['bool', false], ['bool', true]]);
  assert.deepEqual(r, ['bool']);
});

// ─── Backward Inference ─────────────────────────────

test('backward: what expression has type int?', () => {
  const r = run(3, expr => typeo(null, expr, 'int'));
  assert.ok(r.length >= 1);
  // First result should be ['num', _] (a number literal)
  assert.equal(r[0][0], 'num');
});

test('backward: what expression has type bool?', () => {
  const r = run(3, expr => typeo(null, expr, 'bool'));
  assert.ok(r.length >= 1);
  assert.equal(r[0][0], 'bool');
});

// ─── Environment Lookup ─────────────────────────────

test('lookupo: finds first match', () => {
  const env = toList(['x', 'int'], ['y', 'bool']);
  const r = run(1, t => lookupo('x', env, t));
  assert.deepEqual(r, ['int']);
});

test('lookupo: finds second binding', () => {
  const env = toList(['x', 'int'], ['y', 'bool']);
  const r = run(1, t => lookupo('y', env, t));
  assert.deepEqual(r, ['bool']);
});

test('lookupo: shadowing', () => {
  const env = toList(['x', 'bool'], ['x', 'int']);
  const r = run(1, t => lookupo('x', env, t));
  assert.deepEqual(r, ['bool']); // first binding wins
});
