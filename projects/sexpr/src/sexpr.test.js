import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parse, stringify, toArray, SSymbol, SCons, NIL, symbol, cons } from './sexpr.js';

describe('Atoms', () => {
  it('number', () => { assert.equal(parse('42'), 42); });
  it('negative number', () => { assert.equal(parse('-3.14'), -3.14); });
  it('symbol', () => { assert.ok(parse('hello') instanceof SSymbol); assert.equal(parse('hello').name, 'hello'); });
  it('string', () => { const r = parse('"hello world"'); assert.ok(typeof r === 'object' && r.type === 'string' || typeof r === 'string'); });
  it('boolean', () => { assert.equal(parse('#t'), true); assert.equal(parse('#f'), false); });
  it('nil', () => { assert.equal(parse('nil'), NIL); });
});

describe('Lists', () => {
  it('empty list', () => { assert.equal(parse('()'), NIL); });
  it('single item', () => { const r = parse('(1)'); assert.ok(r instanceof SCons); assert.equal(r.car, 1); });
  it('multiple items', () => {
    const r = parse('(1 2 3)');
    const arr = toArray(r);
    assert.deepStrictEqual(arr, [1, 2, 3]);
  });
  it('nested', () => {
    const r = parse('(1 (2 3) 4)');
    const arr = toArray(r);
    assert.equal(arr[0], 1);
    assert.ok(arr[1] instanceof SCons);
    assert.equal(arr[2], 4);
  });
  it('deeply nested', () => {
    const r = parse('((1) ((2)) 3)');
    const arr = toArray(r);
    assert.equal(toArray(arr[0])[0], 1);
  });
});

describe('Dotted pairs', () => {
  it('simple pair', () => { const r = parse('(1 . 2)'); assert.equal(r.car, 1); assert.equal(r.cdr, 2); });
});

describe('Quoting', () => {
  it('quote shorthand', () => {
    const r = parse("'hello");
    const arr = toArray(r);
    assert.equal(arr[0].name, 'quote');
  });
});

describe('Comments', () => {
  it('ignores comments', () => {
    const r = parse('; this is a comment\n42');
    assert.equal(r, 42);
  });
});

describe('Stringify', () => {
  it('number', () => { assert.equal(stringify(42), '42'); });
  it('symbol', () => { assert.equal(stringify(symbol('hello')), 'hello'); });
  it('nil', () => { assert.equal(stringify(NIL), 'nil'); });
  it('boolean', () => { assert.equal(stringify(true), '#t'); assert.equal(stringify(false), '#f'); });
  it('list', () => { assert.equal(stringify(parse('(1 2 3)')), '(1 2 3)'); });
  it('dotted pair', () => { assert.equal(stringify(cons(1, 2)), '(1 . 2)'); });
  it('nested', () => { assert.equal(stringify(parse('(1 (2 3))')), '(1 (2 3))'); });
});

describe('Roundtrip', () => {
  it('numbers', () => { assert.equal(stringify(parse('(+ 1 2)')), '(+ 1 2)'); });
  it('nested', () => { assert.equal(stringify(parse('(define (square x) (* x x))')), '(define (square x) (* x x))'); });
});
