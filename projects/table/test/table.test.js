import { describe, it } from 'node:test'; import assert from 'node:assert/strict';
import { table } from '../src/index.js';
describe('table', () => {
  it('basic', () => { const t = table([['Name', 'Age'], ['Alice', 30], ['Bob', 25]]); assert.ok(t.includes('Alice')); assert.ok(t.includes('+')); });
  it('no border', () => { const t = table([['A', 'B'], [1, 2]], { border: false }); assert.ok(!t.includes('+')); assert.ok(t.includes('A')); });
  it('alignment', () => { const t = table([['Name', 'Val'], ['a', 123]], { align: { 1: 'right' } }); assert.ok(t.includes('123')); });
  it('handles empty', () => { const t = table([['A'], ['B']]); assert.ok(typeof t === 'string'); });
});
