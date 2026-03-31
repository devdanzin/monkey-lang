import { describe, it } from 'node:test'; import assert from 'node:assert/strict';
import { lookup, extension, charset, isText } from '../src/index.js';
describe('mime', () => {
  it('lookup html', () => assert.equal(lookup('index.html'), 'text/html'));
  it('lookup json', () => assert.equal(lookup('data.json'), 'application/json'));
  it('lookup png', () => assert.equal(lookup('img.png'), 'image/png'));
  it('unknown', () => assert.equal(lookup('file.xyz'), 'application/octet-stream'));
  it('extension', () => assert.equal(extension('text/html'), 'html'));
  it('charset', () => assert.equal(charset('text/html'), 'UTF-8'));
  it('charset null', () => assert.equal(charset('image/png'), null));
  it('isText', () => { assert.ok(isText('text/plain')); assert.ok(!isText('image/png')); });
});
