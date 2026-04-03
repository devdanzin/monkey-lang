const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Prolog, atom, variable, compound, num, list, NIL } = require('../src/index.js');

// ─── DCG Basics ─────────────────────────────────────

test('DCG: simple greeting grammar', () => {
  const p = new Prolog();
  p.consult(`
    greeting --> [hello], name.
    name --> [world].
    name --> [prolog].
  `);
  assert.equal(p.queryString('phrase(greeting, [hello, world])').length, 1);
  assert.equal(p.queryString('phrase(greeting, [hello, prolog])').length, 1);
  assert.equal(p.queryString('phrase(greeting, [hello, java])').length, 0);
  assert.equal(p.queryString('phrase(greeting, [hi, world])').length, 0);
});

test('DCG: multiple terminals', () => {
  const p = new Prolog();
  p.consult(`
    ab --> [a, b].
    cd --> [c, d].
    abcd --> ab, cd.
  `);
  assert.equal(p.queryString('phrase(abcd, [a, b, c, d])').length, 1);
  assert.equal(p.queryString('phrase(abcd, [a, b, c])').length, 0);
});

test('DCG: recursive grammar', () => {
  const p = new Prolog();
  p.consult(`
    s --> [].
    s --> [a], s, [b].
  `);
  // a^n b^n language
  assert.equal(p.queryString('phrase(s, [])').length, 1);
  assert.equal(p.queryString('phrase(s, [a, b])').length, 1);
  assert.equal(p.queryString('phrase(s, [a, a, b, b])').length, 1);
  assert.equal(p.queryString('phrase(s, [a, a, a, b, b, b])').length, 1);
  assert.equal(p.queryString('phrase(s, [a, b, b])').length, 0);
  assert.equal(p.queryString('phrase(s, [a])').length, 0);
});

test('DCG: phrase/3 with rest', () => {
  const p = new Prolog();
  p.consult(`
    greeting --> [hello], [world].
  `);
  const r = p.queryString('phrase(greeting, [hello, world, extra, stuff], Rest)');
  assert.equal(r.length, 1);
  // Rest should be [extra, stuff]
  const rest = r[0].Rest;
  assert.equal(rest.type, 'compound');
  assert.equal(rest.args[0].name, 'extra');
});

test('DCG: arithmetic expression parser', () => {
  const p = new Prolog();
  p.consult(`
    digit --> [0]. digit --> [1]. digit --> [2]. digit --> [3].
    digit --> [4]. digit --> [5]. digit --> [6]. digit --> [7].
    digit --> [8]. digit --> [9].
    
    number --> digit.
    number --> digit, number.
  `);
  assert.equal(p.queryString('phrase(number, [1, 2, 3])').length, 1);
  assert.equal(p.queryString('phrase(number, [4])').length, 1);
  assert.equal(p.queryString('phrase(number, [a])').length, 0);
});

test('DCG: alternation', () => {
  const p = new Prolog();
  p.consult(`
    color --> [red].
    color --> [green].
    color --> [blue].
    
    item --> [the], color, [ball].
  `);
  assert.equal(p.queryString('phrase(item, [the, red, ball])').length, 1);
  assert.equal(p.queryString('phrase(item, [the, green, ball])').length, 1);
  assert.equal(p.queryString('phrase(item, [the, yellow, ball])').length, 0);
});

test('DCG: enumerate valid parses', () => {
  const p = new Prolog();
  p.consult(`
    color --> [red].
    color --> [green].
    color --> [blue].
  `);
  const r = p.queryString('findall(C, phrase(color, [C]), Colors)');
  assert.equal(r.length, 1);
  // Should find red, green, blue
});

// ─── phrase/2 with compound rule name ───────────────

test('DCG: rule with extra arguments', () => {
  const p = new Prolog();
  p.consult(`
    greeting(formal) --> [good], [morning].
    greeting(casual) --> [hey].
  `);
  const r1 = p.queryString('phrase(greeting(formal), [good, morning])');
  assert.equal(r1.length, 1);
  const r2 = p.queryString('phrase(greeting(casual), [hey])');
  assert.equal(r2.length, 1);
  const r3 = p.queryString('phrase(greeting(Type), [hey])');
  assert.equal(r3[0].Type.name, 'casual');
});
