// transactions.test.js — Tests for MVCC transactions

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TransactionalKVStore, Transaction } from './transactions.js';

describe('Transactions', () => {
  describe('Basic transactions', () => {
    it('begin/commit transaction', () => {
      const store = new TransactionalKVStore();
      const txn = store.begin();
      txn.set('a', 1);
      txn.set('b', 2);
      txn.commit();
      assert.equal(store.get('a'), 1);
      assert.equal(store.get('b'), 2);
    });

    it('rollback discards changes', () => {
      const store = new TransactionalKVStore();
      store.set('a', 1);
      const txn = store.begin();
      txn.set('a', 999);
      txn.rollback();
      assert.equal(store.get('a'), 1);
    });

    it('reads own writes', () => {
      const store = new TransactionalKVStore();
      store.set('a', 1);
      const txn = store.begin();
      txn.set('a', 2);
      assert.equal(txn.get('a'), 2);
      txn.commit();
    });

    it('reads snapshot for uncommitted writes by others', () => {
      const store = new TransactionalKVStore();
      store.set('key', 'original');
      const txn1 = store.begin();
      const txn2 = store.begin();

      // txn1 modifies key
      txn1.set('key', 'modified');
      txn1.commit();

      // txn2 should still see original (snapshot isolation)
      assert.equal(txn2.get('key'), 'original');
      txn2.rollback();
    });

    it('transaction delete removes key', () => {
      const store = new TransactionalKVStore();
      store.set('a', 1);
      const txn = store.begin();
      txn.delete('a');
      assert.equal(txn.get('a'), undefined);
      txn.commit();
      assert.equal(store.get('a'), undefined);
    });
  });

  describe('Conflict detection', () => {
    it('detects write-write conflict', () => {
      const store = new TransactionalKVStore();
      store.set('key', 'initial');

      const txn1 = store.begin();
      const txn2 = store.begin();

      txn1.set('key', 'value1');
      txn1.commit();

      txn2.set('key', 'value2');
      assert.throws(() => txn2.commit(), /conflict/i);
    });

    it('no conflict on different keys', () => {
      const store = new TransactionalKVStore();
      const txn1 = store.begin();
      const txn2 = store.begin();

      txn1.set('a', 1);
      txn1.commit();

      txn2.set('b', 2);
      txn2.commit(); // Should succeed — different keys
      
      assert.equal(store.get('a'), 1);
      assert.equal(store.get('b'), 2);
    });

    it('conflict on new key written by concurrent txn', () => {
      const store = new TransactionalKVStore();
      const txn1 = store.begin();
      const txn2 = store.begin();

      txn1.set('shared', 'first');
      txn1.commit();

      txn2.set('shared', 'second');
      assert.throws(() => txn2.commit(), /conflict/i);
    });
  });

  describe('Snapshot isolation', () => {
    it('concurrent readers see consistent snapshot', () => {
      const store = new TransactionalKVStore();
      store.set('x', 100);
      store.set('y', 200);

      const reader = store.begin();

      // External modification
      store.set('x', 999);
      store.set('y', 888);

      // Reader sees original values
      assert.equal(reader.get('x'), 100);
      assert.equal(reader.get('y'), 200);
      reader.rollback();
    });

    it('committed values visible to new transactions', () => {
      const store = new TransactionalKVStore();
      const txn1 = store.begin();
      txn1.set('key', 'value');
      txn1.commit();

      const txn2 = store.begin();
      assert.equal(txn2.get('key'), 'value');
      txn2.rollback();
    });

    it('multiple transactions with reads and writes', () => {
      const store = new TransactionalKVStore();
      store.set('balance', 1000);

      const withdraw = store.begin();
      const balance = withdraw.get('balance');
      withdraw.set('balance', balance - 100);
      withdraw.commit();

      assert.equal(store.get('balance'), 900);
    });
  });

  describe('Error handling', () => {
    it('cannot use committed transaction', () => {
      const store = new TransactionalKVStore();
      const txn = store.begin();
      txn.set('a', 1);
      txn.commit();
      assert.throws(() => txn.set('b', 2), /not active/);
    });

    it('cannot use rolled-back transaction', () => {
      const store = new TransactionalKVStore();
      const txn = store.begin();
      txn.rollback();
      assert.throws(() => txn.get('a'), /not active/);
    });

    it('cannot commit twice', () => {
      const store = new TransactionalKVStore();
      const txn = store.begin();
      txn.commit();
      assert.throws(() => txn.commit(), /not active/);
    });
  });

  describe('Direct operations', () => {
    it('set/get without transaction', () => {
      const store = new TransactionalKVStore();
      store.set('direct', 42);
      assert.equal(store.get('direct'), 42);
    });

    it('delete without transaction', () => {
      const store = new TransactionalKVStore();
      store.set('key', 1);
      store.delete('key');
      assert.equal(store.get('key'), undefined);
    });

    it('range queries work', () => {
      const store = new TransactionalKVStore();
      store.set('a', 1);
      store.set('b', 2);
      store.set('c', 3);
      const results = store.range('a', 'c');
      assert.equal(results.length, 3);
    });

    it('clear resets everything', () => {
      const store = new TransactionalKVStore();
      store.set('a', 1);
      store.clear();
      assert.equal(store.size, 0);
    });
  });
});
