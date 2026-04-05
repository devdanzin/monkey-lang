// quantifier.test.js — Quantifier and repetition edge tests

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { match } from './regex.js';
import { compile } from './dfa.js';
import { matchCaptures, searchCaptures } from './capture.js';

describe('Quantifier combinations', () => {
  it('a*b* matches empty string', () => {
    assert.ok(match('a*b*', ''));
  });

  it('a*b* matches a only', () => {
    assert.ok(match('a*b*', 'aaa'));
  });

  it('a*b* matches b only', () => {
    assert.ok(match('a*b*', 'bbb'));
  });

  it('a*b* matches ab', () => {
    assert.ok(match('a*b*', 'aaabbb'));
  });

  it('(ab)+ matches repeated ab', () => {
    assert.ok(match('(ab)+', 'ab'));
    assert.ok(match('(ab)+', 'abab'));
    assert.ok(!match('(ab)+', 'a'));
    assert.ok(!match('(ab)+', 'ba'));
  });

  it('a{2,4} precise range', () => {
    assert.ok(!match('a{2,4}', 'a'));
    assert.ok(match('a{2,4}', 'aa'));
    assert.ok(match('a{2,4}', 'aaa'));
    assert.ok(match('a{2,4}', 'aaaa'));
    assert.ok(!match('a{2,4}', 'aaaaa'));
  });

  it('[abc]{2} exact count', () => {
    assert.ok(match('[abc]{2}', 'ab'));
    assert.ok(match('[abc]{2}', 'ca'));
    assert.ok(!match('[abc]{2}', 'a'));
    assert.ok(!match('[abc]{2}', 'abc'));
  });

  it('optional in sequence: ab?c', () => {
    assert.ok(match('ab?c', 'ac'));
    assert.ok(match('ab?c', 'abc'));
    assert.ok(!match('ab?c', 'abbc'));
  });

  it('alternation with quantifiers: (a+|b+)', () => {
    assert.ok(match('(a+|b+)', 'aaa'));
    assert.ok(match('(a+|b+)', 'bb'));
    assert.ok(!match('(a+|b+)', ''));
    assert.ok(!match('(a+|b+)', 'ab'));
  });
});

describe('DFA quantifier patterns', () => {
  it('DFA a{3}', () => {
    const re = compile('a{3}');
    assert.ok(re.match('aaa'));
    assert.ok(!re.match('aa'));
    assert.ok(!re.match('aaaa'));
  });

  it('DFA (a|b){2,3}', () => {
    const re = compile('(a|b){2,3}');
    assert.ok(!re.match('a'));
    assert.ok(re.match('ab'));
    assert.ok(re.match('aab'));
    assert.ok(!re.match('aaaa'));
  });
});

describe('Capture with quantifiers', () => {
  it('(a+) captures greedily', () => {
    const result = matchCaptures('(a+)b', 'aaab');
    assert.ok(result);
    assert.equal(result[1], 'aaa');
  });

  it('(\\d+) captures all digits', () => {
    const result = matchCaptures('(\\d+)', '12345');
    assert.ok(result);
    assert.equal(result[1], '12345');
  });

  it('search for first number', () => {
    const result = searchCaptures('(\\d+)', 'abc 42 def 99');
    assert.ok(result);
    assert.equal(result.match, '42');
    assert.equal(result.index, 4);
  });
});
