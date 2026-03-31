/**
 * Tiny Finite State Transducer (FST)
 * 
 * Maps input sequences to output sequences via state transitions.
 * - Mealy machine (output on transitions)
 * - Moore machine (output on states)
 * - Compose FSTs
 * - Run on input strings
 * - Transduce arrays
 */

class MealyFST {
  constructor() {
    this.states = new Set();
    this.initial = null;
    this.transitions = new Map(); // "state:input" -> { next, output }
    this.accepting = new Set();
  }

  addState(name, { initial = false, accepting = false } = {}) {
    this.states.add(name);
    if (initial) this.initial = name;
    if (accepting) this.accepting.add(name);
    return this;
  }

  addTransition(from, input, to, output) {
    this.transitions.set(`${from}:${input}`, { next: to, output });
    return this;
  }

  run(inputs) {
    let state = this.initial;
    if (!state) throw new Error('No initial state');
    const outputs = [];
    for (const input of inputs) {
      const key = `${state}:${input}`;
      const t = this.transitions.get(key);
      if (!t) return { accepted: false, output: outputs, state };
      outputs.push(t.output);
      state = t.next;
    }
    return { accepted: this.accepting.has(state), output: outputs, state };
  }

  transduce(inputs) {
    const result = this.run(inputs);
    return result.output;
  }

  /**
   * Get all possible outputs for an input from a given state
   */
  step(state, input) {
    const t = this.transitions.get(`${state}:${input}`);
    return t || null;
  }
}

class MooreFST {
  constructor() {
    this.states = new Map(); // state -> output
    this.initial = null;
    this.transitions = new Map(); // "state:input" -> nextState
    this.accepting = new Set();
  }

  addState(name, { initial = false, accepting = false, output = null } = {}) {
    this.states.set(name, output);
    if (initial) this.initial = name;
    if (accepting) this.accepting.add(name);
    return this;
  }

  addTransition(from, input, to) {
    this.transitions.set(`${from}:${input}`, to);
    return this;
  }

  run(inputs) {
    let state = this.initial;
    if (!state) throw new Error('No initial state');
    const outputs = [this.states.get(state)];
    for (const input of inputs) {
      const next = this.transitions.get(`${state}:${input}`);
      if (!next) return { accepted: false, output: outputs, state };
      state = next;
      outputs.push(this.states.get(state));
    }
    return { accepted: this.accepting.has(state), output: outputs, state };
  }

  transduce(inputs) {
    return this.run(inputs).output;
  }
}

/**
 * Compose two Mealy FSTs: f then g
 * Product construction: (stateA, stateB) transitions together
 */
function compose(fstA, fstB) {
  const result = new MealyFST();
  const pairName = (a, b) => `${a},${b}`;
  
  const initial = pairName(fstA.initial, fstB.initial);
  result.addState(initial, { initial: true });
  
  const queue = [[fstA.initial, fstB.initial]];
  const visited = new Set([initial]);
  
  while (queue.length > 0) {
    const [sa, sb] = queue.shift();
    const pn = pairName(sa, sb);
    
    // Check accepting
    if (fstA.accepting.has(sa) && fstB.accepting.has(sb)) {
      result.accepting.add(pn);
    }
    
    // For each transition from sa
    for (const [key, transA] of fstA.transitions) {
      const [fromA, input] = key.split(':');
      if (fromA !== sa) continue;
      
      // Feed output of A into B
      const transB = fstB.step(sb, transA.output);
      if (!transB) continue;
      
      const nextPair = pairName(transA.next, transB.next);
      if (!visited.has(nextPair)) {
        visited.add(nextPair);
        result.addState(nextPair);
        queue.push([transA.next, transB.next]);
      }
      result.addTransition(pn, input, nextPair, transB.output);
    }
  }
  
  return result;
}

/**
 * Build an FST from a simple string-to-string mapping
 */
function fromMapping(map) {
  const fst = new MealyFST();
  fst.addState('q0', { initial: true, accepting: true });
  
  for (const [input, output] of Object.entries(map)) {
    fst.addTransition('q0', input, 'q0', output);
  }
  
  return fst;
}

module.exports = { MealyFST, MooreFST, compose, fromMapping };
