// benchmark-optimize.js — Benchmark optimization pipeline effects
// Compares execution with and without optimizations

import { compileAndRun } from '../src/wasm-compiler.js';

const benchmarks = [
  {
    name: 'Constant arithmetic',
    code: `
      let result = (2 + 3) * (4 - 1) + (10 / 2) - (8 % 3);
      result
    `,
    expected: 18,
  },
  {
    name: 'Fibonacci(20)',
    code: `
      let fib = fn(n) {
        if (n < 2) { n } else { fib(n - 1) + fib(n - 2) }
      };
      fib(20)
    `,
    expected: 6765,
  },
  {
    name: 'Sum loop (1000)',
    code: `
      let sum = 0;
      for (let i = 0; i < 1000; i = i + 1) {
        sum = sum + i;
      }
      sum
    `,
    expected: 499500,
  },
  {
    name: 'String concatenation',
    code: `
      let s = "hello" + " " + "world";
      len(s)
    `,
    expected: 11,
  },
  {
    name: 'Array operations',
    code: `
      let a = [1, 2, 3, 4, 5];
      let sum = 0;
      for (let i = 0; i < len(a); i = i + 1) {
        sum = sum + a[i];
      }
      sum
    `,
    expected: 15,
  },
  {
    name: 'Dead code elimination',
    code: `
      let f = fn() {
        return 42;
        let x = 999;
        let y = 888;
        return 99;
      };
      f()
    `,
    expected: 42,
  },
  {
    name: 'Nested closures',
    code: `
      let make = fn(x) {
        fn(y) { fn(z) { x + y + z } }
      };
      let f = make(10 * 10);
      f(20)(30)
    `,
    expected: undefined,
  },
];

async function runBenchmark(bench, optimize) {
  const runs = 20;
  const times = [];
  
  for (let i = 0; i < runs; i++) {
    const timings = {};
    try {
      const result = await compileAndRun(bench.code, { optimize, timings });
      if (bench.expected !== undefined && result !== bench.expected) {
        console.error(`  ERROR: ${bench.name} expected ${bench.expected}, got ${result}`);
      }
      times.push(timings.total);
    } catch (e) {
      // Some benchmarks may not compile with optimize (e.g., dead code with undefined vars)
      return { avg: -1, min: -1, error: e.message };
    }
  }

  // Remove outliers (top/bottom 20%)
  times.sort((a, b) => a - b);
  const trimmed = times.slice(Math.floor(runs * 0.2), Math.floor(runs * 0.8));
  const avg = trimmed.reduce((s, t) => s + t, 0) / trimmed.length;
  const min = times[0];
  
  return { avg, min };
}

console.log('WASM Optimization Pipeline Benchmarks');
console.log('='.repeat(60));
console.log(`${'Benchmark'.padEnd(25)} ${'No Opt'.padStart(10)} ${'Optimized'.padStart(10)} ${'Speedup'.padStart(10)}`);
console.log('-'.repeat(60));

for (const bench of benchmarks) {
  const noOpt = await runBenchmark(bench, false);
  const opt = await runBenchmark(bench, true);
  
  if (noOpt.error || opt.error) {
    console.log(`${bench.name.padEnd(25)} ${noOpt.error ? 'ERROR' : `${noOpt.avg.toFixed(2)}ms`} ${opt.error ? 'ERROR' : `${opt.avg.toFixed(2)}ms`}`);
    continue;
  }
  
  const speedup = noOpt.avg / opt.avg;
  const speedStr = speedup > 1 ? `${speedup.toFixed(2)}x` : `${(1/speedup).toFixed(2)}x slower`;
  
  console.log(
    `${bench.name.padEnd(25)} ${noOpt.avg.toFixed(2).padStart(8)}ms ${opt.avg.toFixed(2).padStart(8)}ms ${speedStr.padStart(10)}`
  );
}

console.log('-'.repeat(60));
console.log('Note: Optimization adds compile-time overhead but may reduce generated code size.');
