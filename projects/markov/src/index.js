/**
 * Tiny Markov Chain Text Generator
 * 
 * Statistical text generation:
 * - N-gram model (configurable order)
 * - Train on text corpus
 * - Generate text
 * - Word-level and character-level
 * - Weighted random selection
 * - Serialization
 */

class MarkovChain {
  constructor(order = 2) {
    this.order = order;
    this.chain = new Map(); // stateKey -> Map<next, count>
    this.starts = []; // starting states
    this.totalTransitions = 0;
  }

  train(text, mode = 'word') {
    const tokens = mode === 'word'
      ? text.split(/\s+/).filter(t => t)
      : text.split('');
    
    if (tokens.length <= this.order) return;

    for (let i = 0; i <= tokens.length - this.order; i++) {
      const state = tokens.slice(i, i + this.order).join(mode === 'word' ? ' ' : '');
      const next = tokens[i + this.order] || null;
      
      if (i === 0) this.starts.push(state);
      
      if (!this.chain.has(state)) this.chain.set(state, new Map());
      const transitions = this.chain.get(state);
      if (next !== null) {
        transitions.set(next, (transitions.get(next) || 0) + 1);
        this.totalTransitions++;
      }
    }
    return this;
  }

  generate(length = 50, mode = 'word') {
    if (this.starts.length === 0) return '';
    
    let state = this.starts[Math.floor(Math.random() * this.starts.length)];
    const tokens = state.split(mode === 'word' ? ' ' : '');
    
    for (let i = 0; i < length - this.order; i++) {
      const transitions = this.chain.get(state);
      if (!transitions || transitions.size === 0) break;
      
      const next = weightedRandom(transitions);
      tokens.push(next);
      
      const stateTokens = mode === 'word'
        ? tokens.slice(tokens.length - this.order)
        : tokens.slice(tokens.length - this.order);
      state = stateTokens.join(mode === 'word' ? ' ' : '');
    }
    
    return mode === 'word' ? tokens.join(' ') : tokens.join('');
  }

  probability(state, next) {
    const transitions = this.chain.get(state);
    if (!transitions) return 0;
    const total = [...transitions.values()].reduce((a, b) => a + b, 0);
    return (transitions.get(next) || 0) / total;
  }

  stateCount() { return this.chain.size; }

  mostLikely(state) {
    const transitions = this.chain.get(state);
    if (!transitions || transitions.size === 0) return null;
    let best = null, bestCount = 0;
    for (const [next, count] of transitions) {
      if (count > bestCount) { best = next; bestCount = count; }
    }
    return best;
  }

  toJSON() {
    const chain = {};
    for (const [state, trans] of this.chain) {
      chain[state] = Object.fromEntries(trans);
    }
    return { order: this.order, chain, starts: this.starts };
  }

  static fromJSON(data) {
    const mc = new MarkovChain(data.order);
    mc.starts = data.starts;
    for (const [state, trans] of Object.entries(data.chain)) {
      mc.chain.set(state, new Map(Object.entries(trans)));
    }
    return mc;
  }
}

function weightedRandom(map) {
  const total = [...map.values()].reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (const [key, weight] of map) {
    r -= weight;
    if (r <= 0) return key;
  }
  return [...map.keys()][0];
}

module.exports = { MarkovChain };
