import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { expect, Suite, AssertionError } from './testfw.js';

describe('expect - basic matchers', () => {
  it('toBe', () => { expect(42).toBe(42); });
  it('toBe fails', () => { assert.throws(() => expect(1).toBe(2)); });
  it('toEqual', () => { expect({ a: 1 }).toEqual({ a: 1 }); });
  it('toEqual fails', () => { assert.throws(() => expect({ a: 1 }).toEqual({ a: 2 })); });
  it('toBeTruthy', () => { expect(1).toBeTruthy(); expect('hi').toBeTruthy(); });
  it('toBeFalsy', () => { expect(0).toBeFalsy(); expect('').toBeFalsy(); });
  it('toBeNull', () => { expect(null).toBeNull(); });
  it('toBeUndefined', () => { expect(undefined).toBeUndefined(); });
  it('toBeGreaterThan', () => { expect(5).toBeGreaterThan(3); });
  it('toBeLessThan', () => { expect(3).toBeLessThan(5); });
  it('toContain string', () => { expect('hello world').toContain('world'); });
  it('toContain array', () => { expect([1, 2, 3]).toContain(2); });
  it('toHaveLength', () => { expect([1, 2, 3]).toHaveLength(3); });
  it('toThrow', () => { expect(() => { throw new Error('boom'); }).toThrow(); });
  it('toThrow with pattern', () => { expect(() => { throw new Error('big boom'); }).toThrow('boom'); });
  it('toBeInstanceOf', () => { expect(new Error()).toBeInstanceOf(Error); });
});

describe('expect - not', () => {
  it('not.toBe', () => { expect(1).not.toBe(2); });
  it('not.toBe fails', () => { assert.throws(() => expect(1).not.toBe(1)); });
  it('not.toEqual', () => { expect({ a: 1 }).not.toEqual({ a: 2 }); });
  it('not.toContain', () => { expect('hello').not.toContain('xyz'); });
  it('not.toThrow', () => { expect(() => {}).not.toThrow(); });
});

describe('Suite', () => {
  it('runs tests', async () => {
    const suite = new Suite();
    suite.describe('math', ({ it }) => { it('adds', () => expect(1 + 1).toBe(2)); });
    await suite.run();
    assert.equal(suite.passed, 1);
  });
  it('catches failures', async () => {
    const suite = new Suite();
    suite.describe('fail', ({ it }) => { it('fails', () => expect(1).toBe(2)); });
    await suite.run();
    assert.equal(suite.failed, 1);
  });
  it('skip', async () => {
    const suite = new Suite();
    suite.describe('skip', ({ xit }) => { xit('skipped', () => {}); });
    await suite.run();
    assert.equal(suite.skipped, 1);
  });
  it('beforeEach', async () => {
    const suite = new Suite();
    let val = 0;
    suite.describe('hooks', ({ it, beforeEach }) => { beforeEach(() => { val = 42; }); it('test', () => expect(val).toBe(42)); });
    await suite.run();
    assert.equal(suite.passed, 1);
  });
  it('TAP output', async () => {
    const suite = new Suite();
    suite.describe('tap', ({ it }) => { it('pass', () => {}); });
    await suite.run();
    const tap = suite.toTAP();
    assert.ok(tap.includes('1..1'));
    assert.ok(tap.includes('ok 1'));
  });
  it('total/passed/failed', async () => {
    const suite = new Suite();
    suite.describe('mixed', ({ it }) => { it('pass', () => {}); it('fail', () => { throw new Error('x'); }); });
    await suite.run();
    assert.equal(suite.total, 2);
    assert.equal(suite.passed, 1);
    assert.equal(suite.failed, 1);
  });
});
