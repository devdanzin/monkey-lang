const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Prolog, atom, variable, compound, num, list } = require('../src/index.js');

function listToArr(term) {
  const arr = [];
  let cur = term;
  while (cur.type === 'compound' && cur.functor === '.' && cur.args.length === 2) {
    arr.push(cur.args[0].type === 'num' ? cur.args[0].value : cur.args[0]);
    cur = cur.args[1];
  }
  return arr;
}

// ─── sub_atom/5 ─────────────────────────────────────

test('sub_atom: extract substring by position', () => {
  const p = new Prolog();
  const r = p.query(compound('sub_atom', atom('hello'), num(1), num(3), variable('A'), variable('S')));
  assert.equal(r[0].S.name, 'ell');
  assert.equal(r[0].A.value, 1);
});

test('sub_atom: find substring', () => {
  const p = new Prolog();
  const r = p.query(compound('sub_atom', atom('abcabc'), variable('B'), variable('L'), variable('A'), atom('bc')));
  assert.ok(r.length >= 2); // 'bc' appears at positions 1 and 4
});

test('sub_atom: enumerate all substrings', () => {
  const p = new Prolog();
  const r = p.query(compound('sub_atom', atom('abc'), variable('B'), variable('L'), variable('A'), variable('S')));
  // For "abc" (length 3): 
  // B=0: L=0,1,2,3; B=1: L=0,1,2; B=2: L=0,1; B=3: L=0 → 4+3+2+1 = 10
  assert.equal(r.length, 10);
});

// ─── atom_number/2 ──────────────────────────────────

test('atom_number: atom to number', () => {
  const p = new Prolog();
  const r = p.query(compound('atom_number', atom('42'), variable('N')));
  assert.equal(r[0].N.value, 42);
});

test('atom_number: number to atom', () => {
  const p = new Prolog();
  const r = p.query(compound('atom_number', variable('A'), num(42)));
  assert.equal(r[0].A.name, '42');
});

test('atom_number: float', () => {
  const p = new Prolog();
  const r = p.query(compound('atom_number', atom('3.14'), variable('N')));
  assert.ok(Math.abs(r[0].N.value - 3.14) < 0.001);
});

// ─── char_type/2 ────────────────────────────────────

test('char_type: digit', () => {
  const p = new Prolog();
  assert.equal(p.query(compound('char_type', atom('5'), atom('digit'))).length, 1);
  assert.equal(p.query(compound('char_type', atom('a'), atom('digit'))).length, 0);
});

test('char_type: alpha', () => {
  const p = new Prolog();
  assert.equal(p.query(compound('char_type', atom('a'), atom('alpha'))).length, 1);
  assert.equal(p.query(compound('char_type', atom('5'), atom('alpha'))).length, 0);
});

test('char_type: upper/lower', () => {
  const p = new Prolog();
  assert.equal(p.query(compound('char_type', atom('A'), atom('upper'))).length, 1);
  assert.equal(p.query(compound('char_type', atom('a'), atom('lower'))).length, 1);
  assert.equal(p.query(compound('char_type', atom('a'), atom('upper'))).length, 0);
});

test('char_type: space', () => {
  const p = new Prolog();
  assert.equal(p.query(compound('char_type', atom(' '), atom('space'))).length, 1);
  assert.equal(p.query(compound('char_type', atom('a'), atom('space'))).length, 0);
});

test('char_type: enumerate types for a char', () => {
  const p = new Prolog();
  const r = p.query(compound('char_type', atom('a'), variable('T')));
  const types = r.map(x => x.T.name);
  assert.ok(types.includes('alpha'));
  assert.ok(types.includes('lower'));
  assert.ok(types.includes('alnum'));
});

// ─── upcase_atom/2 and downcase_atom/2 ─────────────

test('upcase_atom', () => {
  const p = new Prolog();
  const r = p.query(compound('upcase_atom', atom('hello'), variable('U')));
  assert.equal(r[0].U.name, 'HELLO');
});

test('downcase_atom', () => {
  const p = new Prolog();
  const r = p.query(compound('downcase_atom', atom('HELLO'), variable('D')));
  assert.equal(r[0].D.name, 'hello');
});

test('upcase/downcase roundtrip', () => {
  const p = new Prolog();
  const r = p.queryString('upcase_atom(hello, U), downcase_atom(U, D)');
  assert.equal(r[0].D.name, 'hello');
});

// ─── atom_string/2 ──────────────────────────────────

test('atom_string: atom to string', () => {
  const p = new Prolog();
  const r = p.query(compound('atom_string', atom('hello'), variable('S')));
  assert.equal(r[0].S.name, 'hello');
});

test('atom_string: number to string', () => {
  const p = new Prolog();
  const r = p.query(compound('atom_string', num(42), variable('S')));
  assert.equal(r[0].S.name, '42');
});

// ─── Integration: string processing ────────────────

test('integration: split atom into chars and check types', () => {
  const p = new Prolog();
  p.consult(`
    all_alpha([]).
    all_alpha([H|T]) :- char_type(H, alpha), all_alpha(T).
  `);
  const r1 = p.queryString('atom_chars(hello, Cs), all_alpha(Cs)');
  assert.equal(r1.length, 1);
  
  // '123' should fail
  const r2 = p.queryString('atom_chars(hello123, Cs), all_alpha(Cs)');
  assert.equal(r2.length, 0);
});

test('integration: uppercase first letter', () => {
  const p = new Prolog();
  p.consult(`
    capitalize(In, Out) :-
      atom_chars(In, [H|T]),
      upcase_atom(H, UH),
      atom_chars(UH, [UC]),
      atom_chars(Out, [UC|T]).
  `);
  const r = p.queryString('capitalize(hello, X)');
  assert.equal(r[0].X.name, 'Hello');
});
