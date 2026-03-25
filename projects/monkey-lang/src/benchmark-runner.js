#!/usr/bin/env node

// JIT Benchmark Runner — JSON output mode for regression tracking
// Usage: node benchmark-runner.js [--json] [--save] [--compare <file>] [--filter <pattern>]

import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import { monkeyEval } from './evaluator.js';
import { Compiler } from './compiler.js';
import { VM } from './vm.js';
import { Environment } from './object.js';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = join(__dirname, '..', 'benchmarks');

const BENCHMARKS = [
  // Loops
  { name: 'loop:sum-10k', category: 'loops', expected: 49995000, input: `let sum = 0; let i = 0; while (i < 10000) { sum = sum + i; i = i + 1; } sum` },
  { name: 'loop:sum-100k', category: 'loops', expected: 4999950000, input: `let sum = 0; let i = 0; while (i < 100000) { sum = sum + i; i = i + 1; } sum` },
  { name: 'loop:nested-100x100', category: 'loops', expected: 10000, input: `let sum = 0; let i = 0; while (i < 100) { let j = 0; while (j < 100) { sum = sum + 1; j = j + 1; } i = i + 1; } sum` },

  // Side traces
  { name: 'side:50-50-branch', category: 'side-traces', expected: 10000, input: `let a = 0; let b = 0; let i = 0; while (i < 10000) { if (i > 4999) { b = b + 1; } else { a = a + 1; } i = i + 1; } a + b` },
  { name: 'side:3-way-branch', category: 'side-traces', expected: 9000, input: `let a = 0; let b = 0; let c = 0; let i = 0; while (i < 9000) { if (i > 5999) { c = c + 1; } else { if (i > 2999) { b = b + 1; } else { a = a + 1; } } i = i + 1; } a + b + c` },

  // Inlining
  { name: 'inline:simple-10k', category: 'inlining', expected: 99990000, input: `let double = fn(x) { x * 2 }; let sum = 0; let i = 0; while (i < 10000) { sum = sum + double(i); i = i + 1; } sum` },
  { name: 'inline:nested-fn', category: 'inlining', expected: 41654172500, input: `let square = fn(x) { x * x }; let add_sq = fn(a, b) { square(a) + square(b) }; let sum = 0; let i = 0; while (i < 5000) { sum = sum + add_sq(i, 1); i = i + 1; } sum` },
  { name: 'inline:fn-conditional', category: 'inlining', expected: 25005000, input: `let check = fn(x) { if (x > 0) { x * 2 } else { x } }; let sum = 0; let i = 1; while (i < 5001) { sum = sum + check(i); i = i + 1; } sum` },

  // Recursive
  { name: 'recursive:fib-25', category: 'recursive', expected: 75025, input: `let fib = fn(n) { if (n < 2) { n } else { fib(n-1) + fib(n-2) } }; fib(25)` },
  { name: 'recursive:fib-30', category: 'recursive', expected: 832040, input: `let fib = fn(n) { if (n < 2) { n } else { fib(n-1) + fib(n-2) } }; fib(30)` },

  // Closures
  { name: 'closure:adder-10k', category: 'closures', expected: 100140000, input: `
    let adder = fn(x) { fn(y) { x + y } };
    let addFive = adder(5);
    let addTen = adder(10);
    let sum = 0; let i = 0;
    while (i < 10000) { sum = sum + addFive(i) + addTen(i); i = i + 1; }
    sum
  ` },
  { name: 'closure:multiplier-5k', category: 'closures', expected: 37492500, input: `let multiplier = fn(x) { fn(y) { x * y } }; let triple = multiplier(3); let sum = 0; let i = 0; while (i < 5000) { sum = sum + triple(i); i = i + 1; } sum` },

  // Higher-order
  { name: 'higher:apply-10k', category: 'higher-order', expected: 99990000, input: `let apply = fn(f, x) { f(x) }; let double = fn(x) { x * 2 }; let sum = 0; let i = 0; while (i < 10000) { sum = sum + apply(double, i); i = i + 1; } sum` },
  { name: 'higher:compose-5k', category: 'higher-order', expected: 25005000, input: `let compose = fn(f, g) { fn(x) { f(g(x)) } }; let double = fn(x) { x * 2 }; let inc = fn(x) { x + 1 }; let di = compose(double, inc); let sum = 0; let i = 0; while (i < 5000) { sum = sum + di(i); i = i + 1; } sum` },

  // Arrays
  { name: 'array:build-1000', category: 'arrays', expected: 1000, input: `let arr = []; let i = 0; while (i < 1000) { arr = push(arr, i); i = i + 1; } len(arr)` },
  { name: 'array:sum-index-1000', category: 'arrays', expected: 499500, input: `let arr = []; let i = 0; while (i < 1000) { arr = push(arr, i); i = i + 1; } let sum = 0; let j = 0; while (j < 1000) { sum = sum + arr[j]; j = j + 1; } sum` },
  { name: 'array:sum-len-1000', category: 'arrays', expected: 499500, input: `let arr = []; let i = 0; while (i < 1000) { arr = push(arr, i); i = i + 1; } let sum = 0; let j = 0; while (j < len(arr)) { sum = sum + arr[j]; j = j + 1; } sum` },

  // Hashes
  { name: 'hash:lookups-5k', category: 'hashes', expected: 45000, input: `let h = {"a": 1, "b": 2, "c": 3, "d": 4, "e": 5}; let sum = 0; let i = 0; while (i < 5000) { sum = sum + h["a"] + h["c"] + h["e"]; i = i + 1; } sum` },

  // Strings
  { name: 'string:concat-1k', category: 'strings', expected: 1000, input: `let s = ""; let i = 0; while (i < 1000) { s = s + "a"; i = i + 1; } len(s)` },
  { name: 'string:len-check-5k', category: 'strings', expected: 25000, input: `let s = "hello"; let sum = 0; let i = 0; while (i < 5000) { sum = sum + len(s); i = i + 1; } sum` },

  // Mixed
  { name: 'mixed:fn-branch-10k', category: 'mixed', expected: 0, input: `let inc = fn(x) { x + 1 }; let dec = fn(x) { x - 1 }; let val = 0; let i = 0; while (i < 10000) { if (i > 4999) { val = inc(val); } else { val = dec(val); } i = i + 1; } val` },
  { name: 'mixed:loop-fib', category: 'mixed', expected: 10945, input: `let fib = fn(n) { if (n < 2) { n } else { fib(n-1) + fib(n-2) } }; let sum = 0; let i = 0; while (i < 20) { sum = sum + fib(i); i = i + 1; } sum` },
  { name: 'mixed:dot-product-5k', category: 'mixed', expected: 41654167500, input: `let dot = fn(n) { let sum = 0; let i = 0; while (i < n) { sum = sum + i * i; i = i + 1; } sum }; dot(5000)` },
  // Stdlib benchmarks (inline stdlib defs)
  { name: 'stdlib:reduce-sum-1k', category: 'stdlib', expected: 499500,
    input: `let reduce = fn(arr, initial, f) { let acc = initial; let i = 0; while (i < len(arr)) { acc = f(acc, arr[i]); i = i + 1; } acc }; let arr = []; let i = 0; while (i < 1000) { arr = push(arr, i); i = i + 1; } reduce(arr, 0, fn(acc, x) { acc + x })` },
  { name: 'stdlib:map-double-1k', category: 'stdlib', expected: 1000,
    input: `let map = fn(arr, f) { let r = []; let i = 0; while (i < len(arr)) { r = push(r, f(arr[i])); i = i + 1; } r }; let arr = []; let i = 0; while (i < 1000) { arr = push(arr, i); i = i + 1; } len(map(arr, fn(x) { x * 2 }))` },
  { name: 'stdlib:filter-gt500-1k', category: 'stdlib', expected: 500,
    input: `let filter = fn(arr, f) { let r = []; let i = 0; while (i < len(arr)) { if (f(arr[i])) { r = push(r, arr[i]); } i = i + 1; } r }; let arr = []; let i = 0; while (i < 1000) { arr = push(arr, i); i = i + 1; } len(filter(arr, fn(x) { x > 499 }))` },
  { name: 'mixed:prime-count-500', category: 'mixed', expected: 95,
    input: `let is_prime = fn(n) { if (n < 2) { return false; } if (n < 4) { return true; } if (n % 2 == 0) { return false; } let i = 3; while (i * i < n + 1) { if (n % i == 0) { return false; } i = i + 2; } true }; let count = 0; let n = 2; while (n < 500) { if (is_prime(n)) { count = count + 1; } n = n + 1; } count` },
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

function benchmark(fn, iterations = 5) {
  const times = [];
  let result;
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    result = fn();
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  const median = times[Math.floor(times.length / 2)];
  const min = Math.min(...times);
  const max = Math.max(...times);
  const p90 = times[Math.floor(times.length * 0.9)];
  return { median, min, max, p90, result };
}

function getGitHash() {
  try { return execSync('git rev-parse --short HEAD', { cwd: join(__dirname, '..'), encoding: 'utf8' }).trim(); }
  catch { return 'unknown'; }
}

// --- Main ---
const args = process.argv.slice(2);
const jsonMode = args.includes('--json');
const saveMode = args.includes('--save');
const compareIdx = args.indexOf('--compare');
const filterIdx = args.indexOf('--filter');
const filter = filterIdx >= 0 ? args[filterIdx + 1] : null;
const compareFile = compareIdx >= 0 ? args[compareIdx + 1] : null;
const ITERS = 7;

const activeBenchmarks = filter
  ? BENCHMARKS.filter(b => b.name.includes(filter) || b.category.includes(filter))
  : BENCHMARKS;

const results = {
  timestamp: new Date().toISOString(),
  gitHash: getGitHash(),
  nodeVersion: process.version,
  iterations: ITERS,
  benchmarks: [],
};

if (!jsonMode) {
  console.log('Monkey JIT Benchmark Suite');
  console.log('=========================\n');
  console.log(`${'Benchmark'.padEnd(30)} ${'VM (ms)'.padStart(10)} ${'JIT (ms)'.padStart(10)} ${'Speedup'.padStart(8)} ${'Correct'.padStart(8)}`);
  console.log('-'.repeat(68));
}

for (const bench of activeBenchmarks) {
  const program = parse(bench.input);
  try {
    const evalR = benchmark(() => runEval(program), ITERS);
    const vmR = benchmark(() => runVM(program), ITERS);
    const jitR = benchmark(() => runJIT(program), ITERS);
    const jitVal = jitR.result.result?.value;
    const correct = bench.expected === null || jitVal === bench.expected;
    const traces = jitR.result.vm?.jit?.traceCount ?? 0;

    const entry = {
      name: bench.name,
      category: bench.category,
      correct,
      traces,
      eval: { median: +evalR.median.toFixed(3), min: +evalR.min.toFixed(3), max: +evalR.max.toFixed(3), p90: +evalR.p90.toFixed(3) },
      vm: { median: +vmR.median.toFixed(3), min: +vmR.min.toFixed(3), max: +vmR.max.toFixed(3), p90: +vmR.p90.toFixed(3) },
      jit: { median: +jitR.median.toFixed(3), min: +jitR.min.toFixed(3), max: +jitR.max.toFixed(3), p90: +jitR.p90.toFixed(3) },
      speedup: { jitVsVm: +(vmR.median / jitR.median).toFixed(2), jitVsEval: +(evalR.median / jitR.median).toFixed(2) },
    };
    results.benchmarks.push(entry);

    if (!jsonMode) {
      const speedStr = entry.speedup.jitVsVm.toFixed(1) + 'x';
      console.log(
        `${bench.name.padEnd(30)} ${(vmR.median.toFixed(2) + 'ms').padStart(10)} ${(jitR.median.toFixed(2) + 'ms').padStart(10)} ${speedStr.padStart(8)} ${(correct ? '✅' : '❌').padStart(8)}`
      );
    }
  } catch (err) {
    results.benchmarks.push({ name: bench.name, category: bench.category, error: err.message });
    if (!jsonMode) console.log(`${bench.name.padEnd(30)} ERROR: ${err.message.slice(0, 40)}`);
  }
}

// Summary
const good = results.benchmarks.filter(b => !b.error);
const totalVm = good.reduce((s, b) => s + b.vm.median, 0);
const totalJit = good.reduce((s, b) => s + b.jit.median, 0);
results.summary = {
  total: good.length,
  errors: results.benchmarks.length - good.length,
  correct: good.filter(b => b.correct).length,
  aggregateSpeedup: +(totalVm / totalJit).toFixed(2),
  totalVmMs: +totalVm.toFixed(1),
  totalJitMs: +totalJit.toFixed(1),
};

if (jsonMode) {
  console.log(JSON.stringify(results, null, 2));
} else {
  console.log(`\nAggregate: ${results.summary.total} benchmarks, ${results.summary.aggregateSpeedup}x overall (${results.summary.totalVmMs}ms → ${results.summary.totalJitMs}ms)`);
  console.log(`Correctness: ${results.summary.correct}/${results.summary.total} passing`);
}

// Save results
if (saveMode) {
  if (!existsSync(RESULTS_DIR)) mkdirSync(RESULTS_DIR, { recursive: true });
  const filename = `bench-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`;
  const filepath = join(RESULTS_DIR, filename);
  writeFileSync(filepath, JSON.stringify(results, null, 2));

  // Also update latest.json symlink
  const latestPath = join(RESULTS_DIR, 'latest.json');
  writeFileSync(latestPath, JSON.stringify(results, null, 2));

  if (!jsonMode) console.log(`\nSaved: ${filepath}`);
}

// Compare mode
if (compareFile) {
  const basePath = compareFile === 'latest' ? join(RESULTS_DIR, 'latest.json') : compareFile;
  if (!existsSync(basePath)) {
    console.error(`\nComparison file not found: ${basePath}`);
    process.exit(1);
  }
  const baseline = JSON.parse(readFileSync(basePath, 'utf8'));
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Regression Report: ${baseline.gitHash} → ${results.gitHash}`);
  console.log(`${'='.repeat(70)}`);
  console.log(`${'Benchmark'.padEnd(30)} ${'Base JIT'.padStart(10)} ${'Curr JIT'.padStart(10)} ${'Change'.padStart(10)} ${'Status'.padStart(8)}`);
  console.log('-'.repeat(70));

  let regressions = 0;
  let improvements = 0;
  const THRESHOLD = 0.15; // 15% change threshold

  for (const curr of results.benchmarks) {
    if (curr.error) continue;
    const base = baseline.benchmarks.find(b => b.name === curr.name);
    if (!base || base.error) continue;

    const change = (curr.jit.median - base.jit.median) / base.jit.median;
    let status = '  ~';
    if (change > THRESHOLD) { status = '⚠️ SLOWER'; regressions++; }
    else if (change < -THRESHOLD) { status = '🚀 FASTER'; improvements++; }

    console.log(
      `${curr.name.padEnd(30)} ${(base.jit.median.toFixed(2) + 'ms').padStart(10)} ${(curr.jit.median.toFixed(2) + 'ms').padStart(10)} ${((change * 100).toFixed(1) + '%').padStart(10)} ${status.padStart(8)}`
    );
  }

  console.log(`\n${regressions} regressions, ${improvements} improvements (>${(THRESHOLD * 100).toFixed(0)}% threshold)`);
  if (regressions > 0) process.exit(1);
}
