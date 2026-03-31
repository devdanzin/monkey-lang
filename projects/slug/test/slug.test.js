import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { slugify } from '../src/index.js';

describe('slugify', () => {
  it('basic', () => assert.equal(slugify('Hello World'), 'hello-world'));
  it('special chars', () => assert.equal(slugify('Hello, World!'), 'hello-world'));
  it('accents', () => assert.equal(slugify('café résumé'), 'cafe-resume'));
  it('multiple spaces', () => assert.equal(slugify('a   b'), 'a-b'));
  it('underscores', () => assert.equal(slugify('hello_world'), 'hello-world'));
  it('custom separator', () => assert.equal(slugify('Hello World', { separator: '_' }), 'hello_world'));
  it('no lowercase', () => assert.equal(slugify('Hello', { lowercase: false }), 'Hello'));
  it('trim', () => assert.equal(slugify('  hello  '), 'hello'));
});
