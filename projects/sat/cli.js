#!/usr/bin/env node

/**
 * SAT Solver CLI
 * 
 * Usage:
 *   node cli.js <file.cnf>           Solve a DIMACS CNF file
 *   node cli.js --bench               Run built-in benchmarks (DPLL vs CDCL)
 *   node cli.js --queens <n>          Solve N-Queens as SAT
 *   node cli.js --pigeon <n>          Prove pigeonhole(n) is UNSAT
 *   node cli.js --random <v> <c> [k]  Solve random k-SAT (default k=3)
 */

import { readFileSync } from 'node:fs';
import { 
  CDCLSolver, solveDPLL, verify, parseDIMACS, 
  nQueens, pigeonhole, randomSAT 
} from './src/index.js';

const args = process.argv.slice(2);

function time(fn) {
  const start = performance.now();
  const result = fn();
  const elapsed = performance.now() - start;
  return { result, elapsed };
}

function printResult(r, elapsed, clauses) {
  if (r.sat) {
    console.log(`s SATISFIABLE  (${elapsed.toFixed(1)}ms)`);
    if (clauses) {
      const valid = verify(clauses, r.model);
      console.log(`v Model verified: ${valid ? '✓' : '✗'}`);
    }
    // Print model in DIMACS format
    const lits = [];
    for (const [v, val] of r.model) {
      lits.push(val ? v : -v);
    }
    lits.sort((a, b) => Math.abs(a) - Math.abs(b));
    console.log(`v ${lits.join(' ')} 0`);
  } else {
    console.log(`s UNSATISFIABLE  (${elapsed.toFixed(1)}ms)`);
  }
  if (r.stats) {
    console.log(`c decisions: ${r.stats.decisions}, propagations: ${r.stats.propagations}, conflicts: ${r.stats.conflicts}, learned: ${r.stats.learned}, restarts: ${r.stats.restarts}`);
  }
}

function runBenchmarks() {
  console.log('=== SAT Solver Benchmarks: DPLL vs CDCL ===\n');
  
  const benchmarks = [
    { name: '4-Queens', gen: () => nQueens(4) },
    { name: '8-Queens', gen: () => nQueens(8) },
    { name: 'PHP(3,2)', gen: () => pigeonhole(2) },
    { name: 'PHP(4,3)', gen: () => pigeonhole(3) },
    { name: 'PHP(5,4)', gen: () => pigeonhole(4) },
    { name: 'Random 20v/60c', gen: () => ({ clauses: randomSAT(20, 60, 3), numVars: 20 }) },
    { name: 'Random 30v/100c', gen: () => ({ clauses: randomSAT(30, 100, 3), numVars: 30 }) },
    { name: 'Random 50v/200c', gen: () => ({ clauses: randomSAT(50, 200, 3), numVars: 50 }) },
  ];

  console.log('Problem'.padEnd(20) + 'DPLL'.padStart(12) + 'CDCL'.padStart(12) + 'Speedup'.padStart(10) + '  Result');
  console.log('-'.repeat(66));

  for (const { name, gen } of benchmarks) {
    const { clauses, numVars } = gen();
    
    // DPLL
    let dpllTime, dpllResult;
    try {
      const d = time(() => solveDPLL(clauses));
      dpllTime = d.elapsed;
      dpllResult = d.result;
    } catch {
      dpllTime = Infinity;
      dpllResult = { sat: '?' };
    }
    
    // CDCL
    const { result: cdclResult, elapsed: cdclTime } = time(() => {
      const s = new CDCLSolver(numVars, clauses);
      return s.solve();
    });
    
    const speedup = dpllTime === Infinity ? '∞' : (dpllTime / cdclTime).toFixed(1) + 'x';
    const sat = cdclResult.sat ? 'SAT' : 'UNSAT';
    
    console.log(
      name.padEnd(20) + 
      `${dpllTime === Infinity ? 'timeout' : dpllTime.toFixed(1) + 'ms'}`.padStart(12) + 
      `${cdclTime.toFixed(1)}ms`.padStart(12) + 
      speedup.padStart(10) + 
      `  ${sat}`
    );
  }
  console.log();
}

// Main
if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  console.log(`SAT Solver — CDCL with clause learning, VSIDS, watched literals

Usage:
  node cli.js <file.cnf>           Solve DIMACS CNF file
  node cli.js --bench              Run benchmarks (DPLL vs CDCL)
  node cli.js --queens <n>         Solve N-Queens
  node cli.js --pigeon <n>         Prove pigeonhole(n) UNSAT
  node cli.js --random <v> <c> [k] Random k-SAT`);
  process.exit(0);
}

if (args[0] === '--bench') {
  runBenchmarks();
} else if (args[0] === '--queens') {
  const n = parseInt(args[1]) || 8;
  console.log(`Solving ${n}-Queens as SAT...`);
  const { clauses, numVars } = nQueens(n);
  console.log(`c ${numVars} variables, ${clauses.length} clauses`);
  const { result, elapsed } = time(() => new CDCLSolver(numVars, clauses).solve());
  printResult(result, elapsed, clauses);
  if (result.sat) {
    console.log(`\nBoard:`);
    for (let r = 0; r < n; r++) {
      let line = '';
      for (let c = 0; c < n; c++) {
        line += result.model.get(r * n + c + 1) ? 'Q ' : '. ';
      }
      console.log(line);
    }
  }
} else if (args[0] === '--pigeon') {
  const n = parseInt(args[1]) || 3;
  console.log(`Proving pigeonhole(${n}) UNSAT: ${n+1} pigeons, ${n} holes...`);
  const { clauses, numVars } = pigeonhole(n);
  console.log(`c ${numVars} variables, ${clauses.length} clauses`);
  const { result, elapsed } = time(() => new CDCLSolver(numVars, clauses).solve());
  printResult(result, elapsed);
} else if (args[0] === '--random') {
  const v = parseInt(args[1]) || 20;
  const c = parseInt(args[2]) || Math.floor(v * 4.27);
  const k = parseInt(args[3]) || 3;
  console.log(`Random ${k}-SAT: ${v} vars, ${c} clauses (ratio ${(c/v).toFixed(2)})...`);
  const clauses = randomSAT(v, c, k);
  const { result, elapsed } = time(() => new CDCLSolver(v, clauses).solve());
  printResult(result, elapsed, clauses);
} else {
  // DIMACS file
  const file = args[0];
  try {
    const content = readFileSync(file, 'utf8');
    const { numVars, clauses } = parseDIMACS(content);
    console.log(`c ${numVars} variables, ${clauses.length} clauses`);
    const { result, elapsed } = time(() => new CDCLSolver(numVars, clauses).solve());
    printResult(result, elapsed, clauses);
  } catch (e) {
    console.error(`Error reading ${file}: ${e.message}`);
    process.exit(1);
  }
}
