import { describe, it } from 'node:test'; import assert from 'node:assert/strict';
import { compact, ordinal, percentage, padLeft, commaSeparate, toRoman, fromRoman } from '../src/index.js';
describe('numfmt', () => {
  it('compact K', () => assert.equal(compact(1500), '1.5K'));
  it('compact M', () => assert.equal(compact(2500000), '2.5M'));
  it('compact B', () => assert.equal(compact(1000000000), '1B'));
  it('ordinal 1st', () => assert.equal(ordinal(1), '1st'));
  it('ordinal 2nd', () => assert.equal(ordinal(2), '2nd'));
  it('ordinal 3rd', () => assert.equal(ordinal(3), '3rd'));
  it('ordinal 11th', () => assert.equal(ordinal(11), '11th'));
  it('ordinal 21st', () => assert.equal(ordinal(21), '21st'));
  it('percentage', () => assert.equal(percentage(0.75), '75%'));
  it('padLeft', () => assert.equal(padLeft(42, 5), '00042'));
  it('comma', () => assert.equal(commaSeparate(1234567), '1,234,567'));
  it('toRoman', () => assert.equal(toRoman(2024), 'MMXXIV'));
  it('fromRoman', () => assert.equal(fromRoman('MMXXIV'), 2024));
  it('roman roundtrip', () => assert.equal(fromRoman(toRoman(1999)), 1999));
});
