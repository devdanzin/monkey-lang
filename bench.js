#!/usr/bin/env node
// bench.js — Quick benchmarks for Monkey-lang VM
import { Lexer } from './src/lexer.js';
import { Parser } from './src/parser.js';
import { Compiler } from './src/compiler.js';
import { VM } from './src/vm.js';
import { GarbageCollector } from './src/gc.js';
import { optimize } from './src/optimizer.js';

function bench(name, input, opts = {}) {
  const l = new Lexer(input);
  const p = new Parser(l);
  const prog = p.parseProgram();
  if (p.errors.length > 0) throw new Error(p.errors.join('\n'));
  const c = new Compiler();
  c.compile(prog);
  const bc = c.bytecode();
  
  if (opts.optimize) {
    bc.instructions = optimize(bc.instructions);
  }
  
  const gc = opts.gc ? new GarbageCollector({ threshold: opts.gcThreshold || 500 }) : null;
  
  const runs = opts.runs || 5;
  const times = [];
  let result;
  
  for (let i = 0; i < runs; i++) {
    const vm = new VM({ constants: bc.constants, instructions: bc.instructions }, gc);
    const start = performance.now();
    vm.run();
    times.push(performance.now() - start);
    result = vm.lastPoppedStackElem();
  }
  
  times.sort((a, b) => a - b);
  const median = times[Math.floor(times.length / 2)];
  const min = times[0];
  const max = times[times.length - 1];
  
  console.log(`${name.padEnd(30)} ${median.toFixed(2).padStart(8)}ms (min=${min.toFixed(2)}, max=${max.toFixed(2)}) → ${result.inspect()}`);
  
  if (gc) {
    const stats = gc.getStats();
    console.log(`  GC: ${stats.collections} collections, ${stats.totalAllocated} allocated, ${stats.totalFreed} freed`);
  }
}

console.log('=== Monkey-lang Benchmarks ===\n');

bench('fib(25)', `
  let fib = fn(n) { if (n < 2) { n } else { fib(n - 1) + fib(n - 2) } };
  fib(25)
`);

bench('fib(25) optimized', `
  let fib = fn(n) { if (n < 2) { n } else { fib(n - 1) + fib(n - 2) } };
  fib(25)
`, { optimize: true });

bench('fib(25) with GC', `
  let fib = fn(n) { if (n < 2) { n } else { fib(n - 1) + fib(n - 2) } };
  fib(25)
`, { gc: true, gcThreshold: 1000 });

bench('sum(1..1000)', `
  let sum = fn(n, acc) { if (n == 0) { acc } else { sum(n - 1, acc + n) } };
  sum(1000, 0)
`);

bench('array comprehension', `
  let squares = [x ** 2 for x in 1..100];
  len(squares)
`);

bench('closure counter 1000x', `
  let make = fn() {
    let n = 0;
    let inc = fn() { set n = n + 1; n };
    inc
  };
  let counter = make();
  for (i in 1..1000) { counter(); }
  counter()
`);

bench('match dispatch', `
  let classify = fn(n) {
    match n % 3 {
      0 => "fizz",
      1 => "one",
      _ => "other"
    }
  };
  let result = 0;
  for (i in 1..100) {
    if (classify(i) == "fizz") { set result = result + 1; }
  }
  result
`);

bench('deep equality arrays', `
  let a = [x for x in 1..50];
  let b = [x for x in 1..50];
  a == b
`);

console.log('\nDone!');
