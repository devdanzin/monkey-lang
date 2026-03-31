const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  Var, Abs, App, freeVars, substitute, normalOrder,
  show, parse, TRUE, FALSE, AND, OR, NOT,
  churchNumeral, fromChurch, SUCC, PLUS, MULT,
} = require('../src/index.js');

test('identity function', () => {
  const id = Abs('x', Var('x'));
  const result = normalOrder(App(id, Var('a')));
  assert.equal(show(result), 'a');
});

test('constant function', () => {
  const K = Abs('x', Abs('y', Var('x')));
  const result = normalOrder(App(App(K, Var('a')), Var('b')));
  assert.equal(show(result), 'a');
});

test('free variables', () => {
  const term = Abs('x', App(Var('x'), Var('y')));
  const fv = freeVars(term);
  assert.ok(fv.has('y'));
  assert.ok(!fv.has('x'));
});

test('substitution with capture avoidance', () => {
  const term = Abs('y', Var('x'));
  const result = substitute(term, 'x', Var('y'));
  // Should alpha-convert to avoid capture
  assert.equal(result.type, 'abs');
  assert.notEqual(result.param, 'y');
});

test('Church booleans — AND', () => {
  const tt = normalOrder(App(App(AND, TRUE), TRUE));
  const tf = normalOrder(App(App(AND, TRUE), FALSE));
  // TRUE returns first arg, FALSE returns second
  assert.equal(show(normalOrder(App(App(tt, Var('t')), Var('f')))), 't');
  assert.equal(show(normalOrder(App(App(tf, Var('t')), Var('f')))), 'f');
});

test('Church booleans — OR', () => {
  const ff = normalOrder(App(App(OR, FALSE), FALSE));
  const ft = normalOrder(App(App(OR, FALSE), TRUE));
  assert.equal(show(normalOrder(App(App(ff, Var('t')), Var('f')))), 'f');
  assert.equal(show(normalOrder(App(App(ft, Var('t')), Var('f')))), 't');
});

test('Church numerals', () => {
  assert.equal(fromChurch(churchNumeral(0)), 0);
  assert.equal(fromChurch(churchNumeral(3)), 3);
  assert.equal(fromChurch(churchNumeral(5)), 5);
});

test('Church SUCC', () => {
  const three = churchNumeral(3);
  const four = normalOrder(App(SUCC, three));
  assert.equal(fromChurch(four), 4);
});

test('Church PLUS', () => {
  const two = churchNumeral(2);
  const three = churchNumeral(3);
  const five = normalOrder(App(App(PLUS, two), three));
  assert.equal(fromChurch(five), 5);
});

test('parse and show', () => {
  const term = parse('\\x.x');
  assert.equal(term.type, 'abs');
  assert.equal(term.param, 'x');
  
  const app = parse('(\\x.x) y');
  const result = normalOrder(app);
  assert.equal(show(result), 'y');
});

test('parse complex', () => {
  const term = parse('(\\f.\\x.f (f x))');
  assert.equal(term.type, 'abs');
  assert.equal(fromChurch(term), 2); // Church numeral 2
});
