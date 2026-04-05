// alternation.test.js — More alternation and grouping tests

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { match } from './regex.js';
import { compile } from './dfa.js';
import { matchCaptures } from './capture.js';

describe('Alternation patterns', () => {
  it('simple alternation', () => {
    assert.ok(match('cat|dog', 'cat'));
    assert.ok(match('cat|dog', 'dog'));
    assert.ok(!match('cat|dog', 'bird'));
  });

  it('three-way alternation', () => {
    assert.ok(match('a|b|c', 'a'));
    assert.ok(match('a|b|c', 'b'));
    assert.ok(match('a|b|c', 'c'));
    assert.ok(!match('a|b|c', 'd'));
  });

  it('alternation with concat', () => {
    assert.ok(match('ab|cd', 'ab'));
    assert.ok(match('ab|cd', 'cd'));
    assert.ok(!match('ab|cd', 'ac'));
  });

  it('alternation inside group', () => {
    assert.ok(match('(a|b)c', 'ac'));
    assert.ok(match('(a|b)c', 'bc'));
    assert.ok(!match('(a|b)c', 'cc'));
  });

  it('group alternation with quantifier', () => {
    assert.ok(match('(ab|cd)+', 'ab'));
    assert.ok(match('(ab|cd)+', 'abcd'));
    assert.ok(match('(ab|cd)+', 'cdab'));
    assert.ok(!match('(ab|cd)+', 'ac'));
  });

  it('DFA alternation', () => {
    const re = compile('(hello|world|foo)');
    assert.ok(re.match('hello'));
    assert.ok(re.match('world'));
    assert.ok(re.match('foo'));
    assert.ok(!re.match('bar'));
  });

  it('capture with alternation', () => {
    const r1 = matchCaptures('(cat|dog) food', 'cat food');
    assert.ok(r1);
    assert.equal(r1[1], 'cat');

    const r2 = matchCaptures('(cat|dog) food', 'dog food');
    assert.ok(r2);
    assert.equal(r2[1], 'dog');
  });

  it('nested group alternation', () => {
    assert.ok(match('((a|b)(c|d))', 'ac'));
    assert.ok(match('((a|b)(c|d))', 'bd'));
    assert.ok(!match('((a|b)(c|d))', 'ab'));
  });

  it('empty alternation branch', () => {
    assert.ok(match('a|', 'a'));
    assert.ok(match('a|', ''));
    assert.ok(!match('a|', 'b'));
  });

  it('long alternation of words', () => {
    const re = compile('(the|quick|brown|fox|jumps|over|lazy|dog)');
    assert.ok(re.match('fox'));
    assert.ok(re.match('lazy'));
    assert.ok(!re.match('cat'));
  });
});
