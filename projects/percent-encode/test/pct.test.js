import { describe, it } from 'node:test'; import assert from 'node:assert/strict';
import { encode, decode } from '../src/index.js';
describe('encode', () => { it('spaces', () => assert.equal(encode('hello world'), 'hello%20world')); it('special', () => assert.equal(encode('a+b=c'), 'a%2Bb%3Dc')); it('unreserved pass through', () => assert.equal(encode('abc123'), 'abc123')); });
describe('decode', () => { it('basic', () => assert.equal(decode('hello%20world'), 'hello world')); it('roundtrip', () => assert.equal(decode(encode('a+b=c&d')), 'a+b=c&d')); });
