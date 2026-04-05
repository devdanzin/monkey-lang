// comprehensive.test.js — Comprehensive regex pattern tests

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { match } from './regex.js';
import { compile } from './dfa.js';
import { matchCaptures, searchCaptures, matchAll, replace, replaceAll, split } from './capture.js';

describe('Comprehensive Regex', () => {
  it('empty pattern matches empty string', () => {
    assert.ok(match('', ''));
  });

  it('single char matches', () => {
    assert.ok(match('a', 'a'));
    assert.ok(!match('a', 'b'));
  });

  it('star produces zero matches', () => {
    assert.ok(match('a*', ''));
    assert.ok(match('a*', 'aaa'));
  });

  it('plus requires one', () => {
    assert.ok(!match('a+', ''));
    assert.ok(match('a+', 'a'));
  });

  it('optional', () => {
    assert.ok(match('ab?c', 'ac'));
    assert.ok(match('ab?c', 'abc'));
  });

  it('dot star matches anything', () => {
    assert.ok(match('.*', ''));
    assert.ok(match('.*', 'hello world'));
  });

  it('group with star', () => {
    assert.ok(match('(ab)*', ''));
    assert.ok(match('(ab)*', 'ab'));
    assert.ok(match('(ab)*', 'abab'));
  });

  it('alternation priority', () => {
    assert.ok(match('abc|def', 'abc'));
    assert.ok(match('abc|def', 'def'));
    assert.ok(!match('abc|def', 'abf'));
  });

  it('DFA basic', () => {
    const re = compile('hello');
    assert.ok(re.match('hello'));
    assert.ok(!re.match('world'));
  });

  it('DFA star', () => {
    const re = compile('a*b');
    assert.ok(re.match('b'));
    assert.ok(re.match('aab'));
  });

  it('capture group basic', () => {
    const r = matchCaptures('(a)(b)', 'ab');
    assert.ok(r);
    assert.equal(r[1], 'a');
    assert.equal(r[2], 'b');
  });

  it('capture with alternation pattern', () => {
    const r = matchCaptures('(cat|dog)', 'cat');
    assert.ok(r);
    assert.equal(r[1], 'cat');
  });

  it('matchAll finds multiple', () => {
    const results = matchAll('a', 'banana');
    assert.ok(results.length >= 3);
  });

  it('replace with pattern', () => {
    assert.equal(replace('a', 'abc', 'x'), 'xbc');
  });

  it('replaceAll with pattern', () => {
    assert.equal(replaceAll('a', 'abab', 'x'), 'xbxb');
  });

  it('split by comma', () => {
    assert.deepEqual(split(',', 'a,b,c'), ['a', 'b', 'c']);
  });

  it('character class [abc]', () => {
    assert.ok(match('[abc]', 'a'));
    assert.ok(match('[abc]', 'b'));
    assert.ok(!match('[abc]', 'd'));
  });

  it('character class range [a-z]', () => {
    assert.ok(match('[a-z]', 'g'));
    assert.ok(!match('[a-z]', 'G'));
  });

  it('negated class [^abc]', () => {
    assert.ok(!match('[^abc]', 'a'));
    assert.ok(match('[^abc]', 'd'));
  });

  it('complex pattern', () => {
    assert.ok(match('(a|b)+c*d', 'abd'));
    assert.ok(match('(a|b)+c*d', 'aaccd'));
    assert.ok(!match('(a|b)+c*d', 'cd'));
  });
});
