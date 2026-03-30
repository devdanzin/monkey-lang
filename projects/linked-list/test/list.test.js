import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SinglyLinkedList, DoublyLinkedList } from '../src/index.js';

for (const [name, ListClass] of [['SinglyLinkedList', SinglyLinkedList], ['DoublyLinkedList', DoublyLinkedList]]) {
  describe(name, () => {
    it('push and toArray', () => {
      const list = new ListClass();
      list.push(1).push(2).push(3);
      assert.deepEqual(list.toArray(), [1, 2, 3]);
      assert.equal(list.size, 3);
    });
    it('unshift', () => {
      const list = new ListClass();
      list.unshift(3).unshift(2).unshift(1);
      assert.deepEqual(list.toArray(), [1, 2, 3]);
    });
    it('pop', () => {
      const list = ListClass.from([1, 2, 3]);
      assert.equal(list.pop(), 3);
      assert.deepEqual(list.toArray(), [1, 2]);
    });
    it('shift', () => {
      const list = ListClass.from([1, 2, 3]);
      assert.equal(list.shift(), 1);
      assert.deepEqual(list.toArray(), [2, 3]);
    });
    it('get', () => {
      const list = ListClass.from([10, 20, 30]);
      assert.equal(list.get(0), 10);
      assert.equal(list.get(2), 30);
      assert.equal(list.get(5), undefined);
    });
    it('set', () => {
      const list = ListClass.from([1, 2, 3]);
      list.set(1, 20);
      assert.deepEqual(list.toArray(), [1, 20, 3]);
    });
    it('insert', () => {
      const list = ListClass.from([1, 3]);
      list.insert(1, 2);
      assert.deepEqual(list.toArray(), [1, 2, 3]);
    });
    it('remove', () => {
      const list = ListClass.from([1, 2, 3]);
      assert.equal(list.remove(1), 2);
      assert.deepEqual(list.toArray(), [1, 3]);
    });
    it('indexOf and contains', () => {
      const list = ListClass.from([10, 20, 30]);
      assert.equal(list.indexOf(20), 1);
      assert.equal(list.indexOf(99), -1);
      assert.equal(list.contains(20), true);
      assert.equal(list.contains(99), false);
    });
    it('reverse', () => {
      const list = ListClass.from([1, 2, 3, 4]);
      list.reverse();
      assert.deepEqual(list.toArray(), [4, 3, 2, 1]);
    });
    it('clear', () => {
      const list = ListClass.from([1, 2]);
      list.clear();
      assert.equal(list.size, 0);
      assert.equal(list.isEmpty, true);
    });
    it('iterator', () => {
      const list = ListClass.from([1, 2, 3]);
      assert.deepEqual([...list], [1, 2, 3]);
    });
    it('from', () => {
      const list = ListClass.from([4, 5, 6]);
      assert.deepEqual(list.toArray(), [4, 5, 6]);
    });
    it('empty operations', () => {
      const list = new ListClass();
      assert.equal(list.pop(), undefined);
      assert.equal(list.shift(), undefined);
      assert.equal(list.get(0), undefined);
    });
  });
}
