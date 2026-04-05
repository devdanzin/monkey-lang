// capture.test.js — Tests for capture groups, backreferences, and utilities

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseWithCaptures, matchCaptures, searchCaptures,
  matchAll, replace, replaceAll, split
} from './capture.js';

describe('Parser with captures', () => {
  it('counts groups', () => {
    const { groupCount } = parseWithCaptures('(a)(b)(c)');
    assert.equal(groupCount, 3);
  });

  it('counts nested groups', () => {
    const { groupCount } = parseWithCaptures('((a)(b))');
    assert.equal(groupCount, 3);
  });

  it('ignores non-capturing groups', () => {
    const { groupCount } = parseWithCaptures('(?:a)(b)(?:c)');
    assert.equal(groupCount, 1);
  });

  it('zero groups without parens', () => {
    const { groupCount } = parseWithCaptures('abc');
    assert.equal(groupCount, 0);
  });
});

describe('Capture group extraction', () => {
  it('captures simple group', () => {
    const result = matchCaptures('(a+)b', 'aaab');
    assert.ok(result);
    assert.equal(result[0], 'aaab');
    assert.equal(result[1], 'aaa');
  });

  it('captures multiple groups', () => {
    const result = matchCaptures('(\\d+)-(\\d+)', '123-456');
    assert.ok(result);
    assert.equal(result[0], '123-456');
    assert.equal(result[1], '123');
    assert.equal(result[2], '456');
  });

  it('captures nested groups', () => {
    const result = matchCaptures('((a+)(b+))', 'aaabb');
    assert.ok(result);
    assert.equal(result[0], 'aaabb');
    assert.equal(result[1], 'aaabb'); // outer group
    assert.equal(result[2], 'aaa');   // first inner
    assert.equal(result[3], 'bb');    // second inner
  });

  it('returns null for no match', () => {
    const result = matchCaptures('(a+)b', 'ccc');
    assert.equal(result, null);
  });

  it('handles non-capturing groups', () => {
    const result = matchCaptures('(?:a+)(b+)', 'aaabb');
    assert.ok(result);
    assert.equal(result[0], 'aaabb');
    assert.equal(result[1], 'bb'); // only capturing group
    assert.equal(result.length, 2);
  });

  it('captures with alternation', () => {
    const result = matchCaptures('(cat|dog)', 'cat');
    assert.ok(result);
    assert.equal(result[1], 'cat');

    const result2 = matchCaptures('(cat|dog)', 'dog');
    assert.ok(result2);
    assert.equal(result2[1], 'dog');
  });

  it('captures with quantifiers', () => {
    const result = matchCaptures('(a+)(b*)', 'aaabb');
    assert.ok(result);
    assert.equal(result[1], 'aaa');
    assert.equal(result[2], 'bb');
  });
});

describe('Backreferences', () => {
  it('matches simple backreference', () => {
    const result = matchCaptures('(a+)\\1', 'aaaa');
    assert.ok(result);
    assert.equal(result[1], 'aa'); // captures first 'aa', then matches 'aa' again
  });

  it('matches word repetition', () => {
    const result = matchCaptures('([abc]+)-\\1', 'abc-abc');
    assert.ok(result);
    assert.equal(result[1], 'abc');
  });

  it('fails when backreference doesnt match', () => {
    const result = matchCaptures('(a+)b\\1', 'aabbb');
    assert.equal(result, null);
  });

  it('matches repeated pattern', () => {
    const result = matchCaptures('(\\w)\\1', 'aa');
    assert.ok(result);
    assert.equal(result[0], 'aa');
    assert.equal(result[1], 'a');
  });
});

describe('Search (find in text)', () => {
  it('finds match at start', () => {
    const result = searchCaptures('(\\d+)', 'abc 123 def');
    assert.ok(result);
    assert.equal(result.match, '123');
    assert.equal(result.index, 4);
    assert.equal(result.groups[1], '123');
  });

  it('finds first match', () => {
    const result = searchCaptures('([a-z]+)', '123 hello world');
    assert.ok(result);
    assert.equal(result.match, 'hello');
    assert.equal(result.index, 4);
  });

  it('returns null when no match', () => {
    const result = searchCaptures('\\d+', 'no numbers here');
    assert.equal(result, null);
  });
});

describe('Match all', () => {
  it('finds all occurrences', () => {
    const results = matchAll('[a-z]+', 'hello world foo');
    assert.equal(results.length, 3);
    assert.equal(results[0].match, 'hello');
    assert.equal(results[1].match, 'world');
    assert.equal(results[2].match, 'foo');
  });

  it('finds all with captures', () => {
    const results = matchAll('(\\d+)', 'a1b22c333');
    assert.equal(results.length, 3);
    assert.equal(results[0].groups[1], '1');
    assert.equal(results[1].groups[1], '22');
    assert.equal(results[2].groups[1], '333');
  });

  it('returns empty for no matches', () => {
    const results = matchAll('\\d+', 'no numbers');
    assert.equal(results.length, 0);
  });

  it('non-overlapping', () => {
    const results = matchAll('aa', 'aaaa');
    assert.equal(results.length, 2); // positions 0 and 2
  });
});

describe('Replace', () => {
  it('replaces first match', () => {
    const result = replace('[a-z]+', 'hello world', 'X');
    assert.equal(result, 'X world');
  });

  it('replaces with group reference', () => {
    const result = replace('(\\w+)-(\\w+)', 'hello-world', '$2-$1');
    assert.equal(result, 'world-hello');
  });

  it('returns original if no match', () => {
    const result = replace('\\d+', 'no numbers', 'X');
    assert.equal(result, 'no numbers');
  });
});

describe('Replace all', () => {
  it('replaces all occurrences', () => {
    const result = replaceAll('[a-z]+', 'hello world foo', 'X');
    assert.equal(result, 'X X X');
  });

  it('replaces all with backreferences', () => {
    const result = replaceAll('(\\d+)', 'a1b22c333', '[$1]');
    assert.equal(result, 'a[1]b[22]c[333]');
  });
});

describe('Split', () => {
  it('splits by pattern', () => {
    const parts = split('[,;]+', 'a,b;;c,d');
    assert.deepEqual(parts, ['a', 'b', 'c', 'd']);
  });

  it('splits by whitespace', () => {
    const parts = split('\\s+', 'hello  world\tfoo');
    assert.deepEqual(parts, ['hello', 'world', 'foo']);
  });

  it('returns whole string if no match', () => {
    const parts = split('\\d+', 'no numbers');
    assert.deepEqual(parts, ['no numbers']);
  });

  it('handles multiple separators', () => {
    const parts = split('-', 'a-b-c-d');
    assert.deepEqual(parts, ['a', 'b', 'c', 'd']);
  });
});
