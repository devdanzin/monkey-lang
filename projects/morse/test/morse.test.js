import { describe, it } from 'node:test'; import assert from 'node:assert/strict';
import { encode, decode } from '../src/index.js';
describe('morse', () => {
  it('SOS', () => assert.equal(encode('SOS'), '... --- ...'));
  it('hello', () => assert.equal(encode('HELLO'), '.... . .-.. .-.. ---'));
  it('decode SOS', () => assert.equal(decode('... --- ...'), 'SOS'));
  it('roundtrip', () => assert.equal(decode(encode('HELLO WORLD')), 'HELLO WORLD'));
  it('numbers', () => assert.equal(encode('123'), '.---- ..--- ...--'));
});
