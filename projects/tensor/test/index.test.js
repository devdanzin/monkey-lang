const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Tensor } = require('../src/index.js');

test('create from array', () => {
  const t = new Tensor([[1, 2], [3, 4]]);
  assert.deepEqual(t.shape, [2, 2]);
  assert.equal(t.get([0, 1]), 2);
  assert.equal(t.get([1, 0]), 3);
});

test('zeros and ones', () => {
  const z = Tensor.zeros([2, 3]);
  assert.equal(z.sum(), 0);
  assert.deepEqual(z.shape, [2, 3]);
  
  const o = Tensor.ones([3, 2]);
  assert.equal(o.sum(), 6);
});

test('arange', () => {
  const t = Tensor.arange(5);
  assert.deepEqual(t.toArray(), [0, 1, 2, 3, 4]);
});

test('reshape', () => {
  const t = Tensor.arange(6).reshape([2, 3]);
  assert.deepEqual(t.shape, [2, 3]);
  assert.equal(t.get([1, 2]), 5);
});

test('element-wise ops', () => {
  const a = new Tensor([1, 2, 3], [3]);
  const b = new Tensor([4, 5, 6], [3]);
  assert.deepEqual(a.add(b).toArray(), [5, 7, 9]);
  assert.deepEqual(a.mul(b).toArray(), [4, 10, 18]);
  assert.deepEqual(a.add(10).toArray(), [11, 12, 13]);
});

test('sum / mean / max / min', () => {
  const t = new Tensor([[1, 2], [3, 4]]);
  assert.equal(t.sum(), 10);
  assert.equal(t.mean(), 2.5);
  assert.equal(t.max(), 4);
  assert.equal(t.min(), 1);
});

test('axis reduction', () => {
  const t = new Tensor([[1, 2, 3], [4, 5, 6]]);
  assert.deepEqual(t.sum(0).toArray(), [5, 7, 9]);
  assert.deepEqual(t.sum(1).toArray(), [6, 15]);
});

test('matmul', () => {
  const a = new Tensor([[1, 2], [3, 4]]);
  const b = new Tensor([[5, 6], [7, 8]]);
  const c = a.matmul(b);
  assert.deepEqual(c.toArray(), [[19, 22], [43, 50]]);
});

test('transpose', () => {
  const t = new Tensor([[1, 2, 3], [4, 5, 6]]);
  const tr = t.transpose();
  assert.deepEqual(tr.shape, [3, 2]);
  assert.deepEqual(tr.toArray(), [[1, 4], [2, 5], [3, 6]]);
});

test('identity matrix', () => {
  const I = Tensor.eye(3);
  assert.equal(I.get([0, 0]), 1);
  assert.equal(I.get([0, 1]), 0);
  assert.equal(I.get([2, 2]), 1);
});

test('map / neg / abs', () => {
  const t = new Tensor([-1, 2, -3], [3]);
  assert.deepEqual(t.abs().toArray(), [1, 2, 3]);
  assert.deepEqual(t.neg().toArray(), [1, -2, 3]);
});
