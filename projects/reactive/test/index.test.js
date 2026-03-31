const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Stream } = require('../src/index.js');

test('of', async () => {
  const result = await Stream.of(1, 2, 3).toArray();
  assert.deepEqual(result, [1, 2, 3]);
});

test('from', async () => {
  const result = await Stream.from([4, 5, 6]).toArray();
  assert.deepEqual(result, [4, 5, 6]);
});

test('map', async () => {
  const result = await Stream.of(1, 2, 3).map(x => x * 2).toArray();
  assert.deepEqual(result, [2, 4, 6]);
});

test('filter', async () => {
  const result = await Stream.of(1, 2, 3, 4).filter(x => x % 2 === 0).toArray();
  assert.deepEqual(result, [2, 4]);
});

test('take', async () => {
  const result = await Stream.of(1, 2, 3, 4, 5).take(3).toArray();
  assert.deepEqual(result, [1, 2, 3]);
});

test('skip', async () => {
  const result = await Stream.of(1, 2, 3, 4, 5).skip(2).toArray();
  assert.deepEqual(result, [3, 4, 5]);
});

test('scan', async () => {
  const result = await Stream.of(1, 2, 3).scan((acc, v) => acc + v, 0).toArray();
  assert.deepEqual(result, [1, 3, 6]);
});

test('reduce', async () => {
  const result = await Stream.of(1, 2, 3).reduce((acc, v) => acc + v, 0).toArray();
  assert.deepEqual(result, [6]);
});

test('distinct', async () => {
  const result = await Stream.of(1, 2, 2, 3, 1, 3).distinct().toArray();
  assert.deepEqual(result, [1, 2, 3]);
});

test('merge', async () => {
  const result = await Stream.merge(Stream.of(1, 3), Stream.of(2, 4)).toArray();
  assert.equal(result.length, 4);
  assert.ok(result.includes(1) && result.includes(4));
});

test('concat', async () => {
  const result = await Stream.concat(Stream.of(1, 2), Stream.of(3, 4)).toArray();
  assert.deepEqual(result, [1, 2, 3, 4]);
});

test('zip', async () => {
  const result = await Stream.zip(Stream.of('a', 'b'), Stream.of(1, 2)).toArray();
  assert.deepEqual(result, [['a', 1], ['b', 2]]);
});

test('chaining', async () => {
  const result = await Stream.of(1, 2, 3, 4, 5)
    .filter(x => x > 2)
    .map(x => x * 10)
    .take(2)
    .toArray();
  assert.deepEqual(result, [30, 40]);
});
