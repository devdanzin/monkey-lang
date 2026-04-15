// bench-ic.js — Benchmark inline caching for hash property access
import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import { Compiler } from './compiler.js';
import { VM } from './vm.js';

function runVM(input) {
  const lexer = new Lexer(input);
  const parser = new Parser(lexer);
  const program = parser.parseProgram();
  if (parser.errors.length > 0) throw new Error(parser.errors.join('\n'));
  const compiler = new Compiler();
  compiler.compile(program);
  const vm = new VM(compiler.bytecode());
  vm.run();
  return { result: vm.lastPoppedStackElem(), vm };
}

function bench(name, code, iterations = 5) {
  // Warm up
  runVM(code);
  
  const times = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    const { result, vm } = runVM(code);
    const elapsed = performance.now() - start;
    times.push(elapsed);
  }
  
  times.sort((a, b) => a - b);
  const median = times[Math.floor(times.length / 2)];
  console.log(`${name}: ${median.toFixed(2)}ms (median of ${iterations})`);
}

console.log('=== Inline Cache Benchmarks ===\n');

// Benchmark 1: Repeated access to same key on same shape
bench('same-shape-access (1000x)', `
  let h = {"x": 1, "y": 2, "z": 3}
  let sum = 0
  let i = 0
  while (i < 1000) {
    set sum = sum + h["x"] + h["y"] + h["z"]
    set i = i + 1
  }
  sum
`);

// Benchmark 2: Array of hashes with same shape (common pattern)
bench('array-of-hashes (100 points)', `
  let make_point = fn(x, y) { {"x": x, "y": y} }
  let points = []
  let i = 0
  while (i < 100) {
    set points = push(points, make_point(i, i * 2))
    set i = i + 1
  }
  let sum = 0
  for (p in points) {
    set sum = sum + p["x"] + p["y"]
  }
  sum
`);

// Benchmark 3: Nested hash access
bench('nested-hash (500x)', `
  let config = {"db": {"host": "localhost", "port": 5432}, "cache": {"ttl": 60}}
  let sum = 0
  let i = 0
  while (i < 500) {
    set sum = sum + config["db"]["port"] + config["cache"]["ttl"]
    set i = i + 1
  }
  sum
`);

// Benchmark 4: Polymorphic — different shapes at same site
bench('polymorphic-access (200x)', `
  let make_2d = fn(x, y) { {"x": x, "y": y} }
  let make_3d = fn(x, y, z) { {"x": x, "y": y, "z": z} }
  let sum = 0
  let i = 0
  while (i < 200) {
    let p = if (i % 2 == 0) { make_2d(i, i) } else { make_3d(i, i, i) }
    set sum = sum + p["x"]
    set i = i + 1
  }
  sum
`);

// Print IC stats
console.log('\n=== IC Stats ===');
const { result, vm } = runVM(`
  let h = {"a": 1, "b": 2}
  let sum = 0
  let i = 0
  while (i < 100) {
    set sum = sum + h["a"] + h["b"]
    set i = i + 1
  }
  sum
`);
console.log(`Result: ${result.inspect()}`);
let totalHits = 0, totalMisses = 0;
for (const [ip, ic] of vm.icTable) {
  if (ic.hits > 0 || ic.misses > 0) {
    totalHits += ic.hits;
    totalMisses += ic.misses;
    console.log(`  IP ${ip}: hits=${ic.hits} misses=${ic.misses} ${ic.megamorphic ? 'MEGA' : ic.poly ? `POLY(${ic.poly.length})` : 'MONO'}`);
  }
}
console.log(`Total: ${totalHits} hits, ${totalMisses} misses (${(totalHits/(totalHits+totalMisses)*100).toFixed(1)}% hit rate)`);
