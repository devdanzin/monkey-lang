const { test } = require('node:test');
const assert = require('node:assert/strict');
const { MarkovChain } = require('../src/index.js');

const corpus = 'the cat sat on the mat the cat ate the fish the dog sat on the rug';

test('train and generate', () => {
  const mc = new MarkovChain(2);
  mc.train(corpus);
  const text = mc.generate(20);
  assert.ok(text.length > 0);
  assert.ok(text.split(' ').length >= 2);
});

test('state count', () => {
  const mc = new MarkovChain(2);
  mc.train(corpus);
  assert.ok(mc.stateCount() > 0);
});

test('probability', () => {
  const mc = new MarkovChain(1);
  mc.train('a b a b a c');
  const p = mc.probability('a', 'b');
  assert.ok(p > 0);
  assert.ok(p <= 1);
});

test('most likely', () => {
  const mc = new MarkovChain(1);
  mc.train('a b a b a b a c');
  assert.equal(mc.mostLikely('a'), 'b');
});

test('character-level', () => {
  const mc = new MarkovChain(3);
  mc.train('hello world hello there hello again', 'char');
  const text = mc.generate(30, 'char');
  assert.ok(text.length > 0);
});

test('serialization', () => {
  const mc = new MarkovChain(2);
  mc.train(corpus);
  const json = mc.toJSON();
  const mc2 = MarkovChain.fromJSON(json);
  assert.equal(mc2.stateCount(), mc.stateCount());
  assert.equal(mc2.order, mc.order);
});

test('empty corpus', () => {
  const mc = new MarkovChain(2);
  assert.equal(mc.generate(), '');
});

test('order 1', () => {
  const mc = new MarkovChain(1);
  mc.train('one two three one two four');
  const text = mc.generate(10);
  assert.ok(text.split(' ').length >= 1);
});
