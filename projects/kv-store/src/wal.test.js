// wal.test.js — Tests for WAL and persistent KV store

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { WAL, PersistentKVStore } from './wal.js';
import { mkdtempSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function tmpDir() {
  return mkdtempSync(join(tmpdir(), 'kv-test-'));
}

describe('WAL', () => {
  it('appends and reads entries', () => {
    const dir = tmpDir();
    const wal = new WAL(join(dir, 'test.wal'));
    wal.append('S', 'key1', 'value1');
    wal.append('D', 'key2');
    const entries = wal.read();
    assert.equal(entries.length, 2);
    assert.equal(entries[0].key, 'key1');
    assert.equal(entries[1].op, 'D');
  });

  it('truncates log', () => {
    const dir = tmpDir();
    const wal = new WAL(join(dir, 'test.wal'));
    wal.append('S', 'a', 1);
    wal.truncate();
    assert.equal(wal.read().length, 0);
  });

  it('reads empty file', () => {
    const dir = tmpDir();
    const wal = new WAL(join(dir, 'nonexistent.wal'));
    assert.deepStrictEqual(wal.read(), []);
  });
});

describe('PersistentKVStore', () => {
  it('basic get/set', () => {
    const dir = tmpDir();
    const store = new PersistentKVStore({ dataPath: join(dir, 'data.json'), walPath: join(dir, 'data.wal') });
    store.set('hello', 'world');
    assert.equal(store.get('hello'), 'world');
    store.destroy();
  });

  it('persists across restarts', () => {
    const dir = tmpDir();
    const opts = { dataPath: join(dir, 'data.json'), walPath: join(dir, 'data.wal') };

    // First instance
    const store1 = new PersistentKVStore(opts);
    store1.set('key1', 'val1');
    store1.set('key2', 'val2');
    store1.close(); // checkpoint

    // Second instance (simulates restart)
    const store2 = new PersistentKVStore(opts);
    assert.equal(store2.get('key1'), 'val1');
    assert.equal(store2.get('key2'), 'val2');
    store2.destroy();
  });

  it('recovers from WAL without checkpoint', () => {
    const dir = tmpDir();
    const opts = { dataPath: join(dir, 'data.json'), walPath: join(dir, 'data.wal') };

    // Write without checkpoint
    const store1 = new PersistentKVStore(opts);
    store1.set('crash-test', 'survived');
    // Don't call close() — simulates crash

    // Recover
    const store2 = new PersistentKVStore(opts);
    assert.equal(store2.get('crash-test'), 'survived');
    store2.destroy();
  });

  it('recovers deletes from WAL', () => {
    const dir = tmpDir();
    const opts = { dataPath: join(dir, 'data.json'), walPath: join(dir, 'data.wal') };

    const store1 = new PersistentKVStore(opts);
    store1.set('a', 1);
    store1.set('b', 2);
    store1.checkpoint();
    store1.delete('a');
    // Crash without checkpoint

    const store2 = new PersistentKVStore(opts);
    assert.equal(store2.get('a'), undefined);
    assert.equal(store2.get('b'), 2);
    store2.destroy();
  });

  it('auto-compacts after threshold', () => {
    const dir = tmpDir();
    const opts = {
      dataPath: join(dir, 'data.json'),
      walPath: join(dir, 'data.wal'),
      compactThreshold: 5,
    };

    const store = new PersistentKVStore(opts);
    for (let i = 0; i < 10; i++) {
      store.set(`key${i}`, i);
    }
    // After 5 inserts, should have compacted once
    assert.ok(existsSync(join(dir, 'data.json')));
    store.destroy();
  });

  it('range queries work', () => {
    const dir = tmpDir();
    const opts = { dataPath: join(dir, 'data.json'), walPath: join(dir, 'data.wal') };
    const store = new PersistentKVStore(opts);
    store.set('a', 1);
    store.set('b', 2);
    store.set('c', 3);
    store.set('d', 4);
    const results = store.range('b', 'c');
    assert.equal(results.length, 2);
    store.destroy();
  });

  it('handles many operations', () => {
    const dir = tmpDir();
    const opts = {
      dataPath: join(dir, 'data.json'),
      walPath: join(dir, 'data.wal'),
      compactThreshold: 50,
    };
    const store = new PersistentKVStore(opts);
    for (let i = 0; i < 200; i++) store.set(`k${String(i).padStart(3, '0')}`, i);
    assert.equal(store.size, 200);
    for (let i = 0; i < 200; i += 3) store.delete(`k${String(i).padStart(3, '0')}`);
    store.close();

    // Recover
    const store2 = new PersistentKVStore(opts);
    assert.equal(store2.size, store.size);
    store2.destroy();
  });

  it('checkpoint creates valid snapshot', () => {
    const dir = tmpDir();
    const opts = { dataPath: join(dir, 'data.json'), walPath: join(dir, 'data.wal') };
    const store = new PersistentKVStore(opts);
    store.set('x', 10);
    store.set('y', 20);
    const count = store.checkpoint();
    assert.equal(count, 2);
    assert.ok(existsSync(join(dir, 'data.json')));
    store.destroy();
  });
});
