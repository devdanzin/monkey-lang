import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sprintf } from '../src/index.js';

describe('strings', () => {
  it('%s', () => assert.equal(sprintf('hello %s', 'world'), 'hello world'));
  it('precision', () => assert.equal(sprintf('%.3s', 'hello'), 'hel'));
  it('width', () => assert.equal(sprintf('%10s', 'hi'), '        hi'));
  it('left align', () => assert.equal(sprintf('%-10s', 'hi'), 'hi        '));
});

describe('integers', () => {
  it('%d', () => assert.equal(sprintf('%d', 42), '42'));
  it('negative', () => assert.equal(sprintf('%d', -5), '-5'));
  it('plus flag', () => assert.equal(sprintf('%+d', 42), '+42'));
  it('space flag', () => assert.equal(sprintf('% d', 42), ' 42'));
  it('zero pad', () => assert.equal(sprintf('%05d', 42), '00042'));
  it('width', () => assert.equal(sprintf('%8d', 42), '      42'));
});

describe('hex/octal/binary', () => {
  it('%x', () => assert.equal(sprintf('%x', 255), 'ff'));
  it('%X', () => assert.equal(sprintf('%X', 255), 'FF'));
  it('%#x', () => assert.equal(sprintf('%#x', 255), '0xff'));
  it('%o', () => assert.equal(sprintf('%o', 8), '10'));
  it('%b', () => assert.equal(sprintf('%b', 10), '1010'));
});

describe('floats', () => {
  it('%f', () => assert.equal(sprintf('%f', 3.14), '3.140000'));
  it('precision', () => assert.equal(sprintf('%.2f', 3.14159), '3.14'));
  it('%e', () => assert.ok(sprintf('%e', 12345).includes('e+')));
  it('%E', () => assert.ok(sprintf('%E', 12345).includes('E+')));
});

describe('special', () => {
  it('%%', () => assert.equal(sprintf('100%%'), '100%'));
  it('%c', () => assert.equal(sprintf('%c', 65), 'A'));
  it('%j', () => assert.equal(sprintf('%j', { a: 1 }), '{"a":1}'));
});

describe('multiple args', () => {
  it('mixed', () => assert.equal(sprintf('%s is %d years old', 'Alice', 30), 'Alice is 30 years old'));
});
