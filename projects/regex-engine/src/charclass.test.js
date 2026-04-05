// charclass.test.js — Character class, escape, and quantifier edge tests

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { match } from './regex.js';
import { compile } from './dfa.js';
import { matchCaptures, matchAll } from './capture.js';

describe('Character class ranges', () => {
  it('[a-z] matches lowercase', () => {
    assert.ok(match('[a-z]', 'a'));
    assert.ok(match('[a-z]', 'm'));
    assert.ok(match('[a-z]', 'z'));
    assert.ok(!match('[a-z]', 'A'));
    assert.ok(!match('[a-z]', '5'));
  });

  it('[A-Z] matches uppercase', () => {
    assert.ok(match('[A-Z]', 'A'));
    assert.ok(match('[A-Z]', 'Z'));
    assert.ok(!match('[A-Z]', 'a'));
  });

  it('[0-9] matches digits', () => {
    assert.ok(match('[0-9]', '0'));
    assert.ok(match('[0-9]', '5'));
    assert.ok(match('[0-9]', '9'));
    assert.ok(!match('[0-9]', 'a'));
  });

  it('[a-zA-Z0-9] matches alphanumeric', () => {
    assert.ok(match('[a-zA-Z0-9]', 'a'));
    assert.ok(match('[a-zA-Z0-9]', 'Z'));
    assert.ok(match('[a-zA-Z0-9]', '5'));
    assert.ok(!match('[a-zA-Z0-9]', '!'));
  });

  it('multiple ranges combined', () => {
    assert.ok(match('[a-fA-F0-9]+', 'deadBEEF'));
    assert.ok(match('[a-fA-F0-9]+', 'ff00'));
    assert.ok(!match('[a-fA-F0-9]+', 'xyz'));
  });

  it('[^a-z] negated range', () => {
    assert.ok(match('[^a-z]', 'A'));
    assert.ok(match('[^a-z]', '5'));
    assert.ok(!match('[^a-z]', 'a'));
  });

  it('single char class', () => {
    assert.ok(match('[x]', 'x'));
    assert.ok(!match('[x]', 'y'));
  });

  it('single char class with multiple chars', () => {
    assert.ok(match('[xyz]', 'x'));
    assert.ok(match('[xyz]', 'z'));
    assert.ok(!match('[xyz]', 'a'));
  });
});

describe('Escape sequences', () => {
  it('\\d matches digits', () => {
    assert.ok(match('\\d', '5'));
    assert.ok(!match('\\d', 'a'));
    assert.ok(match('\\d+', '12345'));
  });

  it('\\w matches word chars', () => {
    assert.ok(match('\\w', 'a'));
    assert.ok(match('\\w', 'Z'));
    assert.ok(match('\\w', '5'));
    assert.ok(match('\\w', '_'));
    assert.ok(!match('\\w', '!'));
  });

  it('\\s matches whitespace', () => {
    assert.ok(match('\\s', ' '));
    assert.ok(match('\\s', '\t'));
    assert.ok(!match('\\s', 'a'));
  });

  it('escaped special chars', () => {
    assert.ok(match('\\.', '.'));
    assert.ok(!match('\\.', 'a'));
    assert.ok(match('\\*', '*'));
    assert.ok(match('\\+', '+'));
    assert.ok(match('\\?', '?'));
    assert.ok(match('\\(', '('));
    assert.ok(match('\\)', ')'));
    assert.ok(match('\\[', '['));
  });

  it('\\d+ for multi-digit numbers', () => {
    assert.ok(match('\\d+', '42'));
    assert.ok(match('\\d+', '0'));
    assert.ok(!match('\\d+', ''));
  });

  it('\\w+ for identifiers', () => {
    assert.ok(match('\\w+', 'hello_world'));
    assert.ok(match('\\w+', '_private'));
    assert.ok(match('\\w+', 'a1b2'));
  });
});

describe('Quantifier edge cases', () => {
  it('a{0} matches empty string', () => {
    assert.ok(match('a{0}', ''));
    assert.ok(!match('a{0}', 'a'));
  });

  it('a{1} matches exactly one', () => {
    assert.ok(match('a{1}', 'a'));
    assert.ok(!match('a{1}', ''));
    assert.ok(!match('a{1}', 'aa'));
  });

  it('a{3,} matches 3 or more', () => {
    assert.ok(!match('a{3,}', 'aa'));
    assert.ok(match('a{3,}', 'aaa'));
    assert.ok(match('a{3,}', 'aaaa'));
  });

  it('a* matches zero or more', () => {
    assert.ok(match('a*', ''));
    assert.ok(match('a*', 'a'));
    assert.ok(match('a*', 'aaaa'));
    assert.ok(!match('a*b', 'c'));
  });

  it('a+ matches one or more', () => {
    assert.ok(!match('a+', ''));
    assert.ok(match('a+', 'a'));
    assert.ok(match('a+', 'aaa'));
  });

  it('a? matches zero or one', () => {
    assert.ok(match('a?', ''));
    assert.ok(match('a?', 'a'));
    assert.ok(!match('a?', 'aa'));
  });
});

describe('Combined patterns', () => {
  it('email-like pattern', () => {
    const re = compile('[a-z]+@[a-z]+');
    assert.ok(re.match('alice@example'));
    assert.ok(re.match('bob@test'));
    assert.ok(!re.match('@missing'));
    assert.ok(!re.match('no-at-sign'));
  });

  it('IP-like pattern', () => {
    assert.ok(match('\\d+\\.\\d+\\.\\d+\\.\\d+', '192.168.1.1'));
    assert.ok(!match('\\d+\\.\\d+\\.\\d+\\.\\d+', '192.168'));
  });

  it('hex color pattern', () => {
    assert.ok(match('[0-9a-fA-F]+', 'ff00cc'));
    assert.ok(match('[0-9a-fA-F]+', 'DEADBEEF'));
  });

  it('simple date pattern', () => {
    assert.ok(match('\\d{4}-\\d{2}-\\d{2}', '2026-04-05'));
    assert.ok(!match('\\d{4}-\\d{2}-\\d{2}', '26-4-5'));
  });

  it('alternation with classes', () => {
    assert.ok(match('(cat|[0-9]+)', 'cat'));
    assert.ok(match('(cat|[0-9]+)', '42'));
    assert.ok(!match('(cat|[0-9]+)', 'dog'));
  });
});

describe('DFA for character classes', () => {
  it('DFA matches [a-z]+', () => {
    const re = compile('[a-z]+');
    assert.ok(re.match('hello'));
    assert.ok(!re.match(''));
    assert.ok(!re.match('HELLO'));
  });

  it('DFA matches [0-9]{3}', () => {
    const re = compile('[0-9]{3}');
    assert.ok(re.match('123'));
    assert.ok(!re.match('12'));
    assert.ok(!re.match('1234'));
  });
});

describe('matchAll with patterns', () => {
  it('finds all words', () => {
    const results = matchAll('[a-zA-Z]+', 'hello world 123 foo');
    assert.equal(results.length, 3);
    assert.equal(results[0].match, 'hello');
    assert.equal(results[1].match, 'world');
    assert.equal(results[2].match, 'foo');
  });

  it('finds all numbers', () => {
    const results = matchAll('[0-9]+', 'x1y22z333');
    assert.equal(results.length, 3);
    assert.equal(results[0].match, '1');
    assert.equal(results[1].match, '22');
    assert.equal(results[2].match, '333');
  });
});
