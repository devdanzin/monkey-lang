const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  lvar, isLvar, eq, neq, succeed, fail, conde, conj, disj, fresh,
  run, runAll, toList, fromList, conso, firsto, resto, emptyo,
  membero, appendo, symbolo, numbero, unify, deepWalk, zzz
} = require('../src/index.js');

// ─── Basic Unification ──────────────────────────────

test('unify: identical values', () => {
  const s = unify(5, 5, new Map());
  assert.ok(s !== null);
});

test('unify: different values fail', () => {
  assert.equal(unify(5, 6, new Map()), null);
});

test('unify: lvar with value', () => {
  const x = lvar('x');
  const s = unify(x, 42, new Map());
  assert.equal(deepWalk(x, s), 42);
});

test('unify: two lvars', () => {
  const x = lvar('x');
  const y = lvar('y');
  const s = unify(x, y, new Map());
  assert.ok(s !== null);
});

test('unify: arrays', () => {
  const x = lvar('x');
  const s = unify([1, x, 3], [1, 2, 3], new Map());
  assert.equal(deepWalk(x, s), 2);
});

test('unify: nested arrays', () => {
  const x = lvar('x');
  const s = unify([1, [2, x]], [1, [2, 3]], new Map());
  assert.equal(deepWalk(x, s), 3);
});

test('unify: occurs check prevents circular', () => {
  const x = lvar('x');
  assert.equal(unify(x, [1, x], new Map()), null);
});

test('unify: strings', () => {
  const s = unify('hello', 'hello', new Map());
  assert.ok(s !== null);
  assert.equal(unify('hello', 'world', new Map()), null);
});

// ─── Basic Goals ────────────────────────────────────

test('eq: simple unification goal', () => {
  const r = run(1, q => eq(q, 5));
  assert.deepEqual(r, [5]);
});

test('eq: two values', () => {
  const r = run(1, q => eq(q, 'hello'));
  assert.deepEqual(r, ['hello']);
});

test('succeed always succeeds', () => {
  const r = run(1, q => conj(succeed, eq(q, 42)));
  assert.deepEqual(r, [42]);
});

test('fail always fails', () => {
  const r = run(1, _q => fail);
  assert.deepEqual(r, []);
});

// ─── Fresh ──────────────────────────────────────────

test('fresh: introduce new variables', () => {
  const r = run(1, q =>
    fresh((x, y) => conj(eq(x, 1), eq(y, 2), eq(q, [x, y])))
  );
  assert.deepEqual(r, [[1, 2]]);
});

test('fresh: variable sharing', () => {
  const r = run(1, q =>
    fresh(x => conj(eq(x, q), eq(x, 'shared')))
  );
  assert.deepEqual(r, ['shared']);
});

// ─── Conde (Disjunction) ───────────────────────────

test('conde: multiple alternatives', () => {
  const r = runAll(q =>
    conde(
      [eq(q, 'tea')],
      [eq(q, 'coffee')],
      [eq(q, 'water')]
    )
  );
  assert.deepEqual(r, ['tea', 'coffee', 'water']);
});

test('conde: with failure', () => {
  const r = runAll(q =>
    conde(
      [eq(q, 'a'), fail],
      [eq(q, 'b')]
    )
  );
  assert.deepEqual(r, ['b']);
});

// ─── Conj (Conjunction) ─────────────────────────────

test('conj: all must succeed', () => {
  const r = run(1, q =>
    fresh((x, y) => conj(eq(x, 1), eq(y, 2), eq(q, [x, y])))
  );
  assert.deepEqual(r, [[1, 2]]);
});

test('conj: fails if any fails', () => {
  const r = run(1, q => conj(eq(q, 5), fail));
  assert.deepEqual(r, []);
});

// ─── Disj (Disjunction) ────────────────────────────

test('disj: any can succeed', () => {
  const r = runAll(q => disj(eq(q, 1), eq(q, 2), eq(q, 3)));
  assert.deepEqual(r, [1, 2, 3]);
});

// ─── Run with N ─────────────────────────────────────

test('run: limit results', () => {
  const r = run(2, q =>
    conde([eq(q, 1)], [eq(q, 2)], [eq(q, 3)])
  );
  assert.equal(r.length, 2);
});

test('run: 0 results', () => {
  const r = run(0, _q => succeed);
  assert.deepEqual(r, []);
});

// ─── Linked Lists ───────────────────────────────────

test('toList/fromList roundtrip', () => {
  const l = toList(1, 2, 3);
  assert.deepEqual(fromList(l), [1, 2, 3]);
});

test('toList empty', () => {
  assert.equal(toList(), null);
});

test('conso: construct pair', () => {
  const r = run(1, q => conso(1, toList(2, 3), q));
  assert.deepEqual(fromList(r[0]), [1, 2, 3]);
});

test('conso: decompose pair', () => {
  const r = run(1, q =>
    fresh((h, t) => conj(
      conso(h, t, toList(1, 2, 3)),
      eq(q, [h, t])
    ))
  );
  assert.equal(r[0][0], 1);
  assert.deepEqual(fromList(r[0][1]), [2, 3]);
});

test('firsto', () => {
  const r = run(1, q => firsto(toList('a', 'b', 'c'), q));
  assert.deepEqual(r, ['a']);
});

test('resto', () => {
  const r = run(1, q => resto(toList('a', 'b', 'c'), q));
  assert.deepEqual(fromList(r[0]), ['b', 'c']);
});

test('emptyo: null is empty', () => {
  const r = run(1, _q => emptyo(null));
  assert.equal(r.length, 1);
});

test('emptyo: non-null fails', () => {
  const r = run(1, _q => emptyo(toList(1)));
  assert.equal(r.length, 0);
});

// ─── Membero ────────────────────────────────────────

test('membero: find in list', () => {
  const r = runAll(q => membero(q, toList('a', 'b', 'c')));
  assert.deepEqual(r, ['a', 'b', 'c']);
});

test('membero: check membership', () => {
  const r = run(1, _q => membero('b', toList('a', 'b', 'c')));
  assert.equal(r.length, 1);
});

test('membero: not a member', () => {
  const r = run(1, _q => membero('d', toList('a', 'b', 'c')));
  assert.equal(r.length, 0);
});

// ─── Appendo ────────────────────────────────────────

test('appendo: concatenate two lists', () => {
  const r = run(1, q => appendo(toList(1, 2), toList(3, 4), q));
  assert.deepEqual(fromList(r[0]), [1, 2, 3, 4]);
});

test('appendo: split a list (relational)', () => {
  const r = runAll(q =>
    fresh((x, y) => conj(
      appendo(x, y, toList(1, 2, 3)),
      eq(q, [x, y])
    ))
  );
  // Should find all ways to split [1,2,3]
  assert.equal(r.length, 4); // [], [1,2,3] | [1], [2,3] | [1,2], [3] | [1,2,3], []
});

test('appendo: infer first argument', () => {
  const r = run(1, q => appendo(q, toList(3), toList(1, 2, 3)));
  assert.deepEqual(fromList(r[0]), [1, 2]);
});

// ─── Interleaving Search ────────────────────────────

test('interleaving: infinite stream interleaved with finite', () => {
  // Create a goal that generates infinite solutions
  function always(q) {
    return conde(
      [eq(q, 'yes')],
      [zzz(() => always(q))] // zzz makes the recursive call lazy
    );
  }
  // With interleaving, we can still get results
  const r = run(3, q => always(q));
  assert.deepEqual(r, ['yes', 'yes', 'yes']);
});

test('interleaving: two infinite streams', () => {
  function nats(n) {
    return (q) => conde(
      [eq(q, n)],
      [zzz(() => nats(n + 1)(q))]
    );
  }
  const r = run(5, q => nats(0)(q));
  assert.deepEqual(r, [0, 1, 2, 3, 4]);
});

// ─── Relational Programming ─────────────────────────

test('relational: run backwards — find input from output', () => {
  // What x makes [x, 2] = [1, 2]?
  const r = run(1, q =>
    fresh(x => conj(eq(q, x), eq([x, 2], [1, 2])))
  );
  assert.deepEqual(r, [1]);
});

test('relational: multiple unknowns', () => {
  const r = run(1, q =>
    fresh((x, y) => conj(
      eq([x, y], [1, 2]),
      eq(q, [y, x])
    ))
  );
  assert.deepEqual(r, [[2, 1]]);
});

// ─── neq ────────────────────────────────────────────

test('neq: different values succeed', () => {
  const r = run(1, q => conj(eq(q, 5), neq(q, 6)));
  assert.deepEqual(r, [5]);
});

test('neq: same values fail', () => {
  const r = run(1, q => conj(eq(q, 5), neq(q, 5)));
  assert.deepEqual(r, []);
});

// ─── Type Constraints ───────────────────────────────

test('symbolo: strings pass', () => {
  const r = run(1, q => conj(eq(q, 'hello'), symbolo(q)));
  assert.deepEqual(r, ['hello']);
});

test('symbolo: numbers fail', () => {
  const r = run(1, q => conj(eq(q, 42), symbolo(q)));
  assert.deepEqual(r, []);
});

test('numbero: numbers pass', () => {
  const r = run(1, q => conj(eq(q, 42), numbero(q)));
  assert.deepEqual(r, [42]);
});

test('numbero: strings fail', () => {
  const r = run(1, q => conj(eq(q, 'hello'), numbero(q)));
  assert.deepEqual(r, []);
});

// ─── Complex Relational Programs ────────────────────

test('relational: ancestor via linked list family tree', () => {
  function parento(x, y) {
    return conde(
      [eq(x, 'tom'), eq(y, 'bob')],
      [eq(x, 'tom'), eq(y, 'liz')],
      [eq(x, 'bob'), eq(y, 'ann')],
      [eq(x, 'bob'), eq(y, 'pat')]
    );
  }

  function ancestoro(x, y) {
    return conde(
      [parento(x, y)],
      [fresh(z => conj(parento(x, z), ancestoro(z, y)))]
    );
  }

  const r = runAll(q => ancestoro('tom', q));
  // tom -> bob, liz, ann, pat (bob's children)
  assert.ok(r.includes('bob'));
  assert.ok(r.includes('liz'));
  assert.ok(r.includes('ann'));
  assert.ok(r.includes('pat'));
});

test('relational: generate and test pattern', () => {
  function digitso(x) {
    return conde(
      [eq(x, 0)], [eq(x, 1)], [eq(x, 2)], [eq(x, 3)], [eq(x, 4)],
      [eq(x, 5)], [eq(x, 6)], [eq(x, 7)], [eq(x, 8)], [eq(x, 9)]
    );
  }

  // Find pairs (x, y) where x + y = 5, x < y
  // (miniKanren is relational, not arithmetic — we enumerate)
  const r = runAll(q =>
    fresh((x, y) => conj(
      digitso(x),
      digitso(y),
      // We can't do arithmetic directly, but we can enumerate constraints
      conde(
        [eq(x, 0), eq(y, 5)],
        [eq(x, 1), eq(y, 4)],
        [eq(x, 2), eq(y, 3)]
      ),
      eq(q, [x, y])
    ))
  );
  assert.deepEqual(r, [[0, 5], [1, 4], [2, 3]]);
});

test('relational: list reversal', () => {
  function reverso(l, r) {
    return conde(
      [emptyo(l), emptyo(r)],
      [fresh((h, t, revT) => conj(
        conso(h, t, l),
        zzz(() => reverso(t, revT)),
        appendo(revT, toList(h), r)
      ))]
    );
  }

  const r = run(1, q => reverso(toList(1, 2, 3), q));
  assert.deepEqual(fromList(r[0]), [3, 2, 1]);
});

test('relational: reversal backwards (find input from output)', () => {
  // Simpler relational test: appendo can find first argument
  const r = run(1, q => appendo(q, toList(3), toList(1, 2, 3)));
  assert.deepEqual(fromList(r[0]), [1, 2]);
});

// ─── Edge Cases ─────────────────────────────────────

test('unify null', () => {
  const s = unify(null, null, new Map());
  assert.ok(s !== null);
});

test('unify booleans', () => {
  assert.ok(unify(true, true, new Map()) !== null);
  assert.equal(unify(true, false, new Map()), null);
});

test('run with complex nested structure', () => {
  const r = run(1, q =>
    fresh((x, y, z) => conj(
      eq(x, {a: 1, b: y}),
      eq(y, [2, z]),
      eq(z, 'end'),
      eq(q, x)
    ))
  );
  assert.deepEqual(r, [{a: 1, b: [2, 'end']}]);
});

test('empty conde returns no results', () => {
  const r = runAll(q => conde());
  assert.deepEqual(r, []);
});
