import { strict as assert } from 'assert';
import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import { typeDirectedOptimize } from './typed-optimizer.js';
import * as ast from './ast.js';

let passed = 0, failed = 0, total = 0;

function test(name, fn) {
  total++;
  try { fn(); passed++; } catch (e) {
    failed++;
    console.log(`  FAIL: ${name}`);
    console.log(`    ${e.message}`);
  }
}

function parse(input) {
  const l = new Lexer(input);
  const p = new Parser(l);
  return p.parseProgram();
}

function optimize(input) {
  const program = parse(input);
  return typeDirectedOptimize(program);
}

// ============================================================
// Constant Folding
// ============================================================

test('fold integer addition', () => {
  const { program, stats } = optimize('let x = 2 + 3;');
  const stmt = program.statements[0];
  assert.ok(stmt.value instanceof ast.IntegerLiteral, `Expected IntegerLiteral, got ${stmt.value.constructor.name}`);
  assert.equal(stmt.value.value, 5);
  assert.ok(stats.constantsFolded > 0);
});

test('fold integer multiplication', () => {
  const { program } = optimize('let x = 6 * 7;');
  assert.equal(program.statements[0].value.value, 42);
});

test('fold integer subtraction', () => {
  const { program } = optimize('let x = 10 - 3;');
  assert.equal(program.statements[0].value.value, 7);
});

test('fold integer division', () => {
  const { program } = optimize('let x = 10 / 3;');
  assert.equal(program.statements[0].value.value, 3);
});

test('fold comparison to bool', () => {
  const { program } = optimize('let x = 5 > 3;');
  assert.ok(program.statements[0].value instanceof ast.BooleanLiteral);
  assert.equal(program.statements[0].value.value, true);
});

test('fold equality', () => {
  const { program } = optimize('let x = 5 == 5;');
  assert.equal(program.statements[0].value.value, true);
});

test('fold boolean AND', () => {
  const { program } = optimize('let x = true && false;');
  assert.equal(program.statements[0].value.value, false);
});

test('fold boolean OR', () => {
  const { program } = optimize('let x = false || true;');
  assert.equal(program.statements[0].value.value, true);
});

test('fold string concatenation', () => {
  const { program } = optimize('let x = "hello" + " world";');
  assert.ok(program.statements[0].value instanceof ast.StringLiteral);
  assert.equal(program.statements[0].value.value, 'hello world');
});

test('fold nested arithmetic', () => {
  const { program, stats } = optimize('let x = (2 + 3) * (4 + 1);');
  // Inner additions fold first, then multiplication
  assert.equal(program.statements[0].value.value, 25);
  assert.ok(stats.constantsFolded >= 3); // two additions + one multiplication
});

test('fold negation', () => {
  const { program } = optimize('let x = -5;');
  assert.equal(program.statements[0].value.value, -5);
});

test('fold NOT', () => {
  const { program } = optimize('let x = !true;');
  assert.equal(program.statements[0].value.value, false);
});

// ============================================================
// Strength Reduction
// ============================================================

test('x * 0 → 0', () => {
  const { program, stats } = optimize('let y = x * 0;');
  assert.equal(program.statements[0].value.value, 0);
  assert.ok(stats.strengthReductions > 0);
});

test('x * 1 → x', () => {
  const { program, stats } = optimize('let y = x * 1;');
  assert.ok(program.statements[0].value instanceof ast.Identifier);
  assert.equal(program.statements[0].value.value, 'x');
  assert.ok(stats.strengthReductions > 0);
});

test('x + 0 → x', () => {
  const { program, stats } = optimize('let y = x + 0;');
  assert.ok(program.statements[0].value instanceof ast.Identifier);
  assert.ok(stats.strengthReductions > 0);
});

test('0 + x → x', () => {
  const { program } = optimize('let y = 0 + x;');
  assert.ok(program.statements[0].value instanceof ast.Identifier);
});

test('x - 0 → x', () => {
  const { program } = optimize('let y = x - 0;');
  assert.ok(program.statements[0].value instanceof ast.Identifier);
});

test('x / 1 → x', () => {
  const { program } = optimize('let y = x / 1;');
  assert.ok(program.statements[0].value instanceof ast.Identifier);
});

test('x * 2 → x + x', () => {
  const { program, stats } = optimize('let y = x * 2;');
  assert.ok(program.statements[0].value instanceof ast.InfixExpression);
  assert.equal(program.statements[0].value.operator, '+');
  assert.ok(stats.strengthReductions > 0);
});

// ============================================================
// Dead Branch Elimination
// ============================================================

test('if (true) eliminates else', () => {
  const { program, stats } = optimize('let x = if (true) { 5 } else { 10 };');
  // Should fold to the consequence block
  assert.ok(stats.branchesEliminated > 0);
});

test('if (false) eliminates then', () => {
  const { program, stats } = optimize('let x = if (false) { 5 } else { 10 };');
  assert.ok(stats.branchesEliminated > 0);
});

test('if with folded condition', () => {
  const { program, stats } = optimize('let x = if (5 > 3) { "yes" } else { "no" };');
  // 5 > 3 folds to true, then "yes" branch is taken
  assert.ok(stats.constantsFolded > 0);
  assert.ok(stats.branchesEliminated > 0);
});

// ============================================================
// Function body optimization
// ============================================================

test('optimize inside function body', () => {
  const { program, stats } = optimize('let f = fn(x) { 2 + 3 };');
  assert.ok(stats.constantsFolded > 0);
});

test('optimize call arguments', () => {
  const { program, stats } = optimize('puts(2 + 3);');
  assert.ok(stats.constantsFolded > 0);
});

// ============================================================
// No optimization when not applicable
// ============================================================

test('variable expressions unchanged', () => {
  const { program, stats } = optimize('let y = x + z;');
  assert.equal(stats.totalOptimizations, 0);
  assert.ok(program.statements[0].value instanceof ast.InfixExpression);
});

test('division by zero not folded', () => {
  const { program } = optimize('let x = 10 / 0;');
  assert.ok(program.statements[0].value instanceof ast.InfixExpression);
});

// ============================================================
// Stats
// ============================================================

test('stats track total optimizations', () => {
  const { stats } = optimize('let x = (2 + 3) * (4 + 1) + 0;');
  assert.ok(stats.totalOptimizations >= 3);
});

// ============================================================
// Report
// ============================================================

console.log(`\nTyped optimizer tests: ${passed}/${total} passed` + (failed ? ` (${failed} failed)` : ''));
if (failed) process.exit(1);
