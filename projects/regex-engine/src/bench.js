// bench.js — Performance benchmarks: NFA vs DFA vs native RegExp

import { match as nfaMatch, test as nfaTest } from './regex.js';
import { compile as dfaCompile } from './dfa.js';
import { matchCaptures, matchAll } from './capture.js';

function bench(name, fn, iterations = 1000) {
  // Warmup
  for (let i = 0; i < Math.min(100, iterations); i++) fn();

  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const elapsed = performance.now() - start;

  return {
    name,
    iterations,
    totalMs: elapsed.toFixed(2),
    perOpUs: ((elapsed / iterations) * 1000).toFixed(2),
    opsPerSec: Math.floor(iterations / (elapsed / 1000)),
  };
}

function formatResult(r) {
  return `  ${r.name.padEnd(35)} ${r.perOpUs.padStart(10)}µs/op  ${String(r.opsPerSec).padStart(12)} ops/s`;
}

function runSuite(suiteName, benchmarks) {
  console.log(`\n═══ ${suiteName} ═══`);
  const results = benchmarks.map(b => bench(b.name, b.fn, b.iterations || 1000));
  results.forEach(r => console.log(formatResult(r)));

  // Find fastest
  const fastest = results.reduce((a, b) => parseFloat(a.perOpUs) < parseFloat(b.perOpUs) ? a : b);
  console.log(`  → Fastest: ${fastest.name}`);
  return results;
}

// ===== Benchmarks =====

console.log('╔═══════════════════════════════════════════════╗');
console.log('║   Regex Engine Benchmarks — NFA vs DFA vs JS ║');
console.log('╚═══════════════════════════════════════════════╝');

// 1. Simple literal matching
const dfa1 = dfaCompile('hello');
runSuite('Simple literal: "hello" against "hello world"', [
  { name: 'NFA match', fn: () => nfaMatch('hello', 'hello') },
  { name: 'DFA match (compiled)', fn: () => dfa1.match('hello') },
  { name: 'Native RegExp', fn: () => /^hello$/.test('hello') },
]);

// 2. Character class
const dfa2 = dfaCompile('[a-z]+');
runSuite('Character class: [a-z]+ against "helloworld"', [
  { name: 'NFA match', fn: () => nfaMatch('[a-z]+', 'helloworld') },
  { name: 'DFA match (compiled)', fn: () => dfa2.match('helloworld') },
  { name: 'Native RegExp', fn: () => /^[a-z]+$/.test('helloworld') },
]);

// 3. Alternation
const dfa3 = dfaCompile('cat|dog|bird|fish');
runSuite('Alternation: cat|dog|bird|fish', [
  { name: 'NFA match "fish"', fn: () => nfaMatch('cat|dog|bird|fish', 'fish') },
  { name: 'DFA match "fish"', fn: () => dfa3.match('fish') },
  { name: 'Native RegExp "fish"', fn: () => /^(cat|dog|bird|fish)$/.test('fish') },
]);

// 4. Kleene star (potential catastrophic backtracking pattern)
const dfa4 = dfaCompile('(a|b)*c');
runSuite('Kleene star: (a|b)*c against "aababababababc"', [
  { name: 'NFA match', fn: () => nfaMatch('(a|b)*c', 'aababababababc') },
  { name: 'DFA match (compiled)', fn: () => dfa4.match('aababababababc') },
  { name: 'Native RegExp', fn: () => /^(a|b)*c$/.test('aababababababc') },
]);

// 5. Pathological case: a?^n a^n
// This is the classic case where backtracking engines are O(2^n)
// but NFA/DFA are O(n)
console.log('\n═══ Pathological: a?ⁿaⁿ (NFA/DFA should dominate) ═══');
for (const n of [10, 15, 20, 25]) {
  const pattern = 'a?'.repeat(n) + 'a'.repeat(n);
  const text = 'a'.repeat(n);
  const dfa = dfaCompile(pattern);
  const nativeRe = new RegExp('^' + pattern + '$');

  const results = [
    bench(`NFA n=${n}`, () => nfaMatch(pattern, text), n <= 15 ? 100 : 10),
    bench(`DFA n=${n}`, () => dfa.match(text), 1000),
    bench(`Native n=${n}`, () => nativeRe.test(text), n <= 20 ? 1000 : 100),
  ];
  results.forEach(r => console.log(formatResult(r)));
}

// 6. Capture groups
runSuite('Capture groups: (\\d+)-(\\d+) against "123-456"', [
  { name: 'Backtracking capture', fn: () => matchCaptures('(\\d+)-(\\d+)', '123-456') },
  { name: 'Native RegExp exec', fn: () => /^(\d+)-(\d+)$/.exec('123-456') },
]);

// 7. matchAll
const text7 = 'The price is $42.99 and $18.50 and $7.25';
runSuite('matchAll: \\d+ in "The price is $42.99..."', [
  { name: 'Our matchAll', fn: () => matchAll('\\d+', text7) },
  { name: 'Native matchAll', fn: () => [...text7.matchAll(/\d+/g)] },
]);

// 8. Long string matching
const longText = 'a'.repeat(10000) + 'b';
const dfa8 = dfaCompile('a+b');
runSuite('Long string: a+b against 10000 a\'s + b', [
  { name: 'NFA match', fn: () => nfaMatch('a+b', longText), iterations: 100 },
  { name: 'DFA match (compiled)', fn: () => dfa8.match(longText), iterations: 100 },
  { name: 'Native RegExp', fn: () => /^a+b$/.test(longText), iterations: 100 },
]);

// 9. DFA compilation cost
runSuite('DFA compilation cost: compile("[a-z]+@[a-z]+")', [
  { name: 'Compile + match', fn: () => dfaCompile('[a-z]+@[a-z]+').match('alice@example'), iterations: 100 },
  { name: 'NFA (no compile)', fn: () => nfaMatch('[a-z]+@[a-z]+', 'alice@example'), iterations: 100 },
]);

console.log('\n✅ Benchmarks complete');
