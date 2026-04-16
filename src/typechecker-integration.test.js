import { strict as assert } from 'assert';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repl = path.join(__dirname, '..', 'repl.js');

let passed = 0, failed = 0, total = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    passed++;
  } catch (e) {
    failed++;
    console.log(`  FAIL: ${name}`);
    console.log(`    ${e.message.split('\n')[0]}`);
  }
}

function run(code, expectPass = true) {
  try {
    const output = execSync(`node ${repl} --typecheck --eval '${code}'`, {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    if (!expectPass) throw new Error('Expected type error but none occurred');
    return output.trim();
  } catch (e) {
    if (expectPass) throw new Error(`Expected pass but got error: ${e.stderr || e.message}`);
    return (e.stderr || e.message).trim();
  }
}

// ============================================================
// Programs that should pass type checking
// ============================================================

test('integer arithmetic passes', () => {
  assert.equal(run('puts(5 + 3);'), '8');
});

test('annotated function passes', () => {
  assert.equal(run('let f = fn(x: int) -> int { x * 2 }; puts(f(5));'), '10');
});

test('string operations pass', () => {
  assert.equal(run('puts("hello" + " " + "world");'), 'hello world');
});

test('boolean logic passes', () => {
  assert.equal(run('puts(5 > 3);'), 'true');
});

test('array operations pass', () => {
  assert.equal(run('let arr = [1, 2, 3]; puts(len(arr));'), '3');
});

test('higher-order functions pass', () => {
  assert.equal(run('let apply = fn(f, x) { f(x) }; let double = fn(x) { x * 2 }; puts(apply(double, 5));'), '10');
});

test('recursive fibonacci passes', () => {
  assert.equal(run('let fib = fn(n: int) -> int { if (n < 2) { n } else { fib(n - 1) + fib(n - 2) } }; puts(fib(10));'), '55');
});

test('hash literals pass', () => {
  run('let h = {"a": 1, "b": 2}; puts(h["a"]);');
});

test('if-else with matching types passes', () => {
  assert.equal(run('let x = if (true) { 5 } else { 10 }; puts(x);'), '5');
});

test('closure captures pass', () => {
  assert.equal(run('let make = fn(x: int) { fn(y: int) -> int { x + y } }; let add5 = make(5); puts(add5(3));'), '8');
});

// ============================================================
// Programs that should fail type checking
// ============================================================

test('wrong return type annotation fails', () => {
  const err = run('let f = fn(x: int) -> string { x + 1 };', false);
  assert.ok(err.includes('return type mismatch'), `Expected return type error, got: ${err}`);
});

test('calling annotated fn with wrong types fails', () => {
  const err = run('let f = fn(x: int, y: int) -> int { x + y }; f("a", "b");', false);
  assert.ok(err.includes('Cannot call') || err.includes('Type'), `Expected call error, got: ${err}`);
});

test('if-else with mismatched types fails', () => {
  const err = run('let x = if (true) { 5 } else { "hello" };', false);
  assert.ok(err.includes('different types'), `Expected branch mismatch error, got: ${err}`);
});

// ============================================================
// Without --typecheck flag, type errors don't stop execution
// ============================================================

test('without --typecheck, type-wrong code runs', () => {
  const output = execSync(`node ${repl} --eval 'let f = fn(x: int) -> string { x + 1 }; puts(f(5));'`, {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8',
    timeout: 5000,
  }).trim();
  assert.equal(output, '6');
});

// ============================================================
// Report
// ============================================================

console.log(`\nTypechecker integration tests: ${passed}/${total} passed` + (failed ? ` (${failed} failed)` : ''));
if (failed) process.exit(1);
