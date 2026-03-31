import { describe, it } from 'node:test'; import assert from 'node:assert/strict';
import { center, truncate, wordWrap, reverse, capitalize, indent, dedent, squeeze } from '../src/index.js';
describe('string', () => {
  it('center', () => assert.equal(center('hi', 6), '  hi  '));
  it('truncate', () => assert.equal(truncate('hello world', 8), 'hello...'));
  it('truncate short', () => assert.equal(truncate('hi', 8), 'hi'));
  it('wordWrap', () => { const w = wordWrap('the quick brown fox', 10); assert.ok(w.includes('\n')); });
  it('reverse', () => assert.equal(reverse('hello'), 'olleh'));
  it('capitalize', () => assert.equal(capitalize('hello'), 'Hello'));
  it('indent', () => assert.equal(indent('a\nb', 2), '  a\n  b'));
  it('dedent', () => assert.equal(dedent('  a\n  b'), 'a\nb'));
  it('squeeze', () => assert.equal(squeeze('  hello   world  '), 'hello world'));
});
