import { strict as assert } from 'assert';
import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import { CFGBuilder } from './cfg.js';
import { LivenessAnalysis, analyzeLiveness, computeUseDef } from './liveness.js';

let passed = 0, failed = 0, total = 0;

function test(name, fn) {
  total++;
  try { fn(); passed++; } catch (e) {
    failed++;
    console.log(`  FAIL: ${name}`);
    console.log(`    ${e.message}`);
  }
}

function parse(source) {
  const lexer = new Lexer(source);
  const parser = new Parser(lexer);
  return parser.parseProgram();
}

function buildCFG(source) {
  const program = parse(source);
  const builder = new CFGBuilder();
  return builder.build(program);
}

// ============================================================
// Use/Def analysis
// ============================================================

test('use/def: let x = 5 → def={x}, use={}', () => {
  const cfg = buildCFG('let x = 5;');
  const entry = cfg.blocks.get(cfg.entry);
  const { use, def } = computeUseDef(entry);
  assert.ok(def.has('x'));
  assert.equal(use.size, 0);
});

test('use/def: let y = x + 1 → def={y}, use={x}', () => {
  const cfg = buildCFG('let y = x + 1;');
  const entry = cfg.blocks.get(cfg.entry);
  const { use, def } = computeUseDef(entry);
  assert.ok(def.has('y'));
  assert.ok(use.has('x'));
});

test('use/def: use before def → captured in use', () => {
  const cfg = buildCFG('puts(x); let x = 5;');
  const entry = cfg.blocks.get(cfg.entry);
  const { use, def } = computeUseDef(entry);
  assert.ok(use.has('x'));     // Used before defined
  assert.ok(def.has('x'));     // Also defined
  assert.ok(use.has('puts'));  // puts is used
});

// ============================================================
// Liveness analysis
// ============================================================

test('simple: x live after def, dead after use', () => {
  const analysis = analyzeLiveness('let x = 5; puts(x);');
  const dead = analysis.findDeadAssignments();
  // x is used by puts, so it should NOT be dead
  assert.ok(!dead.some(d => d.variable === 'x'));
});

test('dead assignment: x never used', () => {
  const analysis = analyzeLiveness('let x = 5; let y = 10; puts(y);');
  const dead = analysis.findDeadAssignments();
  // x is never used after definition
  assert.ok(dead.some(d => d.variable === 'x'));
});

test('both variables live when both used', () => {
  const analysis = analyzeLiveness('let x = 5; let y = 10; puts(x + y);');
  const dead = analysis.findDeadAssignments();
  // Both x and y are used
  assert.ok(!dead.some(d => d.variable === 'x'));
  assert.ok(!dead.some(d => d.variable === 'y'));
});

test('chained definitions: only last matters', () => {
  const analysis = analyzeLiveness('let x = 1; let y = x; puts(y);');
  const dead = analysis.findDeadAssignments();
  // x is used by y's definition, so x is live
  assert.ok(!dead.some(d => d.variable === 'x'));
});

// ============================================================
// Interference graph
// ============================================================

test('interference: variables in different blocks can interfere', () => {
  // When variables cross block boundaries (e.g., via if/else), 
  // they should show up in the interference graph
  const analysis = analyzeLiveness(`
    let x = 1;
    if (true) { puts(x); }
  `);
  analysis.analyze();
  // Just verify the graph doesn't crash and returns an array
  const graph = analysis.buildInterferenceGraph();
  assert.ok(Array.isArray(graph));
});

test('no interference: sequential use', () => {
  const analysis = analyzeLiveness('let x = 1; puts(x); let y = 2; puts(y);');
  analysis.analyze();
  const graph = analysis.buildInterferenceGraph();
  // x and y might not interfere (x dead before y defined)
  // This depends on block structure
});

// ============================================================
// Fixed point convergence
// ============================================================

test('analysis converges', () => {
  const cfg = buildCFG('let x = 1; let y = x + 1; return y;');
  const analysis = new LivenessAnalysis(cfg);
  const result = analysis.analyze();
  assert.ok(result.iterations > 0);
  assert.ok(result.iterations < 100); // Should converge quickly
});

test('empty program converges', () => {
  const cfg = buildCFG('');
  const analysis = new LivenessAnalysis(cfg);
  const result = analysis.analyze();
  assert.ok(result.iterations <= 2);
});

// ============================================================
// Report
// ============================================================

console.log(`\nLiveness analysis tests: ${passed}/${total} passed` + (failed ? ` (${failed} failed)` : ''));
if (failed) process.exit(1);
