#!/usr/bin/env node

// Monkey Language REPL with JIT Diagnostics
// Supports tree-walking interpreter, bytecode VM, and tracing JIT compiler.
// Usage: monkey [--engine=vm|eval|jit] [--version] [file.monkey]

import * as readline from 'node:readline';
import * as fs from 'node:fs';
import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import { monkeyEval } from './evaluator.js';
import { Compiler } from './compiler.js';
import { VM } from './vm.js';
import { IR } from './jit.js';
import { Environment, NULL } from './object.js';
import { STDLIB_SOURCE } from './stdlib.js';
import { compileAndRun as wasmCompileAndRun, WasmCompiler, formatWasmValue } from './wasm-compiler.js';
import { Transpiler } from './transpiler.js';
import { disassemble as wasmDisassemble } from './wasm-dis.js';

const VERSION = '0.3.0';

// Handle --version flag
if (process.argv.includes('--version') || process.argv.includes('-v')) {
  console.log(`Monkey Language v${VERSION}`);
  console.log(`1245 tests | 7 modules | 5 backends: Eval, VM, JIT, Transpiler, WASM`);
  process.exit(0);
}

// Handle --help flag
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`Monkey Language v${VERSION}`);
  console.log(`\nUsage: monkey [options] [file.monkey]`);
  console.log(`\nOptions:`);
  console.log(`  --engine=vm|eval|jit  Select execution engine (default: jit)`);
  console.log(`  --engine=vm|eval|jit|wasm|transpiler  Select execution engine`);
  console.log(`  --compile             Compile .monkey file to .wasm binary`);
  console.log(`  --version, -v         Show version`);
  console.log(`  --help, -h            Show this help`);
  console.log(`\nREPL Commands:`);
  console.log(`  :engine <name>        Switch engine (vm|eval|jit|wasm|transpiler)`);
  console.log(`  :jit                  Show JIT statistics`);
  console.log(`  :quit                 Exit`);
  console.log(`\nModules: math, string, algorithms, array, json, functional`);
  console.log(`Website: https://henry-the-frog.github.io/playground/`);
  process.exit(0);
}

// Handle --compile: monkey --compile file.monkey → file.wasm
if (process.argv.includes('--compile')) {
  const fileArg = process.argv.find(a => a.endsWith('.monkey'));
  if (!fileArg) {
    console.error('Usage: monkey --compile <file.monkey>');
    process.exit(1);
  }
  try {
    const source = fs.readFileSync(fileArg, 'utf8');
    const compiler = new WasmCompiler();
    const builder = compiler.compile(source);
    if (!builder || compiler.errors.length > 0) {
      console.error('Compilation errors:');
      compiler.errors.forEach(e => console.error('  ' + e));
      process.exit(1);
    }
    const binary = builder.build();
    const outFile = fileArg.replace(/\.monkey$/, '.wasm');
    fs.writeFileSync(outFile, binary);
    console.log(`Compiled ${fileArg} → ${outFile} (${binary.length} bytes)`);
    console.log(`Run with: node -e "const fs=require('fs');const b=fs.readFileSync('${outFile}');WebAssembly.instantiate(b,{env:{puts:v=>console.log(v),str:v=>v,__str_concat:()=>0,__str_eq:()=>0}}).then(({instance})=>console.log(instance.exports.main()))"`);
  } catch (e) {
    console.error(`Error: ${e.message}`);
    process.exit(1);
  }
  process.exit(0);
}

// Handle --disassemble: monkey --disassemble file.wasm → WAT text
if (process.argv.includes('--disassemble') || process.argv.includes('--dis')) {
  const wasmArg = process.argv.find(a => a.endsWith('.wasm'));
  const monkeyArg = process.argv.find(a => a.endsWith('.monkey'));
  
  if (wasmArg) {
    // Disassemble a .wasm binary
    try {
      const binary = fs.readFileSync(wasmArg);
      console.log(wasmDisassemble(binary));
    } catch (e) {
      console.error(`Error: ${e.message}`);
      process.exit(1);
    }
  } else if (monkeyArg) {
    // Compile to WASM then disassemble
    try {
      const source = fs.readFileSync(monkeyArg, 'utf8');
      const compiler = new WasmCompiler();
      const builder = compiler.compile(source);
      if (!builder || compiler.errors.length > 0) {
        console.error('Compilation errors:');
        compiler.errors.forEach(e => console.error('  ' + e));
        process.exit(1);
      }
      const binary = builder.build();
      console.log(wasmDisassemble(binary));
    } catch (e) {
      console.error(`Error: ${e.message}`);
      process.exit(1);
    }
  } else {
    console.error('Usage: monkey --disassemble <file.wasm|file.monkey>');
    process.exit(1);
  }
  process.exit(0);
}

// Handle --benchmark: monkey --benchmark file.monkey
if (process.argv.includes('--benchmark') || process.argv.includes('--bench')) {
  const fileArg2 = process.argv.find(a => a.endsWith('.monkey'));
  if (!fileArg2) {
    console.error('Usage: monkey --benchmark <file.monkey>');
    process.exit(1);
  }

  (async () => {
    try {
      const source = fs.readFileSync(fileArg2, 'utf8');
      const fullSource = STDLIB_SOURCE + '\n' + source;
      const N = 20;

      console.log(`\x1b[1mBenchmark: ${fileArg2}\x1b[0m (${N} iterations, median)\n`);

      // Parse
      const lexer = new Lexer(fullSource);
      const parser = new Parser(lexer);
      const program = parser.parseProgram();

      // VM
      let vmTimes = [];
      for (let i = 0; i < N; i++) {
        const c = new Compiler();
        c.compile(program);
        const vm = new VM(c.bytecode());
        const start = performance.now();
        vm.run();
        vmTimes.push(performance.now() - start);
      }
      vmTimes.sort((a, b) => a - b);
      const vmMedian = vmTimes[Math.floor(N / 2)];
      console.log(`  VM:         ${vmMedian.toFixed(3)}ms`);

      // JIT
      let jitTimes = [];
      for (let i = 0; i < N; i++) {
        const c = new Compiler();
        c.compile(program);
        const vm = new VM(c.bytecode());
        vm.enableJIT();
        const start = performance.now();
        vm.run();
        jitTimes.push(performance.now() - start);
      }
      jitTimes.sort((a, b) => a - b);
      const jitMedian = jitTimes[Math.floor(N / 2)];
      console.log(`  JIT:        ${jitMedian.toFixed(3)}ms (${(vmMedian / jitMedian).toFixed(1)}x vs VM)`);

      // WASM
      try {
        const compiler = new WasmCompiler();
        const builder = compiler.compile(source); // No stdlib for WASM
        if (builder && compiler.errors.length === 0) {
          const binary = builder.build();
          const module = await WebAssembly.compile(binary);
          const imports2 = {
            env: {
              puts() {}, str(v) { return v; },
              __str_concat() { return 0; }, __str_eq() { return 0; },
              __rest() { return 0; }, __type() { return 0; },
            }
          };
          let wasmTimes = [];
          for (let i = 0; i < N; i++) {
            const instance = await WebAssembly.instantiate(module, imports2);
            const start = performance.now();
            instance.exports.main();
            wasmTimes.push(performance.now() - start);
          }
          wasmTimes.sort((a, b) => a - b);
          const wasmMedian = wasmTimes[Math.floor(N / 2)];
          console.log(`  WASM:       ${wasmMedian.toFixed(3)}ms (\x1b[32m${(vmMedian / wasmMedian).toFixed(1)}x vs VM\x1b[0m)`);
          console.log(`\n  Binary: ${binary.length} bytes`);
        } else {
          console.log(`  WASM:       N/A (compile error)`);
        }
      } catch (e) {
        console.log(`  WASM:       N/A (${e.message.slice(0, 40)})`);
      }
    } catch (e) {
      console.error(`Error: ${e.message}`);
      process.exit(1);
    }
  })();
} else {

// Handle file execution: monkey file.monkey [--wasm]
const fileArg = process.argv.find(a => a.endsWith('.monkey') && !process.argv.includes('--compile'));
let fileRunning = false;
if (fileArg) {
  fileRunning = true;
  const useWasm = process.argv.includes('--wasm');
  try {
    const source = fs.readFileSync(fileArg, 'utf8');

    if (useWasm) {
      // Run via WASM backend
      const outputLines = [];
      const start = performance.now();
      wasmCompileAndRun(source, { outputLines }).then(result => {
        const elapsed = performance.now() - start;
        for (const line of outputLines) console.log(line);
        if (result !== 0 && outputLines.length === 0) console.log(result);
        console.error(`\x1b[90m(${elapsed.toFixed(2)}ms, WASM)\x1b[0m`);
        process.exit(0);
      }).catch(e => {
        console.error(`WASM error: ${e.message}`);
        process.exit(1);
      });
    } else {
      // Run via VM
      const l = new Lexer(STDLIB_SOURCE + '\n' + source);
      const p = new Parser(l);
      const prog = p.parseProgram();
      if (p.errors.length > 0) {
        console.error('Parse errors:');
        p.errors.forEach(e => console.error('  ' + e));
        process.exit(1);
      }
      const c = new Compiler();
      const err = c.compile(prog);
      if (err) { console.error('Compile error:', err); process.exit(1); }
      const vm = new VM(c.bytecode());
      vm.run();
      process.exit(0);
    }
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}

const PROMPT = '>> ';
const MONKEY = `            __,__
   .--.  .-"     "-.  .--.
  / .. \\/  .-. .-.  \\/ .. \\
 | |  '|  /   Y   \\  |'  | |
 | \\   \\  \\ 0 | 0 /  /   / |
  \\ '- ,\\.-"""""""-./, -' /
   ''-' /_   ^ ^   _\\ '-''
       |  \\._   _./  |
       \\   \\ '~' /   /
        '._ '-=-' _.'
           '-----'
`;

class MonkeyREPL {
  constructor(engine = 'jit') {
    this.engine = engine;
    this.env = new Environment();
    this.symbolTable = null;
    this.constants = [];
    this.globals = new Array(65536);
    this.lastVM = null;  // Keep reference for JIT diagnostics
    this.stdlibLoaded = false;
    this.showTiming = true;
  }

  parse(input) {
    const lexer = new Lexer(input);
    const parser = new Parser(lexer);
    const program = parser.parseProgram();
    if (parser.errors.length > 0) {
      console.error('Parser errors:');
      for (const err of parser.errors) console.error(`  ${err}`);
      return null;
    }
    return program;
  }

  execEval(program) {
    const start = performance.now();
    const result = monkeyEval(program, this.env);
    const elapsed = performance.now() - start;
    if (result && result !== NULL) {
      const timing = this.showTiming ? `  \x1b[90m(${elapsed.toFixed(2)}ms)\x1b[0m` : '';
      console.log(result.inspect() + timing);
    }
  }

  execVM(program, enableJIT = false) {
    const compiler = this.symbolTable
      ? Compiler.withState(this.symbolTable, this.constants)
      : new Compiler();

    const err = compiler.compile(program);
    if (err) { console.error(`Compilation error: ${err}`); return; }

    this.symbolTable = compiler.symbolTable;
    this.constants = compiler.constants;

    const bytecode = compiler.bytecode();
    const vm = VM.withGlobals(bytecode, this.globals);
    if (enableJIT) vm.enableJIT();

    const start = performance.now();
    const runErr = vm.run();
    const elapsed = performance.now() - start;
    if (runErr) { console.error(`VM error: ${runErr}`); return; }

    this.lastVM = vm;
    const result = vm.lastPoppedStackElem();
    if (result && result !== NULL) {
      let info = `${elapsed.toFixed(2)}ms`;
      if (enableJIT && vm.jit) {
        const traces = vm.jit.traces.size;
        if (traces > 0) info += `, ${traces} trace${traces > 1 ? 's' : ''}`;
      }
      const timing = this.showTiming ? `  \x1b[90m(${info})\x1b[0m` : '';
      console.log(this.colorizeResult(result) + timing);
    }
  }

  colorizeResult(result) {
    if (!result) return '';
    const text = result.inspect ? result.inspect() : String(result);
    const type = result.type ? result.type() : '';

    switch (type) {
      case 'INTEGER': return `\x1b[33m${text}\x1b[0m`; // yellow
      case 'FLOAT': return `\x1b[33m${text}\x1b[0m`;
      case 'BOOLEAN': return `\x1b[35m${text}\x1b[0m`; // magenta
      case 'STRING': return `\x1b[32m${text}\x1b[0m`; // green
      case 'ARRAY': return `\x1b[36m${text}\x1b[0m`; // cyan
      case 'HASH': return `\x1b[36m${text}\x1b[0m`;
      case 'FUNCTION': return `\x1b[34m${text}\x1b[0m`; // blue
      case 'CLOSURE': return `\x1b[34m${text}\x1b[0m`;
      case 'NULL': return `\x1b[90m${text}\x1b[0m`; // gray
      case 'ERROR': return `\x1b[31m${text}\x1b[0m`; // red
      default: return text;
    }
  }

  _hasUnbalancedBraces(text) {
    let depth = 0;
    for (const ch of text) {
      if (ch === '{' || ch === '(' || ch === '[') depth++;
      if (ch === '}' || ch === ')' || ch === ']') depth--;
    }
    return depth > 0;
  }

  _countBraceDepth(text) {
    let depth = 0;
    let inString = false;
    let stringChar = null;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inString) {
        if (ch === stringChar && text[i - 1] !== '\\') inString = false;
        continue;
      }
      if (ch === '"' || ch === "'") { inString = true; stringChar = ch; continue; }
      if (ch === '{' || ch === '(' || ch === '[') depth++;
      if (ch === '}' || ch === ')' || ch === ']') depth--;
    }
    return depth;
  }

  async execWasm(input) {
    try {
      const outputLines = [];
      const start = performance.now();
      const result = await wasmCompileAndRun(input, { outputLines });
      const elapsed = performance.now() - start;

      // Print any puts output
      for (const line of outputLines) {
        console.log(line);
      }

      if (result !== 0 || outputLines.length === 0) {
        const timing = this.showTiming ? `  \x1b[90m(${elapsed.toFixed(2)}ms, WASM)\x1b[0m` : '';
        console.log(result + timing);
      } else if (this.showTiming) {
        console.log(`\x1b[90m(${elapsed.toFixed(2)}ms, WASM)\x1b[0m`);
      }
    } catch (e) {
      console.error(`WASM error: ${e.message}`);
    }
  }

  execTranspiler(program, input) {
    try {
      const transpiler = new Transpiler();
      const jsCode = transpiler.transpile(program);
      const lines = jsCode.trim().split('\n');
      const lastLine = lines[lines.length - 1].replace(/;$/, '');
      lines[lines.length - 1] = 'return ' + lastLine + ';';
      const wrappedCode = lines.join('\n');
      const fn = new Function(wrappedCode);

      const start = performance.now();
      const result = fn();
      const elapsed = performance.now() - start;

      if (result !== undefined && result !== null) {
        const timing = this.showTiming ? `  \x1b[90m(${elapsed.toFixed(2)}ms, Transpiler)\x1b[0m` : '';
        console.log(String(result) + timing);
      }
    } catch (e) {
      console.error(`Transpiler error: ${e.message}`);
    }
  }

  loadStdlib() {
    if (this.stdlibLoaded) return;
    const program = this.parse(STDLIB_SOURCE);
    if (program) {
      if (this.engine === 'eval') {
        monkeyEval(program, this.env);
      } else {
        const compiler = this.symbolTable
          ? Compiler.withState(this.symbolTable, this.constants)
          : new Compiler();
        compiler.compile(program);
        this.symbolTable = compiler.symbolTable;
        this.constants = compiler.constants;
        const vm = VM.withGlobals(compiler.bytecode(), this.globals);
        vm.run();
      }
      this.stdlibLoaded = true;
      console.log('Standard library loaded: map, filter, reduce, forEach, range, contains, reverse');
    }
  }

  showJITStats() {
    if (!this.lastVM?.jit) {
      console.log('No JIT data available. Run some code first with :engine jit');
      return;
    }
    const stats = this.lastVM.jit.getStats();
    console.log('\x1b[1mJIT Statistics\x1b[0m');
    console.log(`  Traces:       ${stats.rootTraces + stats.sideTraces} (${stats.rootTraces} root, ${stats.sideTraces} side)`);
    console.log(`  Func traces:  ${stats.funcTraces || 0}`);
    console.log(`  Total:        ${stats.rootTraces + stats.sideTraces + (stats.funcTraces || 0)}`);
  }

  showJITTrace(n) {
    if (!this.lastVM?.jit) {
      console.log('No JIT data available.');
      return;
    }
    let idx = 0;
    for (const [key, trace] of this.lastVM.jit.traces) {
      idx++;
      if (n && idx !== n) continue;
      console.log(`\x1b[1mTrace #${idx}\x1b[0m (key: ${key})`);
      console.log(`  Guards: ${trace.guardCount}`);
      console.log(`  IR instructions: ${trace.ir.filter(i => i).length}`);
      if (trace._sideTraceCount > 0) {
        console.log(`  Side traces: ${trace._sideTraceCount}`);
      }
      console.log('  \x1b[90mIR:\x1b[0m');
      trace.ir.forEach((inst, i) => {
        if (inst) console.log(`    ${i}: ${inst.op} ${JSON.stringify(inst.operands)}`);
      });
      if (n) break;
    }
    if (idx === 0) console.log('No traces recorded.');
  }

  showJITCompiled(n) {
    if (!this.lastVM?.jit) {
      console.log('No JIT data available.');
      return;
    }
    let idx = 0;
    for (const [key, trace] of this.lastVM.jit.traces) {
      idx++;
      if (n && idx !== n) continue;
      if (trace.compiled) {
        console.log(`\x1b[1mTrace #${idx} compiled code:\x1b[0m`);
        console.log(trace.compiled.toString());
      }
      if (n) break;
    }
  }

  runBenchmark(code) {
    const ITERATIONS = 50;
    
    // VM timing
    let vmTotal = 0;
    for (let i = 0; i < ITERATIONS; i++) {
      const program = this.parse(code);
      if (!program) return;
      const compiler = new Compiler();
      compiler.compile(program);
      const vm = new VM(compiler.bytecode());
      const start = performance.now();
      vm.run();
      vmTotal += performance.now() - start;
    }

    // JIT timing
    let jitTotal = 0;
    for (let i = 0; i < ITERATIONS; i++) {
      const program = this.parse(code);
      if (!program) return;
      const compiler = new Compiler();
      compiler.compile(program);
      const vm = new VM(compiler.bytecode());
      vm.enableJIT();
      const start = performance.now();
      vm.run();
      jitTotal += performance.now() - start;
    }

    const vmAvg = vmTotal / ITERATIONS;
    const jitAvg = jitTotal / ITERATIONS;
    const jitSpeedup = vmAvg / jitAvg;

    console.log(`\x1b[1mBenchmark\x1b[0m (${ITERATIONS} iterations)`);
    console.log(`  VM:         ${vmAvg.toFixed(3)}ms avg`);
    console.log(`  JIT:        ${jitAvg.toFixed(3)}ms avg (${jitSpeedup.toFixed(1)}x vs VM)`);

    // Transpiler timing
    try {
      const program = this.parse(code);
      if (program) {
        const transpiler = new Transpiler();
        const jsCode = transpiler.transpile(program);
        const lines = jsCode.trim().split('\n');
        const lastLine = lines[lines.length - 1].replace(/;$/, '');
        lines[lines.length - 1] = 'return ' + lastLine + ';';
        const fn = new Function(lines.join('\n'));
        let transTotal = 0;
        for (let i = 0; i < ITERATIONS; i++) {
          const start = performance.now();
          fn();
          transTotal += performance.now() - start;
        }
        const transAvg = transTotal / ITERATIONS;
        console.log(`  Transpiler: ${transAvg.toFixed(3)}ms avg (${(vmAvg / transAvg).toFixed(1)}x vs VM)`);
      }
    } catch (e) {
      console.log(`  Transpiler: \x1b[90mN/A\x1b[0m`);
    }

    // WASM timing
    this._benchWasm(code, ITERATIONS, vmAvg).then(() => {}).catch(() => {
      console.log(`  WASM:       \x1b[90mN/A\x1b[0m`);
    });
  }

  async _benchWasm(code, iterations, vmAvg) {
    try {
      const compiler = new WasmCompiler();
      const builder = compiler.compile(code);
      if (!builder || compiler.errors.length > 0) {
        console.log(`  WASM:       \x1b[90mN/A (compile error)\x1b[0m`);
        return;
      }
      const binary = builder.build();
      const module = await WebAssembly.compile(binary);
      const imports = {
        env: {
          puts() {}, str(v) { return v; },
          __str_concat() { return 0; }, __str_eq() { return 0; },
        }
      };
      let wasmTotal = 0;
      for (let i = 0; i < iterations; i++) {
        const instance = await WebAssembly.instantiate(module, imports);
        const start = performance.now();
        instance.exports.main();
        wasmTotal += performance.now() - start;
      }
      const wasmAvg = wasmTotal / iterations;
      console.log(`  WASM:       ${wasmAvg.toFixed(3)}ms avg (\x1b[32m${(vmAvg / wasmAvg).toFixed(1)}x vs VM\x1b[0m)`);
    } catch (e) {
      console.log(`  WASM:       \x1b[90mN/A (${e.message.slice(0, 30)})\x1b[0m`);
    }
  }

  handleCommand(line) {
    const parts = line.trim().split(/\s+/);
    const cmd = parts[0];

    switch (cmd) {
      case ':engine':
        if (parts[1]) {
          if (['vm', 'eval', 'jit', 'wasm', 'transpiler', 'trans'].includes(parts[1])) {
            this.engine = parts[1] === 'trans' ? 'transpiler' : parts[1];
            console.log(`Switched to ${this.engine} engine`);
          } else {
            console.log('Usage: :engine [vm|eval|jit|wasm|transpiler]');
          }
        } else {
          console.log(`Current engine: ${this.engine}`);
        }
        return true;

      case ':jit':
        if (!parts[1] || parts[1] === 'stats') {
          this.showJITStats();
        } else if (parts[1] === 'trace') {
          this.showJITTrace(parts[2] ? parseInt(parts[2]) : null);
        } else if (parts[1] === 'compiled') {
          this.showJITCompiled(parts[2] ? parseInt(parts[2]) : null);
        } else if (parts[1] === 'on') {
          this.engine = 'jit';
          console.log('JIT enabled');
        } else if (parts[1] === 'off') {
          this.engine = 'vm';
          console.log('JIT disabled (VM mode)');
        } else {
          console.log('Usage: :jit [stats|trace [N]|compiled [N]|on|off]');
        }
        return true;

      case ':stdlib':
        this.loadStdlib();
        return true;

      case ':benchmark':
      case ':bench': {
        const code = parts.slice(1).join(' ');
        if (!code) {
          console.log('Usage: :benchmark <code>');
        } else {
          this.runBenchmark(code);
        }
        return true;
      }

      case ':dis':
      case ':disassemble': {
        const code = parts.slice(1).join(' ');
        if (!code) {
          console.log('Usage: :dis <code>');
        } else {
          try {
            const compiler = new WasmCompiler();
            const builder = compiler.compile(code);
            if (!builder || compiler.errors.length > 0) {
              console.error('WASM compile errors:', compiler.errors.join(', '));
            } else {
              const binary = builder.build();
              console.log(wasmDisassemble(binary));
              // Show compilation stats
              const s = compiler.stats;
              const funcs = builder.functions.length;
              const imports = builder.imports.length;
              const closures = compiler.closureFuncs.length;
              console.log(`\n\x1b[90m${binary.length} bytes | ${funcs + imports} functions (${imports} imported, ${closures} closures) | ${s.constantsFolded} constants folded\x1b[0m`);
            }
          } catch (e) {
            console.error(`Error: ${e.message}`);
          }
        }
        return true;
      }

      case ':transpile':
      case ':js': {
        const code = parts.slice(1).join(' ');
        if (!code) {
          console.log('Usage: :transpile <code>');
        } else {
          try {
            const program = this.parse(code);
            if (program) {
              const transpiler = new Transpiler();
              const js = transpiler.transpile(program);
              console.log(js);
            }
          } catch (e) {
            console.error(`Error: ${e.message}`);
          }
        }
        return true;
      }

      case ':example': {
        const name = parts[1];
        const examples = {
          fib: 'let fib = fn(n) { if (n <= 1) { n } else { fib(n-1) + fib(n-2) } }; fib(25)',
          factorial: 'let fact = fn(n) { if (n <= 1) { 1 } else { n * fact(n-1) } }; fact(10)',
          closure: 'let makeAdder = fn(x) { fn(y) { x + y } }; let add5 = makeAdder(5); add5(37)',
          fizzbuzz: 'for (i in 1..16) { if (i % 15 == 0) { puts("FizzBuzz") } else { if (i % 3 == 0) { puts("Fizz") } else { if (i % 5 == 0) { puts("Buzz") } else { puts(str(i)) } } } }',
          map: 'let map = fn(arr, f) { let r = []; for (x in arr) { r = push(r, f(x)); } r }; map([1,2,3,4,5], fn(x) { x * x })',
          primes: 'let isPrime = fn(n) { if (n < 2) { return 0; } let i = 2; while (i*i <= n) { if (n%i == 0) { return 0; } i = i + 1; } 1 }; let count = 0; for (n in 2..100) { if (isPrime(n) == 1) { count = count + 1; } } count',
        };
        if (!name || !examples[name]) {
          console.log('Available examples: ' + Object.keys(examples).join(', '));
        } else {
          console.log(`\x1b[90m> ${examples[name]}\x1b[0m`);
          // Execute the example
          const program = this.parse(examples[name]);
          if (program) {
            if (this.engine === 'wasm') {
              await this.execWasm(examples[name]);
            } else if (this.engine === 'eval') {
              this.execEval(program);
            } else if (this.engine === 'transpiler') {
              this.execTranspiler(program, examples[name]);
            } else {
              this.execVM(program, this.engine === 'jit');
            }
          }
        }
        return true;
      }

      case ':time': {
        const code = parts.slice(1).join(' ');
        if (!code) {
          console.log('Usage: :time <code>');
        } else {
          const program = this.parse(code);
          if (program) {
            const start = performance.now();
            if (this.engine === 'eval') {
              this.execEval(program);
            } else {
              this.execVM(program, this.engine === 'jit');
            }
            const elapsed = performance.now() - start;
            console.log(`\x1b[90m${elapsed.toFixed(3)}ms\x1b[0m`);
          }
        }
        return true;
      }

      case ':timing':
        this.showTiming = !this.showTiming;
        console.log(`Timing display: ${this.showTiming ? 'on' : 'off'}`);
        return true;

      case ':reset':
        this.env = new Environment();
        this.symbolTable = null;
        this.constants = [];
        this.globals = new Array(65536);
        this.lastVM = null;
        this.stdlibLoaded = false;
        console.log('State reset');
        return true;

      case ':help':
        console.log('\x1b[1mCommands:\x1b[0m');
        console.log('  :engine [vm|eval|jit|wasm|transpiler]');
        console.log('                           — show/switch execution engine');
        console.log('  :jit [stats|on|off]      — JIT control and statistics');
        console.log('  :jit trace [N]           — show trace IR (all or trace N)');
        console.log('  :jit compiled [N]        — show compiled JavaScript');
        console.log('  :stdlib                  — load standard library');
        console.log('  :benchmark <code>        — benchmark all backends');
        console.log('  :time <code>             — time a single execution');
        console.log('  :timing                  — toggle timing display');
        console.log('  :reset                   — reset all state');
        console.log('  :help                    — show this help');
        console.log('  :quit                    — exit');
        console.log('');
        console.log('\x1b[1mEngines:\x1b[0m eval (tree-walk), vm (bytecode), jit (tracing),');
        console.log('  transpiler (JS codegen), wasm (WebAssembly)');
        console.log('');
        console.log('\x1b[1mBuiltins:\x1b[0m len, puts, first, last, rest, push, split, join,');
        console.log('  trim, str_contains, substr, replace, int, str, type');
        console.log('');
        console.log('\x1b[1mStdlib (:stdlib):\x1b[0m map, filter, reduce, forEach, range, contains, reverse');
        return true;

      case ':quit':
      case ':q':
        process.exit(0);

      default:
        if (cmd.startsWith(':')) {
          console.log(`Unknown command: ${cmd}. Type :help for available commands.`);
          return true;
        }
        return false;
    }
  }

  run() {
    console.log(MONKEY);
    console.log(`\x1b[1mMonkey REPL\x1b[0m — engine: ${this.engine}`);
    console.log('Type :help for commands, :quit to exit\n');

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: PROMPT,
    });

    rl.prompt();

    let pendingAsync = null;
    let multilineBuffer = '';
    let braceDepth = 0;

    rl.on('line', async (line) => {
      // Multiline support: track brace depth
      if (multilineBuffer || this._hasUnbalancedBraces(line)) {
        multilineBuffer += (multilineBuffer ? '\n' : '') + line;
        braceDepth = this._countBraceDepth(multilineBuffer);
        if (braceDepth > 0) {
          rl.setPrompt('... ');
          rl.prompt();
          return;
        }
        // Braces balanced — process the complete input
        line = multilineBuffer;
        multilineBuffer = '';
        braceDepth = 0;
        rl.setPrompt(prompt);
      }

      const trimmed = line.trim();
      if (!trimmed) { rl.prompt(); return; }

      if (trimmed.startsWith(':')) {
        this.handleCommand(trimmed);
        rl.prompt();
        return;
      }

      const program = this.parse(trimmed);
      if (program) {
        try {
          if (this.engine === 'eval') {
            this.execEval(program);
          } else if (this.engine === 'wasm') {
            pendingAsync = this.execWasm(trimmed);
            await pendingAsync;
            pendingAsync = null;
          } else if (this.engine === 'transpiler') {
            this.execTranspiler(program, trimmed);
          } else {
            this.execVM(program, this.engine === 'jit');
          }
        } catch (err) {
          console.error(`Error: ${err.message}`);
        }
      }
      rl.prompt();
    });

    rl.on('close', async () => {
      if (pendingAsync) await pendingAsync;
      console.log('\nBye!');
      process.exit(0);
    });
  }
}

// Parse CLI args
const args = process.argv.slice(2);
let engine = 'jit';  // Default to JIT mode
for (const arg of args) {
  if (arg.startsWith('--engine=')) engine = arg.split('=')[1];
  else if (arg === '--eval') engine = 'eval';
  else if (arg === '--vm') engine = 'vm';
  else if (arg === '--jit') engine = 'jit';
  else if (arg === '--wasm') engine = 'wasm';
  else if (arg === '--transpiler' || arg === '--trans') engine = 'transpiler';
}

if (!fileRunning) {
  const repl = new MonkeyREPL(engine);
  repl.run();
}

} // close benchmark else block
