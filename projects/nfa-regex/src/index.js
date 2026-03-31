/**
 * Tiny Regex Compiler — Thompson's NFA Construction
 * 
 * Compiles regex patterns to NFAs, then simulates:
 * - Concatenation (ab)
 * - Alternation (a|b)
 * - Kleene star (a*)
 * - Plus (a+)
 * - Optional (a?)
 * - Character classes [a-z]
 * - Dot (any char)
 * - Anchors (^, $)
 * - Grouping (parentheses)
 */

class State {
  constructor(accept = false) {
    this.accept = accept;
    this.transitions = []; // [{char, to}] where char can be null (epsilon)
  }
  
  addTransition(char, to) {
    this.transitions.push({ char, to });
  }
}

class NFA {
  constructor(start, end) {
    this.start = start;
    this.end = end;
  }
}

// ─── NFA Construction (Thompson's) ─────────────────

function charNFA(ch) {
  const start = new State();
  const end = new State(true);
  start.addTransition(ch, end);
  return new NFA(start, end);
}

function dotNFA() {
  const start = new State();
  const end = new State(true);
  start.addTransition('.', end); // special: matches any
  return new NFA(start, end);
}

function concat(a, b) {
  a.end.accept = false;
  a.end.addTransition(null, b.start); // epsilon
  return new NFA(a.start, b.end);
}

function alternate(a, b) {
  const start = new State();
  const end = new State(true);
  start.addTransition(null, a.start);
  start.addTransition(null, b.start);
  a.end.accept = false;
  b.end.accept = false;
  a.end.addTransition(null, end);
  b.end.addTransition(null, end);
  return new NFA(start, end);
}

function star(a) {
  const start = new State();
  const end = new State(true);
  start.addTransition(null, a.start);
  start.addTransition(null, end);
  a.end.accept = false;
  a.end.addTransition(null, a.start);
  a.end.addTransition(null, end);
  return new NFA(start, end);
}

function plus(a) {
  const start = new State();
  const end = new State(true);
  start.addTransition(null, a.start);
  a.end.accept = false;
  a.end.addTransition(null, a.start);
  a.end.addTransition(null, end);
  return new NFA(start, end);
}

function optional(a) {
  const start = new State();
  const end = new State(true);
  start.addTransition(null, a.start);
  start.addTransition(null, end);
  a.end.accept = false;
  a.end.addTransition(null, end);
  return new NFA(start, end);
}

function charClass(chars) {
  const start = new State();
  const end = new State(true);
  for (const ch of chars) {
    start.addTransition(ch, end);
  }
  return new NFA(start, end);
}

// ─── Parser ─────────────────────────────────────────

function compile(pattern) {
  let pos = 0;
  
  function parseExpr() {
    let left = parseTerm();
    while (pos < pattern.length && pattern[pos] === '|') {
      pos++; // skip |
      const right = parseTerm();
      left = alternate(left, right);
    }
    return left;
  }

  function parseTerm() {
    let nfa = null;
    while (pos < pattern.length && pattern[pos] !== ')' && pattern[pos] !== '|') {
      let atom = parseAtom();
      // Postfix operators
      while (pos < pattern.length && '*+?'.includes(pattern[pos])) {
        if (pattern[pos] === '*') { atom = star(atom); pos++; }
        else if (pattern[pos] === '+') { atom = plus(atom); pos++; }
        else if (pattern[pos] === '?') { atom = optional(atom); pos++; }
      }
      nfa = nfa ? concat(nfa, atom) : atom;
    }
    return nfa || charNFA(''); // empty
  }

  function parseAtom() {
    if (pattern[pos] === '(') {
      pos++; // skip (
      const nfa = parseExpr();
      pos++; // skip )
      return nfa;
    }
    if (pattern[pos] === '[') {
      return parseCharClass();
    }
    if (pattern[pos] === '.') {
      pos++;
      return dotNFA();
    }
    if (pattern[pos] === '\\') {
      pos++;
      const ch = pattern[pos++];
      if (ch === 'd') return charClass('0123456789'.split(''));
      if (ch === 'w') return charClass('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_'.split(''));
      if (ch === 's') return charClass(' \t\n\r'.split(''));
      return charNFA(ch);
    }
    return charNFA(pattern[pos++]);
  }

  function parseCharClass() {
    pos++; // skip [
    const negate = pattern[pos] === '^';
    if (negate) pos++;
    const chars = [];
    while (pattern[pos] !== ']') {
      if (pattern[pos + 1] === '-' && pattern[pos + 2] !== ']') {
        const from = pattern[pos].charCodeAt(0);
        const to = pattern[pos + 2].charCodeAt(0);
        for (let c = from; c <= to; c++) chars.push(String.fromCharCode(c));
        pos += 3;
      } else {
        chars.push(pattern[pos++]);
      }
    }
    pos++; // skip ]
    
    if (negate) {
      const all = [];
      for (let c = 32; c < 127; c++) {
        const ch = String.fromCharCode(c);
        if (!chars.includes(ch)) all.push(ch);
      }
      return charClass(all);
    }
    return charClass(chars);
  }

  return parseExpr();
}

// ─── NFA Simulation ─────────────────────────────────

function epsilonClosure(states) {
  const closure = new Set(states);
  const stack = [...states];
  while (stack.length > 0) {
    const state = stack.pop();
    for (const t of state.transitions) {
      if (t.char === null && !closure.has(t.to)) {
        closure.add(t.to);
        stack.push(t.to);
      }
    }
  }
  return closure;
}

function move(states, ch) {
  const next = new Set();
  for (const state of states) {
    for (const t of state.transitions) {
      if (t.char === ch || t.char === '.') {
        next.add(t.to);
      }
    }
  }
  return next;
}

function match(nfa, input) {
  let current = epsilonClosure(new Set([nfa.start]));
  for (const ch of input) {
    current = epsilonClosure(move(current, ch));
    if (current.size === 0) return false;
  }
  for (const state of current) {
    if (state.accept) return true;
  }
  return false;
}

function test(pattern, input) {
  const nfa = compile(pattern);
  return match(nfa, input);
}

function search(pattern, input) {
  const nfa = compile(pattern);
  for (let i = 0; i < input.length; i++) {
    for (let j = i; j <= input.length; j++) {
      if (match(nfa, input.slice(i, j))) {
        return { index: i, match: input.slice(i, j) };
      }
    }
  }
  return null;
}

module.exports = { compile, match, test, search, NFA, State };
