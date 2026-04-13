#!/usr/bin/env node
// monkey-fuzzer.js — Grammar-based differential fuzzer for Monkey language
// Generates random valid Monkey programs and compares JIT vs interpreter output.
// Usage: node monkey-fuzzer.js [--count=N] [--seed=S] [--verbose]

import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPL_PATH = join(__dirname, 'src/repl.js');

// --- Seeded PRNG (xorshift32) ---
class RNG {
  constructor(seed = Date.now()) {
    this.state = seed | 0 || 1;
  }
  next() {
    let s = this.state;
    s ^= s << 13;
    s ^= s >> 17;
    s ^= s << 5;
    this.state = s;
    return (s >>> 0) / 0x100000000;
  }
  int(min, max) { return Math.floor(this.next() * (max - min + 1)) + min; }
  pick(arr) { return arr[this.int(0, arr.length - 1)]; }
  bool(p = 0.5) { return this.next() < p; }
}

// --- Grammar-Based Program Generator ---
class MonkeyGenerator {
  constructor(rng, opts = {}) {
    this.rng = rng;
    this.depth = 0;
    this.maxDepth = opts.maxDepth || 5;
    this.vars = [];
    this.fns = [];
  }

  program() {
    const stmts = [];
    const numStmts = this.rng.int(1, 8);
    for (let i = 0; i < numStmts; i++) {
      stmts.push(this.statement());
    }
    // Always end with a puts to produce output
    if (this.vars.length > 0) {
      stmts.push(`puts(${this.rng.pick(this.vars)});`);
    } else {
      stmts.push(`puts(${this.intLiteral()});`);
    }
    return stmts.join('\n');
  }

  statement() {
    this.depth++;
    let s;
    if (this.depth > this.maxDepth) {
      s = this.letStmt();
    } else {
      const choice = this.rng.int(0, 6);
      switch (choice) {
        case 0: case 1: case 2: s = this.letStmt(); break;
        case 3: s = this.fnDef(); break;
        case 4: s = this.ifStmt(); break;
        case 5: s = this.putsStmt(); break;
        case 6: s = this.letArrayStmt(); break;
      }
    }
    this.depth--;
    return s;
  }

  letStmt() {
    const name = this.freshVar();
    // Generate expr BEFORE adding var to avoid self-reference
    const val = this.expr();
    this.vars.push(name);
    return `let ${name} = ${val};`;
  }

  letArrayStmt() {
    const name = this.freshVar();
    const len = this.rng.int(0, 5);
    const elems = [];
    for (let i = 0; i < len; i++) elems.push(this.intLiteral());
    this.vars.push(name);
    return `let ${name} = [${elems.join(', ')}];`;
  }

  fnDef() {
    const name = this.freshVar();
    const params = [];
    const numParams = this.rng.int(0, 3);
    for (let i = 0; i < numParams; i++) params.push(this.freshVar());
    const oldVars = [...this.vars];
    this.vars.push(...params);
    const body = this.expr();
    this.vars = oldVars;
    this.fns.push(name);
    this.vars.push(name);
    return `let ${name} = fn(${params.join(', ')}) { ${body} };`;
  }

  ifStmt() {
    const cond = this.comparison();
    const thenBody = this.expr();
    const elseBody = this.rng.bool(0.5) ? ` else { ${this.expr()} }` : '';
    return `if (${cond}) { ${thenBody}; }${elseBody};`;
  }

  whileStmt() {
    const counter = this.freshVar();
    this.vars.push(counter);
    const limit = this.rng.int(1, 20);
    const accum = this.freshVar();
    this.vars.push(accum);
    return `let ${counter} = 0;\nlet ${accum} = 0;\nwhile (${counter} < ${limit}) { let ${counter} = ${counter} + 1; let ${accum} = ${accum} + 1; };`;
  }

  putsStmt() {
    return `puts(${this.expr()});`;
  }

  expr() {
    if (this.depth > this.maxDepth) return this.atom();
    this.depth++;
    let e;
    const choice = this.rng.int(0, 8);
    switch (choice) {
      case 0: case 1: case 2: e = this.atom(); break;
      case 3: case 4: e = this.binaryExpr(); break;
      case 5: e = this.callExpr(); break;
      case 6: e = this.ifExpr(); break;
      case 7: e = this.stringLiteral(); break;
      case 8: e = this.arrayLiteral(); break;
    }
    this.depth--;
    return e;
  }

  atom() {
    if (this.vars.length > 0 && this.rng.bool(0.6)) {
      return this.rng.pick(this.vars);
    }
    return this.intLiteral();
  }

  // Safe atom that only uses already-defined vars (not the current let target)
  safeAtom() {
    if (this.vars.length > 0 && this.rng.bool(0.6)) {
      return this.rng.pick(this.vars);
    }
    return this.intLiteral();
  }

  intLiteral() {
    return String(this.rng.int(-100, 1000));
  }

  stringLiteral() {
    const words = ['hello', 'world', 'monkey', 'test', 'foo', 'bar'];
    return `"${this.rng.pick(words)}"`;
  }

  arrayLiteral() {
    const len = this.rng.int(0, 4);
    const elems = [];
    for (let i = 0; i < len; i++) elems.push(this.intLiteral());
    return `[${elems.join(', ')}]`;
  }

  binaryExpr() {
    const op = this.rng.pick(['+', '-', '*']);
    const left = this.atom();
    const right = this.atom();
    return `(${left} ${op} ${right})`;
  }

  callExpr() {
    if (this.fns.length > 0) {
      const fn = this.rng.pick(this.fns);
      return `${fn}()`;
    }
    const builtins = ['len', 'type'];
    const fn = this.rng.pick(builtins);
    if (fn === 'len') {
      return `len([${this.intLiteral()}, ${this.intLiteral()}])`;
    }
    return `type(${this.intLiteral()})`;
  }

  ifExpr() {
    const cond = this.comparison();
    const then = this.atom();
    const els = this.atom();
    return `if (${cond}) { ${then} } else { ${els} }`;
  }

  comparison() {
    const op = this.rng.pick(['==', '!=', '<', '>']);
    return `${this.atom()} ${op} ${this.atom()}`;
  }

  freshVar() {
    const id = this._varCounter || 0;
    this._varCounter = id + 1;
    return `v${id}`;
  }
}

// Filter out cosmetic differences (e.g., Closure[N] vs fn(...) { ... })
function isCosmetic(jitOut, evalOut) {
  if (!jitOut || !evalOut) return jitOut === evalOut;
  // VM prints closures as "Closure[N]", interpreter prints "fn(...) { ... }" (multiline)
  const closurePattern = /^Closure\[\d+\]$/;
  const fnPattern = /^fn\(.*?\)\s*\{/;
  // Normalize: trim, compare line by line, allowing closure representation differences
  const jLines = jitOut.trim().split('\n');
  const eLines = evalOut.trim().split('\n');
  // If jit is a single Closure line and eval starts with fn(, it's cosmetic
  if (jLines.length === 1 && closurePattern.test(jLines[0].trim()) && fnPattern.test(eLines[0].trim())) {
    return true;
  }
  return false;
}

// --- Fuzzer Runner ---
function runDiffTest(program, tmpFile) {
  writeFileSync(tmpFile, program);
  try {
    const result = execSync(`node ${REPL_PATH} --diff-test ${tmpFile}`, {
      timeout: 5000,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return { match: true, stderr: result };
  } catch (e) {
    // Exit code 1 = mismatch, parse stderr for details
    const stderr = e.stderr?.toString() || '';
    try {
      const parsed = JSON.parse(stderr);
      return { match: parsed.match === true, ...parsed };
    } catch {
      return { match: false, error: stderr || e.message };
    }
  }
}

// --- Main ---
const args = process.argv.slice(2);
const countArg = args.find(a => a.startsWith('--count='));
const seedArg = args.find(a => a.startsWith('--seed='));
const verbose = args.includes('--verbose');

const count = countArg ? parseInt(countArg.split('=')[1]) : 100;
const seed = seedArg ? parseInt(seedArg.split('=')[1]) : Date.now();

console.log(`Monkey Grammar Fuzzer — ${count} programs, seed=${seed}`);

const tmpDir = join(process.env.TMPDIR || '/tmp', 'monkey-fuzz');
if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });
const tmpFile = join(tmpDir, 'fuzz.monkey');

let passed = 0;
let failed = 0;
let errors = 0;
const mismatches = [];

for (let i = 0; i < count; i++) {
  const rng = new RNG(seed + i);
  const gen = new MonkeyGenerator(rng);
  const program = gen.program();

  if (verbose && i % 10 === 0) {
    process.stdout.write(`\r  ${i}/${count}...`);
  }

  try {
    const result = runDiffTest(program, tmpFile);
    if (result.match || isCosmetic(result.jit_output, result.eval_output)) {
      passed++;
    } else {
      failed++;
      mismatches.push({
        seed: seed + i,
        program,
        jit_output: result.jit_output,
        eval_output: result.eval_output
      });
      if (verbose) {
        console.log(`\n  MISMATCH #${failed} (seed=${seed + i}):`);
        console.log(`  JIT:  ${result.jit_output}`);
        console.log(`  Eval: ${result.eval_output}`);
      }
    }
  } catch (e) {
    errors++;
    if (verbose) {
      console.log(`\n  ERROR #${errors} (seed=${seed + i}): ${e.message}`);
    }
  }
}

if (verbose) process.stdout.write('\r');
console.log(`\nResults:`);
console.log(`  Passed:     ${passed}/${count}`);
console.log(`  Mismatches: ${failed}`);
console.log(`  Errors:     ${errors}`);

if (mismatches.length > 0) {
  console.log(`\nFirst 5 mismatches:`);
  for (const m of mismatches.slice(0, 5)) {
    console.log(`  --- seed=${m.seed} ---`);
    console.log(`  Program: ${m.program.slice(0, 100)}...`);
    console.log(`  JIT:  ${m.jit_output?.slice(0, 80)}`);
    console.log(`  Eval: ${m.eval_output?.slice(0, 80)}`);
  }
}

process.exit(failed > 0 ? 1 : 0);
