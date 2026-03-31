import { describe, it } from 'node:test'; import assert from 'node:assert/strict';
import { parse, format, formatVerbose } from '../src/index.js';
describe('parse', () => {
  it('seconds', () => assert.equal(parse('5s'), 5000));
  it('minutes', () => assert.equal(parse('2m'), 120000));
  it('hours', () => assert.equal(parse('1h'), 3600000));
  it('days', () => assert.equal(parse('1d'), 86400000));
  it('combined', () => assert.equal(parse('1h 30m'), 5400000));
  it('ms', () => assert.equal(parse('500ms'), 500));
});
describe('format', () => {
  it('ms', () => assert.equal(format(500), '500ms'));
  it('seconds', () => assert.equal(format(5000), '5.0s'));
  it('minutes', () => assert.equal(format(120000), '2.0m'));
  it('long', () => assert.ok(format(5000, { long: true }).includes('seconds')));
});
describe('formatVerbose', () => {
  it('combined', () => assert.equal(formatVerbose(3661000), '1h 1m 1s'));
  it('zero', () => assert.equal(formatVerbose(0), '0s'));
});
