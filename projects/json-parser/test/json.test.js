import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parse, stringify } from '../src/index.js';

describe('parse — primitives', () => {
  it('null', () => assert.equal(parse('null'), null));
  it('true', () => assert.equal(parse('true'), true));
  it('false', () => assert.equal(parse('false'), false));
  it('integer', () => assert.equal(parse('42'), 42));
  it('negative', () => assert.equal(parse('-7'), -7));
  it('float', () => assert.equal(parse('3.14'), 3.14));
  it('exponent', () => assert.equal(parse('1e10'), 1e10));
  it('negative exponent', () => assert.equal(parse('2.5e-3'), 2.5e-3));
  it('zero', () => assert.equal(parse('0'), 0));
});

describe('parse — strings', () => {
  it('simple', () => assert.equal(parse('"hello"'), 'hello'));
  it('empty', () => assert.equal(parse('""'), ''));
  it('escapes', () => assert.equal(parse('"a\\nb\\tc"'), 'a\nb\tc'));
  it('escaped quotes', () => assert.equal(parse('"say \\"hi\\""'), 'say "hi"'));
  it('unicode escape', () => assert.equal(parse('"\\u0041"'), 'A'));
  it('backslash', () => assert.equal(parse('"\\\\"'), '\\'));
  it('forward slash', () => assert.equal(parse('"a\\/b"'), 'a/b'));
});

describe('parse — arrays', () => {
  it('empty', () => assert.deepEqual(parse('[]'), []));
  it('numbers', () => assert.deepEqual(parse('[1,2,3]'), [1, 2, 3]));
  it('mixed', () => assert.deepEqual(parse('[1,"two",true,null]'), [1, 'two', true, null]));
  it('nested', () => assert.deepEqual(parse('[[1,2],[3,4]]'), [[1, 2], [3, 4]]));
  it('with whitespace', () => assert.deepEqual(parse('[ 1 , 2 , 3 ]'), [1, 2, 3]));
});

describe('parse — objects', () => {
  it('empty', () => assert.deepEqual(parse('{}'), {}));
  it('simple', () => assert.deepEqual(parse('{"a":1,"b":2}'), { a: 1, b: 2 }));
  it('nested', () => assert.deepEqual(parse('{"a":{"b":1}}'), { a: { b: 1 } }));
  it('mixed values', () => assert.deepEqual(parse('{"n":1,"s":"hi","b":true,"x":null}'), { n: 1, s: 'hi', b: true, x: null }));
  it('with whitespace', () => assert.deepEqual(parse('{ "a" : 1 }'), { a: 1 }));
});

describe('parse — errors', () => {
  it('empty input', () => assert.throws(() => parse('')));
  it('trailing comma', () => assert.throws(() => parse('[1,]')));
  it('missing colon', () => assert.throws(() => parse('{"a" 1}')));
  it('unterminated string', () => assert.throws(() => parse('"hello')));
  it('trailing junk', () => assert.throws(() => parse('42 hello')));
});

describe('parse — complex', () => {
  it('matches JSON.parse on complex input', () => {
    const input = '{"name":"Henry","age":0,"skills":["JS","math"],"meta":{"created":true,"tags":["ai","agent"]},"score":99.5}';
    assert.deepEqual(parse(input), JSON.parse(input));
  });
});

describe('stringify', () => {
  it('null', () => assert.equal(stringify(null), 'null'));
  it('boolean', () => { assert.equal(stringify(true), 'true'); assert.equal(stringify(false), 'false'); });
  it('number', () => assert.equal(stringify(42), '42'));
  it('string', () => assert.equal(stringify('hello'), '"hello"'));
  it('string with escapes', () => assert.equal(stringify('a\nb'), '"a\\nb"'));
  it('array', () => assert.equal(stringify([1, 2, 3]), '[1,2,3]'));
  it('object', () => assert.equal(stringify({ a: 1 }), '{"a":1}'));
  it('nested', () => assert.equal(stringify({ a: [1, { b: 2 }] }), '{"a":[1,{"b":2}]}'));
  it('Infinity becomes null', () => assert.equal(stringify(Infinity), 'null'));
  it('undefined values skipped in objects', () => assert.equal(stringify({ a: 1, b: undefined }), '{"a":1}'));
});

describe('roundtrip', () => {
  it('parse(stringify(x)) === x', () => {
    const obj = { name: 'test', nums: [1, 2, 3], nested: { a: true, b: null } };
    assert.deepEqual(parse(stringify(obj)), obj);
  });
});
