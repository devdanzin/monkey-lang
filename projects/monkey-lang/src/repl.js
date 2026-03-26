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

const VERSION = '0.2.0';

// Handle --version flag
if (process.argv.includes('--version') || process.argv.includes('-v')) {
  console.log(`Monkey Language v${VERSION}`);
  console.log(`1115 tests | 6 modules | Bytecode VM + Tracing JIT`);
  process.exit(0);
}

// Handle --help flag
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`Monkey Language v${VERSION}`);
  console.log(`\nUsage: monkey [options] [file.monkey]`);
  console.log(`\nOptions:`);
  console.log(`  --engine=vm|eval|jit  Select execution engine (default: jit)`);
  console.log(`  --version, -v         Show version`);
  console.log(`  --help, -h            Show this help`);
  console.log(`\nREPL Commands:`);
  console.log(`  :engine <name>        Switch engine at runtime`);
  console.log(`  :jit                  Show JIT statistics`);
  console.log(`  :quit                 Exit`);
  console.log(`\nModules: math, string, algorithms, array, json, functional`);
  console.log(`Website: https://henry-the-frog.github.io/playground/`);
  process.exit(0);
}

// Handle file execution: monkey file.monkey
const fileArg = process.argv.find(a => a.endsWith('.monkey'));
if (fileArg) {
  try {
    const source = fs.readFileSync(fileArg, 'utf8');
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
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
  process.exit(0);
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
      console.log(result.inspect() + timing);
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
    const ITERATIONS = 100;
    
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
    const speedup = vmAvg / jitAvg;

    console.log(`\x1b[1mBenchmark\x1b[0m (${ITERATIONS} iterations)`);
    console.log(`  VM:      ${vmAvg.toFixed(3)}ms avg`);
    console.log(`  JIT:     ${jitAvg.toFixed(3)}ms avg`);
    console.log(`  Speedup: \x1b[${speedup > 2 ? '32' : speedup > 1 ? '33' : '31'}m${speedup.toFixed(2)}x\x1b[0m`);
  }

  handleCommand(line) {
    const parts = line.trim().split(/\s+/);
    const cmd = parts[0];

    switch (cmd) {
      case ':engine':
        if (parts[1]) {
          if (['vm', 'eval', 'jit'].includes(parts[1])) {
            this.engine = parts[1];
            console.log(`Switched to ${this.engine} engine`);
          } else {
            console.log('Usage: :engine [vm|eval|jit]');
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
        console.log('  :engine [vm|eval|jit]    — show/switch execution engine');
        console.log('  :jit [stats|on|off]      — JIT control and statistics');
        console.log('  :jit trace [N]           — show trace IR (all or trace N)');
        console.log('  :jit compiled [N]        — show compiled JavaScript');
        console.log('  :stdlib                  — load standard library (map, filter, reduce, ...)');
        console.log('  :benchmark <code>        — benchmark VM vs JIT (100 iterations)');
        console.log('  :time <code>             — time a single execution');
        console.log('  :timing                  — toggle timing display');
        console.log('  :reset                   — reset all state');
        console.log('  :help                    — show this help');
        console.log('  :quit                    — exit');
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

    rl.on('line', (line) => {
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
          } else {
            this.execVM(program, this.engine === 'jit');
          }
        } catch (err) {
          console.error(`Error: ${err.message}`);
        }
      }
      rl.prompt();
    });

    rl.on('close', () => {
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
}

const repl = new MonkeyREPL(engine);
repl.run();
