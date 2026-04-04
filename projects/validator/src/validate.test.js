import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { v, ValidationError } from './validate.js';

describe('String', () => {
  it('valid', () => { assert.ok(v.string().validate('hello').valid); });
  it('invalid', () => { assert.ok(!v.string().validate(42).valid); });
  it('min', () => { assert.ok(!v.string().min(5).validate('abc').valid); });
  it('max', () => { assert.ok(!v.string().max(3).validate('abcde').valid); });
  it('pattern', () => { assert.ok(v.string().pattern(/^\d+$/).validate('123').valid); });
  it('email', () => { assert.ok(v.string().email().validate('a@b.com').valid); assert.ok(!v.string().email().validate('bad').valid); });
  it('url', () => { assert.ok(v.string().url().validate('https://example.com').valid); });
  it('trim transform', () => { assert.equal(v.string().trim().parse('  hi  '), 'hi'); });
});

describe('Number', () => {
  it('valid', () => { assert.ok(v.number().validate(42).valid); });
  it('invalid', () => { assert.ok(!v.number().validate('42').valid); });
  it('NaN', () => { assert.ok(!v.number().validate(NaN).valid); });
  it('min', () => { assert.ok(!v.number().min(10).validate(5).valid); });
  it('max', () => { assert.ok(!v.number().max(10).validate(15).valid); });
  it('int', () => { assert.ok(!v.number().int().validate(3.14).valid); assert.ok(v.number().int().validate(3).valid); });
  it('positive', () => { assert.ok(v.number().positive().validate(0).valid); assert.ok(!v.number().positive().validate(-1).valid); });
});

describe('Boolean', () => {
  it('valid', () => { assert.ok(v.boolean().validate(true).valid); });
  it('invalid', () => { assert.ok(!v.boolean().validate(1).valid); });
});

describe('Array', () => {
  it('valid', () => { assert.ok(v.array().validate([1,2,3]).valid); });
  it('invalid', () => { assert.ok(!v.array().validate('nope').valid); });
  it('typed items', () => { assert.ok(v.array(v.number()).validate([1,2,3]).valid); assert.ok(!v.array(v.number()).validate([1,'two']).valid); });
  it('min', () => { assert.ok(!v.array().min(3).validate([1]).valid); });
  it('max', () => { assert.ok(!v.array().max(2).validate([1,2,3]).valid); });
});

describe('Object', () => {
  const userSchema = v.object({ name: v.string(), age: v.number() });
  it('valid', () => { assert.ok(userSchema.validate({ name: 'Alice', age: 30 }).valid); });
  it('missing field', () => { assert.ok(!userSchema.validate({ name: 'Alice' }).valid); });
  it('wrong type', () => { assert.ok(!userSchema.validate({ name: 42, age: 30 }).valid); });
  it('not an object', () => { assert.ok(!userSchema.validate('string').valid); });
});

describe('Nested', () => {
  it('nested object', () => {
    const schema = v.object({ user: v.object({ name: v.string() }) });
    assert.ok(schema.validate({ user: { name: 'Alice' } }).valid);
    assert.ok(!schema.validate({ user: { name: 42 } }).valid);
  });
  it('error paths', () => {
    const schema = v.object({ user: v.object({ name: v.string() }) });
    const r = schema.validate({ user: { name: 42 } });
    assert.ok(r.errors[0].path.includes('user.name'));
  });
});

describe('Optional/Nullable', () => {
  it('optional allows undefined', () => { assert.ok(v.string().optional().validate(undefined).valid); });
  it('required rejects undefined', () => { assert.ok(!v.string().validate(undefined).valid); });
  it('nullable allows null', () => { assert.ok(v.string().nullable().validate(null).valid); });
  it('non-nullable rejects null', () => { assert.ok(!v.string().validate(null).valid); });
  it('default value', () => { assert.equal(v.string().default('hello').parse(undefined), 'hello'); });
});

describe('Custom', () => {
  it('custom validator', () => {
    const even = v.custom(v => v % 2 === 0 ? true : 'Must be even');
    assert.ok(even.validate(4).valid);
    assert.ok(!even.validate(3).valid);
  });
});

describe('Parse/SafeParse', () => {
  it('parse returns value', () => { assert.equal(v.string().parse('hello'), 'hello'); });
  it('parse throws on invalid', () => { assert.throws(() => v.string().parse(42), ValidationError); });
  it('safeParse returns result', () => { const r = v.string().safeParse(42); assert.ok(!r.valid); });
});

describe('Transform', () => {
  it('transforms value', () => { assert.equal(v.number().transform(n => n * 2).parse(5), 10); });
});
