const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Prolog, atom, variable, compound, num, list, NIL } = require('../src/index.js');

// Helper
function listToArr(term) {
  const arr = [];
  let cur = term;
  while (cur.type === 'compound' && cur.functor === '.' && cur.args.length === 2) {
    const elem = cur.args[0];
    arr.push(elem.type === 'num' ? elem.value : elem);
    cur = cur.args[1];
  }
  return arr;
}

// ─── Advanced List Operations ───────────────────────

test('select/3 via Prolog', () => {
  const p = new Prolog();
  p.consult(`
    select(X, [X|T], T).
    select(X, [H|T], [H|R]) :- select(X, T, R).
  `);
  const r = p.queryString('select(2, [1, 2, 3], R)');
  assert.equal(r.length, 1);
  assert.deepEqual(listToArr(r[0].R), [1, 3]);
});

test('intersection/3 via Prolog', () => {
  const p = new Prolog();
  p.consult(`
    inter([], _, []).
    inter([H|T], B, [H|R]) :- member(H, B), inter(T, B, R).
    inter([_|T], B, R) :- inter(T, B, R).
  `);
  const r = p.queryString('inter([1, 2, 3, 4], [2, 4, 6], R)');
  assert.ok(r.length >= 1);
  const arr = listToArr(r[0].R);
  assert.deepEqual(arr, [2, 4]);
});

test('subtract/3 via Prolog', () => {
  const p = new Prolog();
  p.consult(`
    subtract([], _, []).
    subtract([H|T], B, R) :- member(H, B), subtract(T, B, R).
    subtract([H|T], B, [H|R]) :- not(member(H, B)), subtract(T, B, R).
  `);
  const r = p.queryString('subtract([1, 2, 3, 4, 5], [2, 4], R)');
  assert.equal(r.length, 1);
  assert.deepEqual(listToArr(r[0].R), [1, 3, 5]);
});

test('union/3 via Prolog', () => {
  const p = new Prolog();
  p.consult(`
    union([], B, B).
    union([H|T], B, R) :- member(H, B), union(T, B, R).
    union([H|T], B, [H|R]) :- not(member(H, B)), union(T, B, R).
  `);
  const r = p.queryString('union([1, 2, 3], [2, 3, 4], R)');
  assert.equal(r.length, 1);
  assert.deepEqual(listToArr(r[0].R), [1, 2, 3, 4]);
});

// ─── Advanced Recursion ─────────────────────────────

test('Ackermann function', () => {
  const p = new Prolog();
  p.consult(`
    ack(0, N, R) :- R is N + 1.
    ack(M, 0, R) :- M > 0, M1 is M - 1, ack(M1, 1, R).
    ack(M, N, R) :- M > 0, N > 0, N1 is N - 1, ack(M, N1, R1), M1 is M - 1, ack(M1, R1, R).
  `);
  const r = p.queryString('ack(2, 3, R)');
  assert.equal(r[0].R.value, 9);
});

test('binary representation', () => {
  const p = new Prolog();
  p.consult(`
    binary(0, [0]).
    binary(1, [1]).
    binary(N, Bits) :- N > 1, Q is N // 2, R is N mod 2, binary(Q, Rest), append(Rest, [R], Bits).
  `);
  const r = p.queryString('binary(13, B)');
  assert.equal(r.length, 1);
  assert.deepEqual(listToArr(r[0].B), [1, 1, 0, 1]);
});

test('merge sort in Prolog', () => {
  const p = new Prolog();
  p.consult(`
    msort_p([], []).
    msort_p([X], [X]).
    msort_p(List, Sorted) :-
      length(List, N), N > 1,
      Half is N // 2,
      split_at(Half, List, Left, Right),
      msort_p(Left, SortedLeft),
      msort_p(Right, SortedRight),
      merge_lists(SortedLeft, SortedRight, Sorted).
    
    split_at(0, List, [], List).
    split_at(N, [H|T], [H|L], R) :- N > 0, N1 is N - 1, split_at(N1, T, L, R).
    
    merge_lists([], R, R).
    merge_lists(L, [], L).
    merge_lists([H1|T1], [H2|T2], [H1|M]) :- H1 =< H2, merge_lists(T1, [H2|T2], M).
    merge_lists([H1|T1], [H2|T2], [H2|M]) :- H2 < H1, merge_lists([H1|T1], T2, M).
  `);
  const r = p.queryString('msort_p([5, 3, 8, 1, 9, 2, 7], S)');
  assert.equal(r.length, 1);
  assert.deepEqual(listToArr(r[0].S), [1, 2, 3, 5, 7, 8, 9]);
});

// ─── Constraint-like Problems ───────────────────────

test('cryptarithmetic: A + B = C', () => {
  const p = new Prolog();
  p.consult(`
    solve(A, B, C) :-
      member(A, [1,2,3,4,5,6,7,8,9]),
      member(B, [1,2,3,4,5,6,7,8,9]),
      C is A + B,
      C < 10.
  `);
  const r = p.queryString('solve(3, 4, C)');
  assert.equal(r[0].C.value, 7);
});

// ─── String/Atom Operations ─────────────────────────

test('atom_chars roundtrip', () => {
  const p = new Prolog();
  const r = p.queryString('atom_chars(hello, Chars), atom_chars(X, Chars)');
  assert.equal(r[0].X.name, 'hello');
});

test('number_chars roundtrip', () => {
  const p = new Prolog();
  const r = p.queryString('number_chars(42, Chars), number_chars(X, Chars)');
  assert.equal(r[0].X.value, 42);
});

// ─── Control Flow ───────────────────────────────────

test('disjunction with backtracking', () => {
  const p = new Prolog();
  p.consult(`
    test(X) :- X = a.
    test(X) :- X = b.
    test(X) :- X = c.
  `);
  const r = p.queryString('test(X)');
  assert.equal(r.length, 3);
});

test('once prevents multiple solutions', () => {
  const p = new Prolog();
  p.consult(`
    multi(1). multi(2). multi(3).
  `);
  assert.equal(p.queryString('once(multi(X))').length, 1);
  assert.equal(p.queryString('multi(X)').length, 3);
});

// ─── Arithmetic Edge Cases ──────────────────────────

test('nested arithmetic', () => {
  const p = new Prolog();
  const r = p.queryString('X is (3 + 4) * (2 + 1)');
  assert.equal(r[0].X.value, 21);
});

test('modular arithmetic', () => {
  const p = new Prolog();
  const r = p.queryString('X is 17 mod 5');
  assert.equal(r[0].X.value, 2);
});

test('power via is', () => {
  const p = new Prolog();
  const r = p.queryString('X is 2 ** 10');
  assert.equal(r[0].X.value, 1024);
});

// ─── Unification Edge Cases ─────────────────────────

test('unify compound terms with shared variables', () => {
  const p = new Prolog();
  const r = p.queryString('f(X, X) = f(hello, hello)');
  assert.equal(r.length, 1);
  assert.equal(r[0].X.name, 'hello');
});

test('unification failure with different functors', () => {
  const p = new Prolog();
  assert.equal(p.queryString('f(a) = g(a)').length, 0);
});

test('unification failure with different arities', () => {
  const p = new Prolog();
  assert.equal(p.queryString('f(a) = f(a, b)').length, 0);
});
