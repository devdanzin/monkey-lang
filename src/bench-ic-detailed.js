// bench-ic-detailed.js — Detailed IC/hidden classes performance analysis
import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import { Compiler } from './compiler.js';
import { VM } from './vm.js';
import { resetInternTable } from './object.js';

function runVM(input) {
  resetInternTable();
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

function bench(name, code, iterations = 10) {
  // Warm up
  runVM(code);
  
  const times = [];
  let lastVM;
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    const { result, vm } = runVM(code);
    const elapsed = performance.now() - start;
    times.push(elapsed);
    lastVM = vm;
  }
  times.sort((a, b) => a - b);
  const median = times[Math.floor(times.length / 2)];
  return { name, median, vm: lastVM, times };
}

console.log('╔══════════════════════════════════════════════════════════════════╗');
console.log('║       Inline Cache / Hidden Classes Performance Analysis        ║');
console.log('╠══════════════════════════════════════════════════════════════════╝');
console.log('');

// Benchmark 1: Monomorphic access (same shape, same property)
const mono = bench('Monomorphic (1000 accesses, same shape)', `
  let get_x = fn(h) { h["x"] }
  let h = {"x": 1, "y": 2}
  let sum = 0
  let i = 0
  while (i < 1000) {
    set sum = sum + get_x(h)
    set i = i + 1
  }
  sum
`);

// Benchmark 2: Polymorphic (2 shapes at same site)
const poly2 = bench('Polymorphic-2 (1000 accesses, 2 shapes)', `
  let get_x = fn(h) { h["x"] }
  let h1 = {"x": 1, "y": 2}
  let h2 = {"x": 3, "y": 4, "z": 5}
  let sum = 0
  let i = 0
  while (i < 500) {
    set sum = sum + get_x(h1) + get_x(h2)
    set i = i + 1
  }
  sum
`);

// Benchmark 3: Polymorphic (4 shapes)
const poly4 = bench('Polymorphic-4 (1000 accesses, 4 shapes)', `
  let get_x = fn(h) { h["x"] }
  let h1 = {"x": 1}
  let h2 = {"x": 2, "a": 0}
  let h3 = {"x": 3, "b": 0}
  let h4 = {"x": 4, "c": 0}
  let sum = 0
  let i = 0
  while (i < 250) {
    set sum = sum + get_x(h1) + get_x(h2) + get_x(h3) + get_x(h4)
    set i = i + 1
  }
  sum
`);

// Benchmark 4: Megamorphic (6+ shapes)
const mega = bench('Megamorphic (1000 accesses, 6 shapes)', `
  let get_x = fn(h) { h["x"] }
  let h1 = {"x": 1}
  let h2 = {"x": 2, "a": 0}
  let h3 = {"x": 3, "b": 0}
  let h4 = {"x": 4, "c": 0}
  let h5 = {"x": 5, "d": 0}
  let h6 = {"x": 6, "e": 0}
  let sum = 0
  let i = 0
  while (i < 167) {
    set sum = sum + get_x(h1) + get_x(h2) + get_x(h3) + get_x(h4) + get_x(h5) + get_x(h6)
    set i = i + 1
  }
  sum
`);

// Benchmark 5: String interning (same string comparison)
const intern = bench('String interning (1000 comparisons)', `
  let count = 0
  let i = 0
  while (i < 1000) {
    if ("hello" == "hello") { set count = count + 1 }
    set i = i + 1
  }
  count
`);

// Benchmark 6: Object construction (hidden class transitions)
const construct = bench('Object construction (500 objects)', `
  let make = fn(v) { {"x": v, "y": v * 2, "z": v * 3} }
  let sum = 0
  let i = 0
  while (i < 500) {
    let obj = make(i)
    set sum = sum + obj["z"]
    set i = i + 1
  }
  sum
`);

// Print results
const results = [mono, poly2, poly4, mega, intern, construct];

for (const r of results) {
  let totalHits = 0, totalMisses = 0;
  if (r.vm.icTable) {
    for (const [, ic] of r.vm.icTable) {
      totalHits += ic.hits || 0;
      totalMisses += ic.misses || 0;
    }
  }
  console.log(`  📊 ${r.name}`);
  console.log(`     Time: ${r.median.toFixed(2)}ms`);
  if (totalHits + totalMisses > 0) {
    console.log(`     IC: ${totalHits} hits, ${totalMisses} misses (${(totalHits / (totalHits + totalMisses) * 100).toFixed(1)}% hit rate)`);
  }
  console.log('');
}

// Summary table
console.log('╔═══════════════════════════════════════════╗');
console.log('║           Summary Table                    ║');
console.log('╠═══════════════════════════════════════════╣');
console.log('  Pattern          │ Time    │ Slowdown');
console.log('  ─────────────────┼─────────┼──────────');
for (const r of results) {
  const ratio = (r.median / mono.median).toFixed(1);
  console.log(`  ${r.name.split('(')[0].padEnd(18)}│ ${r.median.toFixed(2).padStart(6)}ms │ ${ratio}x`);
}
console.log('╚═══════════════════════════════════════════╝');
