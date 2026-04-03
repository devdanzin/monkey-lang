const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  lvar, eq, neq, succeed, fail, conde, conj, disj, fresh,
  run, runAll, toList, fromList, conso, firsto, resto, emptyo,
  membero, appendo, symbolo, numbero, absento, unify, deepWalk,
  zzz, conda, condu, onceo, project, everyo, lengtho
} = require('../src/index.js');

// ─── absento ────────────────────────────────────────

test('absento: value not in structure', () => {
  const r = run(1, q => conj(eq(q, [1, 2, 3]), absento(4, q)));
  assert.deepEqual(r, [[1, 2, 3]]);
});

test('absento: value in structure fails', () => {
  const r = run(1, q => conj(eq(q, [1, 2, 3]), absento(2, q)));
  assert.deepEqual(r, []);
});

test('absento: nested structure', () => {
  const r = run(1, q => conj(eq(q, [[1, 2], [3, 4]]), absento(5, q)));
  assert.deepEqual(r, [[[1, 2], [3, 4]]]);
});

test('absento: nested fails', () => {
  const r = run(1, q => conj(eq(q, [[1, 2], [3, 4]]), absento(3, q)));
  assert.deepEqual(r, []);
});

// ─── conda (soft cut) ───────────────────────────────

test('conda: commits to first matching clause', () => {
  const r = runAll(q =>
    conda(
      [eq(q, 'a')],          // first clause succeeds
      [eq(q, 'b')],          // never tried
      [eq(q, 'c')]           // never tried
    )
  );
  assert.deepEqual(r, ['a']); // only first clause
});

test('conda: falls through on failure', () => {
  const r = runAll(q =>
    conda(
      [fail],                 // fails
      [eq(q, 'b')],          // tried next
      [eq(q, 'c')]           // not tried
    )
  );
  assert.deepEqual(r, ['b']);
});

test('conda: vs conde (multiple solutions)', () => {
  // conde would give ['a', 'b'] but conda commits to first
  const r = runAll(q =>
    conda(
      [conde([eq(q, 'a1')], [eq(q, 'a2')])],  // two solutions
      [eq(q, 'b')]
    )
  );
  // conda commits to clause 1 and returns both solutions from it
  assert.deepEqual(r, ['a1', 'a2']);
});

// ─── condu (committed choice) ───────────────────────

test('condu: takes only first result of matching clause', () => {
  const r = runAll(q =>
    condu(
      [conde([eq(q, 'a1')], [eq(q, 'a2')])],  // two solutions
      [eq(q, 'b')]
    )
  );
  // condu takes only first result from clause 1
  assert.deepEqual(r, ['a1']);
});

// ─── onceo ──────────────────────────────────────────

test('onceo: only first solution', () => {
  const r = runAll(q =>
    onceo(conde([eq(q, 1)], [eq(q, 2)], [eq(q, 3)]))
  );
  assert.deepEqual(r, [1]);
});

// ─── project ────────────────────────────────────────

test('project: access bound value', () => {
  const r = run(1, q =>
    fresh(x => conj(
      eq(x, 42),
      project(x, val => eq(q, val * 2))
    ))
  );
  assert.deepEqual(r, [84]);
});

test('project: conditional based on value', () => {
  const r = run(1, q =>
    fresh(x => conj(
      eq(x, 'hello'),
      project(x, val =>
        val === 'hello' ? eq(q, 'world') : fail
      )
    ))
  );
  assert.deepEqual(r, ['world']);
});

// ─── everyo ─────────────────────────────────────────

test('everyo: all elements satisfy predicate', () => {
  const r = run(1, _q =>
    everyo(x => numbero(x), toList(1, 2, 3))
  );
  assert.equal(r.length, 1);
});

test('everyo: fails if any element fails', () => {
  const r = run(1, _q =>
    everyo(x => numbero(x), toList(1, 'oops', 3))
  );
  assert.equal(r.length, 0);
});

// ─── Complex Relational Scenarios ───────────────────

test('relational: type-safe pairs', () => {
  const r = runAll(q =>
    fresh((x, y) => conj(
      conde([eq(x, 1)], [eq(x, 2)], [eq(x, 3)]),
      conde([eq(y, 'a')], [eq(y, 'b')]),
      eq(q, [x, y])
    ))
  );
  // Should get 3 * 2 = 6 pairs
  assert.equal(r.length, 6);
});

test('relational: generate list from template', () => {
  const r = run(1, q =>
    fresh((x, y) => conj(
      membero(x, toList(1, 2, 3)),
      membero(y, toList('a', 'b')),
      eq(q, [x, y]),
      eq(x, 2),
      eq(y, 'b')
    ))
  );
  assert.deepEqual(r, [[2, 'b']]);
});

test('relational: transitive closure', () => {
  function edgeo(x, y) {
    return conde(
      [eq(x, 'a'), eq(y, 'b')],
      [eq(x, 'b'), eq(y, 'c')],
      [eq(x, 'c'), eq(y, 'd')]
    );
  }

  function patho(x, y) {
    return conde(
      [edgeo(x, y)],
      [fresh(z => conj(edgeo(x, z), zzz(() => patho(z, y))))]
    );
  }

  const r = runAll(q => patho('a', q));
  assert.ok(r.includes('b'));
  assert.ok(r.includes('c'));
  assert.ok(r.includes('d'));
});

test('relational: last element of list', () => {
  function lasto(l, x) {
    return conde(
      [conso(x, eq(null), l)],  // wrong approach, let me fix
      [fresh((h, t) => conj(
        conso(h, t, l),
        zzz(() => lasto(t, x))
      ))]
    );
  }
  // Actually, simpler approach
  function lasto2(l, x) {
    return fresh(h => conde(
      [eq(l, [x, null])],  // single element
      [fresh(t => conj(
        conso(h, t, l),
        zzz(() => lasto2(t, x))
      ))]
    ));
  }

  const r = run(1, q => lasto2(toList(1, 2, 3), q));
  assert.deepEqual(r, [3]);
});

// ─── Append relation: all splits ────────────────────

test('appendo: enumerate all splits of [1,2,3,4]', () => {
  const r = runAll(q =>
    fresh((x, y) => conj(
      appendo(x, y, toList(1, 2, 3, 4)),
      eq(q, [x, y])
    ))
  );
  assert.equal(r.length, 5); // 5 ways: []/[1234], [1]/[234], [12]/[34], [123]/[4], [1234]/[]
});

// ─── neq edge cases ────────────────────────────────

test('neq: arrays', () => {
  const r = run(1, q => conj(eq(q, [1, 2]), neq(q, [1, 3])));
  assert.deepEqual(r, [[1, 2]]);
});

test('neq: same arrays fail', () => {
  const r = run(1, q => conj(eq(q, [1, 2]), neq(q, [1, 2])));
  assert.deepEqual(r, []);
});

// ─── Mixed constraints ─────────────────────────────

test('combined: numbero + neq', () => {
  const r = runAll(q => conj(
    conde([eq(q, 1)], [eq(q, 2)], [eq(q, 3)]),
    numbero(q),
    neq(q, 2)
  ));
  assert.deepEqual(r, [1, 3]);
});

test('combined: symbolo + membero', () => {
  const r = runAll(q => conj(
    membero(q, toList('a', 1, 'b', 2, 'c')),
    symbolo(q)
  ));
  assert.deepEqual(r, ['a', 'b', 'c']);
});

test('combined: numbero + membero', () => {
  const r = runAll(q => conj(
    membero(q, toList('a', 1, 'b', 2, 'c')),
    numbero(q)
  ));
  assert.deepEqual(r, [1, 2]);
});
