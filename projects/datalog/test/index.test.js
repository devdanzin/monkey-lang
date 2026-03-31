const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Datalog, atom, not } = require('../src/index.js');

test('basic facts and query', () => {
  const db = new Datalog();
  db.addFact('parent', 'tom', 'bob');
  db.addFact('parent', 'tom', 'liz');
  
  const results = db.query('parent', 'tom', '?X');
  assert.equal(results.length, 2);
  assert.ok(results.some(r => r['?X'] === 'bob'));
  assert.ok(results.some(r => r['?X'] === 'liz'));
});

test('query with constants', () => {
  const db = new Datalog();
  db.addFact('color', 'sky', 'blue');
  db.addFact('color', 'grass', 'green');
  
  const results = db.query('color', '?X', 'blue');
  assert.equal(results.length, 1);
  assert.equal(results[0]['?X'], 'sky');
});

test('rules — transitive closure', () => {
  const db = new Datalog();
  db.addFact('parent', 'a', 'b');
  db.addFact('parent', 'b', 'c');
  db.addFact('parent', 'c', 'd');
  
  // ancestor(X, Y) :- parent(X, Y)
  db.addRule(
    { pred: 'ancestor', args: ['?X', '?Y'] },
    atom('parent', '?X', '?Y')
  );
  // ancestor(X, Y) :- parent(X, Z), ancestor(Z, Y)
  db.addRule(
    { pred: 'ancestor', args: ['?X', '?Y'] },
    atom('parent', '?X', '?Z'),
    atom('ancestor', '?Z', '?Y')
  );
  
  const results = db.query('ancestor', 'a', '?W');
  assert.equal(results.length, 3); // b, c, d
});

test('join — two predicates', () => {
  const db = new Datalog();
  db.addFact('likes', 'alice', 'coffee');
  db.addFact('likes', 'bob', 'tea');
  db.addFact('likes', 'alice', 'tea');
  db.addFact('healthy', 'tea');
  
  // healthy_drinker(X) :- likes(X, Y), healthy(Y)
  db.addRule(
    { pred: 'healthy_drinker', args: ['?X'] },
    atom('likes', '?X', '?Y'),
    atom('healthy', '?Y')
  );
  
  const results = db.query('healthy_drinker', '?X');
  assert.ok(results.some(r => r['?X'] === 'alice'));
  assert.ok(results.some(r => r['?X'] === 'bob'));
});

test('negation', () => {
  const db = new Datalog();
  db.addFact('person', 'alice');
  db.addFact('person', 'bob');
  db.addFact('vip', 'alice');
  
  // non_vip(X) :- person(X), not vip(X)
  db.addRule(
    { pred: 'non_vip', args: ['?X'] },
    atom('person', '?X'),
    not('vip', '?X')
  );
  
  const results = db.query('non_vip', '?X');
  assert.equal(results.length, 1);
  assert.equal(results[0]['?X'], 'bob');
});

test('no results', () => {
  const db = new Datalog();
  db.addFact('cat', 'tom');
  const results = db.query('dog', '?X');
  assert.equal(results.length, 0);
});

test('ground query', () => {
  const db = new Datalog();
  db.addFact('edge', 1, 2);
  const yes = db.query('edge', 1, 2);
  const no = db.query('edge', 1, 3);
  assert.equal(yes.length, 1);
  assert.equal(no.length, 0);
});
