import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { v4, v1, v5, parse, validate, version, compare, isNil, NIL, DNS_NAMESPACE } from './uuid.js';

describe('v4', () => {
  it('generates valid UUID', () => { assert.ok(validate(v4())); });
  it('version is 4', () => { assert.equal(version(v4()), 4); });
  it('unique', () => { assert.notEqual(v4(), v4()); });
  it('correct format', () => { assert.ok(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v4())); });
});

describe('v1', () => {
  it('generates valid UUID', () => { assert.ok(validate(v1())); });
  it('version is 1', () => { assert.equal(version(v1()), 1); });
  it('unique', () => { assert.notEqual(v1(), v1()); });
});

describe('v5', () => {
  it('generates valid UUID', () => { assert.ok(validate(v5('example.com'))); });
  it('version is 5', () => { assert.equal(version(v5('test')), 5); });
  it('deterministic', () => { assert.equal(v5('example.com'), v5('example.com')); });
  it('different names different UUIDs', () => { assert.notEqual(v5('a'), v5('b')); });
  it('custom namespace', () => { assert.notEqual(v5('test', DNS_NAMESPACE), v5('test', NIL)); });
});

describe('parse', () => {
  it('parses to bytes', () => {
    const bytes = parse('12345678-1234-1234-1234-123456789abc');
    assert.equal(bytes[0], 0x12);
    assert.equal(bytes.length, 16);
  });
});

describe('validate', () => {
  it('valid', () => { assert.ok(validate('12345678-1234-1234-1234-123456789abc')); });
  it('invalid', () => { assert.ok(!validate('not-a-uuid')); });
  it('nil is valid', () => { assert.ok(validate(NIL)); });
});

describe('version', () => {
  it('detects v4', () => { assert.equal(version(v4()), 4); });
  it('invalid returns -1', () => { assert.equal(version('bad'), -1); });
});

describe('compare', () => {
  it('equal', () => { const u = v4(); assert.equal(compare(u, u), 0); });
  it('different', () => { assert.notEqual(compare(v4(), v4()), 0); });
});

describe('NIL', () => {
  it('isNil', () => { assert.ok(isNil(NIL)); });
  it('not nil', () => { assert.ok(!isNil(v4())); });
  it('NIL is valid', () => { assert.ok(validate(NIL)); });
});
