import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { v4, v7, NIL, parse, validate, version, compare } from '../src/index.js';

describe('v4', () => {
  it('generates valid UUID', () => { assert.equal(validate(v4()), true); });
  it('has version 4', () => { assert.equal(version(v4()), 4); });
  it('generates unique UUIDs', () => { const a = v4(), b = v4(); assert.notEqual(a, b); });
  it('correct format', () => { assert.match(v4(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/); });
});

describe('v7', () => {
  it('generates valid UUID', () => { assert.equal(validate(v7()), true); });
  it('has version 7', () => { assert.equal(version(v7()), 7); });
  it('is time-ordered', () => {
    const a = v7(), b = v7();
    assert.ok(compare(a, b) <= 0); // a should be <= b
  });
  it('correct format', () => { assert.match(v7(), /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/); });
});

describe('NIL', () => {
  it('is all zeros', () => { assert.equal(NIL, '00000000-0000-0000-0000-000000000000'); });
  it('validates', () => { assert.equal(validate(NIL), true); });
});

describe('parse', () => {
  it('converts to bytes', () => {
    const bytes = parse('550e8400-e29b-41d4-a716-446655440000');
    assert.equal(bytes.length, 16);
    assert.equal(bytes[0], 0x55);
  });
  it('rejects invalid', () => { assert.throws(() => parse('invalid')); });
});

describe('validate', () => {
  it('accepts valid', () => { assert.equal(validate('550e8400-e29b-41d4-a716-446655440000'), true); });
  it('rejects invalid', () => { assert.equal(validate('not-a-uuid'), false); });
});

describe('version', () => {
  it('extracts version', () => {
    assert.equal(version('550e8400-e29b-41d4-a716-446655440000'), 4);
    assert.equal(version('017f22e2-79b0-7cc3-98c4-dc0c0c07398f'), 7);
  });
});

describe('compare', () => {
  it('orders correctly', () => {
    assert.equal(compare('a', 'b'), -1);
    assert.equal(compare('b', 'a'), 1);
    assert.equal(compare('a', 'a'), 0);
  });
});
