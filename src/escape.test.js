import { strict as assert } from 'assert';
import { EscapeAnalyzer, STACK, HEAP } from './escape.js';

let passed = 0, failed = 0, total = 0;

function test(name, fn) {
  total++;
  try { fn(); passed++; } catch (e) {
    failed++;
    console.log(`  FAIL: ${name}`);
    console.log(`    ${e.message}`);
  }
}

function analyze(source) {
  const ea = new EscapeAnalyzer();
  return ea.analyzeSource(source);
}

// ============================================================
// Stack-allocatable (no escape)
// ============================================================

test('local variable: stack-allocatable', () => {
  const result = analyze('let x = 5;');
  assert.ok(result.stackAllocatable.includes('x'));
});

test('local used only in arithmetic: stack', () => {
  const result = analyze('let x = 5; let y = x + 1;');
  assert.ok(result.stackAllocatable.includes('x'));
});

test('local array used locally: stack', () => {
  const result = analyze('let arr = [1, 2, 3];');
  assert.ok(result.stackAllocatable.includes('arr'));
});

// ============================================================
// Heap-required (escapes)
// ============================================================

test('returned variable: heap', () => {
  const result = analyze('let x = 5; return x;');
  assert.ok(result.heapRequired.some(h => h.name === 'x'));
});

test('passed to function: heap (conservative)', () => {
  const result = analyze('let x = 5; puts(x);');
  assert.ok(result.heapRequired.some(h => h.name === 'x'));
});

// ============================================================
// Closure analysis
// ============================================================

test('closure defined but not escaping: stack', () => {
  const result = analyze('let f = fn(x) { x + 1; };');
  assert.ok(result.stackAllocatable.includes('f'));
});

test('closure passed to function: heap', () => {
  const result = analyze('let f = fn(x) { x + 1; }; puts(f);');
  assert.ok(result.heapRequired.some(h => h.name === 'f'));
});

// ============================================================
// Escape reasons
// ============================================================

test('escape reason: returned', () => {
  const result = analyze('let x = [1,2,3]; return x;');
  const xInfo = result.heapRequired.find(h => h.name === 'x');
  assert.ok(xInfo);
  assert.ok(xInfo.reasons.some(r => r.includes('returned') || r.includes('escaping')));
});

test('escape reason: passed as argument', () => {
  const result = analyze('let x = 42; puts(x);');
  const xInfo = result.heapRequired.find(h => h.name === 'x');
  assert.ok(xInfo);
  assert.ok(xInfo.reasons.some(r => r.includes('argument') || r.includes('escaping')));
});

// ============================================================
// Mixed programs
// ============================================================

test('mixed: some escape, some dont', () => {
  const result = analyze(`
    let x = 5;
    let y = 10;
    let z = x + y;
    return z;
  `);
  // z escapes (returned), x and y might be marked as escaping or stack
  assert.ok(result.heapRequired.some(h => h.name === 'z'));
});

test('empty program', () => {
  const result = analyze('');
  assert.equal(result.stackAllocatable.length, 0);
  assert.equal(result.heapRequired.length, 0);
});

// ============================================================
// Report
// ============================================================

console.log(`\nEscape analysis tests: ${passed}/${total} passed` + (failed ? ` (${failed} failed)` : ''));
if (failed) process.exit(1);
