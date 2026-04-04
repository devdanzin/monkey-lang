import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NFA, DFA, nfaToDFA, regexToNFA, EPSILON } from '../src/index.js';

describe('NFA — basic', () => {
  it('accepts matching string', () => {
    const nfa = new NFA();
    const s0 = nfa.addState();
    const s1 = nfa.addState();
    const s2 = nfa.addState(true);
    nfa.start = s0;
    nfa.addTransition(s0, 'a', s1);
    nfa.addTransition(s1, 'b', s2);
    
    assert.equal(nfa.accepts('ab'), true);
    assert.equal(nfa.accepts('a'), false);
    assert.equal(nfa.accepts('abc'), false);
  });

  it('handles epsilon transitions', () => {
    const nfa = new NFA();
    const s0 = nfa.addState();
    const s1 = nfa.addState(true);
    nfa.start = s0;
    nfa.addTransition(s0, EPSILON, s1);
    
    assert.equal(nfa.accepts(''), true);
  });

  it('nondeterminism', () => {
    const nfa = new NFA();
    const s0 = nfa.addState();
    const s1 = nfa.addState();
    const s2 = nfa.addState(true);
    nfa.start = s0;
    nfa.addTransition(s0, 'a', s1);
    nfa.addTransition(s0, 'a', s2);
    
    assert.equal(nfa.accepts('a'), true);
  });
});

describe('DFA — basic', () => {
  it('accepts matching string', () => {
    const dfa = new DFA();
    dfa.states.add('s0'); dfa.states.add('s1'); dfa.states.add('s2');
    dfa.start = 's0';
    dfa.accept.add('s2');
    dfa.addTransition('s0', 'a', 's1');
    dfa.addTransition('s1', 'b', 's2');
    
    assert.equal(dfa.accepts('ab'), true);
    assert.equal(dfa.accepts('a'), false);
    assert.equal(dfa.accepts('ba'), false);
  });
});

describe('NFA to DFA', () => {
  it('converts simple NFA', () => {
    const nfa = new NFA();
    const s0 = nfa.addState();
    const s1 = nfa.addState(true);
    nfa.start = s0;
    nfa.addTransition(s0, 'a', s1);
    
    const dfa = nfaToDFA(nfa);
    assert.equal(dfa.accepts('a'), true);
    assert.equal(dfa.accepts('b'), false);
  });

  it('converts NFA with epsilon', () => {
    const nfa = new NFA();
    const s0 = nfa.addState();
    const s1 = nfa.addState();
    const s2 = nfa.addState(true);
    nfa.start = s0;
    nfa.addTransition(s0, EPSILON, s1);
    nfa.addTransition(s1, 'x', s2);
    
    const dfa = nfaToDFA(nfa);
    assert.equal(dfa.accepts('x'), true);
    assert.equal(dfa.accepts(''), false);
  });
});

describe('regexToNFA', () => {
  it('single char', () => {
    const nfa = regexToNFA('a');
    assert.equal(nfa.accepts('a'), true);
    assert.equal(nfa.accepts('b'), false);
  });

  it('concatenation', () => {
    const nfa = regexToNFA('ab');
    assert.equal(nfa.accepts('ab'), true);
    assert.equal(nfa.accepts('a'), false);
  });

  it('alternation', () => {
    const nfa = regexToNFA('a|b');
    assert.equal(nfa.accepts('a'), true);
    assert.equal(nfa.accepts('b'), true);
    assert.equal(nfa.accepts('c'), false);
  });

  it('kleene star', () => {
    const nfa = regexToNFA('a*');
    assert.equal(nfa.accepts(''), true);
    assert.equal(nfa.accepts('a'), true);
    assert.equal(nfa.accepts('aaa'), true);
    assert.equal(nfa.accepts('b'), false);
  });

  it('plus', () => {
    const nfa = regexToNFA('a+');
    assert.equal(nfa.accepts(''), false);
    assert.equal(nfa.accepts('a'), true);
    assert.equal(nfa.accepts('aaa'), true);
  });

  it('optional', () => {
    const nfa = regexToNFA('a?');
    assert.equal(nfa.accepts(''), true);
    assert.equal(nfa.accepts('a'), true);
    assert.equal(nfa.accepts('aa'), false);
  });

  it('complex: (a|b)*c', () => {
    const nfa = regexToNFA('(a|b)*c');
    assert.equal(nfa.accepts('c'), true);
    assert.equal(nfa.accepts('ac'), true);
    assert.equal(nfa.accepts('bc'), true);
    assert.equal(nfa.accepts('abc'), true);
    assert.equal(nfa.accepts('ababc'), true);
    assert.equal(nfa.accepts('ab'), false);
  });

  it('regex to NFA to DFA', () => {
    const nfa = regexToNFA('(a|b)*abb');
    const dfa = nfaToDFA(nfa);
    assert.equal(dfa.accepts('abb'), true);
    assert.equal(dfa.accepts('aabb'), true);
    assert.equal(dfa.accepts('babb'), true);
    assert.equal(dfa.accepts('ab'), false);
  });
});
