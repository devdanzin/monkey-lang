import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { KVStore } from '../src/index.js';

describe('KVStore — basic', () => {
  it('set and get', () => { const kv = new KVStore(); kv.set('a', 1); assert.equal(kv.get('a'), 1); });
  it('has', () => { const kv = new KVStore(); kv.set('x', 1); assert.equal(kv.has('x'), true); assert.equal(kv.has('y'), false); });
  it('delete', () => { const kv = new KVStore(); kv.set('x', 1); kv.delete('x'); assert.equal(kv.has('x'), false); });
  it('clear', () => { const kv = new KVStore(); kv.set('a', 1); kv.set('b', 2); kv.clear(); assert.equal(kv.size, 0); });
  it('size', () => { const kv = new KVStore(); kv.set('a', 1); kv.set('b', 2); assert.equal(kv.size, 2); });
  it('keys/values/entries', () => { const kv = new KVStore(); kv.set('a', 1); assert.deepEqual(kv.keys(), ['a']); });
  it('stores objects', () => { const kv = new KVStore(); kv.set('obj', { x: 1 }); assert.deepEqual(kv.get('obj'), { x: 1 }); });
});

describe('KVStore — TTL', () => {
  it('expires after TTL', async () => {
    const kv = new KVStore();
    kv.set('temp', 42, 50);
    assert.equal(kv.get('temp'), 42);
    await new Promise(r => setTimeout(r, 60));
    assert.equal(kv.get('temp'), undefined);
  });
});

describe('KVStore — batch', () => {
  it('mset/mget', () => {
    const kv = new KVStore();
    kv.mset([['a', 1], ['b', 2], ['c', 3]]);
    assert.deepEqual(kv.mget(['a', 'b', 'c']), [1, 2, 3]);
  });
});

describe('KVStore — incr', () => {
  it('increments number', () => { const kv = new KVStore(); kv.set('n', 5); assert.equal(kv.incr('n'), 6); });
  it('creates from 0', () => { const kv = new KVStore(); assert.equal(kv.incr('new'), 1); });
  it('throws on non-number', () => { const kv = new KVStore(); kv.set('s', 'hi'); assert.throws(() => kv.incr('s')); });
});

describe('KVStore — persistence', () => {
  const file = '/tmp/kv-test-' + Date.now() + '.json';
  afterEach(() => { try { new KVStore({ file }).destroy(); } catch {} });

  it('persists to file', () => {
    const kv = new KVStore({ file });
    kv.set('x', 42);
    const kv2 = new KVStore({ file });
    assert.equal(kv2.get('x'), 42);
    kv.destroy();
  });
});

describe('KVStore — iterator', () => {
  it('iterates entries', () => {
    const kv = new KVStore();
    kv.set('a', 1); kv.set('b', 2);
    const entries = [...kv];
    assert.equal(entries.length, 2);
  });
});
