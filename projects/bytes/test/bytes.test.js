import { describe, it } from 'node:test'; import assert from 'node:assert/strict';
import { format, parse } from '../src/index.js';
describe('format', () => {
  it('bytes', () => assert.equal(format(0), '0 B'));
  it('KB', () => assert.equal(format(1500), '1.50 KB'));
  it('MB', () => assert.equal(format(1500000), '1.50 MB'));
  it('GB', () => assert.equal(format(1500000000), '1.50 GB'));
  it('IEC', () => assert.equal(format(1024, { iec: true }), '1.00 KiB'));
  it('negative', () => assert.ok(format(-1500).startsWith('-')));
});
describe('parse', () => {
  it('KB', () => assert.equal(parse('1.5 KB'), 1500));
  it('MiB', () => assert.equal(parse('1 MiB'), 1048576));
  it('GB', () => assert.equal(parse('2 GB'), 2000000000));
  it('invalid throws', () => assert.throws(() => parse('bad')));
});
