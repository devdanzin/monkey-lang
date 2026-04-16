import { strict as assert } from 'assert';
import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import { typecheck, tInt, tBool, tString, tFloat, TFun, TArray } from './typechecker.js';

let passed = 0, failed = 0, total = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    passed++;
  } catch (e) {
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

function checkOk(input) {
  const program = parse(input);
  const result = typecheck(program);
  assert.deepStrictEqual(result.errors, [], `Expected no errors for: ${input}\nGot: ${result.errors.map(e => e.message).join(', ')}`);
  return result;
}

function checkErrors(input, expectedCount) {
  const program = parse(input);
  const result = typecheck(program);
  assert.ok(result.errors.length >= expectedCount,
    `Expected ${expectedCount}+ errors for: ${input}\nGot ${result.errors.length}: ${result.errors.map(e => e.message).join(', ')}`);
  return result;
}

function checkHasError(input, pattern) {
  const program = parse(input);
  const result = typecheck(program);
  const found = result.errors.some(e => e.message.includes(pattern));
  assert.ok(found, `Expected error matching "${pattern}" for: ${input}\nGot: ${result.errors.map(e => e.message).join(', ')}`);
  return result;
}

// ============================================================
// Integer literals and arithmetic
// ============================================================

test('integer literal', () => checkOk('5'));
test('boolean literal', () => checkOk('true'));
test('string literal', () => checkOk('"hello"'));

test('integer arithmetic', () => checkOk('let x = 5 + 3;'));
test('string concatenation', () => checkOk('let x = "hello" + " world";'));

test('let binding infers type', () => {
  checkOk('let x = 5; let y = x + 3;');
});

test('boolean operations', () => {
  checkOk('let x = true && false;');
  checkOk('let y = !true;');
});

// ============================================================
// Type annotations on functions
// ============================================================

test('function with correct annotations', () => {
  checkOk('let add = fn(x: int, y: int) -> int { x + y };');
});

test('function with wrong return type annotation', () => {
  checkHasError(
    'let f = fn(x: int) -> string { x + 1 };',
    'return type mismatch'
  );
});

test('function without annotations', () => {
  checkOk('let f = fn(x, y) { x + y };');
});

test('function applied to wrong argument types', () => {
  checkHasError(
    'let add = fn(x: int, y: int) -> int { x + y }; add("hello", "world");',
    'Cannot call'
  );
});

// ============================================================
// If expressions
// ============================================================

test('if with matching branch types', () => {
  checkOk('let x = if (true) { 5 } else { 10 };');
});

test('if with mismatched branch types', () => {
  checkHasError(
    'let x = if (true) { 5 } else { "hello" };',
    'different types'
  );
});

// ============================================================
// Arrays
// ============================================================

test('integer array', () => {
  checkOk('let arr = [1, 2, 3];');
});

test('empty array', () => {
  checkOk('let arr = [];');
});

test('array index returns element type', () => {
  checkOk('let arr = [1, 2, 3]; let x = arr[0]; let y = x + 1;');
});

// ============================================================
// Hash literals
// ============================================================

test('hash literal', () => {
  checkOk('let h = {"a": 1, "b": 2};');
});

// ============================================================
// Variable assignment type checking
// ============================================================

test('assignment matches type', () => {
  checkOk('let x = 5; set x = 10;');
});

test('assignment type mismatch', () => {
  checkHasError(
    'let x = 5; set x = "hello";',
    'Cannot assign'
  );
});

// ============================================================
// Undefined variables
// ============================================================

test('undefined variable error', () => {
  checkHasError('x + 1;', 'Undefined variable');
});

// ============================================================
// Built-in functions
// ============================================================

test('len returns int', () => {
  checkOk('let x = len("hello"); let y = x + 1;');
});

test('puts is callable', () => {
  checkOk('puts("hello");');
});

// ============================================================
// Pipe operator
// ============================================================

test('pipe operator with function', () => {
  checkOk('let double = fn(x) { x * 2 }; let result = 5 |> double;');
});

// ============================================================
// Comparison operators
// ============================================================

test('comparison returns bool', () => {
  checkOk('let x = 5 > 3; let y = x && true;');
});

test('equality returns bool', () => {
  checkOk('let x = 5 == 5; let y = !x;');
});

// ============================================================
// Nested functions
// ============================================================

test('nested function type inference', () => {
  checkOk(`
    let make_adder = fn(x: int) {
      fn(y: int) -> int { x + y }
    };
  `);
});

test('higher-order function', () => {
  checkOk(`
    let apply = fn(f, x) { f(x) };
    let double = fn(x) { x * 2 };
    let result = apply(double, 5);
  `);
});

// ============================================================
// Template literals / f-strings
// ============================================================

test('template literal is string', () => {
  checkOk('let name = "world"; let msg = "hello " + name;');
});

// ============================================================
// Complex programs
// ============================================================

test('fibonacci function', () => {
  checkOk(`
    let fib = fn(n: int) -> int {
      if (n < 2) { n } else { fib(n - 1) + fib(n - 2) }
    };
  `);
});

test('map over array', () => {
  checkOk(`
    let map = fn(arr, f) {
      let result = [];
      result
    };
  `);
});

test('multiple let bindings with consistent types', () => {
  checkOk(`
    let x = 5;
    let y = 10;
    let z = x + y;
    let result = z * 2;
  `);
});

// ============================================================
// Let-polymorphism
// ============================================================

test('polymorphic identity function', () => {
  checkOk('let id = fn(x) { x }; let a = id(5); let b = id("hello");');
});

test('polymorphic id used with int then string', () => {
  checkOk('let id = fn(x) { x }; let a = id(5) + 1; let b = id("hi") + "!";');
});

test('polymorphic const (K combinator)', () => {
  checkOk('let k = fn(x) { fn(y) { x } }; let a = k(5)("hello"); let b = k("hi")(42);');
});

// ============================================================
// Error detection
// ============================================================

test('negate string error', () => {
  checkHasError('let x = -"hello";', 'Cannot negate');
});

test('call non-function error', () => {
  checkHasError('let x = 5; x(3);', 'Cannot call');
});

test('wrong arity error', () => {
  checkHasError('let f = fn(x, y) { x + y }; f(1);', 'Cannot call');
});

test('too many arguments error', () => {
  checkHasError('let f = fn(x) { x }; f(1, 2);', 'Cannot call');
});

test('add int and bool error', () => {
  checkHasError('let x = 5 + true;', 'Cannot use');
});

test('add int and string error', () => {
  checkHasError('let x = 5 + "hello";', 'Cannot use');
});

test('compare different types error', () => {
  checkHasError('let x = 5 > "hello";', 'Cannot compare');
});

// ============================================================
// Edge cases
// ============================================================

test('empty program', () => checkOk(''));
test('nested arrays', () => checkOk('let x = [[1,2],[3,4]];'));
test('array of functions', () => checkOk('let x = [fn(a){a}, fn(b){b}];'));
test('deeply nested if', () => checkOk('let x = if (true) { if (false) { 1 } else { 2 } } else { 3 };'));
test('function returning function', () => checkOk('let f = fn(x) { fn(y) { fn(z) { x + y + z } } };'));
test('mixed int and float', () => checkOk('let x = 5; let y = 3.14; let z = x + y;'));
test('negative prefix on int', () => checkOk('let x = -5; let y = -x;'));
test('nested scope shadowing', () => {
  checkOk('let x = 5; let f = fn() { let x = "hello"; x }; let y = x + 1;');
});
test('null value', () => checkOk('let x = null;'));
test('undefined variable detected', () => checkHasError('x + 1;', 'Undefined variable'));

// ============================================================
// While loops
// ============================================================

test('while loop', () => {
  checkOk('let i = 0; while (i < 10) { set i = i + 1; }');
});

test('while loop with string', () => {
  checkOk('let s = "hello"; while (len(s) < 10) { set s = s + "!"; }');
});

// ============================================================
// For loops
// ============================================================

test('for-in loop over array', () => {
  checkOk('let arr = [1, 2, 3]; for (x in arr) { puts(x); }');
});

test('for-in loop over range', () => {
  checkOk('for (i in 0..10) { puts(i); }');
});

// ============================================================
// Match expressions
// ============================================================

test('match with consistent arm types', () => {
  checkOk(`
    let x = 5;
    let result = match (x) {
      1 => "one",
      2 => "two",
      _ => "other"
    };
  `);
});

test('match with mismatched arm types', () => {
  checkHasError(`
    let x = 5;
    let result = match (x) {
      1 => "one",
      2 => 42
    };
  `, 'Match arms have different types');
});

// ============================================================
// Ternary expressions
// ============================================================

test('ternary expression', () => {
  checkOk('let x = true ? 1 : 2;');
});

test('ternary with mismatched types', () => {
  checkHasError('let x = true ? 1 : "hello";', 'Ternary branches have different types');
});

// ============================================================
// Range expressions
// ============================================================

test('range creates int array', () => {
  checkOk('let arr = 0..10; let x = arr[0] + 1;');
});

// ============================================================
// Slice expressions
// ============================================================

test('array slice', () => {
  checkOk('let arr = [1, 2, 3, 4]; let sub = arr[1:3]; let x = sub[0] + 1;');
});

// ============================================================
// Try/catch
// ============================================================

test('try/catch expression', () => {
  checkOk(`
    let result = try {
      let x = 42 / 0;
      x
    } catch (e) {
      0
    };
  `);
});

// ============================================================
// Null literal
// ============================================================

test('null literal', () => {
  checkOk('let x = null;');
});

// ============================================================
// Array comprehension
// ============================================================

test('array comprehension', () => {
  checkOk('let arr = [1, 2, 3]; let doubled = [x * 2 for x in arr];');
});

// ============================================================
// Report
// ============================================================

console.log(`\nTypechecker tests: ${passed}/${total} passed` + (failed ? ` (${failed} failed)` : ''));
if (failed) process.exit(1);
