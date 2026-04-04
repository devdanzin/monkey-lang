#!/usr/bin/env node
// cli.js — Run .wasm files with WASI support

import { readFileSync } from 'node:fs';
import { decode } from './decoder.js';
import { WasmInstance } from './runtime.js';
import { WasiHost, WasiExit } from './wasi.js';

function usage() {
  console.log('Usage: wasm-run <file.wasm> [args...]');
  console.log('');
  console.log('Options:');
  console.log('  --help     Show this help');
  console.log('  --stats    Print execution stats');
  console.log('  --decode   Just decode and print module info');
  process.exit(0);
}

const args = process.argv.slice(2);
if (args.length === 0 || args.includes('--help')) usage();

const decodeOnly = args.includes('--decode');
const showStats = args.includes('--stats');
const wasmFile = args.find(a => !a.startsWith('--'));
const wasmArgs = args.slice(args.indexOf(wasmFile) + 1).filter(a => !a.startsWith('--'));

if (!wasmFile) {
  console.error('Error: No .wasm file specified');
  process.exit(1);
}

try {
  const t0 = performance.now();
  const fileBuffer = readFileSync(wasmFile);
  // Convert Node.js Buffer to a proper ArrayBuffer (Buffer shares memory with a larger pool)
  const arrayBuf = fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength);
  const tRead = performance.now() - t0;

  const t1 = performance.now();
  const module = decode(arrayBuf);
  const tDecode = performance.now() - t1;

  if (decodeOnly) {
    console.log('Module info:');
    console.log(`  Types:     ${module.types.length}`);
    console.log(`  Imports:   ${module.imports.length}`);
    console.log(`  Functions: ${module.functions.length}`);
    console.log(`  Tables:    ${module.tables.length}`);
    console.log(`  Memories:  ${module.memories.length}`);
    console.log(`  Globals:   ${module.globals.length}`);
    console.log(`  Exports:   ${module.exports.length}`);
    console.log(`  Data:      ${module.data.length}`);
    console.log(`  Elements:  ${module.elements.length}`);
    console.log(`  Start:     ${module.start ?? 'none'}`);
    console.log('\nExports:');
    for (const exp of module.exports) {
      console.log(`  ${exp.kind} ${exp.name} (index ${exp.index})`);
    }
    if (showStats) {
      console.log(`\nRead: ${tRead.toFixed(1)}ms, Decode: ${tDecode.toFixed(1)}ms`);
    }
    process.exit(0);
  }

  // Set up WASI
  const wasi = new WasiHost({
    args: [wasmFile, ...wasmArgs],
    env: process.env,
  });

  const t2 = performance.now();
  const imports = wasi.getImports();
  const instance = new WasmInstance(module, imports);
  wasi.memory = instance.memory;
  const tInit = performance.now() - t2;

  // Find and run _start
  const startExport = module.exports.find(e => e.kind === 'func' && e.name === '_start');
  if (!startExport) {
    // Try 'main' as fallback
    const mainExport = module.exports.find(e => e.kind === 'func' && e.name === 'main');
    if (mainExport) {
      const t3 = performance.now();
      const result = instance.exports.main();
      const tExec = performance.now() - t3;
      if (result !== undefined) process.stdout.write(String(result) + '\n');
      // Print any WASI output
      const out = wasi.getStdout();
      if (out) process.stdout.write(out);
      const err = wasi.getStderr();
      if (err) process.stderr.write(err);
      if (showStats) printStats(tRead, tDecode, tInit, tExec);
    } else {
      console.error('Error: No _start or main export found');
      process.exit(1);
    }
  } else {
    const t3 = performance.now();
    try {
      instance.exports._start();
    } catch (e) {
      if (e instanceof WasiExit) {
        const out = wasi.getStdout();
        if (out) process.stdout.write(out);
        const err = wasi.getStderr();
        if (err) process.stderr.write(err);
        if (showStats) printStats(tRead, tDecode, tInit, performance.now() - t3);
        process.exit(e.code);
      }
      throw e;
    }
    const tExec = performance.now() - t3;
    const out = wasi.getStdout();
    if (out) process.stdout.write(out);
    const err = wasi.getStderr();
    if (err) process.stderr.write(err);
    if (showStats) printStats(tRead, tDecode, tInit, tExec);
  }

} catch (e) {
  if (e instanceof WasiExit) process.exit(e.code);
  console.error(`Error: ${e.message}`);
  if (process.env.DEBUG) console.error(e.stack);
  process.exit(1);
}

function printStats(tRead, tDecode, tInit, tExec) {
  const total = tRead + tDecode + tInit + tExec;
  console.error(`\n--- Stats ---`);
  console.error(`Read:    ${tRead.toFixed(1)}ms`);
  console.error(`Decode:  ${tDecode.toFixed(1)}ms`);
  console.error(`Init:    ${tInit.toFixed(1)}ms`);
  console.error(`Execute: ${tExec.toFixed(1)}ms`);
  console.error(`Total:   ${total.toFixed(1)}ms`);
}
