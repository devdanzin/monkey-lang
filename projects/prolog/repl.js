#!/usr/bin/env node
/**
 * Prolog REPL — Interactive command-line interface
 * 
 * Usage: node repl.js [file.pl ...]
 * 
 * Commands:
 *   ?- query.        — run a query
 *   fact.            — add a fact/rule
 *   :- consult(f).   — load a file (not yet)
 *   /trace           — toggle trace mode
 *   /clauses         — list all clauses
 *   /reset           — clear all clauses
 *   /help            — show help
 *   /quit            — exit
 */

const readline = require('readline');
const fs = require('fs');
const { Prolog } = require('./src/index.js');

const prolog = new Prolog();
let traceMode = false;
let buffer = '';

// Load files from command line
const files = process.argv.slice(2);
for (const file of files) {
  try {
    const text = fs.readFileSync(file, 'utf8');
    const results = prolog.consult(text);
    console.log(`Loaded ${file}`);
    if (results.length > 0) {
      for (const qResult of results) {
        printResults(qResult);
      }
    }
  } catch (e) {
    console.error(`Error loading ${file}: ${e.message}`);
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '?- ',
  terminal: true,
});

function termToString(term) {
  if (!term) return 'undefined';
  if (term.type === 'atom') return term.name;
  if (term.type === 'num') return String(term.value);
  if (term.type === 'var') return term.name;
  if (term.type === 'compound') {
    if (term.functor === '.' && term.args.length === 2) {
      return '[' + listToString(term) + ']';
    }
    return `${term.functor}(${term.args.map(termToString).join(', ')})`;
  }
  return String(term);
}

function listToString(term) {
  const items = [];
  let cur = term;
  while (cur.type === 'compound' && cur.functor === '.' && cur.args.length === 2) {
    items.push(termToString(cur.args[0]));
    cur = cur.args[1];
  }
  if (cur.type === 'atom' && cur.name === '[]') return items.join(', ');
  return items.join(', ') + '|' + termToString(cur);
}

function printResults(results) {
  if (results.length === 0) {
    console.log('false.');
    return;
  }
  for (const result of results) {
    const bindings = Object.entries(result);
    if (bindings.length === 0) {
      console.log('true.');
    } else {
      const parts = bindings.map(([name, val]) => `${name} = ${termToString(val)}`);
      console.log(parts.join(', '));
    }
  }
}

function processInput(line) {
  line = line.trim();
  if (!line) return;

  // Commands
  if (line.startsWith('/')) {
    const cmd = line.split(/\s+/)[0].toLowerCase();
    switch (cmd) {
      case '/trace':
        traceMode = !traceMode;
        console.log(`Trace mode: ${traceMode ? 'ON' : 'OFF'}`);
        return;
      case '/clauses':
        for (let i = 0; i < prolog.clauses.length; i++) {
          const c = prolog.clauses[i];
          const head = termToString(c.head);
          if (c.body.length === 0) {
            console.log(`${i}: ${head}.`);
          } else {
            console.log(`${i}: ${head} :- ${c.body.map(termToString).join(', ')}.`);
          }
        }
        console.log(`(${prolog.clauses.length} clauses)`);
        return;
      case '/reset':
        prolog.clauses = [];
        prolog.output = [];
        console.log('Database cleared.');
        return;
      case '/help':
        console.log('Commands:');
        console.log('  ?- query.     Run a query');
        console.log('  fact.         Add fact/rule');
        console.log('  /trace        Toggle trace mode');
        console.log('  /clauses      List all clauses');
        console.log('  /reset        Clear database');
        console.log('  /quit         Exit');
        return;
      case '/quit': case '/exit': case '/q':
        process.exit(0);
    }
  }

  // Accumulate multi-line input
  buffer += line + ' ';
  if (!buffer.trimEnd().endsWith('.')) {
    rl.setPrompt('|  ');
    return;
  }

  const input = buffer.trim();
  buffer = '';
  rl.setPrompt('?- ');

  try {
    // Check if it's a query
    if (input.startsWith('?-')) {
      const queryText = input.slice(2).trim();
      prolog.output = [];
      const results = prolog.queryString(queryText);
      if (prolog.output.length > 0) {
        process.stdout.write(prolog.output.join(''));
      }
      printResults(results);
    } else {
      // It's a clause to add
      prolog.consult(input);
      console.log('true.');
    }
  } catch (e) {
    console.error(`Error: ${e.message}`);
  }
}

if (process.stdin.isTTY) {
  console.log('Prolog REPL — Type /help for commands, /quit to exit');
  console.log(`${prolog.clauses.length} clauses loaded.`);
  rl.prompt();

  rl.on('line', (line) => {
    processInput(line);
    rl.prompt();
  });

  rl.on('close', () => {
    console.log('\nBye!');
    process.exit(0);
  });
} else {
  // Pipe mode — read all input
  const chunks = [];
  process.stdin.on('data', d => chunks.push(d));
  process.stdin.on('end', () => {
    const input = Buffer.concat(chunks).toString('utf8');
    try {
      prolog.output = [];
      const results = prolog.consult(input);
      if (prolog.output.length > 0) {
        process.stdout.write(prolog.output.join(''));
      }
      for (const qResult of results) {
        printResults(qResult);
      }
    } catch (e) {
      console.error(`Error: ${e.message}`);
      process.exit(1);
    }
  });
}
