// bench.test.js — Verify benchmarks run without errors

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { match as nfaMatch } from './regex.js';
import { compile as dfaCompile } from './dfa.js';
import { matchCaptures, matchAll } from './capture.js';

describe('Benchmark correctness', () => {
  it('NFA matches correctly', () => {
    assert.ok(nfaMatch('hello', 'hello'));
    assert.ok(nfaMatch('[a-z]+', 'helloworld'));
    assert.ok(nfaMatch('(a|b)*c', 'aababababababc'));
  });

  it('DFA matches correctly', () => {
    assert.ok(dfaCompile('hello').match('hello'));
    assert.ok(dfaCompile('[a-z]+').match('helloworld'));
    assert.ok(dfaCompile('(a|b)*c').match('aababababababc'));
  });

  it('pathological pattern: a?^n a^n', () => {
    for (const n of [5, 10, 15]) {
      const pattern = 'a?'.repeat(n) + 'a'.repeat(n);
      const text = 'a'.repeat(n);
      assert.ok(nfaMatch(pattern, text), `NFA should match a?^${n}a^${n}`);
      assert.ok(dfaCompile(pattern).match(text), `DFA should match a?^${n}a^${n}`);
    }
  });

  it('capture groups match correctly', () => {
    const result = matchCaptures('(\\d+)-(\\d+)', '123-456');
    assert.deepEqual(result, ['123-456', '123', '456']);
  });

  it('matchAll finds all occurrences', () => {
    const results = matchAll('\\d+', 'The price is $42.99 and $18.50');
    assert.ok(results.length >= 4); // 42, 99, 18, 50
  });

  it('long string matching', () => {
    const longText = 'a'.repeat(1000) + 'b';
    assert.ok(nfaMatch('a+b', longText));
    assert.ok(dfaCompile('a+b').match(longText));
  });

  it('DFA compilation produces working matcher', () => {
    const re = dfaCompile('[a-z]+@[a-z]+');
    assert.ok(re.match('alice@example'));
    assert.ok(!re.match('123@456'));
  });
});
