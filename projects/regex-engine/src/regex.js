// Regex Engine — Thompson NFA Construction + DFA Subset Construction
//
// Supports: concatenation, alternation (|), repetition (*, +, ?, {n,m}),
// grouping (capturing + non-capturing), character classes ([abc], [a-z], [^...]),
// anchors (^, $, \b, \B), dot (.), escapes (\d, \w, \s, \D, \W, \S, \t, \n, \r),
// lazy quantifiers (*?, +?, ??), DFA compilation for O(n) matching

// ===== NFA State =====
let stateId = 0;
function resetStateId() { stateId = 0; }
function newState() { return { id: stateId++, transitions: [], epsilon: [], accept: false, groupStart: -1, groupEnd: -1 }; }

// ===== NFA Fragment (for Thompson construction) =====
class Fragment {
  constructor(start, ends) {
    this.start = start;
    this.ends = ends;
  }
  patch(state) {
    for (const end of this.ends) {
      end.epsilon.push(state);
    }
  }
}

// ===== Character Matchers =====
const matchers = {
  digit: ch => ch >= '0' && ch <= '9',
  word: ch => (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9') || ch === '_',
  space: ch => ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f' || ch === '\v',
  'non-digit': ch => !(ch >= '0' && ch <= '9'),
  'non-word': ch => !((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9') || ch === '_'),
  'non-space': ch => !(ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f' || ch === '\v'),
};

// ===== Parser: Regex → AST =====
function parse(pattern) {
  let pos = 0;
  let groupCount = 0;

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
      nodes.push(parseQuantified());
    }
    if (nodes.length === 0) return { type: 'empty' };
    if (nodes.length === 1) return nodes[0];
    return nodes.reduce((left, right) => ({ type: 'concat', left, right }));
  }

  function parseQuantified() {
    let node = parseAtom();
    const ch = peek();
    if (ch === '*' || ch === '+' || ch === '?') {
      advance();
      const lazy = peek() === '?' ? (advance(), true) : false;
      if (ch === '*') return { type: 'star', child: node, lazy };
      if (ch === '+') return { type: 'plus', child: node, lazy };
      if (ch === '?') return { type: 'question', child: node, lazy };
    }
    if (ch === '{') {
      return parseRepetition(node);
    }
    return node;
  }

  function parseRepetition(node) {
    advance(); // skip {
    let min = 0, max = Infinity;
    let numStr = '';
    while (peek() !== null && peek() >= '0' && peek() <= '9') numStr += advance();
    min = parseInt(numStr, 10);
    if (peek() === ',') {
      advance();
      let maxStr = '';
      while (peek() !== null && peek() >= '0' && peek() <= '9') maxStr += advance();
      max = maxStr.length > 0 ? parseInt(maxStr, 10) : Infinity;
    } else {
      max = min; // {n} means exactly n
    }
    expect('}');
    const lazy = peek() === '?' ? (advance(), true) : false;
    return { type: 'repetition', child: node, min, max, lazy };
  }

  function parseAtom() {
    const ch = peek();
    if (ch === '(') {
      advance();
      // Check for non-capturing group (?:...)
      if (peek() === '?' && pattern[pos + 1] === ':') {
        advance(); advance(); // skip ?:
        const node = parseRegex();
        expect(')');
        return node; // non-capturing, just return inner
      }
      // Check for lookahead (?=...) and negative lookahead (?!...)
      if (peek() === '?') {
        const nextCh = pattern[pos + 1];
        if (nextCh === '=' || nextCh === '!') {
          advance(); advance();
          const node = parseRegex();
          expect(')');
          return { type: nextCh === '=' ? 'lookahead' : 'neg-lookahead', child: node };
        }
        // Lookbehind (?<=...) and negative lookbehind (?<!...)
        if (nextCh === '<' && (pattern[pos + 2] === '=' || pattern[pos + 2] === '!')) {
          const kind = pattern[pos + 2];
          advance(); advance(); advance(); // skip ?<=  or ?<!
          const node = parseRegex();
          expect(')');
          return { type: kind === '=' ? 'lookbehind' : 'neg-lookbehind', child: node };
        }
        // Named group (?<name>...)
        if (nextCh === '<') {
          advance(); advance(); // skip ?<
          let name = '';
          while (peek() !== '>' && peek() !== null) name += advance();
          expect('>');
          const groupIdx = ++groupCount;
          const node = parseRegex();
          expect(')');
          return { type: 'group', child: node, index: groupIdx, name };
        }
      }
      // Capturing group
      const groupIdx = ++groupCount;
      const node = parseRegex();
      expect(')');
      return { type: 'group', child: node, index: groupIdx };
    }
    if (ch === '[') return parseCharClass();
    if (ch === '.') { advance(); return { type: 'dot' }; }
    if (ch === '^') { advance(); return { type: 'anchor', kind: 'start' }; }
    if (ch === '$') { advance(); return { type: 'anchor', kind: 'end' }; }
    if (ch === '\\') {
      advance();
      const esc = advance();
      if (esc === 'd') return { type: 'class', predicate: 'digit' };
      if (esc === 'w') return { type: 'class', predicate: 'word' };
      if (esc === 's') return { type: 'class', predicate: 'space' };
      if (esc === 'D') return { type: 'class', predicate: 'non-digit' };
      if (esc === 'W') return { type: 'class', predicate: 'non-word' };
      if (esc === 'S') return { type: 'class', predicate: 'non-space' };
      if (esc === 'b') return { type: 'anchor', kind: 'word-boundary' };
      if (esc === 'B') return { type: 'anchor', kind: 'non-word-boundary' };
      if (esc === 't') return { type: 'literal', char: '\t' };
      if (esc === 'n') return { type: 'literal', char: '\n' };
      if (esc === 'r') return { type: 'literal', char: '\r' };
      if (esc === 'f') return { type: 'literal', char: '\f' };
      if (esc === 'v') return { type: 'literal', char: '\v' };
      if (esc === '0') return { type: 'literal', char: '\0' };
      // Backreference \1..\9
      if (esc >= '1' && esc <= '9') return { type: 'backref', index: parseInt(esc, 10) };
      // Literal escape (e.g., \., \*, \\, etc.)
      return { type: 'literal', char: esc };
    }
    if (ch === null || ch === ')' || ch === '|') return { type: 'empty' };
    advance();
    return { type: 'literal', char: ch };
  }

  function parseCharClass() {
    expect('[');
    let negate = false;
    if (peek() === '^') { negate = true; advance(); }
    const chars = new Set();
    const ranges = [];
    // Handle ] as first char in class
    if (peek() === ']') { chars.add(advance()); }
    while (peek() !== ']' && peek() !== null) {
      const start = advance();
      if (start === '\\') {
        // Escape inside character class
        const esc = advance();
        if (esc === 'd' || esc === 'w' || esc === 's' || esc === 'D' || esc === 'W' || esc === 'S') {
          ranges.push({ predicate: esc === 'd' ? 'digit' : esc === 'w' ? 'word' : esc === 's' ? 'space' :
            esc === 'D' ? 'non-digit' : esc === 'W' ? 'non-word' : 'non-space' });
        } else if (esc === 't') chars.add('\t');
        else if (esc === 'n') chars.add('\n');
        else if (esc === 'r') chars.add('\r');
        else chars.add(esc);
      } else if (peek() === '-' && pattern[pos + 1] !== ']' && pattern[pos + 1] !== undefined) {
        advance(); // skip -
        let end = advance();
        if (end === '\\') {
          const esc2 = advance();
          end = esc2 === 't' ? '\t' : esc2 === 'n' ? '\n' : esc2 === 'r' ? '\r' : esc2;
        }
        for (let c = start.charCodeAt(0); c <= end.charCodeAt(0); c++) {
          chars.add(String.fromCharCode(c));
        }
      } else {
        chars.add(start);
      }
    }
    expect(']');
    return { type: 'charset', chars, ranges, negate };
  }

  const ast = parseRegex();
  if (pos !== pattern.length) throw new Error(`Unexpected character at position ${pos}: '${pattern[pos]}'`);
  return { ast, groupCount };
}

// ===== Compiler: AST → NFA (Thompson Construction) =====
function compile(ast) {
  resetStateId();

  function build(node) {
    switch (node.type) {
      case 'empty': {
        const s = newState();
        return new Fragment(s, [s]);
      }
      case 'literal': {
        const s = newState();
        const end = newState();
        const c = node.char;
        s.transitions.push({ match: ch => ch === c, target: end, label: c });
        return new Fragment(s, [end]);
      }
      case 'dot': {
        const s = newState();
        const end = newState();
        s.transitions.push({ match: ch => ch !== '\n', target: end, label: '.' });
        return new Fragment(s, [end]);
      }
      case 'class': {
        const s = newState();
        const end = newState();
        const pred = matchers[node.predicate];
        s.transitions.push({ match: pred, target: end, label: '\\' + node.predicate[0] });
        return new Fragment(s, [end]);
      }
      case 'charset': {
        const s = newState();
        const end = newState();
        const { chars, ranges, negate } = node;
        const preds = (ranges || []).map(r => matchers[r.predicate]);
        const match = negate
          ? ch => !chars.has(ch) && !preds.some(p => p(ch))
          : ch => chars.has(ch) || preds.some(p => p(ch));
        s.transitions.push({ match, target: end, label: '[...]' });
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
        if (node.lazy) {
          // Lazy: prefer skipping (epsilon to out) before entering child
          child.patch(s);
          return new Fragment(s, [s, ...[]]);
          // Actually for lazy, we need: s → (out, child.start) instead of (child.start, out)
        }
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
      case 'repetition': {
        // {min,max} — expand to: child{min} child?{max-min}
        const { min, max, child: childNode } = node;
        let frags = [];
        // Required copies
        for (let i = 0; i < min; i++) {
          frags.push(build(childNode));
        }
        // Optional copies
        if (max === Infinity) {
          // min copies + star
          const starChild = build(childNode);
          const starState = newState();
          starState.epsilon.push(starChild.start);
          starChild.patch(starState);
          frags.push(new Fragment(starState, [starState]));
        } else {
          for (let i = min; i < max; i++) {
            const optChild = build(childNode);
            const optState = newState();
            optState.epsilon.push(optChild.start);
            frags.push(new Fragment(optState, [optState, ...optChild.ends]));
          }
        }
        // Chain fragments
        if (frags.length === 0) {
          const s = newState();
          return new Fragment(s, [s]);
        }
        let result = frags[0];
        for (let i = 1; i < frags.length; i++) {
          result.patch(frags[i].start);
          result = new Fragment(result.start, frags[i].ends);
        }
        return result;
      }
      case 'group': {
        const child = build(node.child);
        // Add group markers to the NFA states
        const groupStart = newState();
        const groupEnd = newState();
        groupStart.groupStart = node.index;
        groupEnd.groupEnd = node.index;
        groupStart.epsilon.push(child.start);
        child.patch(groupEnd);
        return new Fragment(groupStart, [groupEnd]);
      }
      case 'anchor': {
        // Anchors are zero-width, handled in simulation
        const s = newState();
        s.anchor = node.kind;
        return new Fragment(s, [s]);
      }
      case 'lookahead':
      case 'neg-lookahead': {
        // Lookaheads: compile child NFA, check at current position without consuming
        const childNFA = compile(node.child);
        const s = newState();
        s.lookahead = { nfa: childNFA, negative: node.type === 'neg-lookahead' };
        return new Fragment(s, [s]);
      }
      case 'lookbehind':
      case 'neg-lookbehind': {
        // Lookbehinds: store child AST for backtracking evaluation at match time
        const s = newState();
        s.lookbehind = { child: node.child, negative: node.type === 'neg-lookbehind' };
        return new Fragment(s, [s]);
      }
      case 'backref': {
        const s = newState();
        const end = newState();
        s.transitions.push({
          match: null, // special: handled by simulation
          target: end,
          backref: node.index,
          label: '\\' + node.index,
        });
        return new Fragment(s, [end]);
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
// checkAnchors: if false, skip anchor/lookahead checks (used in DFA construction)
function epsilonClosure(states, input, pos, groups, checkAnchors = true) {
  const closure = new Set();
  const stack = [...states];
  while (stack.length) {
    const s = stack.pop();
    if (closure.has(s)) continue;

    // Handle anchors
    if (checkAnchors && s.anchor) {
      const ok = checkAnchor(s.anchor, input, pos);
      if (!ok) continue;
    }

    // Handle lookaheads
    if (checkAnchors && s.lookahead) {
      const { nfa, negative } = s.lookahead;
      const remainder = input.slice(pos);
      const matches = nfaFullMatch(nfa, remainder);
      if (negative ? matches : !matches) continue;
    }

    // Handle lookbehinds
    if (checkAnchors && s.lookbehind) {
      const { child, negative } = s.lookbehind;
      // Try all possible lengths behind current position
      let found = false;
      for (let len = 0; len <= pos; len++) {
        const behind = input.slice(pos - len, pos);
        const result = backtrackerMatch(child, behind, 0);
        if (result && result.matched && result.end === len) {
          found = true;
          break;
        }
      }
      if (negative ? found : !found) continue;
    }

    closure.add(s);

    // Track group boundaries
    if (s.groupStart >= 0 && groups) {
      groups.set(s.groupStart, { ...(groups.get(s.groupStart) || {}), start: pos });
    }
    if (s.groupEnd >= 0 && groups) {
      groups.set(s.groupEnd, { ...(groups.get(s.groupEnd) || {}), end: pos });
    }

    for (const next of s.epsilon) {
      stack.push(next);
    }
  }
  return closure;
}

function checkAnchor(kind, input, pos) {
  switch (kind) {
    case 'start': return pos === 0;
    case 'end': return pos === input.length;
    case 'word-boundary': {
      const before = pos > 0 ? matchers.word(input[pos - 1]) : false;
      const after = pos < input.length ? matchers.word(input[pos]) : false;
      return before !== after;
    }
    case 'non-word-boundary': {
      const before = pos > 0 ? matchers.word(input[pos - 1]) : false;
      const after = pos < input.length ? matchers.word(input[pos]) : false;
      return before === after;
    }
    default: return true;
  }
}

function step(currentStates, char, input, pos) {
  const next = new Set();
  for (const state of currentStates) {
    for (const { match, target, backref } of state.transitions) {
      if (backref !== undefined) {
        // Backreference: skip for NFA sim (handled in backtracking matcher)
        continue;
      }
      if (match && match(char)) next.add(target);
    }
  }
  return epsilonClosure(next, input, pos + 1);
}

function hasAccept(states) {
  for (const s of states) {
    if (s.accept) return true;
  }
  return false;
}

// Simple full-match NFA test (for lookaheads)
function nfaFullMatch(nfa, input) {
  let states = epsilonClosure(new Set([nfa.start]), input, 0);
  for (let i = 0; i < input.length; i++) {
    states = step(states, input[i], input, i);
    if (states.size === 0) return false;
  }
  return hasAccept(states);
}

// ===== DFA Subset Construction =====
class DFA {
  constructor(nfa) {
    this.nfa = nfa;
    this.states = new Map(); // stateKey → { transitions: Map<charOrPred, stateKey>, accept: bool }
    this.startKey = null;
    this._build();
  }

  _stateKey(nfaStates) {
    return [...nfaStates].map(s => s.id).sort((a, b) => a - b).join(',');
  }

  _build() {
    // DFA construction: don't check anchors during epsilon closure (no input context)
    const startSet = epsilonClosure(new Set([this.nfa.start]), '', 0, null, false);
    this.startKey = this._stateKey(startSet);

    const worklist = [{ key: this.startKey, states: startSet }];
    const visited = new Set([this.startKey]);

    while (worklist.length > 0) {
      const { key, states: nfaStates } = worklist.shift();
      const dfaState = {
        accept: hasAccept(nfaStates),
        transitionFns: [],
      };
      this.states.set(key, dfaState);

      // Collect all (match, target) pairs from the NFA state set
      const allTransitions = [];
      for (const state of nfaStates) {
        for (const { match, target, backref } of state.transitions) {
          if (backref !== undefined) continue;
          if (!match) continue;
          allTransitions.push({ match, target });
        }
      }

      // For each unique combination of target states reachable by a character,
      // we group characters together. We test representative chars to find
      // distinct target sets.
      const targetSetMap = new Map(); // targetKey → { targets: Set, matchFns: [fn] }
      const testChars = new Set();
      // Build test alphabet from printable ASCII + common special chars
      for (let c = 32; c <= 126; c++) testChars.add(String.fromCharCode(c));
      testChars.add('\t'); testChars.add('\n'); testChars.add('\r');
      testChars.add('\0'); testChars.add('\f'); testChars.add('\v');

      for (const ch of testChars) {
        const targets = new Set();
        for (const { match, target } of allTransitions) {
          if (match(ch)) targets.add(target);
        }
        if (targets.size === 0) continue;
        const targetClosure = epsilonClosure(targets, '', 0, null, false);
        if (targetClosure.size === 0) continue;
        const targetKey = this._stateKey(targetClosure);
        if (!targetSetMap.has(targetKey)) {
          targetSetMap.set(targetKey, { states: targetClosure, chars: new Set() });
        }
        targetSetMap.get(targetKey).chars.add(ch);
      }

      for (const [targetKey, { states: targetStates, chars }] of targetSetMap) {
        // Build a match function for the character set
        const charSet = chars;
        const match = ch => charSet.has(ch);
        dfaState.transitionFns.push({ match, targetKey });
        if (!visited.has(targetKey)) {
          visited.add(targetKey);
          worklist.push({ key: targetKey, states: targetStates });
        }
      }
    }
  }

  test(input) {
    let current = this.startKey;
    for (const ch of input) {
      const state = this.states.get(current);
      if (!state) return false;
      let nextKey = null;
      for (const { match, targetKey } of state.transitionFns) {
        if (match(ch)) { nextKey = targetKey; break; }
      }
      if (nextKey === null) return false;
      current = nextKey;
    }
    const state = this.states.get(current);
    return state ? state.accept : false;
  }

  get stateCount() { return this.states.size; }

  // Hopcroft minimization: merge equivalent states
  minimize() {
    // Partition refinement algorithm
    const stateKeys = [...this.states.keys()];
    if (stateKeys.length <= 1) return this;
    
    // Get the alphabet (all unique char sets that appear in transitions)
    const alphabet = new Set();
    for (const [, state] of this.states) {
      for (const { match, targetKey } of state.transitionFns) {
        // Test all ASCII chars to find which chars this transition handles
        for (let c = 0; c <= 127; c++) {
          const ch = String.fromCharCode(c);
          if (match(ch)) alphabet.add(ch);
        }
      }
    }
    
    // Initial partition: accepting vs non-accepting
    const accepting = stateKeys.filter(k => this.states.get(k).accept);
    const nonAccepting = stateKeys.filter(k => !this.states.get(k).accept);
    
    let partitions = [];
    if (accepting.length > 0) partitions.push(new Set(accepting));
    if (nonAccepting.length > 0) partitions.push(new Set(nonAccepting));
    
    // Map: stateKey → partition index
    function getPartition(key) {
      for (let i = 0; i < partitions.length; i++) {
        if (partitions[i].has(key)) return i;
      }
      return -1;
    }
    
    // Get transition target for a state and character
    const getTarget = (key, ch) => {
      const state = this.states.get(key);
      if (!state) return null;
      for (const { match, targetKey } of state.transitionFns) {
        if (match(ch)) return targetKey;
      }
      return null; // dead state
    };
    
    // Refine until stable
    let changed = true;
    while (changed) {
      changed = false;
      const newPartitions = [];
      
      for (const partition of partitions) {
        if (partition.size <= 1) {
          newPartitions.push(partition);
          continue;
        }
        
        // Try to split this partition
        let split = false;
        for (const ch of alphabet) {
          const groups = new Map(); // targetPartition → Set<stateKey>
          for (const key of partition) {
            const target = getTarget(key, ch);
            const targetPart = target !== null ? getPartition(target) : -1;
            if (!groups.has(targetPart)) groups.set(targetPart, new Set());
            groups.get(targetPart).add(key);
          }
          
          if (groups.size > 1) {
            // Split
            for (const [, group] of groups) {
              newPartitions.push(group);
            }
            split = true;
            changed = true;
            break;
          }
        }
        
        if (!split) {
          newPartitions.push(partition);
        }
      }
      
      partitions = newPartitions;
    }
    
    // If no merging possible, return self
    if (partitions.length === stateKeys.length) return this;
    
    // Build minimized DFA
    const minimized = new DFA(this.nfa);
    minimized.states = new Map();
    
    // Representative: first element of each partition
    const repMap = new Map(); // old key → representative key
    for (const partition of partitions) {
      const rep = [...partition][0];
      for (const key of partition) {
        repMap.set(key, rep);
      }
    }
    
    minimized.startKey = repMap.get(this.startKey);
    
    for (const partition of partitions) {
      const rep = [...partition][0];
      const oldState = this.states.get(rep);
      const newTransitions = [];
      
      for (const { match, targetKey } of oldState.transitionFns) {
        const newTarget = repMap.get(targetKey);
        // Deduplicate: only add if target not already covered
        if (!newTransitions.some(t => t.targetKey === newTarget && t.match === match)) {
          newTransitions.push({ match, targetKey: newTarget });
        }
      }
      
      minimized.states.set(rep, {
        accept: oldState.accept,
        transitionFns: newTransitions,
      });
    }
    
    return minimized;
  }
}

// ===== Lazy DFA — builds states on demand =====
class LazyDFA {
  constructor(nfa) {
    this.nfa = nfa;
    this.states = new Map(); // stateKey → { nfaStates, accept, transitions: Map<char, stateKey> }
    this.startKey = null;
    this._init();
  }

  _stateKey(nfaStates) {
    return [...nfaStates].map(s => s.id).sort((a, b) => a - b).join(',');
  }

  _init() {
    const startSet = epsilonClosure(new Set([this.nfa.start]), '', 0, null, false);
    this.startKey = this._stateKey(startSet);
    this.states.set(this.startKey, {
      nfaStates: startSet,
      accept: hasAccept(startSet),
      transitions: new Map(),
    });
  }

  _getOrBuildTransition(stateKey, ch) {
    const state = this.states.get(stateKey);
    if (state.transitions.has(ch)) return state.transitions.get(ch);
    
    // Compute the next NFA state set
    const nextNfa = new Set();
    for (const nfaState of state.nfaStates) {
      for (const { match, target, backref } of nfaState.transitions) {
        if (backref !== undefined) continue;
        if (match && match(ch)) nextNfa.add(target);
      }
    }
    
    if (nextNfa.size === 0) {
      state.transitions.set(ch, null);
      return null;
    }
    
    const closure = epsilonClosure(nextNfa, '', 0, null, false);
    if (closure.size === 0) {
      state.transitions.set(ch, null);
      return null;
    }
    
    const nextKey = this._stateKey(closure);
    if (!this.states.has(nextKey)) {
      this.states.set(nextKey, {
        nfaStates: closure,
        accept: hasAccept(closure),
        transitions: new Map(),
      });
    }
    
    state.transitions.set(ch, nextKey);
    return nextKey;
  }

  test(input) {
    let current = this.startKey;
    for (const ch of input) {
      const next = this._getOrBuildTransition(current, ch);
      if (next === null) return false;
      current = next;
    }
    return this.states.get(current).accept;
  }

  get stateCount() { return this.states.size; }
  get cacheSize() {
    let count = 0;
    for (const [, state] of this.states) {
      count += state.transitions.size;
    }
    return count;
  }
}

// ===== Backtracking Matcher (for backreferences + lazy quantifiers) =====
function backtrackerMatch(ast, input, groupCount, startPos = 0) {
  // Returns { matched: bool, groups: Map<int, string>, end: int } or null
  // startPos: where matching begins (for lookbehind context)
  
  function matchNode(node, pos, groups) {
    switch (node.type) {
      case 'empty':
        return [{ end: pos, groups }];
      case 'literal':
        if (pos < input.length && input[pos] === node.char) {
          return [{ end: pos + 1, groups }];
        }
        return [];
      case 'dot':
        if (pos < input.length && input[pos] !== '\n') {
          return [{ end: pos + 1, groups }];
        }
        return [];
      case 'class': {
        const pred = matchers[node.predicate];
        if (pos < input.length && pred(input[pos])) {
          return [{ end: pos + 1, groups }];
        }
        return [];
      }
      case 'charset': {
        if (pos >= input.length) return [];
        const ch = input[pos];
        const { chars, ranges, negate } = node;
        const preds = (ranges || []).map(r => matchers[r.predicate]);
        const inClass = chars.has(ch) || preds.some(p => p(ch));
        if (negate ? !inClass : inClass) {
          return [{ end: pos + 1, groups }];
        }
        return [];
      }
      case 'concat': {
        let results = matchNode(node.left, pos, groups);
        const final = [];
        for (const r of results) {
          const rightResults = matchNode(node.right, r.end, r.groups);
          final.push(...rightResults);
        }
        return final;
      }
      case 'alt': {
        const leftResults = matchNode(node.left, pos, groups);
        const rightResults = matchNode(node.right, pos, groups);
        return [...leftResults, ...rightResults];
      }
      case 'star':
        return matchRepeat(node.child, pos, groups, 0, Infinity, node.lazy);
      case 'plus':
        return matchRepeat(node.child, pos, groups, 1, Infinity, node.lazy);
      case 'question':
        return matchRepeat(node.child, pos, groups, 0, 1, node.lazy);
      case 'repetition':
        return matchRepeat(node.child, pos, groups, node.min, node.max, node.lazy);
      case 'group': {
        const childResults = matchNode(node.child, pos, groups);
        return childResults.map(r => {
          const newGroups = new Map(r.groups);
          newGroups.set(node.index, input.slice(pos, r.end));
          if (node.name) newGroups.set(node.name, input.slice(pos, r.end));
          return { end: r.end, groups: newGroups };
        });
      }
      case 'backref': {
        const captured = groups.get(node.index);
        if (captured === undefined) return [];
        if (input.startsWith(captured, pos)) {
          return [{ end: pos + captured.length, groups }];
        }
        return [];
      }
      case 'anchor': {
        const ok = checkAnchor(node.kind, input, pos);
        if (ok) return [{ end: pos, groups }];
        return [];
      }
      case 'lookahead': {
        // Check if child matches at current position (any length)
        const childResults = matchNode(node.child, pos, groups);
        if (childResults.length > 0) return [{ end: pos, groups }]; // don't consume
        return [];
      }
      case 'neg-lookahead': {
        const childResults = matchNode(node.child, pos, groups);
        if (childResults.length === 0) return [{ end: pos, groups }];
        return [];
      }
      case 'lookbehind': {
        // Try all possible lengths behind current position in the full input
        for (let len = 0; len <= pos; len++) {
          const behind = input.slice(pos - len, pos);
          const r = backtrackerMatch(node.child, behind, 0);
          if (r && r.matched && r.end === len) {
            return [{ end: pos, groups }];
          }
        }
        return [];
      }
      case 'neg-lookbehind': {
        for (let len = 0; len <= pos; len++) {
          const behind = input.slice(pos - len, pos);
          const r = backtrackerMatch(node.child, behind, 0);
          if (r && r.matched && r.end === len) {
            return []; // found a match behind — negative fails
          }
        }
        return [{ end: pos, groups }];
      }
      default:
        throw new Error(`Backtracker: unknown node type ${node.type}`);
    }
  }
  
  function matchRepeat(childNode, pos, groups, min, max, lazy) {
    // Generate all possible repetition results ordered by preference
    // Collect all lengths: [(count, end, groups), ...]
    const options = [];
    
    // BFS: collect all possible repetition counts
    let frontier = [{ count: 0, end: pos, groups }];
    if (0 >= min) options.push({ end: pos, groups });
    
    while (frontier.length > 0) {
      const nextFrontier = [];
      for (const f of frontier) {
        if (f.count >= max) continue;
        const childResults = matchNode(childNode, f.end, f.groups);
        for (const r of childResults) {
          if (r.end === f.end) continue; // no progress, skip
          const newCount = f.count + 1;
          if (newCount >= min) {
            options.push({ end: r.end, groups: r.groups });
          }
          if (newCount < max) {
            nextFrontier.push({ count: newCount, end: r.end, groups: r.groups });
          }
        }
      }
      frontier = nextFrontier;
    }
    
    if (lazy) {
      // Already ordered shortest-first (by construction)
      return options;
    }
    // Greedy: longest first
    return options.reverse();
  }
  
  const results = matchNode(ast, startPos, new Map());
  // Return first result that matches (results are ordered by preference)
  for (const r of results) {
    return { matched: true, end: r.end, groups: r.groups };
  }
  return null;
}

// Expose internal: return all match results for a pattern against input
function _backtrackerInner(ast, input, groupCount, startPos = 0) {
  // Full backtracker returning all possible results
  // startPos: where matching begins (for search from position)
  
  function matchNode(node, pos, groups) {
    switch (node.type) {
      case 'empty':
        return [{ end: pos, groups }];
      case 'literal':
        return (pos < input.length && input[pos] === node.char) ? [{ end: pos + 1, groups }] : [];
      case 'dot':
        return (pos < input.length && input[pos] !== '\n') ? [{ end: pos + 1, groups }] : [];
      case 'class': {
        const pred = matchers[node.predicate];
        return (pos < input.length && pred(input[pos])) ? [{ end: pos + 1, groups }] : [];
      }
      case 'charset': {
        if (pos >= input.length) return [];
        const ch = input[pos];
        const { chars, ranges, negate } = node;
        const preds = (ranges || []).map(r => matchers[r.predicate]);
        const inClass = chars.has(ch) || preds.some(p => p(ch));
        return (negate ? !inClass : inClass) ? [{ end: pos + 1, groups }] : [];
      }
      case 'concat': {
        const final = [];
        for (const r of matchNode(node.left, pos, groups)) {
          final.push(...matchNode(node.right, r.end, r.groups));
        }
        return final;
      }
      case 'alt':
        return [...matchNode(node.left, pos, groups), ...matchNode(node.right, pos, groups)];
      case 'star':
        return matchRepeat(node.child, pos, groups, 0, Infinity, node.lazy);
      case 'plus':
        return matchRepeat(node.child, pos, groups, 1, Infinity, node.lazy);
      case 'question':
        return matchRepeat(node.child, pos, groups, 0, 1, node.lazy);
      case 'repetition':
        return matchRepeat(node.child, pos, groups, node.min, node.max, node.lazy);
      case 'group': {
        return matchNode(node.child, pos, groups).map(r => {
          const ng = new Map(r.groups);
          ng.set(node.index, input.slice(pos, r.end));
          if (node.name) ng.set(node.name, input.slice(pos, r.end));
          return { end: r.end, groups: ng };
        });
      }
      case 'backref': {
        const captured = groups.get(node.index);
        if (captured === undefined) return [];
        return input.startsWith(captured, pos) ? [{ end: pos + captured.length, groups }] : [];
      }
      case 'anchor':
        return checkAnchor(node.kind, input, pos) ? [{ end: pos, groups }] : [];
      case 'lookahead':
        return matchNode(node.child, pos, groups).length > 0 ? [{ end: pos, groups }] : [];
      case 'neg-lookahead':
        return matchNode(node.child, pos, groups).length === 0 ? [{ end: pos, groups }] : [];
      case 'lookbehind': {
        for (let len = 0; len <= pos; len++) {
          const behind = input.slice(pos - len, pos);
          const r = backtrackerMatch(node.child, behind, 0);
          if (r && r.matched && r.end === len) return [{ end: pos, groups }];
        }
        return [];
      }
      case 'neg-lookbehind': {
        for (let len = 0; len <= pos; len++) {
          const behind = input.slice(pos - len, pos);
          const r = backtrackerMatch(node.child, behind, 0);
          if (r && r.matched && r.end === len) return [];
        }
        return [{ end: pos, groups }];
      }
      default:
        throw new Error(`Backtracker: unknown node type ${node.type}`);
    }
  }
  
  function matchRepeat(childNode, pos, groups, min, max, lazy) {
    const options = [];
    let frontier = [{ count: 0, end: pos, groups }];
    if (0 >= min) options.push({ end: pos, groups });
    while (frontier.length > 0) {
      const nextFrontier = [];
      for (const f of frontier) {
        if (f.count >= max) continue;
        for (const r of matchNode(childNode, f.end, f.groups)) {
          if (r.end === f.end) continue;
          const nc = f.count + 1;
          if (nc >= min) options.push({ end: r.end, groups: r.groups });
          if (nc < max) nextFrontier.push({ count: nc, end: r.end, groups: r.groups });
        }
      }
      frontier = nextFrontier;
    }
    return lazy ? options : options.reverse();
  }
  
  return matchNode(ast, startPos, new Map());
}

// ===== Public API =====
export class Regex {
  constructor(pattern, flags = '') {
    this.pattern = pattern;
    this.flags = flags;
    const parsed = parse(pattern);
    this.ast = parsed.ast;
    this.groupCount = parsed.groupCount;
    this.hasBackrefs = pattern.includes('\\') && /\\[1-9]/.test(pattern);
    this.hasLazy = /[*+?]\?|\{\d+,?\d*\}\?/.test(pattern);
    this.hasLookbehind = /\(\?<[=!]/.test(pattern);
    this.nfa = compile(this.ast);
    this._dfa = null; // lazily built
  }

  get dfa() {
    if (!this._dfa) this._dfa = new DFA(this.nfa);
    return this._dfa;
  }

  get minimizedDfa() {
    if (!this._minimizedDfa) this._minimizedDfa = this.dfa.minimize();
    return this._minimizedDfa;
  }

  get lazyDfa() {
    if (!this._lazyDfa) this._lazyDfa = new LazyDFA(this.nfa);
    return this._lazyDfa;
  }

  // Full match (entire string must match)
  test(input) {
    if (this.hasBackrefs || this.hasLazy) {
      const results = _backtrackerInner(this.ast, input, this.groupCount);
      return results.some(r => r.end === input.length);
    }
    let states = epsilonClosure(new Set([this.nfa.start]), input, 0);
    for (let i = 0; i < input.length; i++) {
      states = step(states, input[i], input, i);
      if (states.size === 0) return false;
    }
    return hasAccept(states);
  }

  // Full match returning captured groups
  exec(input) {
    // Get all possible match results; find first that's a full match
    const allResults = _backtrackerInner(this.ast, input, this.groupCount);
    let result = null;
    for (const r of allResults) {
      if (r.end === input.length) { result = r; break; }
    }
    if (!result) return null;
    const groups = [input]; // groups[0] = full match
    for (let i = 1; i <= this.groupCount; i++) {
      groups.push(result.groups.get(i) ?? undefined);
    }
    groups.index = 0;
    groups.input = input;
    // Named groups
    const named = {};
    for (const [key, val] of result.groups) {
      if (typeof key === 'string') named[key] = val;
    }
    if (Object.keys(named).length > 0) groups.groups = named;
    return groups;
  }

  // Search with capturing groups
  execSearch(input) {
    for (let i = 0; i <= input.length; i++) {
      const suffix = input.slice(i);
      const results = _backtrackerInner(this.ast, suffix, this.groupCount);
      
      for (const r of results) {
        if (r.end > 0) {
          const sub = suffix.slice(0, r.end);
          const groups = [sub];
          for (let k = 1; k <= this.groupCount; k++) {
            groups.push(r.groups.get(k) ?? undefined);
          }
          groups.index = i;
          groups.input = input;
          const named = {};
          for (const [key, val] of r.groups) {
            if (typeof key === 'string') named[key] = val;
          }
          if (Object.keys(named).length > 0) groups.groups = named;
          return groups;
        }
      }
    }
    return null;
  }

  // Full match using DFA (O(n), no backtracking)
  testDFA(input) {
    return this.dfa.test(input);
  }

  // Full match using minimized DFA
  testMinDFA(input) {
    return this.minimizedDfa.test(input);
  }

  // Full match using lazy DFA (builds states on demand)
  testLazyDFA(input) {
    return this.lazyDfa.test(input);
  }

  // Search (find first match anywhere in string)
  search(input) {
    // Use backtracker for patterns with lazy quantifiers or backrefs (NFA can't handle laziness)
    if (this.hasLazy || this.hasBackrefs || this.hasLookbehind) {
      return this._backtrackerSearch(input, false);
    }
    return this._nfaSearch(input);
  }

  _backtrackerSearch(input, shortest = false) {
    for (let i = 0; i <= input.length; i++) {
      // Run backtracker at each position using full input
      const results = _backtrackerInner(this.ast, input, this.groupCount, i);
      
      // Filter to non-empty matches, ordered by preference
      let bestResult = null;
      for (const r of results) {
        if (r.end > i) {
          bestResult = r;
          break;
        }
      }
      if (bestResult) {
        return { index: i, match: input.slice(i, bestResult.end) };
      }
    }
    return null;
  }

  _nfaSearch(input) {
    for (let i = 0; i <= input.length; i++) {
      let states = epsilonClosure(new Set([this.nfa.start]), input, i);
      let lastMatch = hasAccept(states) ? { index: i, match: '' } : null;

      for (let j = i; j < input.length; j++) {
        states = step(states, input[j], input, j);
        if (states.size === 0) break;
        if (hasAccept(states)) lastMatch = { index: i, match: input.slice(i, j + 1) };
      }

      if (lastMatch) {
        // Prefer non-empty match, but accept empty if it's a valid anchor match
        if (lastMatch.match.length > 0) return lastMatch;
        // Empty match — only return if we can't find a non-empty one later
        // (for patterns like a* that match empty everywhere)
        continue;
      }
    }
    // Second pass: accept empty matches for anchor patterns
    for (let i = 0; i <= input.length; i++) {
      let states = epsilonClosure(new Set([this.nfa.start]), input, i);
      if (hasAccept(states)) return { index: i, match: '' };
    }
    return null;
  }

  // Find all non-overlapping matches
  matchAll(input) {
    if (this.hasLazy || this.hasBackrefs || this.hasLookbehind) {
      return this._backtrackerMatchAll(input);
    }
    const results = [];
    let i = 0;
    while (i <= input.length) {
      let states = epsilonClosure(new Set([this.nfa.start]), input, i);
      let lastMatch = null;

      if (hasAccept(states)) {
        lastMatch = { index: i, match: '' };
      }

      for (let j = i; j < input.length; j++) {
        states = step(states, input[j], input, j);
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

  _backtrackerMatchAll(input) {
    const results = [];
    let i = 0;
    while (i <= input.length) {
      const btResults = _backtrackerInner(this.ast, input, this.groupCount, i);
      let best = null;
      for (const r of btResults) {
        if (r.end > i) { best = r; break; }
      }
      if (best) {
        results.push({ index: i, match: input.slice(i, best.end) });
        i = best.end;
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
      result += input.slice(lastIdx, m.index);
      if (typeof replacement === 'function') {
        result += replacement(m.match, m.index);
      } else {
        result += replacement;
      }
      lastIdx = m.index + m.match.length;
    }
    result += input.slice(lastIdx);
    return result;
  }

  // Split string on regex matches
  split(input, limit = Infinity) {
    const matches = this.matchAll(input);
    if (!matches.length) return [input];
    const parts = [];
    let lastIdx = 0;
    for (const m of matches) {
      if (parts.length >= limit - 1) break;
      parts.push(input.slice(lastIdx, m.index));
      lastIdx = m.index + m.match.length;
    }
    parts.push(input.slice(lastIdx));
    return parts;
  }

  // Get DFA stats
  get dfaStats() {
    const dfa = this.dfa;
    const minDfa = this.minimizedDfa;
    return { states: dfa.stateCount, minimizedStates: minDfa.stateCount };
  }

  toString() { return `/${this.pattern}/`; }
}

// For tests
export { parse, compile, epsilonClosure, step, hasAccept, DFA, LazyDFA, matchers, checkAnchor, backtrackerMatch };
