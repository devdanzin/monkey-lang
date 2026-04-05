// dfa.js — NFA→DFA subset construction and DFA minimization
// Uses powerset construction (subset construction) to convert NFA to DFA
// Then Hopcroft's algorithm for DFA state minimization

import { parse, buildNFA, State, Fragment } from './regex.js';

// ===== Epsilon Closure =====
function epsilonClosure(states) {
  const closure = new Set();
  const stack = [...states];
  for (const s of states) closure.add(s);
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

// Get all unique input symbols from NFA
function getAlphabet(nfa) {
  const alphabet = new Set();
  const visited = new Set();
  const stack = [nfa.start];
  while (stack.length > 0) {
    const state = stack.pop();
    if (visited.has(state)) continue;
    visited.add(state);
    for (const t of state.transitions) {
      if (t.epsilon) {
        stack.push(t.state);
      } else if (t.dot) {
        alphabet.add('.'); // wildcard marker
      } else if (t.char) {
        alphabet.add(t.char);
      } else if (t.charClass) {
        for (const ch of t.charClass) alphabet.add(ch);
      }
      if (t.state) stack.push(t.state);
    }
  }
  return alphabet;
}

// Move from a set of NFA states on a given symbol
function nfaMove(states, symbol) {
  const next = new Set();
  for (const state of states) {
    for (const t of state.transitions) {
      if (t.epsilon) continue;
      if (t.dot) {
        next.add(t.state);
      } else if (t.char === symbol) {
        next.add(t.state);
      } else if (t.charClass) {
        const inClass = t.charClass.includes(symbol);
        if (t.negate ? !inClass : inClass) next.add(t.state);
      }
    }
  }
  return next;
}

// Convert a set of NFA states to a canonical string key
function stateSetKey(states) {
  return [...states].map(s => s.id).sort((a, b) => a - b).join(',');
}

// ===== DFA State =====
export class DFAState {
  constructor(id, nfaStates, isAccept) {
    this.id = id;
    this.nfaStates = nfaStates; // Set of NFA states this DFA state represents
    this.isAccept = isAccept;
    this.transitions = new Map(); // symbol → DFAState
  }
}

// ===== Subset Construction (NFA → DFA) =====
export function nfaToDFA(nfa) {
  const startClosure = epsilonClosure(new Set([nfa.start]));
  const startKey = stateSetKey(startClosure);
  const startAccept = [...startClosure].some(s => s.isAccept);

  let nextId = 0;
  const startState = new DFAState(nextId++, startClosure, startAccept);
  const dfaStates = new Map(); // key → DFAState
  dfaStates.set(startKey, startState);

  const alphabet = getAlphabet(nfa);
  const worklist = [startState];

  while (worklist.length > 0) {
    const current = worklist.pop();

    for (const symbol of alphabet) {
      if (symbol === '.') continue; // handle wildcards separately

      const moved = nfaMove(current.nfaStates, symbol);
      if (moved.size === 0) continue;

      const closure = epsilonClosure(moved);
      const key = stateSetKey(closure);

      if (!dfaStates.has(key)) {
        const isAccept = [...closure].some(s => s.isAccept);
        const newState = new DFAState(nextId++, closure, isAccept);
        dfaStates.set(key, newState);
        worklist.push(newState);
      }

      current.transitions.set(symbol, dfaStates.get(key));
    }
  }

  return {
    start: startState,
    states: [...dfaStates.values()],
    alphabet,
  };
}

// ===== DFA Minimization (Hopcroft's Algorithm) =====
export function minimizeDFA(dfa) {
  const { states, alphabet } = dfa;

  if (states.length <= 1) return dfa;

  // Initial partition: accepting vs non-accepting
  const acceptStates = states.filter(s => s.isAccept);
  const nonAcceptStates = states.filter(s => !s.isAccept);

  let partitions = [];
  if (acceptStates.length > 0) partitions.push(new Set(acceptStates));
  if (nonAcceptStates.length > 0) partitions.push(new Set(nonAcceptStates));

  // Map from state to its partition index
  function getPartition(state) {
    for (let i = 0; i < partitions.length; i++) {
      if (partitions[i].has(state)) return i;
    }
    return -1;
  }

  // Refine partitions
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
      const groups = new Map(); // signature → Set<state>
      for (const state of partition) {
        // Build signature: for each symbol, which partition does the transition go to?
        const sig = [];
        for (const symbol of alphabet) {
          const target = state.transitions.get(symbol);
          sig.push(target ? getPartition(target) : -1);
        }
        const sigKey = sig.join(',');
        if (!groups.has(sigKey)) groups.set(sigKey, new Set());
        groups.get(sigKey).add(state);
      }

      for (const group of groups.values()) {
        newPartitions.push(group);
      }
      if (groups.size > 1) changed = true;
    }

    partitions = newPartitions;
  }

  // Build minimized DFA
  let minNextId = 0;
  const minStates = new Map(); // partition index → new DFAState
  const partitionOf = new Map(); // state → partition index

  for (let i = 0; i < partitions.length; i++) {
    for (const state of partitions[i]) {
      partitionOf.set(state, i);
    }
    const representative = [...partitions[i]][0];
    const newState = new DFAState(minNextId++, representative.nfaStates, representative.isAccept);
    minStates.set(i, newState);
  }

  // Add transitions
  for (let i = 0; i < partitions.length; i++) {
    const representative = [...partitions[i]][0];
    const minState = minStates.get(i);
    for (const [symbol, target] of representative.transitions) {
      const targetPartition = partitionOf.get(target);
      if (targetPartition !== undefined) {
        minState.transitions.set(symbol, minStates.get(targetPartition));
      }
    }
  }

  const startPartition = partitionOf.get(dfa.start);
  return {
    start: minStates.get(startPartition),
    states: [...minStates.values()],
    alphabet,
  };
}

// ===== DFA Matching =====
export function dfaMatch(dfa, text) {
  let current = dfa.start;
  for (let i = 0; i < text.length; i++) {
    const next = current.transitions.get(text[i]);
    if (!next) return false;
    current = next;
  }
  return current.isAccept;
}

// DFA search (find match anywhere in text)
export function dfaSearch(dfa, text) {
  for (let start = 0; start <= text.length; start++) {
    let current = dfa.start;
    if (current.isAccept) return { match: true, start, end: start };
    for (let i = start; i < text.length; i++) {
      const next = current.transitions.get(text[i]);
      if (!next) break;
      current = next;
      if (current.isAccept) return { match: true, start, end: i + 1 };
    }
  }
  return { match: false };
}

// ===== DFA Statistics =====
export function dfaStats(dfa) {
  let transitionCount = 0;
  for (const state of dfa.states) {
    transitionCount += state.transitions.size;
  }
  return {
    states: dfa.states.length,
    transitions: transitionCount,
    acceptStates: dfa.states.filter(s => s.isAccept).length,
    alphabet: dfa.alphabet.size,
  };
}

// ===== Convenience: Pattern → DFA =====
export function compile(pattern) {
  const ast = parse(pattern);
  const nfa = buildNFA(ast);
  const dfa = nfaToDFA(nfa);
  const minDfa = minimizeDFA(dfa);
  return {
    match: (text) => dfaMatch(minDfa, text),
    search: (text) => dfaSearch(minDfa, text),
    stats: () => dfaStats(minDfa),
    dfa: minDfa,
    rawDfa: dfa,
  };
}
