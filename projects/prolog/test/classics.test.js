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

// ─── Tower of Hanoi ─────────────────────────────────

test('tower of hanoi', () => {
  const p = new Prolog();
  p.consult(`
    hanoi(1, From, To, _) :- 
      write(From), write(' -> '), writeln(To).
    hanoi(N, From, To, Via) :-
      N > 1,
      N1 is N - 1,
      hanoi(N1, From, Via, To),
      write(From), write(' -> '), writeln(To),
      hanoi(N1, Via, To, From).
  `);
  p.queryString('hanoi(3, left, right, center)');
  assert.ok(p.output.length > 0);
  // 3 discs = 7 moves, each move has 3 outputs (from, arrow, to\n)
  const moves = p.output.filter(s => s.includes('->')).length;
  assert.equal(moves, 7);
});

// ─── Quicksort ──────────────────────────────────────

test('quicksort', () => {
  const p = new Prolog();
  p.consult(`
    qsort([], []).
    qsort([H|T], Sorted) :-
      partition(H, T, Less, Greater),
      qsort(Less, SortedLess),
      qsort(Greater, SortedGreater),
      append(SortedLess, [H|SortedGreater], Sorted).
    
    partition(_, [], [], []).
    partition(Pivot, [H|T], [H|Less], Greater) :-
      H =< Pivot, partition(Pivot, T, Less, Greater).
    partition(Pivot, [H|T], Less, [H|Greater]) :-
      H > Pivot, partition(Pivot, T, Less, Greater).
  `);
  const r = p.queryString('qsort([3, 1, 4, 1, 5, 9, 2, 6], S)');
  assert.equal(r.length, 1);
  const sorted = listToArr(r[0].S);
  assert.deepEqual(sorted, [1, 1, 2, 3, 4, 5, 6, 9]);
});

// ─── Eight Queens ───────────────────────────────────

test('eight queens — 4 queens has solutions', () => {
  const p = new Prolog();
  p.consult(`
    queens(N, Qs) :- length_list(N, Qs), place_queens(N, Qs, _, _).
    
    length_list(0, []).
    length_list(N, [_|T]) :- N > 0, N1 is N - 1, length_list(N1, T).
    
    place_queens(0, _, _, _).
    place_queens(N, Qs, Ups, Downs) :-
      N > 0,
      N1 is N - 1,
      place_queens(N1, Qs, [_|Ups], [_|Downs]),
      place_queen(N, Qs, Ups, Downs).
    
    place_queen(Q, [Q|_], [Q|_], [Q|_]).
    place_queen(Q, [_|Qs], [_|Ups], [_|Downs]) :-
      place_queen(Q, Qs, Ups, Downs).
  `);
  // 4-queens should have at least 2 distinct solutions
  const r = p.queryString('queens(4, Qs)');
  assert.ok(r.length >= 2, `Expected >= 2 solutions, got ${r.length}`);
});

// ─── List Permutations ─────────────────────────────

test('permutation via select', () => {
  const p = new Prolog();
  p.consult(`
    select(X, [X|T], T).
    select(X, [H|T], [H|R]) :- select(X, T, R).
    
    perm([], []).
    perm(List, [H|Perm]) :- select(H, List, Rest), perm(Rest, Perm).
  `);
  const r = p.queryString('perm([1, 2, 3], P)');
  assert.equal(r.length, 6); // 3! = 6
});

// ─── GCD ────────────────────────────────────────────

test('GCD via Euclid', () => {
  const p = new Prolog();
  p.consult(`
    gcd(X, 0, X) :- X > 0.
    gcd(X, Y, G) :- Y > 0, R is X mod Y, gcd(Y, R, G).
  `);
  const r = p.queryString('gcd(12, 8, G)');
  assert.equal(r[0].G.value, 4);
  const r2 = p.queryString('gcd(35, 21, G)');
  assert.equal(r2[0].G.value, 7);
});

// ─── List Operations via Prolog ─────────────────────

test('list max', () => {
  const p = new Prolog();
  p.consult(`
    list_max([X], X).
    list_max([X|Xs], Max) :- list_max(Xs, MaxRest), (X > MaxRest -> Max = X ; Max = MaxRest).
  `);
  const r = p.queryString('list_max([3, 7, 2, 9, 1], M)');
  assert.equal(r[0].M.value, 9);
});

test('list sum', () => {
  const p = new Prolog();
  p.consult(`
    sum([], 0).
    sum([H|T], S) :- sum(T, S1), S is S1 + H.
  `);
  const r = p.queryString('sum([1, 2, 3, 4, 5], S)');
  assert.equal(r[0].S.value, 15);
});

test('list flatten', () => {
  const p = new Prolog();
  p.consult(`
    my_flatten([], []).
    my_flatten([H|T], Flat) :-
      is_list(H),
      my_flatten(H, FlatH),
      my_flatten(T, FlatT),
      append(FlatH, FlatT, Flat).
    my_flatten([H|T], [H|FlatT]) :-
      not(is_list(H)),
      my_flatten(T, FlatT).
  `);
  const r = p.queryString('my_flatten([1, [2, 3], [4, [5]]], F)');
  assert.equal(r.length, 1);
  const flat = listToArr(r[0].F);
  assert.deepEqual(flat, [1, 2, 3, 4, 5]);
});

// ─── Map Coloring ───────────────────────────────────

test('map coloring — 3 colors for simple graph', () => {
  const p = new Prolog();
  p.consult(`
    color(red). color(green). color(blue).
    
    adjacent(a, b). adjacent(a, c). adjacent(b, c).
    
    coloring(A, B, C) :-
      color(A), color(B), color(C),
      A \\= B, A \\= C, B \\= C.
  `);
  const r = p.queryString('coloring(A, B, C)');
  assert.equal(r.length, 6); // 3! = 6 valid 3-colorings
});

// ─── Peano Arithmetic ───────────────────────────────

test('Peano addition', () => {
  const p = new Prolog();
  p.consult(`
    add(z, Y, Y).
    add(s(X), Y, s(Z)) :- add(X, Y, Z).
  `);
  // s(s(z)) + s(s(s(z))) = s(s(s(s(s(z)))))  (2 + 3 = 5)
  const r = p.queryString('add(s(s(z)), s(s(s(z))), R)');
  assert.equal(r.length, 1);
  // Count the 's' wrappers
  let n = r[0].R;
  let count = 0;
  while (n.type === 'compound' && n.functor === 's') { count++; n = n.args[0]; }
  assert.equal(count, 5);
});

// ─── Palindrome ─────────────────────────────────────

test('palindrome check', () => {
  const p = new Prolog();
  p.consult(`
    palindrome(L) :- reverse(L, L).
  `);
  assert.equal(p.queryString('palindrome([a, b, b, a])').length, 1);
  assert.equal(p.queryString('palindrome([a, b, c])').length, 0);
  assert.equal(p.queryString('palindrome([])').length, 1);
});

// ─── Accumulator Pattern ────────────────────────────

test('length with accumulator', () => {
  const p = new Prolog();
  p.consult(`
    my_length([], 0).
    my_length([_|T], N) :- my_length(T, N1), N is N1 + 1.
  `);
  const r = p.queryString('my_length([a, b, c, d], N)');
  assert.equal(r[0].N.value, 4);
});

// ─── Power ──────────────────────────────────────────

test('power computation', () => {
  const p = new Prolog();
  p.consult(`
    pow(_, 0, 1).
    pow(B, E, R) :- E > 0, E1 is E - 1, pow(B, E1, R1), R is B * R1.
  `);
  const r = p.queryString('pow(2, 10, R)');
  assert.equal(r[0].R.value, 1024);
});

// ─── Subset Generation ─────────────────────────────

test('subsets of a set', () => {
  const p = new Prolog();
  p.consult(`
    subset([], []).
    subset([H|T], [H|S]) :- subset(T, S).
    subset([_|T], S) :- subset(T, S).
  `);
  const r = p.queryString('subset([1, 2, 3], S)');
  assert.equal(r.length, 8); // 2^3 = 8
});

// ─── Path Finding ───────────────────────────────────

test('path finding in directed graph', () => {
  const p = new Prolog();
  p.consult(`
    edge(a, b). edge(b, c). edge(c, d). edge(a, d).
    
    path(X, X, [X]).
    path(X, Y, [X|P]) :- edge(X, Z), path(Z, Y, P).
  `);
  const r = p.queryString('path(a, d, P)');
  assert.ok(r.length >= 2); // at least a->d and a->b->c->d
});

// ─── Higher-order: Reduce/Fold ──────────────────────

test('fold left for sum', () => {
  const p = new Prolog();
  p.consult(`
    foldl(_, Acc, [], Acc).
    foldl(add, Acc, [H|T], Result) :- 
      NewAcc is Acc + H, foldl(add, NewAcc, T, Result).
  `);
  const r = p.queryString('foldl(add, 0, [1, 2, 3, 4, 5], S)');
  assert.equal(r[0].S.value, 15);
});

// ─── String from Parser ─────────────────────────────

test('parser: arithmetic expression precedence', () => {
  const p = new Prolog();
  // 3 + 4 * 2 should be 11 (not 14)
  const r = p.queryString('X is 3 + 4 * 2');
  assert.equal(r[0].X.value, 11);
});

test('parser: comparison in rule body', () => {
  const p = new Prolog();
  p.consult(`
    positive(X) :- X > 0.
  `);
  assert.equal(p.queryString('positive(5)').length, 1);
  assert.equal(p.queryString('positive(-1)').length, 0);
});

test('parser: nested compound terms', () => {
  const p = new Prolog();
  p.consult(`
    f(g(h(1), 2), 3).
  `);
  const r = p.queryString('f(g(h(X), Y), Z)');
  assert.equal(r[0].X.value, 1);
  assert.equal(r[0].Y.value, 2);
  assert.equal(r[0].Z.value, 3);
});

test('parser: empty list', () => {
  const p = new Prolog();
  const r = p.queryString('X = []');
  assert.equal(r[0].X.name, '[]');
});

test('parser: multiple clauses for same predicate', () => {
  const p = new Prolog();
  p.consult(`
    vowel(a). vowel(e). vowel(i). vowel(o). vowel(u).
  `);
  const r = p.queryString('vowel(X)');
  assert.equal(r.length, 5);
});

// ─── Assert with Rules ──────────────────────────────

test('assert a rule dynamically', () => {
  const p = new Prolog();
  p.addFact(compound('num', num(5)));
  // Assert a rule via the API
  p.query(compound('assertz',
    compound(':-', compound('double', variable('X'), variable('Y')),
      compound('is', variable('Y'), compound('*', variable('X'), num(2))))
  ));
  const r = p.queryString('double(5, D)');
  assert.equal(r[0].D.value, 10);
});

// ─── Negation with Complex Goals ────────────────────

test('negation: not with compound goal', () => {
  const p = new Prolog();
  p.consult(`
    likes(alice, cats).
    likes(bob, dogs).
    dislikes(X, Y) :- not(likes(X, Y)).
  `);
  assert.equal(p.queryString('dislikes(alice, dogs)').length, 1);
  assert.equal(p.queryString('dislikes(alice, cats)').length, 0);
});

// ─── Between with findall ───────────────────────────

test('generate range with between + findall', () => {
  const p = new Prolog();
  const r = p.queryString('findall(X, between(1, 10, X), L)');
  const arr = listToArr(r[0].L);
  assert.deepEqual(arr, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

// ─── Multiple Solutions with Backtracking ───────────

test('generate pairs with backtracking', () => {
  const p = new Prolog();
  p.consult(`
    color(red). color(green). color(blue).
    pair(X, Y) :- color(X), color(Y), X \\= Y.
  `);
  const r = p.queryString('pair(X, Y)');
  assert.equal(r.length, 6); // P(3,2) = 6
});

// ─── Occurs Check Edge Case ─────────────────────────

test('occurs check: X = f(f(X)) fails', () => {
  const p = new Prolog();
  const r = p.queryString('X = f(f(X))');
  assert.equal(r.length, 0);
});
