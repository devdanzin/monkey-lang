import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parse, stringify } from '../src/index.js';

describe('parse atoms', () => {
  it('integer', () => assert.equal(parse('42'), 42));
  it('negative integer', () => assert.equal(parse('-7'), -7));
  it('float', () => assert.equal(parse('3.14'), 3.14));
  it('symbol', () => assert.equal(parse('hello'), Symbol.for('hello')));
  it('boolean true', () => assert.equal(parse('#t'), true));
  it('boolean false', () => assert.equal(parse('#f'), false));
  it('nil', () => assert.equal(parse('nil'), null));
  it('string', () => assert.equal(parse('"hello world"'), 'hello world'));
  it('escaped string', () => assert.equal(parse('"say \\"hi\\""'), 'say "hi"'));
});

describe('parse lists', () => {
  it('empty list', () => assert.deepEqual(parse('()'), []));
  it('simple list', () => {
    const r = parse('(+ 1 2)');
    assert.equal(r.length, 3);
    assert.equal(r[0], Symbol.for('+'));
    assert.equal(r[1], 1);
    assert.equal(r[2], 2);
  });
  it('nested', () => {
    const r = parse('(define (square x) (* x x))');
    assert.equal(r.length, 3);
    assert.ok(Array.isArray(r[1]));
  });
  it('quote shorthand', () => {
    const r = parse("'foo");
    assert.deepEqual(r, [Symbol.for('quote'), Symbol.for('foo')]);
  });
});

describe('stringify', () => {
  it('number', () => assert.equal(stringify(42), '42'));
  it('symbol', () => assert.equal(stringify(Symbol.for('x')), 'x'));
  it('list', () => assert.equal(stringify([Symbol.for('+'), 1, 2]), '(+ 1 2)'));
  it('nil', () => assert.equal(stringify(null), 'nil'));
  it('string', () => assert.equal(stringify('hello'), '"hello"'));
  it('roundtrip', () => {
    const expr = '(define (fact n) (if (= n 0) 1 (* n (fact (- n 1)))))';
    assert.equal(stringify(parse(expr)), expr);
  });
});

describe('errors', () => {
  it('unclosed paren', () => assert.throws(() => parse('(a b'), /Unclosed/));
  it('unclosed string', () => assert.throws(() => parse('"hello'), /Unclosed/));
});
