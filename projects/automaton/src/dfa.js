// DFA — Deterministic Finite Automaton with minimization

export class DFA {
  constructor() {
    this.states = new Set();
    this.alphabet = new Set();
    this.transitions = new Map(); // "state,symbol" → state
    this.startState = null;
    this.acceptStates = new Set();
  }

  addState(name, { start = false, accept = false } = {}) {
    this.states.add(name);
    if (start) this.startState = name;
    if (accept) this.acceptStates.add(name);
    return this;
  }

  addTransition(from, symbol, to) {
    this.alphabet.add(symbol);
    this.transitions.set(`${from},${symbol}`, to);
    return this;
  }

  // Run DFA on input string
  run(input) {
    let state = this.startState;
    for (const ch of input) {
      const next = this.transitions.get(`${state},${ch}`);
      if (next === undefined) return false; // Dead state
      state = next;
    }
    return this.acceptStates.has(state);
  }

  // Get trace (sequence of states)
  trace(input) {
    const path = [this.startState];
    let state = this.startState;
    for (const ch of input) {
      const next = this.transitions.get(`${state},${ch}`);
      if (next === undefined) return { accepted: false, path, stuck: ch };
      state = next;
      path.push(state);
    }
    return { accepted: this.acceptStates.has(state), path };
  }

  // Minimize using Hopcroft's algorithm (partition refinement)
  minimize() {
    const states = [...this.states];
    const alphabet = [...this.alphabet];

    // Initial partition: accept states vs non-accept states
    let P = [
      new Set(states.filter(s => this.acceptStates.has(s))),
      new Set(states.filter(s => !this.acceptStates.has(s))),
    ].filter(s => s.size > 0);

    let changed = true;
    while (changed) {
      changed = false;
      const newP = [];
      for (const group of P) {
        for (const sym of alphabet) {
          const split = this._splitGroup(group, sym, P);
          if (split.length > 1) {
            newP.push(...split);
            changed = true;
          } else {
            newP.push(group);
          }
          break; // Only need one split per iteration
        }
        if (changed) {
          // Add remaining groups unchanged
          for (const g of P) { if (!newP.some(n => [...g].every(s => n.has(s)))) newP.push(g); }
          break;
        }
      }
      if (changed) P = newP;
    }

    // Build minimized DFA
    const min = new DFA();
    const groupOf = new Map();
    for (let i = 0; i < P.length; i++) {
      for (const s of P[i]) groupOf.set(s, `q${i}`);
    }

    for (let i = 0; i < P.length; i++) {
      const name = `q${i}`;
      const rep = [...P[i]][0];
      min.addState(name, { start: rep === this.startState, accept: this.acceptStates.has(rep) });
    }

    for (const [key, to] of this.transitions) {
      const [from, sym] = key.split(',');
      const gFrom = groupOf.get(from), gTo = groupOf.get(to);
      if (!min.transitions.has(`${gFrom},${sym}`)) min.addTransition(gFrom, sym, gTo);
    }

    return min;
  }

  _splitGroup(group, symbol, partition) {
    const targets = new Map();
    for (const state of group) {
      const target = this.transitions.get(`${state},${symbol}`);
      const targetGroup = partition.findIndex(g => g.has(target));
      const key = target === undefined ? -1 : targetGroup;
      if (!targets.has(key)) targets.set(key, new Set());
      targets.get(key).add(state);
    }
    return [...targets.values()];
  }

  get stateCount() { return this.states.size; }
}
