const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Prolog, atom, variable, compound, num, list, NIL, unify } = require('../src/index.js');

// ─── Basic Facts and Queries ────────────────────────

test('simple fact query', () => {
  const p = new Prolog();
  p.addFact(compound('parent', atom('tom'), atom('bob')));
  p.addFact(compound('parent', atom('tom'), atom('liz')));
  const results = p.query(compound('parent', atom('tom'), variable('X')));
  assert.equal(results.length, 2);
  assert.equal(results[0].X.name, 'bob');
  assert.equal(results[1].X.name, 'liz');
});

test('no match returns empty', () => {
  const p = new Prolog();
  p.addFact(compound('cat', atom('tom')));
  const results = p.query(compound('dog', variable('X')));
  assert.equal(results.length, 0);
});

test('rules with body goals', () => {
  const p = new Prolog();
  p.addFact(compound('parent', atom('tom'), atom('bob')));
  p.addFact(compound('parent', atom('bob'), atom('ann')));
  p.addRule(
    compound('grandparent', variable('X'), variable('Z')),
    compound('parent', variable('X'), variable('Y')),
    compound('parent', variable('Y'), variable('Z'))
  );
  const results = p.query(compound('grandparent', atom('tom'), variable('W')));
  assert.equal(results.length, 1);
  assert.equal(results[0].W.name, 'ann');
});

test('recursive rule — ancestor', () => {
  const p = new Prolog();
  p.addFact(compound('parent', atom('a'), atom('b')));
  p.addFact(compound('parent', atom('b'), atom('c')));
  p.addFact(compound('parent', atom('c'), atom('d')));
  p.addRule(compound('ancestor', variable('X'), variable('Y')),
    compound('parent', variable('X'), variable('Y')));
  p.addRule(compound('ancestor', variable('X'), variable('Y')),
    compound('parent', variable('X'), variable('Z')),
    compound('ancestor', variable('Z'), variable('Y')));
  const results = p.query(compound('ancestor', atom('a'), variable('W')));
  assert.equal(results.length, 3);
});

// ─── Arithmetic ─────────────────────────────────────

test('is/2 arithmetic evaluation', () => {
  const p = new Prolog();
  p.addFact(compound('age', atom('alice'), num(30)));
  p.addRule(
    compound('older', variable('X'), variable('A')),
    compound('age', variable('X'), variable('Y')),
    compound('is', variable('A'), compound('+', variable('Y'), num(1)))
  );
  const results = p.query(compound('older', atom('alice'), variable('A')));
  assert.equal(results.length, 1);
  assert.equal(results[0].A.value, 31);
});

test('arithmetic: multiplication and subtraction', () => {
  const p = new Prolog();
  const r = p.query(compound('is', variable('X'), compound('*', num(6), num(7))));
  assert.equal(r[0].X.value, 42);
  const r2 = p.query(compound('is', variable('X'), compound('-', num(100), num(58))));
  assert.equal(r2[0].X.value, 42);
});

test('arithmetic: integer division and mod', () => {
  const p = new Prolog();
  const r = p.query(compound('is', variable('X'), compound('/', num(10), num(3))));
  assert.equal(r[0].X.value, 3);
  const r2 = p.query(compound('is', variable('X'), compound('mod', num(10), num(3))));
  assert.equal(r2[0].X.value, 1);
});

// ─── Comparison ─────────────────────────────────────

test('arithmetic comparison: <, >, >=, =<', () => {
  const p = new Prolog();
  assert.equal(p.query(compound('<', num(1), num(2))).length, 1);
  assert.equal(p.query(compound('<', num(2), num(1))).length, 0);
  assert.equal(p.query(compound('>', num(5), num(3))).length, 1);
  assert.equal(p.query(compound('>=', num(3), num(3))).length, 1);
  assert.equal(p.query(compound('=<', num(3), num(5))).length, 1);
});

test('arithmetic equality: =:= and =\\=', () => {
  const p = new Prolog();
  assert.equal(p.query(compound('=:=', num(3), compound('+', num(1), num(2)))).length, 1);
  assert.equal(p.query(compound('=\\=', num(3), num(4))).length, 1);
  assert.equal(p.query(compound('=\\=', num(3), num(3))).length, 0);
});

// ─── Unification ────────────────────────────────────

test('unification: =/2', () => {
  const p = new Prolog();
  const results = p.query(compound('=', variable('X'), atom('hello')));
  assert.equal(results.length, 1);
  assert.equal(results[0].X.name, 'hello');
});

test('unification failure: \\=/2', () => {
  const p = new Prolog();
  assert.equal(p.query(compound('\\=', atom('a'), atom('b'))).length, 1);
  assert.equal(p.query(compound('\\=', atom('a'), atom('a'))).length, 0);
});

test('structural equality: ==/2 and \\==/2', () => {
  const p = new Prolog();
  assert.equal(p.query(compound('==', atom('a'), atom('a'))).length, 1);
  assert.equal(p.query(compound('==', atom('a'), atom('b'))).length, 0);
  assert.equal(p.query(compound('\\==', atom('a'), atom('b'))).length, 1);
});

// ─── Negation ───────────────────────────────────────

test('not/1 negation as failure', () => {
  const p = new Prolog();
  p.addFact(compound('cat', atom('tom')));
  assert.equal(p.query(compound('not', compound('cat', atom('tom')))).length, 0);
  assert.equal(p.query(compound('not', compound('cat', atom('jerry')))).length, 1);
});

// ─── Multiple Goals ─────────────────────────────────

test('queryAll with multiple goals', () => {
  const p = new Prolog();
  p.addFact(compound('likes', atom('alice'), atom('coffee')));
  p.addFact(compound('likes', atom('bob'), atom('tea')));
  p.addFact(compound('likes', atom('alice'), atom('tea')));
  const results = p.queryAll(
    compound('likes', variable('X'), atom('coffee')),
    compound('likes', variable('X'), atom('tea'))
  );
  assert.equal(results.length, 1);
  assert.equal(results[0].X.name, 'alice');
});

// ─── Write/Output ───────────────────────────────────

test('write/1 and nl/0', () => {
  const p = new Prolog();
  p.addFact(compound('greet', atom('world')));
  p.addRule(compound('hello', variable('X')),
    compound('greet', variable('X')),
    compound('write', variable('X')));
  p.query(compound('hello', variable('X')));
  assert.ok(p.output.includes('world'));
});

// ─── Parser Integration ─────────────────────────────

test('consult: load facts from text', () => {
  const p = new Prolog();
  p.consult(`
    parent(tom, bob).
    parent(tom, liz).
    parent(bob, ann).
  `);
  const r = p.queryString('parent(tom, X)');
  assert.equal(r.length, 2);
  assert.equal(r[0].X.name, 'bob');
});

test('consult: rules from text', () => {
  const p = new Prolog();
  p.consult(`
    parent(tom, bob).
    parent(bob, ann).
    grandparent(X, Z) :- parent(X, Y), parent(Y, Z).
  `);
  const r = p.queryString('grandparent(tom, W)');
  assert.equal(r.length, 1);
  assert.equal(r[0].W.name, 'ann');
});

test('queryString with arithmetic', () => {
  const p = new Prolog();
  const r = p.queryString('X is 3 + 4 * 2');
  assert.equal(r.length, 1);
  assert.equal(r[0].X.value, 11);
});

test('consult with queries returns results', () => {
  const p = new Prolog();
  const results = p.consult(`
    color(red).
    color(blue).
    color(green).
    ?- color(X).
  `);
  assert.equal(results.length, 1);
  assert.equal(results[0].length, 3);
});

// ─── Lists ──────────────────────────────────────────

test('list: member/2', () => {
  const p = new Prolog();
  const l = list(atom('a'), atom('b'), atom('c'));
  const r = p.query(compound('member', variable('X'), l));
  assert.equal(r.length, 3);
  assert.equal(r[0].X.name, 'a');
  assert.equal(r[2].X.name, 'c');
});

test('list: append/3 with known first list', () => {
  const p = new Prolog();
  const l1 = list(num(1), num(2));
  const l2 = list(num(3), num(4));
  const r = p.query(compound('append', l1, l2, variable('X')));
  assert.equal(r.length, 1);
  const arr = listToArr(r[0].X);
  assert.deepEqual(arr, [1, 2, 3, 4]);
});

test('list: length/2', () => {
  const p = new Prolog();
  const l = list(atom('a'), atom('b'), atom('c'));
  const r = p.query(compound('length', l, variable('N')));
  assert.equal(r[0].N.value, 3);
});

test('list: reverse/2', () => {
  const p = new Prolog();
  const l = list(num(1), num(2), num(3));
  const r = p.query(compound('reverse', l, variable('R')));
  assert.deepEqual(listToArr(r[0].R), [3, 2, 1]);
});

test('list: last/2', () => {
  const p = new Prolog();
  const l = list(atom('a'), atom('b'), atom('c'));
  const r = p.query(compound('last', l, variable('X')));
  assert.equal(r[0].X.name, 'c');
});

test('list: sort/2 removes duplicates', () => {
  const p = new Prolog();
  const l = list(num(3), num(1), num(2), num(1));
  const r = p.query(compound('sort', l, variable('S')));
  assert.deepEqual(listToArr(r[0].S), [1, 2, 3]);
});

test('list: msort/2 keeps duplicates', () => {
  const p = new Prolog();
  const l = list(num(3), num(1), num(2), num(1));
  const r = p.query(compound('msort', l, variable('S')));
  assert.deepEqual(listToArr(r[0].S), [1, 1, 2, 3]);
});

test('list: nth1/3', () => {
  const p = new Prolog();
  const l = list(atom('a'), atom('b'), atom('c'));
  const r = p.query(compound('nth1', num(2), l, variable('X')));
  assert.equal(r[0].X.name, 'b');
});

test('list: nth0/3', () => {
  const p = new Prolog();
  const l = list(atom('a'), atom('b'), atom('c'));
  const r = p.query(compound('nth0', num(0), l, variable('X')));
  assert.equal(r[0].X.name, 'a');
});

// ─── Type Checks ────────────────────────────────────

test('type checks: atom, number, var, nonvar, compound', () => {
  const p = new Prolog();
  assert.equal(p.query(compound('atom', atom('hello'))).length, 1);
  assert.equal(p.query(compound('atom', num(5))).length, 0);
  assert.equal(p.query(compound('number', num(42))).length, 1);
  assert.equal(p.query(compound('number', atom('x'))).length, 0);
  assert.equal(p.query(compound('nonvar', atom('a'))).length, 1);
  assert.equal(p.query(compound('compound', compound('f', atom('a')))).length, 1);
  assert.equal(p.query(compound('compound', atom('a'))).length, 0);
  assert.equal(p.query(compound('integer', num(5))).length, 1);
  assert.equal(p.query(compound('atomic', atom('a'))).length, 1);
  assert.equal(p.query(compound('atomic', num(5))).length, 1);
});

test('is_list/1', () => {
  const p = new Prolog();
  assert.equal(p.query(compound('is_list', list(num(1), num(2)))).length, 1);
  assert.equal(p.query(compound('is_list', NIL)).length, 1);
  assert.equal(p.query(compound('is_list', atom('notalist'))).length, 0);
});

// ─── Findall ────────────────────────────────────────

test('findall/3', () => {
  const p = new Prolog();
  p.addFact(compound('color', atom('red')));
  p.addFact(compound('color', atom('blue')));
  p.addFact(compound('color', atom('green')));
  const r = p.query(compound('findall', variable('X'), compound('color', variable('X')), variable('L')));
  assert.equal(r.length, 1);
  const arr = listToArr(r[0].L);
  assert.deepEqual(arr.map(a => a.name), ['red', 'blue', 'green']);
});

test('findall/3 empty result', () => {
  const p = new Prolog();
  const r = p.query(compound('findall', variable('X'), compound('foo', variable('X')), variable('L')));
  assert.equal(r.length, 1);
  assert.equal(r[0].L.name, '[]');
});

// ─── Assert/Retract ─────────────────────────────────

test('assertz/1 adds facts dynamically', () => {
  const p = new Prolog();
  p.query(compound('assertz', compound('color', atom('red'))));
  p.query(compound('assertz', compound('color', atom('blue'))));
  const r = p.query(compound('color', variable('X')));
  assert.equal(r.length, 2);
});

test('asserta/1 adds to front', () => {
  const p = new Prolog();
  p.addFact(compound('item', atom('b')));
  p.query(compound('asserta', compound('item', atom('a'))));
  const r = p.query(compound('item', variable('X')));
  assert.equal(r[0].X.name, 'a');
  assert.equal(r[1].X.name, 'b');
});

test('retract/1 removes facts', () => {
  const p = new Prolog();
  p.addFact(compound('color', atom('red')));
  p.addFact(compound('color', atom('blue')));
  p.query(compound('retract', compound('color', atom('red'))));
  const r = p.query(compound('color', variable('X')));
  assert.equal(r.length, 1);
  assert.equal(r[0].X.name, 'blue');
});

// ─── Functor/Arg/Univ ──────────────────────────────

test('functor/3 decompose', () => {
  const p = new Prolog();
  const r = p.query(compound('functor', compound('f', atom('a'), atom('b')), variable('F'), variable('N')));
  assert.equal(r[0].F.name, 'f');
  assert.equal(r[0].N.value, 2);
});

test('arg/3', () => {
  const p = new Prolog();
  const r = p.query(compound('arg', num(2), compound('f', atom('a'), atom('b'), atom('c')), variable('X')));
  assert.equal(r[0].X.name, 'b');
});

test('=../2 univ', () => {
  const p = new Prolog();
  const r = p.query(compound('=..', compound('f', num(1), num(2)), variable('L')));
  const arr = listToArrRaw(r[0].L);
  assert.equal(arr[0].name, 'f');
  assert.equal(arr[1].value, 1);
  assert.equal(arr[2].value, 2);
});

// ─── Copy Term ──────────────────────────────────────

test('copy_term/2', () => {
  const p = new Prolog();
  const r = p.query(compound('copy_term', compound('f', variable('X'), variable('X')), variable('C')));
  assert.equal(r.length, 1);
  // The copy should have fresh variables
  assert.equal(r[0].C.type, 'compound');
  assert.equal(r[0].C.functor, 'f');
});

// ─── Between ────────────────────────────────────────

test('between/3 generates range', () => {
  const p = new Prolog();
  const r = p.query(compound('between', num(1), num(5), variable('X')));
  assert.equal(r.length, 5);
  assert.equal(r[0].X.value, 1);
  assert.equal(r[4].X.value, 5);
});

// ─── Succ/Plus ──────────────────────────────────────

test('succ/2', () => {
  const p = new Prolog();
  const r1 = p.query(compound('succ', num(3), variable('X')));
  assert.equal(r1[0].X.value, 4);
  const r2 = p.query(compound('succ', variable('X'), num(5)));
  assert.equal(r2[0].X.value, 4);
});

test('plus/3', () => {
  const p = new Prolog();
  const r = p.query(compound('plus', num(3), num(4), variable('X')));
  assert.equal(r[0].X.value, 7);
  const r2 = p.query(compound('plus', num(3), variable('Y'), num(10)));
  assert.equal(r2[0].Y.value, 7);
});

// ─── Atom/Number Chars ──────────────────────────────

test('atom_chars/2', () => {
  const p = new Prolog();
  const r = p.query(compound('atom_chars', atom('hello'), variable('L')));
  const arr = listToArr(r[0].L);
  assert.deepEqual(arr.map(a => a.name), ['h', 'e', 'l', 'l', 'o']);
});

test('atom_length/2', () => {
  const p = new Prolog();
  const r = p.query(compound('atom_length', atom('hello'), variable('N')));
  assert.equal(r[0].N.value, 5);
});

test('atom_concat/3', () => {
  const p = new Prolog();
  const r = p.query(compound('atom_concat', atom('hello'), atom(' world'), variable('R')));
  assert.equal(r[0].R.name, 'hello world');
});

// ─── If-Then-Else ───────────────────────────────────

test('if-then-else via ;/-> ', () => {
  const p = new Prolog();
  p.addFact(compound('is_zero', num(0)));
  // (is_zero(X) -> Y = zero ; Y = nonzero)
  const cond = compound('->', compound('is_zero', num(0)), compound('=', variable('Y'), atom('zero')));
  const r1 = p.query(compound(';', cond, compound('=', variable('Y'), atom('nonzero'))));
  assert.equal(r1[0].Y.name, 'zero');

  const cond2 = compound('->', compound('is_zero', num(1)), compound('=', variable('Y'), atom('zero')));
  const r2 = p.query(compound(';', cond2, compound('=', variable('Y'), atom('nonzero'))));
  assert.equal(r2[0].Y.name, 'nonzero');
});

// ─── Disjunction ────────────────────────────────────

test('disjunction via ;/2', () => {
  const p = new Prolog();
  p.addFact(compound('a', num(1)));
  p.addFact(compound('b', num(2)));
  const r = p.query(compound(';', compound('a', variable('X')), compound('b', variable('X'))));
  assert.equal(r.length, 2);
  assert.equal(r[0].X.value, 1);
  assert.equal(r[1].X.value, 2);
});

// ─── Call/Once ──────────────────────────────────────

test('call/1', () => {
  const p = new Prolog();
  p.addFact(compound('foo', atom('bar')));
  const r = p.query(compound('call', compound('foo', variable('X'))));
  assert.equal(r[0].X.name, 'bar');
});

test('once/1 returns only first solution', () => {
  const p = new Prolog();
  p.addFact(compound('num', num(1)));
  p.addFact(compound('num', num(2)));
  p.addFact(compound('num', num(3)));
  const r = p.query(compound('once', compound('num', variable('X'))));
  assert.equal(r.length, 1);
  assert.equal(r[0].X.value, 1);
});

// ─── Ground ─────────────────────────────────────────

test('ground/1', () => {
  const p = new Prolog();
  assert.equal(p.query(compound('ground', compound('f', atom('a'), num(1)))).length, 1);
  assert.equal(p.query(compound('ground', compound('f', variable('X')))).length, 0);
});

// ─── Parser: Lists ──────────────────────────────────

test('parser: list syntax in queryString', () => {
  const p = new Prolog();
  const r = p.queryString('X = [1, 2, 3]');
  assert.equal(r.length, 1);
  assert.deepEqual(listToArr(r[0].X), [1, 2, 3]);
});

test('parser: head|tail syntax', () => {
  const p = new Prolog();
  p.consult(`
    first([H|_], H).
  `);
  const r = p.queryString('first([a, b, c], X)');
  assert.equal(r[0].X.name, 'a');
});

// ─── Classic Prolog: Fibonacci ──────────────────────

test('fibonacci via Prolog rules', () => {
  const p = new Prolog();
  p.consult(`
    fib(0, 0).
    fib(1, 1).
    fib(N, F) :- N > 1, N1 is N - 1, N2 is N - 2, fib(N1, F1), fib(N2, F2), F is F1 + F2.
  `);
  const r = p.queryString('fib(10, F)');
  assert.equal(r[0].F.value, 55);
});

// ─── Classic Prolog: Factorial ──────────────────────

test('factorial via Prolog rules', () => {
  const p = new Prolog();
  p.consult(`
    fact(0, 1).
    fact(N, F) :- N > 0, N1 is N - 1, fact(N1, F1), F is N * F1.
  `);
  const r = p.queryString('fact(6, F)');
  assert.equal(r[0].F.value, 720);
});

// ─── Forall ─────────────────────────────────────────

test('forall/2', () => {
  const p = new Prolog();
  p.consult(`
    even(0). even(2). even(4).
  `);
  const r = p.query(compound('forall',
    compound('even', variable('X')),
    compound('>=', variable('X'), num(0))
  ));
  assert.equal(r.length, 1);
});

// ─── Maplist ────────────────────────────────────────

test('maplist/2 checks predicate on all elements', () => {
  const p = new Prolog();
  p.consult(`positive(X) :- X > 0.`);
  const l = list(num(1), num(2), num(3));
  const r = p.query(compound('maplist', atom('positive'), l));
  assert.equal(r.length, 1);
});

// ─── Unification occurs check ───────────────────────

test('occurs check prevents circular unification', () => {
  const p = new Prolog();
  const r = p.query(compound('=', variable('X'), compound('f', variable('X'))));
  assert.equal(r.length, 0);
});

// Helper to convert list term to JS array of values (nums become numbers)
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

// Helper that keeps raw term objects
function listToArrRaw(term) {
  const arr = [];
  let cur = term;
  while (cur.type === 'compound' && cur.functor === '.' && cur.args.length === 2) {
    arr.push(cur.args[0]);
    cur = cur.args[1];
  }
  return arr;
}
