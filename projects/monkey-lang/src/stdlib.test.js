import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import { monkeyEval } from './evaluator.js';
import { Environment } from './object.js';

function evaluate(code) {
  const l = new Lexer(code);
  const p = new Parser(l);
  const program = p.parseProgram();
  if (p.errors.length > 0) throw new Error('Parse: ' + p.errors.join(', '));
  return monkeyEval(program, new Environment());
}

describe('Standard Library: Array Functions', () => {
  it('map doubles values', () => {
    const r = evaluate('map([1,2,3], fn(x) { x * 2 });');
    assert.deepEqual(r.elements.map(e => e.value), [2, 4, 6]);
  });

  it('map with string conversion', () => {
    const r = evaluate('map([1,2,3], fn(x) { str(x); });');
    assert.deepEqual(r.elements.map(e => e.value), ['1', '2', '3']);
  });

  it('filter keeps matches', () => {
    const r = evaluate('filter([1,2,3,4,5], fn(x) { x > 2 });');
    assert.deepEqual(r.elements.map(e => e.value), [3, 4, 5]);
  });

  it('filter with no matches returns empty', () => {
    const r = evaluate('filter([1,2,3], fn(x) { x > 10 });');
    assert.equal(r.elements.length, 0);
  });

  it('reduce sum', () => {
    const r = evaluate('reduce([1,2,3,4,5], fn(a, b) { a + b }, 0);');
    assert.equal(r.value, 15);
  });

  it('reduce product', () => {
    const r = evaluate('reduce([1,2,3,4], fn(a, b) { a * b }, 1);');
    assert.equal(r.value, 24);
  });

  it('reduce without initial value', () => {
    const r = evaluate('reduce([1,2,3], fn(a, b) { a + b });');
    assert.equal(r.value, 6);
  });

  it('find returns first match', () => {
    const r = evaluate('find([1,2,3,4,5], fn(x) { x > 3 });');
    assert.equal(r.value, 4);
  });

  it('find returns null for no match', () => {
    const r = evaluate('find([1,2,3], fn(x) { x > 10 });');
    assert.equal(r.inspect(), 'null');
  });

  it('any with match', () => {
    const r = evaluate('any([1,2,3], fn(x) { x > 2 });');
    assert.equal(r.inspect(), 'true');
  });

  it('any without match', () => {
    const r = evaluate('any([1,2,3], fn(x) { x > 10 });');
    assert.equal(r.inspect(), 'false');
  });

  it('all with all matching', () => {
    const r = evaluate('all([1,2,3], fn(x) { x > 0 });');
    assert.equal(r.inspect(), 'true');
  });

  it('all with some not matching', () => {
    const r = evaluate('all([1,2,3], fn(x) { x > 1 });');
    assert.equal(r.inspect(), 'false');
  });

  it('sort numbers', () => {
    const r = evaluate('sort([3,1,4,1,5,9]);');
    assert.deepEqual(r.elements.map(e => e.value), [1, 1, 3, 4, 5, 9]);
  });

  it('sort with custom comparator', () => {
    const r = evaluate('sort([3,1,4], fn(a, b) { b - a });');
    assert.deepEqual(r.elements.map(e => e.value), [4, 3, 1]);
  });

  it('reverse array', () => {
    const r = evaluate('reverse([1,2,3]);');
    assert.deepEqual(r.elements.map(e => e.value), [3, 2, 1]);
  });

  it('reverse string', () => {
    const r = evaluate('reverse("hello");');
    assert.equal(r.value, 'olleh');
  });

  it('range with single arg', () => {
    const r = evaluate('range(5);');
    assert.deepEqual(r.elements.map(e => e.value), [0, 1, 2, 3, 4]);
  });

  it('range with start and stop', () => {
    const r = evaluate('range(2, 5);');
    assert.deepEqual(r.elements.map(e => e.value), [2, 3, 4]);
  });

  it('range with step', () => {
    const r = evaluate('range(0, 10, 2);');
    assert.deepEqual(r.elements.map(e => e.value), [0, 2, 4, 6, 8]);
  });

  it('map + filter + reduce (pipeline)', () => {
    const r = evaluate(`
      let nums = range(1, 11);
      let evens = filter(nums, fn(x) { x % 2 == 0 });
      let doubled = map(evens, fn(x) { x * 2 });
      reduce(doubled, fn(a, b) { a + b }, 0);
    `);
    // evens: [2,4,6,8,10], doubled: [4,8,12,16,20], sum: 60
    assert.equal(r.value, 60);
  });

  it('sort does not mutate original', () => {
    const r = evaluate(`
      let arr = [3, 1, 2];
      let sorted = sort(arr);
      arr[0];
    `);
    assert.equal(r.value, 3); // original unchanged
  });
});
