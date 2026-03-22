#!/usr/bin/env node

// Monkey Language Benchmark: Interpreter vs Compiler+VM
// Compares execution time of the tree-walking evaluator against the bytecode compiler + VM

import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import { monkeyEval } from './evaluator.js';
import { Compiler } from './compiler.js';
import { VM } from './vm.js';
import { Environment } from './object.js';

const BENCHMARKS = [
  {
    name: 'fibonacci(25)',
    input: `
      let fib = fn(n) { if (n < 2) { n } else { fib(n-1) + fib(n-2) } };
      fib(25)
    `,
  },
  {
    name: 'hash access (100 lookups)',
    input: `
      let h = {"a": 1, "b": 2, "c": 3, "d": 4, "e": 5};
      let access = fn(n) {
        if (n == 0) { 0 }
        else { h["a"] + h["b"] + h["c"] + access(n - 1) }
      };
      access(100)
    `,
  },
  {
    name: 'nested loops (counter to 500)',
    input: `
      let loop = fn(n) {
        if (n == 0) { 0 } else { loop(n - 1) }
      };
      loop(500)
    `,
  },
  {
    name: 'string concatenation (100x)',
    input: `
      let repeat = fn(s, n) {
        if (n == 0) { "" } else { s + repeat(s, n - 1) }
      };
      len(repeat("ab", 100))
    `,
  },
  {
    name: 'integer arithmetic (pure)',
    input: `
      let sum = 0 + 1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9;
      let result = sum * sum * sum + sum * sum - sum;
      result
    `,
  },
  {
    name: 'hot loop (10k iterations)',
    input: `
      let sum = 0;
      let i = 0;
      while (i < 10000) {
        sum = sum + i;
        i = i + 1;
      }
      sum
    `,
  },
];

function parse(input) {
  const lexer = new Lexer(input);
  const parser = new Parser(lexer);
  return parser.parseProgram();
}

function timeEval(program, iterations = 1) {
  const times = [];
  for (let i = 0; i < iterations; i++) {
    const env = new Environment();
    const start = performance.now();
    const result = monkeyEval(program, env);
    times.push(performance.now() - start);
  }
  return { avg: times.reduce((a, b) => a + b) / times.length, result: null };
}

function timeVM(program, iterations = 1) {
  // Compile once, then time execution
  const compiler = new Compiler();
  compiler.compile(program);
  const bytecode = compiler.bytecode();

  const times = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    const vm = new VM(bytecode);
    vm.run();
    times.push(performance.now() - start);
  }
  return { avg: times.reduce((a, b) => a + b) / times.length, result: null };
}

function timeJIT(program, iterations = 1) {
  const compiler = new Compiler();
  compiler.compile(program);
  const bytecode = compiler.bytecode();

  const times = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    const vm = new VM(bytecode);
    vm.enableJIT();
    vm.run();
    times.push(performance.now() - start);
  }
  return { avg: times.reduce((a, b) => a + b) / times.length, result: null };
}

console.log('Monkey Language Benchmark');
console.log('========================\n');
console.log(`${'Benchmark'.padEnd(35)} ${'Eval (ms)'.padStart(12)} ${'VM (ms)'.padStart(12)} ${'JIT (ms)'.padStart(12)} ${'JIT vs VM'.padStart(10)}`);
console.log('-'.repeat(83));

const iterations = 3;

for (const bench of BENCHMARKS) {
  const program = parse(bench.input);

  try {
    const evalResult = timeEval(program, iterations);
    const vmResult = timeVM(program, iterations);
    const jitResult = timeJIT(program, iterations);
    const speedup = vmResult.avg / jitResult.avg;

    console.log(
      `${bench.name.padEnd(35)} ${evalResult.avg.toFixed(2).padStart(12)} ${vmResult.avg.toFixed(2).padStart(12)} ${jitResult.avg.toFixed(2).padStart(12)} ${speedup.toFixed(2).padStart(9)}x`
    );
  } catch (err) {
    console.log(`${bench.name.padEnd(35)} ERROR: ${err.message}`);
  }
}

console.log();
