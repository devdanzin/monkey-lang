// dfa.test.js — Tests for NFA→DFA conversion and DFA minimization

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parse, buildNFA } from './regex.js';
import { nfaToDFA, minimizeDFA, dfaMatch, dfaSearch, dfaStats, compile, DFAState } from './dfa.js';

describe('NFA → DFA Conversion', () => {
  it('converts simple literal', () => {
    const ast = parse('abc');
    const nfa = buildNFA(ast);
    const dfa = nfaToDFA(nfa);
    assert.ok(dfa.start);
    assert.ok(dfa.states.length > 0);
    assert.ok(dfaMatch(dfa, 'abc'));
    assert.ok(!dfaMatch(dfa, 'ab'));
    assert.ok(!dfaMatch(dfa, 'abcd'));
  });

  it('converts alternation', () => {
    const ast = parse('a|b');
    const nfa = buildNFA(ast);
    const dfa = nfaToDFA(nfa);
    assert.ok(dfaMatch(dfa, 'a'));
    assert.ok(dfaMatch(dfa, 'b'));
    assert.ok(!dfaMatch(dfa, 'c'));
    assert.ok(!dfaMatch(dfa, 'ab'));
  });

  it('converts Kleene star', () => {
    const ast = parse('a*');
    const nfa = buildNFA(ast);
    const dfa = nfaToDFA(nfa);
    assert.ok(dfaMatch(dfa, ''));
    assert.ok(dfaMatch(dfa, 'a'));
    assert.ok(dfaMatch(dfa, 'aaa'));
    assert.ok(!dfaMatch(dfa, 'b'));
  });

  it('converts plus', () => {
    const ast = parse('a+');
    const nfa = buildNFA(ast);
    const dfa = nfaToDFA(nfa);
    assert.ok(!dfaMatch(dfa, ''));
    assert.ok(dfaMatch(dfa, 'a'));
    assert.ok(dfaMatch(dfa, 'aaaa'));
    assert.ok(!dfaMatch(dfa, 'b'));
  });

  it('converts optional', () => {
    const ast = parse('ab?c');
    const nfa = buildNFA(ast);
    const dfa = nfaToDFA(nfa);
    assert.ok(dfaMatch(dfa, 'ac'));
    assert.ok(dfaMatch(dfa, 'abc'));
    assert.ok(!dfaMatch(dfa, 'abbc'));
  });

  it('converts complex pattern: (a|b)*c', () => {
    const ast = parse('(a|b)*c');
    const nfa = buildNFA(ast);
    const dfa = nfaToDFA(nfa);
    assert.ok(dfaMatch(dfa, 'c'));
    assert.ok(dfaMatch(dfa, 'ac'));
    assert.ok(dfaMatch(dfa, 'bc'));
    assert.ok(dfaMatch(dfa, 'abc'));
    assert.ok(dfaMatch(dfa, 'aabbc'));
    assert.ok(!dfaMatch(dfa, 'a'));
    assert.ok(!dfaMatch(dfa, 'ab'));
  });

  it('handles character classes', () => {
    const ast = parse('[abc]+');
    const nfa = buildNFA(ast);
    const dfa = nfaToDFA(nfa);
    assert.ok(dfaMatch(dfa, 'a'));
    assert.ok(dfaMatch(dfa, 'abc'));
    assert.ok(dfaMatch(dfa, 'cba'));
    assert.ok(!dfaMatch(dfa, ''));
    assert.ok(!dfaMatch(dfa, 'd'));
  });

  it('handles ranges in character classes', () => {
    const ast = parse('[a-z]+');
    const nfa = buildNFA(ast);
    const dfa = nfaToDFA(nfa);
    assert.ok(dfaMatch(dfa, 'hello'));
    assert.ok(dfaMatch(dfa, 'z'));
    assert.ok(!dfaMatch(dfa, ''));
    assert.ok(!dfaMatch(dfa, 'A'));
  });

  it('DFA has no epsilon transitions', () => {
    const ast = parse('a*b');
    const nfa = buildNFA(ast);
    const dfa = nfaToDFA(nfa);
    // Every DFA state should have only symbol transitions (Map-based)
    for (const state of dfa.states) {
      assert.ok(state.transitions instanceof Map);
    }
  });
});

describe('DFA Minimization', () => {
  it('minimizes simple DFA', () => {
    const ast = parse('ab');
    const nfa = buildNFA(ast);
    const dfa = nfaToDFA(nfa);
    const minDfa = minimizeDFA(dfa);
    assert.ok(minDfa.states.length <= dfa.states.length);
    assert.ok(dfaMatch(minDfa, 'ab'));
    assert.ok(!dfaMatch(minDfa, 'a'));
  });

  it('minimized DFA matches same strings', () => {
    const patterns = ['a|b', '(a|b)*', 'ab+c', '[abc]d'];
    const testStrings = ['', 'a', 'b', 'ab', 'abc', 'aab', 'bd', 'cd', 'ad', 'c'];

    for (const pattern of patterns) {
      const ast = parse(pattern);
      const nfa = buildNFA(ast);
      const dfa = nfaToDFA(nfa);
      const minDfa = minimizeDFA(dfa);

      for (const s of testStrings) {
        assert.equal(
          dfaMatch(dfa, s),
          dfaMatch(minDfa, s),
          `Pattern "${pattern}" on "${s}": DFA=${dfaMatch(dfa, s)} min=${dfaMatch(minDfa, s)}`
        );
      }
    }
  });

  it('reduces state count', () => {
    // (a|b)* can be represented with fewer states than raw subset construction gives
    const ast = parse('(a|b)*');
    const nfa = buildNFA(ast);
    const dfa = nfaToDFA(nfa);
    const minDfa = minimizeDFA(dfa);
    assert.ok(minDfa.states.length <= dfa.states.length,
      `Minimized (${minDfa.states.length}) should be <= raw (${dfa.states.length})`);
  });

  it('preserves acceptance property', () => {
    const ast = parse('a+');
    const nfa = buildNFA(ast);
    const minDfa = minimizeDFA(nfaToDFA(nfa));
    assert.ok(!minDfa.start.isAccept, 'Start should not be accept for a+');
    assert.ok(minDfa.states.some(s => s.isAccept), 'Should have at least one accept state');
  });
});

describe('DFA Search', () => {
  it('finds match at start', () => {
    const ast = parse('hello');
    const nfa = buildNFA(ast);
    const dfa = nfaToDFA(nfa);
    const result = dfaSearch(dfa, 'hello world');
    assert.ok(result.match);
    assert.equal(result.start, 0);
    assert.equal(result.end, 5);
  });

  it('finds match in middle', () => {
    const ast = parse('world');
    const nfa = buildNFA(ast);
    const dfa = nfaToDFA(nfa);
    const result = dfaSearch(dfa, 'hello world');
    assert.ok(result.match);
    assert.equal(result.start, 6);
    assert.equal(result.end, 11);
  });

  it('returns no match when absent', () => {
    const ast = parse('xyz');
    const nfa = buildNFA(ast);
    const dfa = nfaToDFA(nfa);
    const result = dfaSearch(dfa, 'hello world');
    assert.ok(!result.match);
  });

  it('finds empty pattern anywhere', () => {
    const compiled = compile('');
    const result = compiled.search('anything');
    assert.ok(result.match);
  });
});

describe('DFA Stats', () => {
  it('reports correct statistics', () => {
    const compiled = compile('abc');
    const stats = compiled.stats();
    assert.ok(stats.states > 0);
    assert.ok(stats.transitions >= 0);
    assert.equal(stats.acceptStates, 1);
  });

  it('minimized has fewer or equal states', () => {
    const ast = parse('(a|b|c)*d');
    const nfa = buildNFA(ast);
    const rawDfa = nfaToDFA(nfa);
    const minDfa = minimizeDFA(rawDfa);
    assert.ok(minDfa.states.length <= rawDfa.states.length);
  });
});

describe('Compile convenience API', () => {
  it('compiles and matches', () => {
    const re = compile('hello');
    assert.ok(re.match('hello'));
    assert.ok(!re.match('world'));
  });

  it('compiles complex pattern', () => {
    const re = compile('(a|b)*c+d?');
    assert.ok(re.match('c'));
    assert.ok(re.match('acd'));
    assert.ok(re.match('bcc'));
    assert.ok(re.match('abbccc'));
    assert.ok(re.match('abccd'));
    assert.ok(!re.match(''));
    assert.ok(!re.match('ab'));
    assert.ok(!re.match('d'));
  });

  it('exposes both raw and minimized DFA', () => {
    const re = compile('(a|b)*');
    assert.ok(re.dfa);
    assert.ok(re.rawDfa);
    assert.ok(re.dfa.states.length <= re.rawDfa.states.length);
  });

  it('handles digit class', () => {
    const re = compile('\\d+');
    assert.ok(re.match('123'));
    assert.ok(re.match('0'));
    assert.ok(!re.match(''));
    assert.ok(!re.match('abc'));
  });
});
