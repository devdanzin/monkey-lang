#!/usr/bin/env node

// Monkey Language REPL
// Supports both tree-walking interpreter and bytecode compiler+VM modes.
// Usage: monkey [--engine=vm|eval] or toggle at runtime with :engine vm/:engine eval

import * as readline from 'node:readline';
import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import { monkeyEval } from './evaluator.js';
import { Compiler } from './compiler.js';
import { VM } from './vm.js';
import { Environment, NULL } from './object.js';

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
  constructor(engine = 'vm') {
    this.engine = engine;

    // Interpreter state
    this.env = new Environment();

    // Compiler state
    this.symbolTable = null;
    this.constants = [];
    this.globals = new Array(65536);
  }

  parse(input) {
    const lexer = new Lexer(input);
    const parser = new Parser(lexer);
    const program = parser.parseProgram();
    if (parser.errors.length > 0) {
      console.error('Parser errors:');
      for (const err of parser.errors) {
        console.error(`  ${err}`);
      }
      return null;
    }
    return program;
  }

  execEval(program) {
    const result = monkeyEval(program, this.env);
    if (result && result !== NULL) {
      console.log(result.inspect());
    }
  }

  execVM(program) {
    const compiler = this.symbolTable
      ? Compiler.withState(this.symbolTable, this.constants)
      : new Compiler();

    const err = compiler.compile(program);
    if (err) {
      console.error(`Compilation error: ${err}`);
      return;
    }

    // Save state for next iteration
    this.symbolTable = compiler.symbolTable;
    this.constants = compiler.constants;

    const bytecode = compiler.bytecode();
    const vm = VM.withGlobals(bytecode, this.globals);
    const runErr = vm.run();
    if (runErr) {
      console.error(`VM error: ${runErr}`);
      return;
    }

    const result = vm.lastPoppedStackElem();
    if (result && result !== NULL) {
      console.log(result.inspect());
    }
  }

  handleCommand(line) {
    const cmd = line.trim();
    if (cmd === ':engine vm' || cmd === ':engine eval') {
      this.engine = cmd.split(' ')[1];
      console.log(`Switched to ${this.engine} engine`);
      return true;
    }
    if (cmd === ':engine') {
      console.log(`Current engine: ${this.engine}`);
      return true;
    }
    if (cmd === ':reset') {
      this.env = new Environment();
      this.symbolTable = null;
      this.constants = [];
      this.globals = new Array(65536);
      console.log('State reset');
      return true;
    }
    if (cmd === ':help') {
      console.log('Commands:');
      console.log('  :engine [vm|eval]  — show/switch execution engine');
      console.log('  :reset             — reset all state');
      console.log('  :help              — show this help');
      console.log('  :quit              — exit');
      return true;
    }
    if (cmd === ':quit' || cmd === ':q') {
      process.exit(0);
    }
    return false;
  }

  run() {
    console.log(MONKEY);
    console.log(`Monkey REPL — engine: ${this.engine}`);
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
          if (this.engine === 'vm') {
            this.execVM(program);
          } else {
            this.execEval(program);
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
let engine = 'vm';
for (const arg of args) {
  if (arg.startsWith('--engine=')) engine = arg.split('=')[1];
  else if (arg === '--eval') engine = 'eval';
  else if (arg === '--vm') engine = 'vm';
}

const repl = new MonkeyREPL(engine);
repl.run();
