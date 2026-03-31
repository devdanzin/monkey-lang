import { describe, it } from 'node:test'; import assert from 'node:assert/strict';
import { int, float, bool, pick, shuffle, hex, string, gaussian, color, weighted } from '../src/index.js';
describe('random', () => {
  it('int in range', () => { const n = int(1, 10); assert.ok(n >= 1 && n <= 10); });
  it('float in range', () => { const n = float(0, 1); assert.ok(n >= 0 && n <= 1); });
  it('bool', () => assert.equal(typeof bool(), 'boolean'));
  it('pick', () => { const arr = [1, 2, 3]; assert.ok(arr.includes(pick(arr))); });
  it('shuffle same elements', () => { const arr = [1, 2, 3, 4]; const s = shuffle(arr); assert.equal(s.length, arr.length); for (const x of arr) assert.ok(s.includes(x)); });
  it('hex length', () => assert.equal(hex(16).length, 16));
  it('string length', () => assert.equal(string(10).length, 10));
  it('gaussian is number', () => assert.equal(typeof gaussian(), 'number'));
  it('color is hex', () => assert.ok(/^#[0-9a-f]{6}$/.test(color())));
  it('weighted', () => { const result = weighted([['a', 100], ['b', 0]]); assert.equal(result, 'a'); });
});
