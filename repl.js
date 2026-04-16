#!/usr/bin/env node
// repl.js — Interactive REPL for Monkey-lang
//
// Usage: node repl.js [--eval "code"] [--gc] [--trace] [--optimize]

import readline from 'readline';
import { Lexer } from './src/lexer.js';
import { Parser } from './src/parser.js';
import { Compiler, SymbolTable } from './src/compiler.js';
import { VM } from './src/vm.js';
import { GarbageCollector } from './src/gc.js';
import { optimize } from './src/optimizer.js';
import { typecheck } from './src/typechecker.js';
import { NULL } from './src/object.js';

const args = process.argv.slice(2);
const useGC = args.includes('--gc');
const useOptimize = args.includes('--optimize');
const useTypecheck = args.includes('--typecheck');
const evalIdx = args.indexOf('--eval');

// For --eval mode, just evaluate and exit
if (evalIdx >= 0 && args[evalIdx + 1]) {
  const input = args[evalIdx + 1];
  try {
    const lexer = new Lexer(input);
    const parser = new Parser(lexer);
    const program = parser.parseProgram();
    if (parser.errors.length > 0) throw new Error(parser.errors.join('\n'));
    
    // Type checking pass
    if (useTypecheck) {
      const { errors } = typecheck(program);
      if (errors.length > 0) {
        console.error('Type errors:');
        errors.forEach(e => console.error(`  ${e.message}`));
        process.exit(1);
      }
    }
    
    const compiler = new Compiler();
    compiler.compile(program);
    const bytecode = compiler.bytecode();
    if (useOptimize) bytecode.instructions = optimize(bytecode.instructions);
    const vm = new VM(bytecode);
    vm.run();
    const result = vm.lastPoppedStackElem();
    if (result !== NULL) console.log(result.inspect());
    process.exit(0);
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
}

// REPL mode
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '🐒 > ',
});

console.log('Monkey-lang REPL v1.0');
console.log('Type .help for commands, .quit to exit');
if (useGC) console.log('GC enabled');
if (useOptimize) console.log('Optimizer enabled');
if (useTypecheck) console.log('Type checker enabled');
console.log();

// Persistent state for multi-line expressions
let globalSymbols = new SymbolTable();
let globals = new Array(65536);
let constants = [];
let gc = useGC ? new GarbageCollector({ threshold: 500, verbose: false }) : null;
let history = [];

rl.prompt();

rl.on('line', (line) => {
  line = line.trim();
  
  if (!line) {
    rl.prompt();
    return;
  }
  
  // Commands
  if (line.startsWith('.')) {
    handleCommand(line);
    rl.prompt();
    return;
  }
  
  history.push(line);
  
  try {
    const result = evaluate(line);
    if (result !== NULL && result !== undefined) {
      console.log(result.inspect());
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
  
  rl.prompt();
});

rl.on('close', () => {
  console.log('\nBye! 🐒');
  process.exit(0);
});

function evaluate(input) {
  const lexer = new Lexer(input);
  const parser = new Parser(lexer);
  const program = parser.parseProgram();
  
  if (parser.errors.length > 0) {
    throw new Error(parser.errors.join('\n'));
  }
  
  // Type checking pass
  if (useTypecheck) {
    const { errors } = typecheck(program);
    if (errors.length > 0) {
      throw new Error('Type errors:\n' + errors.map(e => `  ${e.message}`).join('\n'));
    }
  }
  
  const compiler = new Compiler();
  // TODO: In a full REPL, we'd want to preserve symbol state across evaluations
  // For now, each line is independent
  compiler.compile(program);
  const bytecode = compiler.bytecode();
  
  if (useOptimize) {
    bytecode.instructions = optimize(bytecode.instructions);
  }
  
  const vm = new VM(bytecode, gc);
  vm.run();
  return vm.lastPoppedStackElem();
}

function handleCommand(cmd) {
  switch (cmd) {
    case '.help':
      console.log('Commands:');
      console.log('  .help     Show this help');
      console.log('  .quit     Exit the REPL');
      console.log('  .history  Show command history');
      console.log('  .gc       Show GC stats');
      console.log('  .clear    Clear history');
      break;
    case '.quit':
    case '.exit':
      console.log('Bye! 🐒');
      process.exit(0);
      break;
    case '.history':
      history.forEach((h, i) => console.log(`  ${i + 1}: ${h}`));
      break;
    case '.gc':
      if (gc) {
        const stats = gc.getStats();
        console.log('GC Stats:');
        console.log(`  Collections: ${stats.collections}`);
        console.log(`  Allocated: ${stats.totalAllocated}`);
        console.log(`  Freed: ${stats.totalFreed}`);
        console.log(`  Live: ${stats.heapSize}`);
        console.log(`  Peak: ${stats.peakLive}`);
      } else {
        console.log('GC not enabled. Start with --gc');
      }
      break;
    case '.clear':
      history = [];
      console.log('History cleared');
      break;
    default:
      console.log(`Unknown command: ${cmd}. Type .help for help.`);
  }
}
