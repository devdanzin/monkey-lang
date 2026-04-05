// regex.js — Regular expression engine from scratch
// Thompson's NFA construction + matching

// ===== NFA State =====
let nextStateId = 0;
export class State {
  constructor() {
    this.id = nextStateId++;
    this.transitions = []; // { char, state } or { epsilon: true, state }
    this.isAccept = false;
  }
  addTransition(char, state) { this.transitions.push({ char, state }); }
  addEpsilon(state) { this.transitions.push({ epsilon: true, state }); }
}

// ===== NFA Fragment =====
export class Fragment {
  constructor(start, accept) {
    this.start = start;
    this.accept = accept;
  }
}

// ===== Regex Parser =====
// Grammar: expr = term ('|' term)*
//          term = factor+
//          factor = atom quantifier?
//          atom = char | '.' | '[...]' | '(' expr ')'
//          quantifier = '*' | '+' | '?' | '{n}' | '{n,m}'

export function parse(pattern) {
  let pos = 0;

  function parseExpr() {
    let node = parseTerm();
    while (pos < pattern.length && pattern[pos] === '|') {
      pos++; // skip |
      node = { type: 'alt', left: node, right: parseTerm() };
    }
    return node;
  }

  function parseTerm() {
    const factors = [];
    while (pos < pattern.length && pattern[pos] !== ')' && pattern[pos] !== '|') {
      factors.push(parseFactor());
    }
    if (factors.length === 0) return { type: 'empty' };
    if (factors.length === 1) return factors[0];
    return { type: 'concat', parts: factors };
  }

  function parseFactor() {
    let node = parseAtom();
    if (pos < pattern.length) {
      if (pattern[pos] === '*') { pos++; node = { type: 'star', child: node }; }
      else if (pattern[pos] === '+') { pos++; node = { type: 'plus', child: node }; }
      else if (pattern[pos] === '?') { pos++; node = { type: 'optional', child: node }; }
      else if (pattern[pos] === '{') {
        pos++; // skip {
        let minStr = '';
        while (pos < pattern.length && /\d/.test(pattern[pos])) minStr += pattern[pos++];
        const min = parseInt(minStr);
        let max = min;
        if (pos < pattern.length && pattern[pos] === ',') {
          pos++;
          let maxStr = '';
          while (pos < pattern.length && /\d/.test(pattern[pos])) maxStr += pattern[pos++];
          max = maxStr ? parseInt(maxStr) : Infinity;
        }
        if (pos < pattern.length && pattern[pos] === '}') pos++;
        node = { type: 'repeat', child: node, min, max };
      }
    }
    return node;
  }

  function parseAtom() {
    if (pattern[pos] === '(') {
      pos++; // skip (
      const node = parseExpr();
      if (pos < pattern.length && pattern[pos] === ')') pos++;
      return { type: 'group', child: node };
    }
    if (pattern[pos] === '[') {
      return parseCharClass();
    }
    if (pattern[pos] === '^') { pos++; return { type: 'anchor', which: 'start' }; }
    if (pattern[pos] === '$') { pos++; return { type: 'anchor', which: 'end' }; }
    if (pattern[pos] === '.') { pos++; return { type: 'dot' }; }
    if (pattern[pos] === '\\') {
      pos++;
      const ch = pattern[pos++];
      if (ch === 'd') return { type: 'class', chars: '0123456789' };
      if (ch === 'w') return { type: 'class', chars: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_' };
      if (ch === 's') return { type: 'class', chars: ' \t\n\r' };
      return { type: 'char', char: ch };
    }
    const ch = pattern[pos++];
    return { type: 'char', char: ch };
  }

  function parseCharClass() {
    pos++; // skip [
    let negate = false;
    if (pos < pattern.length && pattern[pos] === '^') { negate = true; pos++; }
    let chars = '';
    while (pos < pattern.length && pattern[pos] !== ']') {
      if (pos + 2 < pattern.length && pattern[pos + 1] === '-') {
        const start = pattern[pos].charCodeAt(0);
        const end = pattern[pos + 2].charCodeAt(0);
        for (let c = start; c <= end; c++) chars += String.fromCharCode(c);
        pos += 3;
      } else {
        chars += pattern[pos++];
      }
    }
    if (pos < pattern.length) pos++; // skip ]
    return { type: 'class', chars, negate };
  }

  return parseExpr();
}

// ===== NFA Construction (Thompson's) =====
export function buildNFA(ast) {
  nextStateId = 0;

  function build(node) {
    switch (node.type) {
      case 'char': {
        const s = new State();
        const e = new State();
        e.isAccept = true;
        s.addTransition(node.char, e);
        return new Fragment(s, e);
      }
      case 'dot': {
        const s = new State();
        const e = new State();
        e.isAccept = true;
        s.addTransition('.', e); // special: matches any
        return new Fragment(s, e);
      }
      case 'class': {
        const s = new State();
        const e = new State();
        e.isAccept = true;
        s.transitions.push({ charClass: node.chars, negate: node.negate, state: e });
        return new Fragment(s, e);
      }
      case 'concat': {
        let frag = build(node.parts[0]);
        for (let i = 1; i < node.parts.length; i++) {
          const next = build(node.parts[i]);
          frag.accept.isAccept = false;
          frag.accept.addEpsilon(next.start);
          frag = new Fragment(frag.start, next.accept);
        }
        return frag;
      }
      case 'alt': {
        const s = new State();
        const e = new State();
        e.isAccept = true;
        const left = build(node.left);
        const right = build(node.right);
        left.accept.isAccept = false;
        right.accept.isAccept = false;
        s.addEpsilon(left.start);
        s.addEpsilon(right.start);
        left.accept.addEpsilon(e);
        right.accept.addEpsilon(e);
        return new Fragment(s, e);
      }
      case 'star': {
        const s = new State();
        const e = new State();
        e.isAccept = true;
        const inner = build(node.child);
        inner.accept.isAccept = false;
        s.addEpsilon(inner.start);
        s.addEpsilon(e);
        inner.accept.addEpsilon(inner.start);
        inner.accept.addEpsilon(e);
        return new Fragment(s, e);
      }
      case 'plus': {
        const s = new State();
        const e = new State();
        e.isAccept = true;
        const inner = build(node.child);
        inner.accept.isAccept = false;
        s.addEpsilon(inner.start);
        inner.accept.addEpsilon(inner.start);
        inner.accept.addEpsilon(e);
        return new Fragment(s, e);
      }
      case 'optional': {
        const s = new State();
        const e = new State();
        e.isAccept = true;
        const inner = build(node.child);
        inner.accept.isAccept = false;
        s.addEpsilon(inner.start);
        s.addEpsilon(e);
        inner.accept.addEpsilon(e);
        return new Fragment(s, e);
      }
      case 'repeat': {
        // Build min required copies + max-min optional copies
        const parts = [];
        for (let i = 0; i < node.min; i++) parts.push(node.child);
        const maxExtra = Math.min(node.max - node.min, 10); // cap for safety
        for (let i = 0; i < maxExtra; i++) parts.push({ type: 'optional', child: node.child });
        if (parts.length === 0) return build({ type: 'empty' });
        if (node.max === Infinity) {
          parts.push({ type: 'star', child: node.child });
        }
        return build({ type: 'concat', parts });
      }
      case 'group':
        return build(node.child);
      case 'anchor': {
        const s = new State();
        s.isAccept = true;
        s.anchor = node.which;
        return new Fragment(s, s);
      }
      case 'empty': {
        const s = new State();
        s.isAccept = true;
        return new Fragment(s, s);
      }
      default:
        throw new Error(`Unknown node: ${node.type}`);
    }
  }

  return build(ast);
}

// ===== NFA Simulation =====
function epsilonClosure(states) {
  const closure = new Set(states);
  const stack = [...states];
  while (stack.length > 0) {
    const state = stack.pop();
    for (const t of state.transitions) {
      if (t.epsilon && !closure.has(t.state)) {
        closure.add(t.state);
        stack.push(t.state);
      }
    }
  }
  return closure;
}

function step(states, char) {
  const next = new Set();
  for (const state of states) {
    for (const t of state.transitions) {
      if (t.epsilon) continue;
      if (t.char === char || t.char === '.') {
        next.add(t.state);
      } else if (t.charClass) {
        const inClass = t.charClass.includes(char);
        if (t.negate ? !inClass : inClass) next.add(t.state);
      }
    }
  }
  return epsilonClosure(next);
}

// ===== Public API =====
export function match(pattern, text) {
  const ast = parse(pattern);
  const nfa = buildNFA(ast);
  let current = epsilonClosure(new Set([nfa.start]));

  for (let i = 0; i < text.length; i++) {
    current = step(current, text[i]);
    if (current.size === 0) return false;
  }

  for (const state of current) {
    if (state.isAccept) return true;
  }
  return false;
}

export function test(pattern, text) {
  // Search for match anywhere in text
  const ast = parse(pattern);
  const nfa = buildNFA(ast);

  for (let start = 0; start <= text.length; start++) {
    let current = epsilonClosure(new Set([nfa.start]));
    for (const s of current) if (s.isAccept) return true;

    for (let i = start; i < text.length; i++) {
      current = step(current, text[i]);
      for (const s of current) if (s.isAccept) return true;
      if (current.size === 0) break;
    }
  }
  return false;
}
