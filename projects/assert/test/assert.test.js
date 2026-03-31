import { describe, it } from 'node:test';
import nodeAssert from 'node:assert/strict';
import { expect } from '../src/index.js';

describe('equality', () => {
  it('equal', () => expect(42).to.equal(42));
  it('not equal', () => expect(1).not.equal(2));
  it('deepEqual', () => expect([1, 2]).deepEqual([1, 2]));
});

describe('truthiness', () => {
  it('ok', () => expect(1).ok());
  it('falsy', () => expect(0).falsy());
  it('null', () => expect(null).null());
  it('undefined', () => expect(undefined).undefined());
});

describe('types', () => {
  it('type', () => expect('hello').type('string'));
  it('instanceOf', () => expect([]).instanceOf(Array));
});

describe('comparison', () => {
  it('gt', () => expect(5).gt(3));
  it('gte', () => expect(5).gte(5));
  it('lt', () => expect(3).lt(5));
  it('lte', () => expect(5).lte(5));
  it('between', () => expect(5).between(1, 10));
  it('closeTo', () => expect(3.14).closeTo(Math.PI, 0.01));
});

describe('collections', () => {
  it('include string', () => expect('hello world').include('world'));
  it('include array', () => expect([1, 2, 3]).include(2));
  it('length', () => expect([1, 2, 3]).length(3));
  it('empty', () => expect([]).empty());
  it('not empty', () => expect([1]).not.empty());
});

describe('objects', () => {
  it('property', () => expect({ a: 1 }).property('a'));
  it('property value', () => expect({ a: 1 }).property('a', 1));
});

describe('errors', () => {
  it('throws', () => expect(() => { throw new Error('boom'); }).throws());
  it('throws type', () => expect(() => { throw new TypeError('bad'); }).throws(TypeError));
  it('not throws', () => expect(() => {}).not.throws());
});

describe('match', () => {
  it('regex', () => expect('hello123').match(/\d+/));
});

describe('assertion errors', () => {
  it('fails correctly', () => {
    nodeAssert.throws(() => expect(1).equal(2), /AssertionError/);
  });
});
