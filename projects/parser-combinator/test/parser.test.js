import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { char, string, regex, seq, alt, many, many1, optional, map, sepBy, between, integer, letters, lazy } from '../src/index.js';

describe('primitives', () => {
  it('char', () => { const r = char('a')('abc'); assert.ok(r.success); assert.equal(r.value, 'a'); assert.equal(r.rest, 'bc'); });
  it('char fail', () => assert.ok(!char('a')('xyz').success));
  it('string', () => assert.equal(string('hello')('hello world').value, 'hello'));
  it('regex', () => assert.equal(regex(/\d+/)('123abc').value, '123'));
});

describe('combinators', () => {
  it('seq', () => { const r = seq(char('a'), char('b'))('abc'); assert.deepEqual(r.value, ['a', 'b']); });
  it('alt', () => assert.equal(alt(char('x'), char('a'))('abc').value, 'a'));
  it('many', () => assert.deepEqual(many(char('a'))('aaab').value, ['a', 'a', 'a']));
  it('many empty', () => assert.deepEqual(many(char('a'))('bbb').value, []));
  it('many1', () => assert.ok(!many1(char('a'))('bbb').success));
  it('optional', () => assert.equal(optional(char('a'))('bbb').value, null));
  it('map', () => assert.equal(map(regex(/\d+/), Number)('42').value, 42));
});

describe('compound', () => {
  it('sepBy', () => { const r = sepBy(integer, char(','))('1,2,3'); assert.deepEqual(r.value, [1, 2, 3]); });
  it('between', () => assert.equal(between(char('('), integer, char(')'))('(42)').value, 42));
  it('integer', () => assert.equal(integer('99 rest').value, 99));
  it('letters', () => assert.equal(letters('hello123').value, 'hello'));
});

describe('lazy', () => {
  it('recursive parser', () => {
    const expr = lazy(() => alt(
      map(seq(char('('), expr, char(')')), ([, v]) => v),
      integer
    ));
    assert.equal(expr('((42))').value, 42);
  });
});
