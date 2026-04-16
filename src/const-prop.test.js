import { strict as assert } from 'assert';
import { propagateConstants, TOP, BOTTOM, constVal, meet, isConst, latticeEqual } from './const-prop.js';

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
// Lattice operations
// ============================================================

test('meet: ⊤ ⊓ const = const', () => {
  assert.ok(latticeEqual(meet(TOP, constVal(5)), constVal(5)));
});

test('meet: const ⊓ ⊤ = const', () => {
  assert.ok(latticeEqual(meet(constVal(5), TOP), constVal(5)));
});

test('meet: same const = const', () => {
  assert.ok(latticeEqual(meet(constVal(5), constVal(5)), constVal(5)));
});

test('meet: diff const = ⊥', () => {
  assert.ok(latticeEqual(meet(constVal(5), constVal(3)), BOTTOM));
});

test('meet: ⊥ ⊓ anything = ⊥', () => {
  assert.ok(latticeEqual(meet(BOTTOM, constVal(5)), BOTTOM));
});

// ============================================================
// Simple constant propagation
// ============================================================

test('simple: let x = 5 → x_0 is 5', () => {
  const result = propagateConstants('let x = 5;');
  assert.ok(result.constants.has('x_0'));
  assert.equal(result.constants.get('x_0'), 5);
});

test('simple: let x = 5; let y = 10 → both constant', () => {
  const result = propagateConstants('let x = 5; let y = 10;');
  assert.equal(result.constants.get('x_0'), 5);
  assert.equal(result.constants.get('y_0'), 10);
});

test('arithmetic: let x = 5; let y = x + 3 → y = 8', () => {
  const result = propagateConstants('let x = 5; let y = x + 3;');
  assert.equal(result.constants.get('x_0'), 5);
  assert.equal(result.constants.get('y_0'), 8);
});

test('chained: let x = 2; let y = x * 3; let z = y + 1 → z = 7', () => {
  const result = propagateConstants('let x = 2; let y = x * 3; let z = y + 1;');
  assert.equal(result.constants.get('x_0'), 2);
  assert.equal(result.constants.get('y_0'), 6);
  assert.equal(result.constants.get('z_0'), 7);
});

test('subtraction: let x = 10; let y = x - 3 → y = 7', () => {
  const result = propagateConstants('let x = 10; let y = x - 3;');
  assert.equal(result.constants.get('y_0'), 7);
});

// ============================================================
// Non-constant (bottom)
// ============================================================

test('function call: not constant', () => {
  const result = propagateConstants('let x = puts(5);');
  // x should be BOTTOM (not constant) because puts is a function call
  assert.ok(!result.constants.has('x_0'));
});

// ============================================================
// Convergence
// ============================================================

test('converges in few iterations', () => {
  const result = propagateConstants('let x = 1; let y = 2; let z = x + y;');
  assert.ok(result.iterations > 0);
  assert.ok(result.iterations < 20);
});

test('empty program converges', () => {
  const result = propagateConstants('');
  assert.equal(result.constants.size, 0);
});

// ============================================================
// Report
// ============================================================

console.log(`\nConstant propagation tests: ${passed}/${total} passed` + (failed ? ` (${failed} failed)` : ''));
if (failed) process.exit(1);
