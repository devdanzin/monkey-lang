// edge.test.js — Edge cases and comprehensive tests for the regex engine

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { match, test as regTest, parse, buildNFA } from './regex.js';
import { compile, nfaToDFA, minimizeDFA, dfaMatch, dfaStats } from './dfa.js';
import { matchCaptures, searchCaptures, matchAll, replace, replaceAll, split } from './capture.js';

describe('Edge cases — NFA matching', () => {
  it('empty pattern matches empty string', () => {
    assert.ok(match('', ''));
  });

  it('empty pattern does not match non-empty', () => {
    assert.ok(!match('', 'a'));
  });

  it('matches single character', () => {
    assert.ok(match('a', 'a'));
    assert.ok(!match('a', 'b'));
  });

  it('dot matches any character', () => {
    assert.ok(match('.', 'a'));
    assert.ok(match('.', 'z'));
    assert.ok(!match('.', ''));
  });

  it('escaped special characters', () => {
    assert.ok(match('\\.', '.'));
    // Escaped dot should NOT match other chars
    assert.ok(!match('\\.', 'a'));
    assert.ok(match('\\*', '*'));
  });

  it('nested quantifiers', () => {
    assert.ok(match('(a+)+', 'aaa'));
    assert.ok(match('(a*)*', ''));
  });

  it('alternation with empty branch', () => {
    assert.ok(match('a|', 'a'));
    assert.ok(match('a|', ''));
  });

  it('character class edge cases', () => {
    assert.ok(match('[a]', 'a'));
    assert.ok(!match('[a]', 'b'));
    assert.ok(match('[a-z0-9]', 'x'));
    assert.ok(match('[a-z0-9]', '5'));
    assert.ok(!match('[a-z0-9]', 'A'));
  });

  it('negated character class', () => {
    assert.ok(match('[^abc]', 'd'));
    assert.ok(!match('[^abc]', 'a'));
  });

  it('repeat quantifier', () => {
    assert.ok(match('a{3}', 'aaa'));
    assert.ok(!match('a{3}', 'aa'));
    assert.ok(!match('a{3}', 'aaaa'));
  });

  it('repeat range', () => {
    assert.ok(match('a{2,4}', 'aa'));
    assert.ok(match('a{2,4}', 'aaa'));
    assert.ok(match('a{2,4}', 'aaaa'));
    assert.ok(!match('a{2,4}', 'a'));
  });

  it('word boundary classes', () => {
    assert.ok(match('\\d\\d', '42'));
    assert.ok(!match('\\d\\d', 'ab'));
    assert.ok(match('\\w+', 'hello_123'));
    assert.ok(match('\\s', ' '));
    assert.ok(match('\\s', '\t'));
  });
});

describe('Edge cases — test (search)', () => {
  it('finds pattern anywhere in string', () => {
    assert.ok(regTest('abc', 'xyzabcdef'));
    assert.ok(regTest('\\d+', 'hello123world'));
    assert.ok(!regTest('xyz', 'hello'));
  });

  it('anchored patterns (full match)', () => {
    // Note: anchor handling in test() (search mode) is incomplete
    // For now, verify full match with anchors works
    assert.ok(match('^hello$', 'hello'));
    assert.ok(!match('^hello$', 'hello world'));
  });
});

describe('Edge cases — DFA', () => {
  it('DFA matches empty language', () => {
    const re = compile('a');
    assert.ok(!re.match(''));
    assert.ok(re.match('a'));
  });

  it('DFA handles long strings', () => {
    const re = compile('[ab]+');
    const long = 'ab'.repeat(1000);
    assert.ok(re.match(long));
  });

  it('minimization preserves behavior on many patterns', () => {
    const patterns = [
      'a', 'ab', 'a|b', 'a*', 'a+', 'a?',
      '(a|b)*c', '[abc]+', 'a{2,4}',
      '(ab|cd)*', 'a(b|c)d'
    ];
    const strings = ['', 'a', 'b', 'ab', 'abc', 'cd', 'abcd', 'aaa', 'aaaa', 'bc'];

    for (const p of patterns) {
      const ast = parse(p);
      const nfa = buildNFA(ast);
      const dfa = nfaToDFA(nfa);
      const minDfa = minimizeDFA(dfa);
      for (const s of strings) {
        assert.equal(
          dfaMatch(dfa, s), dfaMatch(minDfa, s),
          `"${p}" on "${s}"`
        );
      }
    }
  });

  it('DFA stats are sane', () => {
    const re = compile('hello');
    const stats = re.stats();
    assert.ok(stats.states >= 2);
    assert.equal(stats.acceptStates, 1);
    assert.ok(stats.alphabet >= 4); // h, e, l, o
  });
});

describe('Edge cases — Captures', () => {
  it('empty group', () => {
    const result = matchCaptures('()', '');
    assert.ok(result);
    assert.equal(result[1], '');
  });

  it('optional group not matched', () => {
    const result = matchCaptures('(a)?b', 'b');
    assert.ok(result);
    assert.equal(result[0], 'b');
    // Group 1 should be undefined since it didn't match
    assert.equal(result[1], undefined);
  });

  it('deeply nested groups', () => {
    const result = matchCaptures('((a)(b(c)))', 'abc');
    assert.ok(result);
    assert.equal(result[1], 'abc');  // outer
    assert.equal(result[2], 'a');
    assert.equal(result[3], 'bc');
    assert.equal(result[4], 'c');
  });

  it('group in alternation — only matched branch captures', () => {
    const result = matchCaptures('(a)|(b)', 'b');
    assert.ok(result);
    assert.equal(result[1], undefined); // a branch not taken
    assert.equal(result[2], 'b');
  });

  it('group with quantifier', () => {
    const result = matchCaptures('(ab)+', 'ababab');
    assert.ok(result);
    // Group captures the last iteration
    assert.equal(result[1], 'ab');
  });

  it('backreference with alternation', () => {
    const result = matchCaptures('(a|b)\\1', 'aa');
    assert.ok(result);
    assert.equal(result[1], 'a');

    const result2 = matchCaptures('(a|b)\\1', 'bb');
    assert.ok(result2);
    assert.equal(result2[1], 'b');

    const result3 = matchCaptures('(a|b)\\1', 'ab');
    assert.equal(result3, null);
  });
});

describe('Comprehensive — matchAll', () => {
  it('email-like pattern', () => {
    const results = matchAll('[a-z]+@[a-z]+', 'contact alice@example and bob@test');
    assert.equal(results.length, 2);
    assert.equal(results[0].match, 'alice@example');
    assert.equal(results[1].match, 'bob@test');
  });

  it('numbers in text', () => {
    const results = matchAll('\\d+', 'price: $42.99, qty: 5');
    assert.equal(results.length, 3);
    assert.equal(results[0].match, '42');
    assert.equal(results[1].match, '99');
    assert.equal(results[2].match, '5');
  });

  it('words with captures', () => {
    const results = matchAll('([A-Z])[a-z]+', 'Hello World Foo');
    assert.equal(results.length, 3);
    assert.equal(results[0].groups[1], 'H');
    assert.equal(results[1].groups[1], 'W');
    assert.equal(results[2].groups[1], 'F');
  });
});

describe('Comprehensive — replace', () => {
  it('replaces digits with X', () => {
    assert.equal(replaceAll('\\d', 'h3ll0 w0rld', 'X'), 'hXllX wXrld');
  });

  it('swaps two groups', () => {
    const result = replace('(\\w+):(\\w+)', 'key:value', '$2:$1');
    assert.equal(result, 'value:key');
  });

  it('preserves unmatched text', () => {
    assert.equal(replaceAll('[aeiou]', 'hello', '*'), 'h*ll*');
  });
});

describe('Comprehensive — split', () => {
  it('splits CSV-like', () => {
    const parts = split(',', 'a,b,c,d,e');
    assert.deepEqual(parts, ['a', 'b', 'c', 'd', 'e']);
  });

  it('splits on multiple delimiters', () => {
    const parts = split('[,;]+', 'a,b;;c,d');
    assert.deepEqual(parts, ['a', 'b', 'c', 'd']);
  });

  it('handles leading/trailing matches', () => {
    const parts = split('-', '-a-b-');
    assert.deepEqual(parts, ['', 'a', 'b', '']);
  });
});

describe('NFA vs DFA consistency', () => {
  it('NFA and DFA agree on various inputs', () => {
    const patterns = ['abc', 'a|b', 'a*b', '(a|b)+', '[abc]+'];
    const inputs = ['', 'a', 'b', 'ab', 'abc', 'aab', 'bbb', 'ccc'];

    for (const p of patterns) {
      const re = compile(p);
      for (const s of inputs) {
        const nfaResult = match(p, s);
        const dfaResult = re.match(s);
        assert.equal(nfaResult, dfaResult,
          `NFA/DFA disagree on pattern "${p}" input "${s}": NFA=${nfaResult} DFA=${dfaResult}`);
      }
    }
  });
});
