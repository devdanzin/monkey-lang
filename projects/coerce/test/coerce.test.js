import { describe, it } from 'node:test'; import assert from 'node:assert/strict';
import { toNumber, toString, toBoolean, toArray, toDate, toInteger, typeOf } from '../src/index.js';
describe('toNumber', () => { it('string', () => assert.equal(toNumber('42'), 42)); it('bool', () => assert.equal(toNumber(true), 1)); it('null', () => assert.equal(toNumber(null), 0)); it('invalid', () => assert.equal(toNumber('abc'), null)); });
describe('toString', () => { it('number', () => assert.equal(toString(42), '42')); it('null', () => assert.equal(toString(null), 'null')); it('object', () => assert.equal(toString({a:1}), '{"a":1}')); });
describe('toBoolean', () => { it('truthy string', () => assert.ok(toBoolean('yes'))); it('false string', () => assert.ok(!toBoolean('false'))); it('0', () => assert.ok(!toBoolean(0))); it('empty', () => assert.ok(!toBoolean(''))); });
describe('toArray', () => { it('string', () => assert.deepEqual(toArray('hi'), ['h', 'i'])); it('null', () => assert.deepEqual(toArray(null), [])); it('value', () => assert.deepEqual(toArray(42), [42])); });
describe('toDate', () => { it('string', () => assert.ok(toDate('2026-01-01') instanceof Date)); it('invalid', () => assert.equal(toDate('nope'), null)); });
describe('toInteger', () => { it('float', () => assert.equal(toInteger(3.7), 3)); });
describe('typeOf', () => { it('null', () => assert.equal(typeOf(null), 'null')); it('array', () => assert.equal(typeOf([]), 'array')); it('date', () => assert.equal(typeOf(new Date()), 'date')); });
