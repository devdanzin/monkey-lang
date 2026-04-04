// btree.test.js — Tests for B-tree implementation

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BTree } from './btree.js';

describe('BTree', () => {
  describe('Basic operations', () => {
    it('creates empty tree', () => {
      const tree = new BTree();
      assert.equal(tree.size, 0);
      assert.equal(tree.get('key'), undefined);
    });

    it('inserts and retrieves a single key', () => {
      const tree = new BTree();
      tree.set('a', 1);
      assert.equal(tree.size, 1);
      assert.equal(tree.get('a'), 1);
    });

    it('inserts multiple keys in order', () => {
      const tree = new BTree(2);
      for (let i = 0; i < 10; i++) tree.set(String(i), i);
      assert.equal(tree.size, 10);
      for (let i = 0; i < 10; i++) assert.equal(tree.get(String(i)), i);
    });

    it('inserts keys in reverse order', () => {
      const tree = new BTree(2);
      for (let i = 9; i >= 0; i--) tree.set(String(i), i);
      assert.equal(tree.size, 10);
      for (let i = 0; i < 10; i++) assert.equal(tree.get(String(i)), i);
    });

    it('updates existing keys', () => {
      const tree = new BTree();
      tree.set('key', 1);
      tree.set('key', 2);
      assert.equal(tree.size, 1);
      assert.equal(tree.get('key'), 2);
    });

    it('has() returns true for existing keys', () => {
      const tree = new BTree();
      tree.set('a', 1);
      assert.ok(tree.has('a'));
      assert.ok(!tree.has('b'));
    });
  });

  describe('Delete', () => {
    it('deletes from leaf', () => {
      const tree = new BTree(2);
      tree.set('a', 1);
      tree.set('b', 2);
      tree.set('c', 3);
      assert.ok(tree.delete('b'));
      assert.equal(tree.size, 2);
      assert.equal(tree.get('b'), undefined);
      assert.equal(tree.get('a'), 1);
      assert.equal(tree.get('c'), 3);
    });

    it('deletes non-existent key returns false', () => {
      const tree = new BTree();
      tree.set('a', 1);
      assert.ok(!tree.delete('b'));
      assert.equal(tree.size, 1);
    });

    it('deletes all keys', () => {
      const tree = new BTree(2);
      for (let i = 0; i < 20; i++) tree.set(String(i).padStart(2, '0'), i);
      for (let i = 0; i < 20; i++) {
        assert.ok(tree.delete(String(i).padStart(2, '0')), `Failed to delete ${i}`);
      }
      assert.equal(tree.size, 0);
    });

    it('maintains order after deletions', () => {
      const tree = new BTree(2);
      for (let i = 0; i < 20; i++) tree.set(String(i).padStart(2, '0'), i);
      // Delete even numbers
      for (let i = 0; i < 20; i += 2) tree.delete(String(i).padStart(2, '0'));
      const keys = [...tree.keys()];
      for (let i = 0; i < keys.length - 1; i++) {
        assert.ok(keys[i] < keys[i + 1], `Order broken: ${keys[i]} >= ${keys[i + 1]}`);
      }
    });
  });

  describe('Range queries', () => {
    it('returns empty for empty tree', () => {
      const tree = new BTree();
      assert.deepStrictEqual(tree.range('a', 'z'), []);
    });

    it('returns all keys in range', () => {
      const tree = new BTree(2);
      for (let i = 0; i < 10; i++) tree.set(String.fromCharCode(97 + i), i); // a-j
      const results = tree.range('c', 'g');
      assert.equal(results.length, 5);
      assert.equal(results[0].key, 'c');
      assert.equal(results[4].key, 'g');
    });

    it('handles single-key range', () => {
      const tree = new BTree(2);
      tree.set('a', 1);
      tree.set('b', 2);
      tree.set('c', 3);
      const results = tree.range('b', 'b');
      assert.equal(results.length, 1);
      assert.equal(results[0].key, 'b');
    });

    it('returns empty when range has no matches', () => {
      const tree = new BTree(2);
      tree.set('a', 1);
      tree.set('z', 26);
      const results = tree.range('m', 'n');
      assert.equal(results.length, 0);
    });
  });

  describe('Iteration', () => {
    it('iterates keys in sorted order', () => {
      const tree = new BTree(2);
      const items = ['d', 'b', 'a', 'c', 'f', 'e'];
      for (const k of items) tree.set(k, k.charCodeAt(0));
      const keys = [...tree.keys()];
      assert.deepStrictEqual(keys, ['a', 'b', 'c', 'd', 'e', 'f']);
    });

    it('iterates values', () => {
      const tree = new BTree();
      tree.set('a', 1);
      tree.set('b', 2);
      tree.set('c', 3);
      assert.deepStrictEqual([...tree.values()], [1, 2, 3]);
    });

    it('iterates entries', () => {
      const tree = new BTree();
      tree.set('x', 10);
      tree.set('y', 20);
      const entries = tree.toArray();
      assert.equal(entries.length, 2);
      assert.equal(entries[0].key, 'x');
      assert.equal(entries[1].key, 'y');
    });
  });

  describe('Min/Max', () => {
    it('returns min and max', () => {
      const tree = new BTree(2);
      for (let i = 0; i < 10; i++) tree.set(String.fromCharCode(97 + i), i);
      assert.equal(tree.min().key, 'a');
      assert.equal(tree.max().key, 'j');
    });

    it('min and max on empty tree', () => {
      const tree = new BTree();
      assert.equal(tree.min(), undefined);
      assert.equal(tree.max(), undefined);
    });
  });

  describe('Tree structure', () => {
    it('grows height with many inserts', () => {
      const tree = new BTree(2);
      assert.equal(tree.height(), 0);
      for (let i = 0; i < 100; i++) tree.set(String(i).padStart(3, '0'), i);
      assert.ok(tree.height() > 0);
    });

    it('maintains invariants with 1000 operations', () => {
      const tree = new BTree(3);
      const map = new Map(); // reference implementation

      for (let i = 0; i < 500; i++) {
        const key = String(Math.floor(Math.random() * 200)).padStart(3, '0');
        const value = i;
        tree.set(key, value);
        map.set(key, value);
      }

      // Verify all keys match
      for (const [key, value] of map) {
        assert.equal(tree.get(key), value, `Mismatch for key ${key}`);
      }

      // Delete half
      const keys = [...map.keys()];
      for (let i = 0; i < keys.length; i += 2) {
        tree.delete(keys[i]);
        map.delete(keys[i]);
      }

      // Verify remaining
      for (const [key, value] of map) {
        assert.equal(tree.get(key), value, `Mismatch after delete for key ${key}`);
      }

      // Verify sorted order
      const sortedKeys = [...tree.keys()];
      for (let i = 0; i < sortedKeys.length - 1; i++) {
        assert.ok(sortedKeys[i] < sortedKeys[i + 1], `Order broken: ${sortedKeys[i]} >= ${sortedKeys[i + 1]}`);
      }

      assert.equal(tree.size, map.size);
    });

    it('clear resets tree', () => {
      const tree = new BTree();
      tree.set('a', 1);
      tree.set('b', 2);
      tree.clear();
      assert.equal(tree.size, 0);
      assert.equal(tree.get('a'), undefined);
    });
  });

  describe('Different orders', () => {
    for (const order of [2, 3, 4, 5, 10]) {
      it(`works with order ${order}`, () => {
        const tree = new BTree(order);
        for (let i = 0; i < 50; i++) tree.set(String(i).padStart(2, '0'), i);
        assert.equal(tree.size, 50);
        for (let i = 0; i < 50; i++) assert.equal(tree.get(String(i).padStart(2, '0')), i);
        // Delete every 3rd
        for (let i = 0; i < 50; i += 3) tree.delete(String(i).padStart(2, '0'));
        const remaining = tree.size;
        assert.ok(remaining > 30 && remaining < 40);
      });
    }
  });
});
