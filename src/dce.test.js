import { strict as assert } from 'assert';
import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import { DeadCodeEliminator, findDeadVariables } from './dce.js';

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

// ============================================================
// Dead code after return
// ============================================================

test('removes code after return', () => {
  const dce = new DeadCodeEliminator();
  const result = dce.eliminateSource('return 1; let x = 2; let y = 3;');
  assert.equal(result.program.statements.length, 1);
  assert.equal(result.eliminated, 2);
});

test('keeps code before return', () => {
  const dce = new DeadCodeEliminator();
  const result = dce.eliminateSource('let x = 1; return x;');
  assert.equal(result.program.statements.length, 2);
  assert.equal(result.eliminated, 0);
});

test('no return: keeps everything', () => {
  const dce = new DeadCodeEliminator();
  const result = dce.eliminateSource('let x = 1; let y = 2;');
  assert.equal(result.program.statements.length, 2);
  assert.equal(result.eliminated, 0);
});

// ============================================================
// Constant if-condition elimination
// ============================================================

test('if(true): eliminates else branch', () => {
  const dce = new DeadCodeEliminator();
  const result = dce.eliminateSource('if (true) { let x = 1; } else { let y = 2; }');
  assert.ok(result.eliminated > 0);
  assert.ok(result.warnings.some(w => w.includes('if (true)')));
});

test('if(false): eliminates then branch', () => {
  const dce = new DeadCodeEliminator();
  const result = dce.eliminateSource('if (false) { let x = 1; } else { let y = 2; }');
  assert.ok(result.eliminated > 0);
  assert.ok(result.warnings.some(w => w.includes('if (false)')));
});

test('if(false) with no else: eliminates entire if', () => {
  const dce = new DeadCodeEliminator();
  const result = dce.eliminateSource('if (false) { let x = 1; }');
  assert.ok(result.eliminated > 0);
});

// ============================================================
// Dead variable detection
// ============================================================

test('finds dead variable: assigned but never read', () => {
  const program = parse('let x = 5; let y = 10; puts(y);');
  const dead = findDeadVariables(program);
  assert.ok(dead.some(d => d.name === 'x'));
  assert.ok(!dead.some(d => d.name === 'y'));
});

test('no dead variables when all used', () => {
  const program = parse('let x = 5; let y = x + 1; puts(y);');
  const dead = findDeadVariables(program);
  assert.equal(dead.length, 0);
});

test('dead variable in complex expression', () => {
  const program = parse('let a = 1; let b = 2; let c = a + b;');
  const dead = findDeadVariables(program);
  assert.ok(dead.some(d => d.name === 'c'));
  assert.ok(!dead.some(d => d.name === 'a'));
  assert.ok(!dead.some(d => d.name === 'b'));
});

test('function params are read', () => {
  const program = parse('let f = fn(x) { x + 1; }; f(5);');
  const dead = findDeadVariables(program);
  assert.ok(!dead.some(d => d.name === 'f'));
});

// ============================================================
// Warnings
// ============================================================

test('warnings generated for dead code', () => {
  const dce = new DeadCodeEliminator();
  const result = dce.eliminateSource('return 1; let x = 2;');
  assert.ok(result.warnings.length > 0);
  assert.ok(result.warnings.some(w => w.includes('Dead code')));
});

// ============================================================
// Edge cases
// ============================================================

test('empty program', () => {
  const dce = new DeadCodeEliminator();
  const result = dce.eliminateSource('');
  assert.equal(result.program.statements.length, 0);
  assert.equal(result.eliminated, 0);
});

test('only return', () => {
  const dce = new DeadCodeEliminator();
  const result = dce.eliminateSource('return 42;');
  assert.equal(result.program.statements.length, 1);
  assert.equal(result.eliminated, 0);
});

// ============================================================
// Report
// ============================================================

console.log(`\nDCE tests: ${passed}/${total} passed` + (failed ? ` (${failed} failed)` : ''));
if (failed) process.exit(1);
