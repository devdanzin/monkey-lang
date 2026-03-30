// Regex Engine — Thompson NFA Construction
// Supports: concatenation, alternation (|), repetition (*, +, ?), grouping (()), character classes ([abc], [a-z]), dot (.), escapes (\d, \w, \s)

// ===== NFA State =====
let stateId = 0;
function newState() { return { id: stateId++, transitions: [], epsilon: [], accept: false }; }

// ===== NFA Fragment (for Thompson construction) =====
class Fragment {
  constructor(start, ends) {
    this.start = start;
    this.ends = ends; // dangling arrows (states whose transition points nowhere yet)
  }

  // Connect all dangling ends to a state
  patch(state) {
    for (const end of this.ends) {
      end.epsilon.push(state);
    }
  }
}

// ===== Parser: Regex → AST =====
// Grammar:
//   regex   = alt
//   alt     = concat ('|' concat)*
//   concat  = repeat+
//   repeat  = atom ('*' | '+' | '?')?
//   atom    = '(' regex ')' | '[' class ']' | '.' | '\d' | '\w' | '\s' | literal

function parse(pattern) {
  let pos = 0;

  function peek() { return pos < pattern.length ? pattern[pos] : null; }
  function advance() { return pattern[pos++]; }
  function expect(ch) {
    if (advance() !== ch) throw new Error(`Expected '${ch}' at position ${pos - 1}`);
  }

  function parseRegex() { return parseAlt(); }

  function parseAlt() {
    let node = parseConcat();
    while (peek() === '|') {
      advance();
      const right = parseConcat();
      node = { type: 'alt', left: node, right };
    }
    return node;
  }

  function parseConcat() {
    const nodes = [];
    while (pos < pattern.length && peek() !== ')' && peek() !== '|') {
      nodes.push(parseRepeat());
    }
    if (nodes.length === 0) return { type: 'empty' };
    if (nodes.length === 1) return nodes[0];
    return nodes.reduce((left, right) => ({ type: 'concat', left, right }));
  }

  function parseRepeat() {
    let node = parseAtom();
    const ch = peek();
    if (ch === '*') { advance(); return { type: 'star', child: node }; }
    if (ch === '+') { advance(); return { type: 'plus', child: node }; }
    if (ch === '?') { advance(); return { type: 'question', child: node }; }
    return node;
  }

  function parseAtom() {
    const ch = peek();
    if (ch === '(') {
      advance();
      const node = parseRegex();
      expect(')');
      return node;
    }
    if (ch === '[') {
      return parseCharClass();
    }
    if (ch === '.') {
      advance();
      return { type: 'dot' };
    }
    if (ch === '\\') {
      advance();
      const esc = advance();
      if (esc === 'd') return { type: 'class', chars: null, predicate: 'digit' };
      if (esc === 'w') return { type: 'class', chars: null, predicate: 'word' };
      if (esc === 's') return { type: 'class', chars: null, predicate: 'space' };
      if (esc === 'D') return { type: 'class', chars: null, predicate: 'non-digit' };
      if (esc === 'W') return { type: 'class', chars: null, predicate: 'non-word' };
      if (esc === 'S') return { type: 'class', chars: null, predicate: 'non-space' };
      return { type: 'literal', char: esc };
    }
    if (ch === null || ch === ')' || ch === '|') {
      return { type: 'empty' };
    }
    advance();
    return { type: 'literal', char: ch };
  }

  function parseCharClass() {
    expect('[');
    let negate = false;
    if (peek() === '^') { negate = true; advance(); }
    const chars = new Set();
    while (peek() !== ']' && peek() !== null) {
      const start = advance();
      if (peek() === '-' && pattern[pos + 1] !== ']') {
        advance(); // skip -
        const end = advance();
        for (let c = start.charCodeAt(0); c <= end.charCodeAt(0); c++) {
          chars.add(String.fromCharCode(c));
        }
      } else {
        chars.add(start);
      }
    }
    expect(']');
    return { type: 'charset', chars, negate };
  }

  const ast = parseRegex();
  if (pos !== pattern.length) throw new Error(`Unexpected character at position ${pos}: '${pattern[pos]}'`);
  return ast;
}

// ===== Compiler: AST → NFA (Thompson Construction) =====
function compile(ast) {
  stateId = 0;

  function build(node) {
    switch (node.type) {
      case 'empty': {
        const s = newState();
        return new Fragment(s, [s]);
      }
      case 'literal': {
        const s = newState();
        const end = newState();
        s.transitions.push({ match: ch => ch === node.char, target: end });
        return new Fragment(s, [end]);
      }
      case 'dot': {
        const s = newState();
        const end = newState();
        s.transitions.push({ match: ch => ch !== '\n', target: end });
        return new Fragment(s, [end]);
      }
      case 'class': {
        const s = newState();
        const end = newState();
        let predicate;
        switch (node.predicate) {
          case 'digit': predicate = ch => /\d/.test(ch); break;
          case 'word': predicate = ch => /\w/.test(ch); break;
          case 'space': predicate = ch => /\s/.test(ch); break;
          case 'non-digit': predicate = ch => !/\d/.test(ch); break;
          case 'non-word': predicate = ch => !/\w/.test(ch); break;
          case 'non-space': predicate = ch => !/\s/.test(ch); break;
        }
        s.transitions.push({ match: predicate, target: end });
        return new Fragment(s, [end]);
      }
      case 'charset': {
        const s = newState();
        const end = newState();
        const { chars, negate } = node;
        const match = negate
          ? ch => !chars.has(ch)
          : ch => chars.has(ch);
        s.transitions.push({ match, target: end });
        return new Fragment(s, [end]);
      }
      case 'concat': {
        const left = build(node.left);
        const right = build(node.right);
        left.patch(right.start);
        return new Fragment(left.start, right.ends);
      }
      case 'alt': {
        const left = build(node.left);
        const right = build(node.right);
        const s = newState();
        s.epsilon.push(left.start, right.start);
        return new Fragment(s, [...left.ends, ...right.ends]);
      }
      case 'star': {
        const child = build(node.child);
        const s = newState();
        s.epsilon.push(child.start);
        child.patch(s);
        return new Fragment(s, [s]);
      }
      case 'plus': {
        const child = build(node.child);
        const s = newState();
        s.epsilon.push(child.start);
        child.patch(s);
        return new Fragment(child.start, [s]);
      }
      case 'question': {
        const child = build(node.child);
        const s = newState();
        s.epsilon.push(child.start);
        return new Fragment(s, [s, ...child.ends]);
      }
      default:
        throw new Error(`Unknown AST node: ${node.type}`);
    }
  }

  const frag = build(ast);
  const accept = newState();
  accept.accept = true;
  frag.patch(accept);

  return { start: frag.start, accept };
}

// ===== NFA Simulation =====
function epsilonClosure(states) {
  const closure = new Set();
  const stack = [...states];
  while (stack.length) {
    const s = stack.pop();
    if (closure.has(s)) continue;
    closure.add(s);
    for (const next of s.epsilon) {
      stack.push(next);
    }
  }
  return closure;
}

function step(currentStates, char) {
  const next = new Set();
  for (const state of currentStates) {
    for (const { match, target } of state.transitions) {
      if (match(char)) next.add(target);
    }
  }
  return epsilonClosure(next);
}

function hasAccept(states) {
  for (const s of states) {
    if (s.accept) return true;
  }
  return false;
}

// ===== Public API =====
export class Regex {
  constructor(pattern) {
    this.pattern = pattern;
    this.ast = parse(pattern);
    this.nfa = compile(this.ast);
  }

  // Full match (entire string must match)
  test(input) {
    let states = epsilonClosure(new Set([this.nfa.start]));
    for (const ch of input) {
      states = step(states, ch);
      if (states.size === 0) return false;
    }
    return hasAccept(states);
  }

  // Search (find first match anywhere in string)
  search(input) {
    for (let i = 0; i < input.length; i++) {
      let states = epsilonClosure(new Set([this.nfa.start]));
      if (hasAccept(states)) return { index: i, match: '' };
      for (let j = i; j < input.length; j++) {
        states = step(states, input[j]);
        if (states.size === 0) break;
        if (hasAccept(states)) return { index: i, match: input.slice(i, j + 1) };
      }
    }
    // Check empty match at end
    let states = epsilonClosure(new Set([this.nfa.start]));
    if (hasAccept(states)) return { index: input.length, match: '' };
    return null;
  }

  // Find all non-overlapping matches
  matchAll(input) {
    const results = [];
    let i = 0;
    while (i < input.length) {
      let states = epsilonClosure(new Set([this.nfa.start]));
      let lastMatch = hasAccept(states) ? { index: i, match: '' } : null;

      for (let j = i; j < input.length; j++) {
        states = step(states, input[j]);
        if (states.size === 0) break;
        if (hasAccept(states)) lastMatch = { index: i, match: input.slice(i, j + 1) };
      }

      if (lastMatch && lastMatch.match.length > 0) {
        results.push(lastMatch);
        i += lastMatch.match.length;
      } else {
        i++;
      }
    }
    return results;
  }

  // Replace all matches
  replace(input, replacement) {
    const matches = this.matchAll(input);
    if (!matches.length) return input;
    let result = '', lastIdx = 0;
    for (const m of matches) {
      result += input.slice(lastIdx, m.index) + replacement;
      lastIdx = m.index + m.match.length;
    }
    result += input.slice(lastIdx);
    return result;
  }
}

// For tests
export { parse, compile, epsilonClosure, step, hasAccept };
