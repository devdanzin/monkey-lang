import { strict as assert } from 'assert';
import { RegisterAllocator, LinearScanAllocator } from './regalloc.js';

let passed = 0, failed = 0, total = 0;

function test(name, fn) {
  total++;
  try { fn(); passed++; } catch (e) {
    failed++;
    console.log(`  FAIL: ${name}`);
    console.log(`    ${e.message}`);
  }
}

// ============================================================
// Graph coloring register allocation
// ============================================================

test('no interference: all get registers', () => {
  const alloc = new RegisterAllocator(4);
  const result = alloc.allocate([]);
  assert.equal(result.spilled.length, 0);
});

test('two interfering vars: different registers', () => {
  const alloc = new RegisterAllocator(4);
  const result = alloc.allocate([['x', 'y']]);
  assert.notEqual(result.allocation.get('x'), result.allocation.get('y'));
  assert.equal(result.spilled.length, 0);
});

test('triangle: 3 vars all interfering', () => {
  const alloc = new RegisterAllocator(3);
  const result = alloc.allocate([['x', 'y'], ['y', 'z'], ['x', 'z']]);
  assert.notEqual(result.allocation.get('x'), result.allocation.get('y'));
  assert.notEqual(result.allocation.get('y'), result.allocation.get('z'));
  assert.notEqual(result.allocation.get('x'), result.allocation.get('z'));
  assert.equal(result.spilled.length, 0);
});

test('4 vars, 3 colors: K4 requires spill', () => {
  // Complete graph K4 with only 3 colors → must spill
  const alloc = new RegisterAllocator(3);
  const result = alloc.allocate([
    ['a', 'b'], ['a', 'c'], ['a', 'd'],
    ['b', 'c'], ['b', 'd'],
    ['c', 'd']
  ]);
  assert.ok(result.spilled.length >= 1);
});

test('chain: x-y-z (2 colors sufficient)', () => {
  const alloc = new RegisterAllocator(2);
  const result = alloc.allocate([['x', 'y'], ['y', 'z']]);
  // x and z can share a register since they don't interfere
  assert.notEqual(result.allocation.get('x'), result.allocation.get('y'));
  assert.notEqual(result.allocation.get('y'), result.allocation.get('z'));
  assert.equal(result.allocation.get('x'), result.allocation.get('z')); // Can share!
  assert.equal(result.spilled.length, 0);
});

test('star graph: center interferes with all', () => {
  const alloc = new RegisterAllocator(4);
  const result = alloc.allocate([['c', 'a'], ['c', 'b'], ['c', 'd']]);
  // Center gets one color, rest can share (they don't interfere with each other)
  assert.equal(result.spilled.length, 0);
});

// ============================================================
// Linear scan register allocation
// ============================================================

test('linear scan: non-overlapping ranges share registers', () => {
  const alloc = new LinearScanAllocator(2);
  const result = alloc.allocate(['x', 'y'], new Map([
    ['x', { start: 0, end: 5 }],
    ['y', { start: 6, end: 10 }],
  ]));
  assert.notEqual(result.allocation.get('x'), 'spill');
  assert.notEqual(result.allocation.get('y'), 'spill');
});

test('linear scan: overlapping ranges need different registers', () => {
  const alloc = new LinearScanAllocator(2);
  const result = alloc.allocate(['x', 'y'], new Map([
    ['x', { start: 0, end: 10 }],
    ['y', { start: 5, end: 15 }],
  ]));
  assert.notEqual(result.allocation.get('x'), result.allocation.get('y'));
});

test('linear scan: spill when out of registers', () => {
  const alloc = new LinearScanAllocator(1);
  const result = alloc.allocate(['x', 'y'], new Map([
    ['x', { start: 0, end: 10 }],
    ['y', { start: 5, end: 15 }],
  ]));
  assert.ok(result.spilled.length >= 1);
});

test('linear scan: 3 vars, 2 regs, 1 spill', () => {
  const alloc = new LinearScanAllocator(2);
  const result = alloc.allocate(['a', 'b', 'c'], new Map([
    ['a', { start: 0, end: 10 }],
    ['b', { start: 2, end: 8 }],
    ['c', { start: 4, end: 12 }],
  ]));
  // All three overlap → need 3 registers, only have 2
  assert.ok(result.spilled.length >= 1);
});

// ============================================================
// Report
// ============================================================

console.log(`\nRegister allocator tests: ${passed}/${total} passed` + (failed ? ` (${failed} failed)` : ''));
if (failed) process.exit(1);
