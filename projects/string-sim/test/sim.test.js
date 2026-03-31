import { describe, it } from 'node:test'; import assert from 'node:assert/strict';
import { jaccard, sorensen, cosine, hammingDistance, jaro } from '../src/index.js';
describe('jaccard', () => { it('identical = 1', () => assert.equal(jaccard('abc', 'abc'), 1)); it('different < 1', () => assert.ok(jaccard('abc', 'xyz') < 1)); });
describe('sorensen', () => { it('similar strings', () => assert.ok(sorensen('night', 'nacht') > 0)); it('identical', () => assert.equal(sorensen('abc', 'abc'), 1)); });
describe('cosine', () => { it('identical = 1', () => assert.ok(Math.abs(cosine('abc', 'abc') - 1) < 0.01)); it('different', () => assert.ok(cosine('abc', 'xyz') < 0.01)); });
describe('hamming', () => { it('basic', () => assert.equal(hammingDistance('karolin', 'kathrin'), 3)); it('same', () => assert.equal(hammingDistance('abc', 'abc'), 0)); it('different length throws', () => assert.throws(() => hammingDistance('ab', 'abc'))); });
describe('jaro', () => { it('identical = 1', () => assert.equal(jaro('abc', 'abc'), 1)); it('similar', () => assert.ok(jaro('martha', 'marhta') > 0.9)); it('different', () => assert.ok(jaro('abc', 'xyz') < 0.5)); });
