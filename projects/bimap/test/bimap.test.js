import { describe, it } from 'node:test'; import assert from 'node:assert/strict';
import { BiMap } from '../src/index.js';
describe('BiMap', () => {
  it('set/get', () => { const b = new BiMap(); b.set('a', 1); assert.equal(b.get('a'), 1); });
  it('getKey (reverse)', () => { const b = new BiMap(); b.set('a', 1); assert.equal(b.getKey(1), 'a'); });
  it('overwrite removes old', () => { const b = new BiMap(); b.set('a', 1); b.set('a', 2); assert.equal(b.get('a'), 2); assert.equal(b.getKey(1), undefined); });
  it('hasValue', () => { const b = new BiMap(); b.set('a', 1); assert.ok(b.hasValue(1)); assert.ok(!b.hasValue(2)); });
  it('delete', () => { const b = new BiMap(); b.set('a', 1); b.delete('a'); assert.equal(b.size, 0); assert.ok(!b.hasValue(1)); });
  it('inverse', () => { const b = new BiMap(); b.set('a', 1); const inv = b.inverse(); assert.equal(inv.get(1), 'a'); });
});
