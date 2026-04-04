import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { v, ValidationError } from '../src/index.js';

describe('String validation', () => {
  it('validates string', () => assert.equal(v.string().validate('hello').valid, true));
  it('rejects non-string', () => assert.equal(v.string().validate(42).valid, false));
  it('min length', () => assert.equal(v.string().min(3).validate('ab').valid, false));
  it('max length', () => assert.equal(v.string().max(3).validate('abcd').valid, false));
  it('email', () => { assert.equal(v.string().email().validate('a@b.c').valid, true); assert.equal(v.string().email().validate('bad').valid, false); });
  it('url', () => assert.equal(v.string().url().validate('https://x.com').valid, true));
  it('pattern', () => assert.equal(v.string().pattern(/^\d+$/).validate('123').valid, true));
});

describe('Number validation', () => {
  it('validates number', () => assert.equal(v.number().validate(42).valid, true));
  it('rejects NaN', () => assert.equal(v.number().validate(NaN).valid, false));
  it('min', () => assert.equal(v.number().min(10).validate(5).valid, false));
  it('max', () => assert.equal(v.number().max(10).validate(15).valid, false));
  it('integer', () => { assert.equal(v.number().integer().validate(5).valid, true); assert.equal(v.number().integer().validate(5.5).valid, false); });
  it('positive', () => assert.equal(v.number().positive().validate(-1).valid, false));
});

describe('Boolean validation', () => {
  it('validates boolean', () => assert.equal(v.boolean().validate(true).valid, true));
  it('rejects non-boolean', () => assert.equal(v.boolean().validate(1).valid, false));
});

describe('Array validation', () => {
  it('validates array', () => assert.equal(v.array().validate([1, 2]).valid, true));
  it('rejects non-array', () => assert.equal(v.array().validate('nope').valid, false));
  it('min length', () => assert.equal(v.array().min(3).validate([1]).valid, false));
  it('validates items', () => {
    const schema = v.array(v.number());
    assert.equal(schema.validate([1, 2, 3]).valid, true);
    assert.equal(schema.validate([1, 'two', 3]).valid, false);
  });
});

describe('Object validation', () => {
  it('validates shape', () => {
    const schema = v.object({ name: v.string(), age: v.number() });
    assert.equal(schema.validate({ name: 'Alice', age: 30 }).valid, true);
    assert.equal(schema.validate({ name: 'Alice', age: 'thirty' }).valid, false);
  });

  it('nested objects', () => {
    const schema = v.object({ user: v.object({ name: v.string() }) });
    assert.equal(schema.validate({ user: { name: 'Bob' } }).valid, true);
  });
});

describe('Optional', () => {
  it('allows undefined when optional', () => assert.equal(v.string().optional().validate(undefined).valid, true));
  it('rejects undefined when required', () => assert.equal(v.string().validate(undefined).valid, false));
});

describe('parse', () => {
  it('returns value on success', () => assert.equal(v.string().parse('hello'), 'hello'));
  it('throws on failure', () => assert.throws(() => v.number().parse('nope'), ValidationError));
});
