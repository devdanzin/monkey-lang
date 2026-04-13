// benchmark.js — Compare tree-walker vs compiler+VM performance
import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import { monkeyEval } from './evaluator.js';
import { Environment } from './object.js';
import { Compiler } from './compiler.js';
import { VM } from './vm.js';

function parse(input) {
  const l = new Lexer(input);
  const p = new Parser(l);
  return p.parseProgram();
}

function benchInterpreter(input, warmup = 1) {
  const program = parse(input);
  // Warmup
  for (let i = 0; i < warmup; i++) monkeyEval(program, new Environment());
  const start = performance.now();
  const result = monkeyEval(program, new Environment());
  return { time: performance.now() - start, result: result?.inspect?.() || 'null' };
}

function benchVM(input, warmup = 1) {
  // Warmup
  for (let i = 0; i < warmup; i++) {
    const compiler = new Compiler();
    compiler.compile(parse(input));
    const vm = new VM(compiler.bytecode());
    vm.run();
  }
  // Compile
  const compileStart = performance.now();
  const compiler = new Compiler();
  compiler.compile(parse(input));
  const bc = compiler.bytecode();
  const compileTime = performance.now() - compileStart;
  // Execute
  const execStart = performance.now();
  const vm = new VM(bc);
  vm.run();
  const execTime = performance.now() - execStart;
  return {
    compileTime,
    execTime,
    totalTime: compileTime + execTime,
    result: vm.lastPoppedStackElem()?.inspect?.() || 'null',
  };
}

function runBenchmark(name, input) {
  console.log(`\n--- ${name} ---`);
  const interp = benchInterpreter(input);
  const vm = benchVM(input);
  console.log(`  Tree-walker: ${interp.time.toFixed(1)}ms (result: ${interp.result})`);
  console.log(`  Compiler:    ${vm.compileTime.toFixed(1)}ms`);
  console.log(`  VM Execute:  ${vm.execTime.toFixed(1)}ms`);
  console.log(`  VM Total:    ${vm.totalTime.toFixed(1)}ms (result: ${vm.result})`);
  console.log(`  Speedup:     ${(interp.time / vm.totalTime).toFixed(2)}x`);
  if (interp.result !== vm.result) {
    console.log(`  ⚠️  RESULT MISMATCH: interp=${interp.result} vm=${vm.result}`);
  }
}

console.log('=== Monkey Language Benchmark: Tree-Walker vs Compiler+VM ===');

// 1. Fibonacci — recursive function call overhead
runBenchmark('Fibonacci(25)', `
let fibonacci = fn(x) {
  if (x == 0) { return 0; }
  if (x == 1) { return 1; }
  fibonacci(x - 1) + fibonacci(x - 2);
};
fibonacci(25);
`);

// 2. Loop-style sum — iteration via recursion (limited depth to avoid JS stack overflow)
runBenchmark('Sum 1..100 (recursive)', `
let sum = fn(n) {
  if (n == 0) { return 0; }
  n + sum(n - 1);
};
sum(100);
`);

// 3. Array processing — builtin + array creation
runBenchmark('Array reduce', `
let arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
let reduce = fn(a, init, f) {
  if (len(a) == 0) { return init; }
  reduce(rest(a), f(init, first(a)), f);
};
reduce(arr, 0, fn(acc, x) { acc + x });
`);

// 4. Nested closures — closure creation and access
runBenchmark('Nested closures', `
let make = fn(x) {
  fn(y) {
    fn(z) { x + y + z }
  }
};
let a = make(1);
let b = a(2);
let c = b(3);
c;
`);

// 5. String concatenation
runBenchmark('String concatenation (5x)', `
let a = "hello";
let b = a + " " + "world" + "!" + " " + "monkey";
b;
`);

// 6. Hash creation and access
runBenchmark('Hash operations', `
let h = {"a": 1, "b": 2, "c": 3, "d": 4, "e": 5};
h["a"] + h["b"] + h["c"] + h["d"] + h["e"];
`);

// 7. Higher-order functions
runBenchmark('Map function', `
let map = fn(arr, f) {
  if (len(arr) == 0) { return []; }
  let head = f(first(arr));
  let tail = map(rest(arr), f);
  push([head], first(tail));
};
map([1, 2, 3, 4, 5], fn(x) { x * 2 });
`);

// 8. Complex: counter pattern
runBenchmark('Counter (closure mutation)', `
let newCounter = fn() {
  let count = 0;
  fn() {
    let count = count + 1;
    count
  }
};
let c = newCounter();
let a = c();
let b = c();
let d = c();
d;
`);

console.log('\n=== Done ===');
