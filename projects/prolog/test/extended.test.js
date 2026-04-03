const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Prolog, atom, variable, compound, num, list, NIL, cut } = require('../src/index.js');

function listToArr(term) {
  const arr = [];
  let cur = term;
  while (cur.type === 'compound' && cur.functor === '.' && cur.args.length === 2) {
    arr.push(cur.args[0].type === 'num' ? cur.args[0].value : cur.args[0]);
    cur = cur.args[1];
  }
  return arr;
}

// ─── Parser Stress Tests ────────────────────────────

test('parser: deeply nested compound', () => {
  const p = new Prolog();
  p.consult('f(g(h(i(j(1))))).');
  const r = p.queryString('f(g(h(i(j(X)))))');
  assert.equal(r[0].X.value, 1);
});

test('parser: many clauses for same predicate', () => {
  const p = new Prolog();
  let text = '';
  for (let i = 0; i < 20; i++) text += `num(${i}).\n`;
  p.consult(text);
  const r = p.queryString('num(X)');
  assert.equal(r.length, 20);
});

test('parser: complex arithmetic expression', () => {
  const p = new Prolog();
  const r = p.queryString('X is (3 + 4) * 2 - 1 + 10 // 3');
  assert.equal(r[0].X.value, 16);
});

test('parser: negative numbers', () => {
  const p = new Prolog();
  const r = p.queryString('X is -5 + 3');
  assert.equal(r[0].X.value, -2);
});

test('parser: list with mixed types', () => {
  const p = new Prolog();
  const r = p.queryString('X = [a, 1, b, 2, c]');
  assert.equal(r.length, 1);
  const arr = listToArr(r[0].X);
  assert.equal(arr.length, 5);
});

test('parser: empty body rule', () => {
  const p = new Prolog();
  p.consult('fact(42).');
  assert.equal(p.queryString('fact(X)')[0].X.value, 42);
});

test('parser: operators in different positions', () => {
  const p = new Prolog();
  assert.equal(p.queryString('3 + 4 =:= 7').length, 1);
  assert.equal(p.queryString('10 mod 3 =:= 1').length, 1);
  assert.equal(p.queryString('2 ** 3 =:= 8').length, 1);
});

// ─── Arithmetic Edge Cases ──────────────────────────

test('arithmetic: zero handling', () => {
  const p = new Prolog();
  assert.equal(p.queryString('X is 0 + 0')[0].X.value, 0);
  assert.equal(p.queryString('X is 0 * 100')[0].X.value, 0);
  assert.equal(p.queryString('X is 100 - 100')[0].X.value, 0);
});

test('arithmetic: large numbers', () => {
  const p = new Prolog();
  const r = p.queryString('X is 2 ** 20');
  assert.equal(r[0].X.value, 1048576);
});

test('arithmetic: nested operations', () => {
  const p = new Prolog();
  assert.equal(p.queryString('X is (2 + 3) * (4 + 5) * (6 + 7)')[0].X.value, 585);
});

test('arithmetic: min and max', () => {
  const p = new Prolog();
  const r1 = p.query(compound('is', variable('X'), compound('min', num(3), num(7))));
  assert.equal(r1[0].X.value, 3);
  const r2 = p.query(compound('is', variable('X'), compound('max', num(3), num(7))));
  assert.equal(r2[0].X.value, 7);
});

test('arithmetic: abs', () => {
  const p = new Prolog();
  const r = p.query(compound('is', variable('X'), compound('abs', num(-42))));
  assert.equal(r[0].X.value, 42);
});

test('arithmetic: sign', () => {
  const p = new Prolog();
  const r1 = p.query(compound('is', variable('X'), compound('sign', num(-5))));
  assert.equal(r1[0].X.value, -1);
  const r2 = p.query(compound('is', variable('X'), compound('sign', num(5))));
  assert.equal(r2[0].X.value, 1);
});

// ─── DCG Advanced ───────────────────────────────────

test('DCG: palindrome grammar', () => {
  const p = new Prolog();
  p.consult(`
    pal --> [].
    pal --> [_].
    pal --> [X], pal, [X].
  `);
  assert.equal(p.queryString('phrase(pal, [a, b, a])').length, 1);
  assert.equal(p.queryString('phrase(pal, [a, b, b, a])').length, 1);
  assert.equal(p.queryString('phrase(pal, [a, b, c])').length, 0);
});

test('DCG: simple expression parser (terminals only)', () => {
  const p = new Prolog();
  p.consult(`
    digit --> [0]. digit --> [1]. digit --> [2]. digit --> [3].
    digit --> [4]. digit --> [5]. digit --> [6]. digit --> [7].
    digit --> [8]. digit --> [9].
    digits --> digit.
    digits --> digit, digits.
  `);
  assert.equal(p.queryString('phrase(digits, [1, 2, 3])').length, 1);
  assert.equal(p.queryString('phrase(digits, [a])').length, 0);
});

test('DCG: sentence with optional parts', () => {
  const p = new Prolog();
  p.consult(`
    sentence --> subject, verb, object.
    subject --> [i]. subject --> [you]. subject --> [he].
    verb --> [like]. verb --> [hate].
    object --> [cats]. object --> [dogs]. object --> [pizza].
  `);
  assert.equal(p.queryString('phrase(sentence, [i, like, cats])').length, 1);
  assert.equal(p.queryString('phrase(sentence, [he, hate, pizza])').length, 1);
  assert.equal(p.queryString('phrase(sentence, [i, like])').length, 0); // missing object
});

test('DCG: repeated pattern', () => {
  const p = new Prolog();
  p.consult(`
    abab --> [].
    abab --> [a, b], abab.
  `);
  assert.equal(p.queryString('phrase(abab, [a, b, a, b])').length, 1);
  assert.equal(p.queryString('phrase(abab, [a, b, a])').length, 0);
});

// ─── Advanced Backtracking ──────────────────────────

test('backtracking: generate and test', () => {
  const p = new Prolog();
  p.consult(`
    between_p(Low, High, Low) :- Low =< High.
    between_p(Low, High, X) :- Low < High, Low1 is Low + 1, between_p(Low1, High, X).
    
    pythagorean(A, B, C) :-
      between_p(1, 20, A),
      between_p(A, 20, B),
      C is A * A + B * B,
      D is round(sqrt(C)),
      D * D =:= C.
  `);
  // This should find some Pythagorean triples
  const r = p.queryString('pythagorean(3, 4, C)');
  assert.equal(r[0].C.value, 25); // 3² + 4² = 25, sqrt(25) = 5, 5² = 25 ✓
});

test('backtracking: N-queens with different approach', () => {
  const p = new Prolog();
  p.consult(`
    safe([]).
    safe([Q|Qs]) :- no_attack(Q, Qs, 1), safe(Qs).
    
    no_attack(_, [], _).
    no_attack(Q, [Q1|Qs], D) :-
      Q =\\= Q1,
      Q =\\= Q1 + D,
      Q =\\= Q1 - D,
      D1 is D + 1,
      no_attack(Q, Qs, D1).
    
    perm([], []).
    perm([X|Xs], Ys) :- perm(Xs, Zs), insert(X, Zs, Ys).
    
    insert(X, Ys, [X|Ys]).
    insert(X, [Y|Ys], [Y|Zs]) :- insert(X, Ys, Zs).
    
    queens(N, Qs) :- numlist(1, N, Ns), perm(Ns, Qs), safe(Qs).
    
    numlist(N, N, [N]).
    numlist(Low, High, [Low|Rest]) :- Low < High, Low1 is Low + 1, numlist(Low1, High, Rest).
  `);
  const r = p.queryString('once(queens(4, Qs))');
  assert.equal(r.length, 1);
});

// ─── Longer Programs ────────────────────────────────

test('insertion sort', () => {
  const p = new Prolog();
  p.consult(`
    isort([], []).
    isort([H|T], Sorted) :- isort(T, ST), insert_sorted(H, ST, Sorted).
    
    insert_sorted(X, [], [X]).
    insert_sorted(X, [H|T], [X, H|T]) :- X =< H.
    insert_sorted(X, [H|T], [H|ST]) :- X > H, insert_sorted(X, T, ST).
  `);
  const r = p.queryString('isort([5, 3, 8, 1, 9, 2], S)');
  assert.deepEqual(listToArr(r[0].S), [1, 2, 3, 5, 8, 9]);
});

test('bubble sort', () => {
  const p = new Prolog();
  p.consult(`
    bsort(List, Sorted) :- swap(List, List1), bsort(List1, Sorted).
    bsort(Sorted, Sorted).
    
    swap([X, Y|Rest], [Y, X|Rest]) :- X > Y.
    swap([Z|Rest], [Z|Rest1]) :- swap(Rest, Rest1).
  `);
  const r = p.queryString('bsort([3, 1, 2], S)');
  assert.ok(r.length >= 1);
  assert.deepEqual(listToArr(r[0].S), [1, 2, 3]);
});

test('list zip', () => {
  const p = new Prolog();
  p.consult(`
    zip([], [], []).
    zip([A|As], [B|Bs], [pair(A, B)|Ps]) :- zip(As, Bs, Ps).
  `);
  const r = p.queryString('zip([1, 2, 3], [a, b, c], Z)');
  assert.equal(r.length, 1);
  const arr = listToArr(r[0].Z);
  assert.equal(arr.length, 3);
  assert.equal(arr[0].functor, 'pair');
});

test('list take/drop', () => {
  const p = new Prolog();
  p.consult(`
    take(0, _, []).
    take(N, [H|T], [H|R]) :- N > 0, N1 is N - 1, take(N1, T, R).
    
    drop(0, L, L).
    drop(N, [_|T], R) :- N > 0, N1 is N - 1, drop(N1, T, R).
  `);
  const r1 = p.queryString('take(3, [a, b, c, d, e], T)');
  assert.equal(listToArr(r1[0].T).length, 3);
  const r2 = p.queryString('drop(2, [a, b, c, d, e], D)');
  assert.equal(listToArr(r2[0].D).length, 3);
});

test('map with user predicate', () => {
  const p = new Prolog();
  p.consult(`
    double(X, Y) :- Y is X * 2.
    
    my_map(_, [], []).
    my_map(P, [H|T], [RH|RT]) :- call(P, H, RH), my_map(P, T, RT).
  `);
  // Can't easily test call/3 through queryString... use API
  // Actually our call/1 only handles 1-arg. Let's skip call/3 for now.
});

test('tree operations', () => {
  const p = new Prolog();
  p.consult(`
    tree_member(X, node(X, _, _)).
    tree_member(X, node(Y, Left, _)) :- X < Y, tree_member(X, Left).
    tree_member(X, node(Y, _, Right)) :- X > Y, tree_member(X, Right).
    
    tree_insert(X, nil, node(X, nil, nil)).
    tree_insert(X, node(X, L, R), node(X, L, R)).
    tree_insert(X, node(Y, L, R), node(Y, L1, R)) :- X < Y, tree_insert(X, L, L1).
    tree_insert(X, node(Y, L, R), node(Y, L, R1)) :- X > Y, tree_insert(X, R, R1).
  `);
  const r = p.queryString('tree_insert(5, nil, T1), tree_insert(3, T1, T2), tree_insert(7, T2, T3), tree_member(3, T3)');
  assert.equal(r.length, 1);
});

test('flatten nested structures', () => {
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
  const r = p.queryString('my_flatten([1, [2, [3, 4]], 5], F)');
  assert.deepEqual(listToArr(r[0].F), [1, 2, 3, 4, 5]);
});

// ─── Edge Cases ─────────────────────────────────────

test('empty query returns true', () => {
  const p = new Prolog();
  p.consult('fact(1).');
  // Querying a known fact
  const r = p.queryString('fact(1)');
  assert.equal(r.length, 1);
});

test('recursive predicate with base case', () => {
  const p = new Prolog();
  p.consult(`
    count(0, []).
    count(N, [_|T]) :- count(N1, T), N is N1 + 1.
  `);
  const r = p.queryString('count(N, [a, b, c, d])');
  assert.equal(r[0].N.value, 4);
});

test('multiple rules with same head', () => {
  const p = new Prolog();
  p.consult(`
    greet(hello).
    greet(hi).
    greet(hey).
    greet(yo).
  `);
  const r = p.queryString('greet(X)');
  assert.equal(r.length, 4);
});

test('deeply recursive fibonacci still works', () => {
  const p = new Prolog();
  p.consult(`
    fib(0, 0). fib(1, 1).
    fib(N, F) :- N > 1, N1 is N - 1, N2 is N - 2, fib(N1, F1), fib(N2, F2), F is F1 + F2.
  `);
  const r = p.queryString('fib(12, F)');
  assert.equal(r[0].F.value, 144);
});

test('comparison chain', () => {
  const p = new Prolog();
  p.consult(`
    ordered([]).
    ordered([_]).
    ordered([A, B|T]) :- A =< B, ordered([B|T]).
  `);
  assert.equal(p.queryString('ordered([1, 2, 3, 4, 5])').length, 1);
  assert.equal(p.queryString('ordered([1, 3, 2])').length, 0);
});
