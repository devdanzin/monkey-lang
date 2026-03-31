const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Prolog, atom, variable, compound, num } = require('../src/index.js');

test('simple fact query', () => {
  const p = new Prolog();
  p.addFact(compound('parent', atom('tom'), atom('bob')));
  p.addFact(compound('parent', atom('tom'), atom('liz')));
  
  const results = p.query(compound('parent', atom('tom'), variable('X')));
  assert.equal(results.length, 2);
  assert.equal(results[0].X.name, 'bob');
  assert.equal(results[1].X.name, 'liz');
});

test('no match', () => {
  const p = new Prolog();
  p.addFact(compound('cat', atom('tom')));
  const results = p.query(compound('dog', variable('X')));
  assert.equal(results.length, 0);
});

test('rules', () => {
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

test('arithmetic — is/2', () => {
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

test('unification — =/2', () => {
  const p = new Prolog();
  const results = p.query(compound('=', variable('X'), atom('hello')));
  assert.equal(results.length, 1);
  assert.equal(results[0].X.name, 'hello');
});

test('negation — not/1', () => {
  const p = new Prolog();
  p.addFact(compound('cat', atom('tom')));
  
  const r1 = p.query(compound('not', compound('cat', atom('tom'))));
  assert.equal(r1.length, 0); // tom IS a cat, so not fails
  
  const r2 = p.query(compound('not', compound('cat', atom('jerry'))));
  assert.equal(r2.length, 1); // jerry is NOT a cat
});

test('multiple goals', () => {
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
  assert.equal(results.length, 3); // b, c, d
});

test('write output', () => {
  const p = new Prolog();
  p.addFact(compound('greet', atom('world')));
  p.addRule(compound('hello', variable('X')),
    compound('greet', variable('X')),
    compound('write', variable('X')));
  
  p.query(compound('hello', variable('X')));
  assert.ok(p.output.includes('world'));
});
