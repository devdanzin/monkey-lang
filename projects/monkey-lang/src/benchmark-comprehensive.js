#!/usr/bin/env node

// Comprehensive Monkey JIT Benchmark Suite
// Tests all optimization paths: loops, side traces, function inlining, nested calls

import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import { monkeyEval } from './evaluator.js';
import { Compiler } from './compiler.js';
import { VM } from './vm.js';
import { Environment } from './object.js';

const BENCHMARKS = [
  // === Hot loops (core JIT strength) ===
  {
    name: 'hot loop: sum 10k',
    category: 'loops',
    input: `
      let sum = 0; let i = 0;
      while (i < 10000) { sum = sum + i; i = i + 1; }
      sum
    `,
    expected: 49995000,
  },
  {
    name: 'hot loop: sum 100k',
    category: 'loops',
    input: `
      let sum = 0; let i = 0;
      while (i < 100000) { sum = sum + i; i = i + 1; }
      sum
    `,
    expected: 4999950000,
  },
  {
    name: 'nested loops: 100x100',
    category: 'loops',
    input: `
      let sum = 0; let i = 0;
      while (i < 100) {
        let j = 0;
        while (j < 100) { sum = sum + 1; j = j + 1; }
        i = i + 1;
      }
      sum
    `,
    expected: 10000,
  },

  // === Side traces (branching in loops) ===
  {
    name: 'side trace: 50/50 branch',
    category: 'side-traces',
    input: `
      let a = 0; let b = 0; let i = 0;
      while (i < 10000) {
        if (i > 4999) { b = b + 1; } else { a = a + 1; }
        i = i + 1;
      }
      a + b
    `,
    expected: 10000,
  },
  {
    name: 'side trace: 3-way branch',
    category: 'side-traces',
    input: `
      let a = 0; let b = 0; let c = 0; let i = 0;
      while (i < 9000) {
        if (i > 5999) { c = c + 1; }
        else { if (i > 2999) { b = b + 1; } else { a = a + 1; } }
        i = i + 1;
      }
      a + b + c
    `,
    expected: 9000,
  },

  // === Function inlining ===
  {
    name: 'inline: simple fn 10k calls',
    category: 'inlining',
    input: `
      let double = fn(x) { x * 2 };
      let sum = 0; let i = 0;
      while (i < 10000) { sum = sum + double(i); i = i + 1; }
      sum
    `,
    expected: 99990000,
  },
  {
    name: 'inline: nested fn calls',
    category: 'inlining',
    input: `
      let square = fn(x) { x * x };
      let add_sq = fn(a, b) { square(a) + square(b) };
      let sum = 0; let i = 0;
      while (i < 5000) { sum = sum + add_sq(i, 1); i = i + 1; }
      sum
    `,
    expected: 41654172500,
  },
  {
    name: 'inline: fn with conditional (stable)',
    category: 'inlining',
    input: `
      let check = fn(x) { if (x > 0) { x * 2 } else { x } };
      let sum = 0; let i = 1;
      while (i < 5001) { sum = sum + check(i); i = i + 1; }
      sum
    `,
    expected: 25005000,
  },

  // === Recursive (not traceable — baseline comparison) ===
  {
    name: 'recursive: fib(25)',
    category: 'recursive',
    input: `
      let fib = fn(n) { if (n < 2) { n } else { fib(n-1) + fib(n-2) } };
      fib(25)
    `,
    expected: 75025,
  },
  {
    name: 'recursive: loop(500)',
    category: 'recursive',
    input: `
      let loop = fn(n) { if (n == 0) { 0 } else { loop(n - 1) } };
      loop(500)
    `,
    expected: 0,
  },

  // === Mixed patterns ===
  {
    name: 'mixed: accumulate with fn + branch',
    category: 'mixed',
    input: `
      let inc = fn(x) { x + 1 };
      let dec = fn(x) { x - 1 };
      let val = 0; let i = 0;
      while (i < 10000) {
        if (i > 4999) { val = inc(val); } else { val = dec(val); }
        i = i + 1;
      }
      val
    `,
    expected: 0,
  },
  {
    name: 'string concat: 100x',
    category: 'strings',
    input: `
      let repeat = fn(s, n) {
        if (n == 0) { "" } else { s + repeat(s, n - 1) }
      };
      len(repeat("ab", 100))
    `,
    expected: 200,
  },

  // === Arrays ===
  {
    name: 'array: build 1000 elements',
    category: 'arrays',
    input: `
      let arr = [];
      let i = 0;
      while (i < 1000) { arr = push(arr, i); i = i + 1; }
      len(arr)
    `,
    expected: 1000,
  },
  {
    name: 'array: sum via index 1000',
    category: 'arrays',
    input: `
      let arr = [];
      let i = 0;
      while (i < 1000) { arr = push(arr, i); i = i + 1; }
      let sum = 0; let j = 0;
      while (j < 1000) { sum = sum + arr[j]; j = j + 1; }
      sum
    `,
    expected: 499500,
  },
  {
    name: 'array: nested fn + array access',
    category: 'arrays',
    input: `
      let get = fn(arr, i) { arr[i] };
      let arr = [10, 20, 30, 40, 50];
      let sum = 0; let i = 0;
      while (i < 5000) {
        sum = sum + get(arr, 0) + get(arr, 4);
        i = i + 1;
      }
      sum
    `,
    expected: 300000,
  },

  // === Closures ===
  {
    name: 'closure: adder factory 10k',
    category: 'closures',
    input: `
      let adder = fn(x) { fn(y) { x + y } };
      let addFive = adder(5);
      let addTen = adder(10);
      let sum = 0; let i = 0;
      while (i < 10000) {
        sum = sum + addFive(i) + addTen(i);
        i = i + 1;
      }
      sum
    `,
    expected: 100140000,
  },
  {
    name: 'closure: multiplier factory 5k',
    category: 'closures',
    input: `
      let multiplier = fn(x) { fn(y) { x * y } };
      let triple = multiplier(3);
      let sum = 0; let i = 0;
      while (i < 5000) { sum = sum + triple(i); i = i + 1; }
      sum
    `,
    expected: 37492500,
  },

  // === Higher-order functions ===
  {
    name: 'higher-order: apply fn 10k times',
    category: 'higher-order',
    input: `
      let apply = fn(f, x) { f(x) };
      let double = fn(x) { x * 2 };
      let sum = 0; let i = 0;
      while (i < 10000) { sum = sum + apply(double, i); i = i + 1; }
      sum
    `,
    expected: 99990000,
  },
  {
    name: 'higher-order: compose',
    category: 'higher-order',
    input: `
      let compose = fn(f, g) { fn(x) { f(g(x)) } };
      let double = fn(x) { x * 2 };
      let inc = fn(x) { x + 1 };
      let double_inc = compose(double, inc);
      let sum = 0; let i = 0;
      while (i < 5000) { sum = sum + double_inc(i); i = i + 1; }
      sum
    `,
    expected: 25005000,
  },

  // === Stress tests ===
  {
    name: 'fib(30) raw integer JIT',
    category: 'stress',
    input: `
      let fib = fn(n) { if (n < 2) { n } else { fib(n-1) + fib(n-2) } };
      fib(30)
    `,
    expected: 832040,
  },
  {
    name: 'loop calling recursive fn',
    category: 'stress',
    input: `
      let fib = fn(n) { if (n < 2) { n } else { fib(n-1) + fib(n-2) } };
      let sum = 0; let i = 0;
      while (i < 20) { sum = sum + fib(i); i = i + 1; }
      sum
    `,
    expected: 10945,
  },
  {
    name: 'factorial(20) recursive',
    category: 'stress',
    input: `
      let fact = fn(n) { if (n < 2) { 1 } else { n * fact(n-1) } };
      fact(20)
    `,
    expected: 2432902008176640000,
  },
];

function parse(input) {
  const lexer = new Lexer(input);
  const parser = new Parser(lexer);
  return parser.parseProgram();
}

function runEval(program) {
  const env = new Environment();
  return monkeyEval(program, env);
}

function runVM(program) {
  const compiler = new Compiler();
  compiler.compile(program);
  const vm = new VM(compiler.bytecode());
  vm.run();
  return { result: vm.lastPoppedStackElem(), vm };
}

function runJIT(program) {
  const compiler = new Compiler();
  compiler.compile(program);
  const vm = new VM(compiler.bytecode());
  vm.enableJIT();
  vm.run();
  return { result: vm.lastPoppedStackElem(), vm };
}

function timeN(fn, n) {
  const times = [];
  let result;
  for (let i = 0; i < n; i++) {
    const start = performance.now();
    result = fn();
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  // median
  const median = times[Math.floor(times.length / 2)];
  return { median, result };
}

const ITERS = 5;
let currentCategory = '';

console.log('Monkey JIT Comprehensive Benchmarks');
console.log('====================================\n');
console.log(`${'Benchmark'.padEnd(38)} ${'Eval'.padStart(10)} ${'VM'.padStart(10)} ${'JIT'.padStart(10)} ${'JIT/VM'.padStart(8)} ${'JIT/Eval'.padStart(9)} ${'Traces'.padStart(7)}`);
console.log('-'.repeat(95));

for (const bench of BENCHMARKS) {
  if (bench.category !== currentCategory) {
    currentCategory = bench.category;
    console.log(`\n  --- ${currentCategory} ---`);
  }

  const program = parse(bench.input);
  try {
    const evalR = timeN(() => runEval(program), ITERS);
    const vmR = timeN(() => runVM(program), ITERS);
    const jitR = timeN(() => runJIT(program), ITERS);

    const jitVsVm = vmR.median / jitR.median;
    const jitVsEval = evalR.median / jitR.median;
    const traces = jitR.result.vm?.jit?.traceCount ?? '?';

    // Validate correctness
    const jitVal = jitR.result.result?.value;
    if (bench.expected !== null && jitVal !== bench.expected) {
      console.log(`${bench.name.padEnd(38)} ❌ WRONG: got ${jitVal}, expected ${bench.expected}`);
      continue;
    }

    console.log(
      `${bench.name.padEnd(38)} ${(evalR.median.toFixed(2) + 'ms').padStart(10)} ${(vmR.median.toFixed(2) + 'ms').padStart(10)} ${(jitR.median.toFixed(2) + 'ms').padStart(10)} ${jitVsVm.toFixed(1).padStart(7)}x ${jitVsEval.toFixed(1).padStart(8)}x ${String(traces).padStart(7)}`);
  } catch (err) {
    console.log(`${bench.name.padEnd(38)} ERROR: ${err.message.slice(0, 50)}`);
  }
}

console.log('\n(Median of 5 runs. Times include compilation overhead for VM/JIT.)\n');
