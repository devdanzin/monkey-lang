import { strict as assert } from 'assert';
import { traceInference, formatTrace } from './type-tracer.js';

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
// Basic tracing
// ============================================================

test('trace literal', () => {
  const trace = traceInference('5');
  assert.ok(trace.steps.length > 0);
  assert.ok(trace.steps.some(s => s.type === 'infer'));
});

test('trace let binding', () => {
  const trace = traceInference('let x = 5;');
  assert.ok(trace.steps.some(s => s.type === 'generalize'));
});

test('trace function', () => {
  const trace = traceInference('let f = fn(x) { x };');
  assert.ok(trace.steps.some(s => s.type === 'generalize'));
  const genStep = trace.steps.find(s => s.type === 'generalize');
  assert.ok(genStep.data.name === 'f');
});

test('trace function application', () => {
  const trace = traceInference('let f = fn(x) { x }; f(5);');
  assert.ok(trace.steps.some(s => s.type === 'unify'));
  assert.ok(trace.steps.some(s => s.type === 'instantiate'));
});

test('trace shows unification', () => {
  const trace = traceInference('let x = 5 + 3;');
  const unifySteps = trace.steps.filter(s => s.type === 'unify');
  assert.ok(unifySteps.length > 0);
  assert.ok(unifySteps.every(s => s.data.success));
});

test('trace shows substitution', () => {
  const trace = traceInference('let f = fn(x) { x }; f(5);');
  const substSteps = trace.steps.filter(s => s.type === 'subst');
  assert.ok(substSteps.length > 0);
});

// ============================================================
// Error tracing
// ============================================================

test('trace type error', () => {
  const trace = traceInference('let x = 5; let y = if (true) { x } else { "hello" };');
  assert.ok(trace.errors.length > 0 || trace.steps.some(s => s.type === 'error' || (s.type === 'unify' && !s.data.success)));
});

test('trace undefined variable', () => {
  const trace = traceInference('y + 1;');
  assert.ok(trace.steps.some(s => s.type === 'error') || trace.errors.length > 0);
});

// ============================================================
// Format output
// ============================================================

test('format trace produces string', () => {
  const trace = traceInference('let x = 5; let y = x + 1;');
  const output = formatTrace(trace);
  assert.ok(typeof output === 'string');
  assert.ok(output.length > 0);
});

test('format trace shows INFER steps', () => {
  const trace = traceInference('5 + 3');
  const output = formatTrace(trace);
  assert.ok(output.includes('INFER'));
});

// ============================================================
// Complex programs
// ============================================================

test('trace polymorphic id', () => {
  const trace = traceInference('let id = fn(x) { x }; id(5); id("hello");');
  // Should show instantiate twice (once for each call)
  const instSteps = trace.steps.filter(s => s.type === 'instantiate');
  assert.ok(instSteps.length >= 2, `Expected 2+ instantiations, got ${instSteps.length}`);
});

test('trace higher-order function', () => {
  const trace = traceInference('let apply = fn(f, x) { f(x) }; let double = fn(x) { x * 2 }; apply(double, 5);');
  assert.ok(trace.steps.some(s => s.type === 'unify'));
  assert.ok(trace.errors.length === 0);
});

test('trace recursive function', () => {
  const trace = traceInference('let fib = fn(n) { if (n < 2) { n } else { fib(n - 1) + fib(n - 2) } };');
  // Should show generalization of fib
  const genSteps = trace.steps.filter(s => s.type === 'generalize');
  assert.ok(genSteps.some(s => s.data.name === 'fib'));
});

// ============================================================
// Report
// ============================================================

console.log(`\nType tracer tests: ${passed}/${total} passed` + (failed ? ` (${failed} failed)` : ''));
if (failed) process.exit(1);
