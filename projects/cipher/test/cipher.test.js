import { describe, it } from 'node:test'; import assert from 'node:assert/strict';
import { rot13, caesar, vigenere, xorCipher, atbash } from '../src/index.js';
describe('rot13', () => { it('basic', () => assert.equal(rot13('HELLO'), 'URYYB')); it('roundtrip', () => assert.equal(rot13(rot13('Hello World')), 'Hello World')); });
describe('caesar', () => { it('shift 3', () => assert.equal(caesar('ABC', 3), 'DEF')); it('wrap', () => assert.equal(caesar('XYZ', 3), 'ABC')); it('decrypt', () => assert.equal(caesar(caesar('Hello', 7), 26 - 7), 'Hello')); });
describe('vigenere', () => { it('encrypt', () => assert.equal(vigenere('HELLO', 'KEY'), 'RIJVS')); it('decrypt', () => assert.equal(vigenere('RIJVS', 'KEY', true), 'HELLO')); });
describe('xor', () => { it('roundtrip', () => assert.equal(xorCipher(xorCipher('hello', 'key'), 'key'), 'hello')); });
describe('atbash', () => { it('basic', () => assert.equal(atbash('ABC'), 'ZYX')); it('roundtrip', () => assert.equal(atbash(atbash('Hello')), 'Hello')); });
