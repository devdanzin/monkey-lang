import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BST, AVLTree } from './bst.js';

describe('BST', () => {
  it('insert and search', () => { const t = new BST(); t.insert(5); t.insert(3); t.insert(7); assert.equal(t.search(3), 3); });
  it('has', () => { const t = new BST(); t.insert(5); assert.ok(t.has(5)); assert.ok(!t.has(3)); });
  it('search missing', () => { assert.equal(new BST().search(1), undefined); });
  it('key-value', () => { const t = new BST(); t.insert(1, 'one'); assert.equal(t.search(1), 'one'); });
  it('update value', () => { const t = new BST(); t.insert(1, 'a'); t.insert(1, 'b'); assert.equal(t.search(1), 'b'); assert.equal(t.size, 1); });
  it('min/max', () => { const t = new BST(); t.insert(5).insert(3).insert(7).insert(1).insert(9); assert.equal(t.min(), 1); assert.equal(t.max(), 9); });
  it('delete leaf', () => { const t = new BST(); t.insert(5).insert(3).insert(7); assert.ok(t.delete(3)); assert.ok(!t.has(3)); assert.equal(t.size, 2); });
  it('delete node with children', () => { const t = new BST(); t.insert(5).insert(3).insert(7).insert(6).insert(8); t.delete(7); assert.ok(!t.has(7)); assert.ok(t.has(6)); assert.ok(t.has(8)); });
  it('delete missing', () => { assert.ok(!new BST().delete(1)); });
  it('inorder', () => { const t = new BST(); t.insert(3).insert(1).insert(5).insert(2).insert(4); assert.deepStrictEqual(t.inorder(), [1,2,3,4,5]); });
  it('preorder', () => { const t = new BST(); t.insert(3).insert(1).insert(5); assert.deepStrictEqual(t.preorder(), [3,1,5]); });
  it('postorder', () => { const t = new BST(); t.insert(3).insert(1).insert(5); assert.deepStrictEqual(t.postorder(), [1,5,3]); });
  it('height', () => { const t = new BST(); t.insert(3).insert(1).insert(5); assert.equal(t.height(), 2); });
  it('iterable', () => { const t = new BST(); t.insert(3).insert(1).insert(2); assert.deepStrictEqual([...t], [1,2,3]); });
  it('size', () => { const t = new BST(); t.insert(1).insert(2).insert(3); assert.equal(t.size, 3); });
  it('custom comparator', () => {
    const t = new BST((a, b) => b - a); // reverse
    t.insert(1).insert(2).insert(3);
    assert.deepStrictEqual(t.inorder(), [3, 2, 1]);
  });
});

describe('AVLTree', () => {
  it('insert and search', () => { const t = new AVLTree(); t.insert(5).insert(3).insert(7); assert.equal(t.search(5), 5); });
  it('stays balanced after sequential insert', () => {
    const t = new AVLTree();
    for (let i = 1; i <= 100; i++) t.insert(i);
    assert.ok(t.isBalanced());
    assert.ok(t.height() <= 8); // log2(100) ≈ 7
  });
  it('inorder sorted', () => {
    const t = new AVLTree();
    t.insert(50).insert(30).insert(70).insert(10).insert(40).insert(60).insert(80);
    assert.deepStrictEqual(t.inorder(), [10, 30, 40, 50, 60, 70, 80]);
  });
  it('delete and rebalance', () => {
    const t = new AVLTree();
    for (let i = 1; i <= 20; i++) t.insert(i);
    for (let i = 1; i <= 10; i++) t.delete(i);
    assert.ok(t.isBalanced());
    assert.equal(t.size, 10);
  });
  it('size', () => { const t = new AVLTree(); t.insert(1).insert(2).insert(3); assert.equal(t.size, 3); });
  it('height is logarithmic', () => {
    const t = new AVLTree();
    for (let i = 0; i < 1000; i++) t.insert(i);
    assert.ok(t.height() <= 15); // log2(1000) ≈ 10, AVL factor ~1.44
  });
});
