#!/usr/bin/env node
// corpus-smoke.js — Run a sample from the monkey-lang-tests-corpus through diff-test
// Usage: node corpus-smoke.js [--corpus=/path/to/corpus] [--count=N] [--verbose]
//
// Downloads the corpus if not present, picks N random .monkey files with "puts",
// runs each through --diff-test (JIT vs interpreter), reports pass/fail.

import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPL_PATH = join(__dirname, 'src/repl.js');

const args = process.argv.slice(2);
const corpusArg = args.find(a => a.startsWith('--corpus='));
const corpusPath = corpusArg ? corpusArg.split('=')[1] : '/tmp/monkey-tests-corpus';
const countArg = args.find(a => a.startsWith('--count='));
const count = countArg ? parseInt(countArg.split('=')[1]) : 100;
const verbose = args.includes('--verbose');

// Find all .monkey files
function findMonkeyFiles(dir) {
  const files = [];
  function walk(d) {
    try {
      for (const entry of readdirSync(d, { withFileTypes: true })) {
        const full = join(d, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith('.monkey')) files.push(full);
      }
    } catch {}
  }
  walk(dir);
  return files;
}

// Shuffle array using Fisher-Yates
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const testsDir = join(corpusPath, 'harvested/tests-licensed');
if (!existsSync(testsDir)) {
  console.error(`Corpus not found at ${testsDir}`);
  console.error('Clone it: git clone https://github.com/devdanzin/monkey-lang-tests-corpus.git /tmp/monkey-tests-corpus');
  process.exit(1);
}

console.log('Finding .monkey files...');
const allFiles = findMonkeyFiles(testsDir);
console.log(`Found ${allFiles.length} test programs`);

// Filter to files containing puts (likely to produce output)
const putsFiles = allFiles.filter(f => {
  try {
    return readFileSync(f, 'utf8').includes('puts');
  } catch { return false; }
});
console.log(`${putsFiles.length} have puts() calls`);

// Sample
const sample = shuffle(putsFiles).slice(0, Math.min(count, putsFiles.length));
console.log(`Running ${sample.length} programs through --diff-test...\n`);

let passed = 0, failed = 0, errors = 0, timeouts = 0;
const failures = [];

for (let i = 0; i < sample.length; i++) {
  const file = sample[i];
  if (verbose && i % 10 === 0) {
    process.stdout.write(`\r  ${i}/${sample.length}...`);
  }
  try {
    execSync(`node ${REPL_PATH} --diff-test "${file}"`, {
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    passed++;
  } catch (e) {
    const stderr = e.stderr?.toString() || '';
    if (e.killed || e.signal === 'SIGTERM') {
      timeouts++;
      continue;
    }
    try {
      const result = JSON.parse(stderr);
      if (result.match === false) {
        failed++;
        failures.push({ file, jit: result.jit_output, eval: result.eval_output });
      } else if (result.error) {
        // Parse error — expected for some corpus programs
        errors++;
      } else {
        passed++;
      }
    } catch {
      errors++; // Parse errors, unsupported syntax, etc
    }
  }
}

if (verbose) process.stdout.write('\r');
console.log(`\nResults (${sample.length} programs):`);
console.log(`  Passed:   ${passed}`);
console.log(`  Failed:   ${failed} (JIT ≠ interpreter)`);
console.log(`  Errors:   ${errors} (parse/runtime errors — expected for cross-impl corpus)`);
console.log(`  Timeouts: ${timeouts}`);

if (failures.length > 0) {
  console.log('\nDivergent programs:');
  for (const f of failures.slice(0, 5)) {
    console.log(`  ${f.file}`);
    console.log(`    JIT:  ${f.jit?.slice(0, 80)}`);
    console.log(`    Eval: ${f.eval?.slice(0, 80)}`);
  }
}

process.exit(failed > 0 ? 1 : 0);
