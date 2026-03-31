const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Arena, Pool, StackAllocator } = require('../src/index.js');

test('arena — basic alloc', () => {
  const arena = new Arena(256);
  const p1 = arena.alloc(16);
  const p2 = arena.alloc(32);
  assert.equal(p1, 0);
  assert.equal(p2, 16);
  assert.equal(arena.used(), 48);
});

test('arena — alignment', () => {
  const arena = new Arena(256);
  arena.alloc(3); // offset = 3
  const p = arena.alloc(4, 4); // should align to 4
  assert.equal(p, 4);
});

test('arena — out of memory', () => {
  const arena = new Arena(16);
  assert.notEqual(arena.alloc(8), null);
  assert.notEqual(arena.alloc(8), null);
  assert.equal(arena.alloc(1), null); // full
});

test('arena — read/write', () => {
  const arena = new Arena(64);
  const p = arena.allocTyped('i32');
  arena.write(p, 42, 'i32');
  assert.equal(arena.read(p, 'i32'), 42);
});

test('arena — float', () => {
  const arena = new Arena(64);
  const p = arena.allocTyped('f64');
  arena.write(p, 3.14159, 'f64');
  assert.ok(Math.abs(arena.read(p, 'f64') - 3.14159) < 0.0001);
});

test('arena — reset', () => {
  const arena = new Arena(64);
  arena.alloc(32);
  assert.equal(arena.used(), 32);
  arena.reset();
  assert.equal(arena.used(), 0);
});

test('arena — bytes', () => {
  const arena = new Arena(64);
  const p = arena.alloc(4);
  arena.writeBytes(p, new Uint8Array([1, 2, 3, 4]));
  assert.deepEqual([...arena.readBytes(p, 4)], [1, 2, 3, 4]);
});

test('pool — alloc/free', () => {
  const pool = new Pool(8, 4);
  const p1 = pool.alloc();
  const p2 = pool.alloc();
  assert.notEqual(p1, null);
  assert.notEqual(p2, null);
  assert.equal(pool.used, 2);
  pool.free(p1);
  assert.equal(pool.used, 1);
  assert.equal(pool.available, 3);
});

test('pool — exhaustion', () => {
  const pool = new Pool(4, 2);
  pool.alloc();
  pool.alloc();
  assert.equal(pool.alloc(), null);
});

test('pool — reuse freed slot', () => {
  const pool = new Pool(4, 2);
  const p1 = pool.alloc();
  pool.alloc();
  pool.free(p1);
  const p3 = pool.alloc();
  assert.equal(p3, p1); // reuses freed slot
});

test('stack allocator — push/pop marker', () => {
  const stack = new StackAllocator(256);
  stack.alloc(16);
  stack.pushMarker();
  stack.alloc(32);
  assert.equal(stack.used(), 48);
  stack.popMarker();
  assert.equal(stack.used(), 16);
});

test('stack allocator — nested markers', () => {
  const stack = new StackAllocator(256);
  stack.alloc(10);
  stack.pushMarker();
  stack.alloc(20);
  stack.pushMarker();
  stack.alloc(30);
  assert.equal(stack.used(), 60);
  stack.popMarker();
  assert.equal(stack.used(), 30);
  stack.popMarker();
  assert.equal(stack.used(), 10);
});
