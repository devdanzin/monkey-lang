// replace-split.test.js — More replace and split tests

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { match } from './regex.js';
import { compile } from './dfa.js';
import { replace, replaceAll, split } from './capture.js';

describe('Replace and Split', () => {
  it('replace first occurrence', () => {
    assert.equal(replace('hello', 'hello world hello', 'hi'), 'hi world hello');
  });

  it('replaceAll occurrences', () => {
    assert.equal(replaceAll('a', 'aaa', 'b'), 'bbb');
  });

  it('split by pattern', () => {
    const parts = split(',', 'a,b,,c');
    assert.deepEqual(parts, ['a', 'b', '', 'c']);
  });

  it('split by multi-char pattern', () => {
    const parts = split('::', 'hello::world::foo');
    assert.deepEqual(parts, ['hello', 'world', 'foo']);
  });

  it('DFA compiles simple pattern', () => {
    const re = compile('abc');
    assert.ok(re.match('abc'));
    assert.ok(!re.match('abd'));
  });

  it('DFA with star', () => {
    const re = compile('a*b');
    assert.ok(re.match('b'));
    assert.ok(re.match('ab'));
    assert.ok(re.match('aab'));
    assert.ok(!re.match('ac'));
  });

  it('DFA with plus', () => {
    const re = compile('a+');
    assert.ok(re.match('a'));
    assert.ok(re.match('aaa'));
    assert.ok(!re.match(''));
  });

  it('DFA with optional', () => {
    const re = compile('ab?c');
    assert.ok(re.match('ac'));
    assert.ok(re.match('abc'));
    assert.ok(!re.match('abbc'));
  });

  it('NFA dot match', () => {
    assert.ok(match('a.c', 'abc'));
    assert.ok(match('a.c', 'aXc'));
    assert.ok(!match('a.c', 'ac'));
  });
});
