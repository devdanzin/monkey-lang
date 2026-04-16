import { strict as assert } from 'assert';
import { TypeAnnotator, getTypeInfo, formatHover } from './type-info.js';

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
// Basic type info
// ============================================================

test('integer variable', () => {
  const { types } = getTypeInfo('let x = 5;');
  assert.ok(types.some(t => t.includes('x') && t.includes('int')));
});

test('string variable', () => {
  const { types } = getTypeInfo('let s = "hello";');
  assert.ok(types.some(t => t.includes('s') && t.includes('string')));
});

test('boolean variable', () => {
  const { types } = getTypeInfo('let b = true;');
  assert.ok(types.some(t => t.includes('b') && t.includes('bool')));
});

test('arithmetic result is Int', () => {
  const { types } = getTypeInfo('let r = 2 + 3;');
  assert.ok(types.some(t => t.includes('r') && t.includes('int')));
});

test('string concat result is String', () => {
  const { types } = getTypeInfo('let r = "a" + "b";');
  assert.ok(types.some(t => t.includes('r') && t.includes('string')));
});

// ============================================================
// Function types
// ============================================================

test('function type', () => {
  const { types } = getTypeInfo('let add = fn(x, y) { x + y; };');
  assert.ok(types.some(t => t.includes('add')));
});

test('function with return type', () => {
  const { types } = getTypeInfo('let double = fn(x) { x * 2; };');
  assert.ok(types.some(t => t.includes('double')));
});

// ============================================================
// Array types
// ============================================================

test('array of integers', () => {
  const { types } = getTypeInfo('let arr = [1, 2, 3];');
  assert.ok(types.some(t => t.includes('arr') && (t.includes('[int]') || t.includes('array'))));
});

// ============================================================
// Hover info
// ============================================================

test('hover: finds variable at position', () => {
  const annotator = new TypeAnnotator();
  annotator.analyze('let x = 5;');
  const annotations = annotator.getAllAnnotations();
  assert.ok(annotations.length > 0);
  assert.ok(annotations.some(a => a.name === 'x'));
});

test('hover: returns null for empty position', () => {
  const result = formatHover('let x = 5;', 99, 99);
  assert.equal(result, null);
});

// ============================================================
// Error handling
// ============================================================

test('parse errors reported', () => {
  const { errors } = getTypeInfo('let = ;');
  assert.ok(errors.length > 0);
});

test('empty program', () => {
  const { types, errors } = getTypeInfo('');
  assert.equal(types.length, 0);
});

// ============================================================
// Complex programs
// ============================================================

test('multiple let bindings', () => {
  const { types } = getTypeInfo(`
    let x = 5;
    let y = "hello";
    let z = true;
  `);
  assert.ok(types.some(t => t.includes('x') && t.includes('int')));
  assert.ok(types.some(t => t.includes('y') && t.includes('string')));
  assert.ok(types.some(t => t.includes('z') && t.includes('bool')));
});

test('if expression', () => {
  const { types } = getTypeInfo('let r = if (true) { 1 } else { 2 };');
  assert.ok(types.some(t => t.includes('r')));
});

// ============================================================
// Report
// ============================================================

console.log(`\nType info tests: ${passed}/${total} passed` + (failed ? ` (${failed} failed)` : ''));
if (failed) process.exit(1);
