import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  char, string, satisfy, regex, succeed, fail,
  alt, seq, map, many, many1, optional, lazy, between, sepBy,
  ws, lexeme, parseJSON, ParseResult,
} from '../src/index.js';

describe('Basic parsers', () => {
  it('char matches single character', () => {
    const p = char('a');
    const r = p('abc', 0);
    assert.equal(r.value, 'a');
    assert.equal(r.pos, 1);
  });

  it('char fails on mismatch', () => {
    assert.equal(char('a')('b', 0), null);
  });

  it('string matches exact string', () => {
    const r = string('hello')('hello world', 0);
    assert.equal(r.value, 'hello');
    assert.equal(r.pos, 5);
  });

  it('satisfy matches predicate', () => {
    const digit = satisfy(c => c >= '0' && c <= '9');
    assert.equal(digit('5', 0).value, '5');
    assert.equal(digit('a', 0), null);
  });

  it('regex matches pattern', () => {
    const num = regex(/\d+/);
    const r = num('abc123def', 3);
    assert.equal(r.value, '123');
    assert.equal(r.pos, 6);
  });

  it('succeed always succeeds', () => {
    const r = succeed(42)('anything', 0);
    assert.equal(r.value, 42);
    assert.equal(r.pos, 0);
  });

  it('fail always fails', () => {
    assert.equal(fail()('anything', 0), null);
  });
});

describe('Combinators', () => {
  it('alt tries alternatives', () => {
    const p = alt(char('a'), char('b'));
    assert.equal(p('a', 0).value, 'a');
    assert.equal(p('b', 0).value, 'b');
    assert.equal(p('c', 0), null);
  });

  it('seq sequences parsers', () => {
    const p = seq(char('a'), char('b'), char('c'));
    const r = p('abc', 0);
    assert.deepEqual(r.value, ['a', 'b', 'c']);
  });

  it('seq fails if any part fails', () => {
    const p = seq(char('a'), char('b'));
    assert.equal(p('ac', 0), null);
  });

  it('map transforms result', () => {
    const num = map(regex(/\d+/), Number);
    assert.equal(num('42', 0).value, 42);
  });

  it('many matches zero or more', () => {
    const p = many(char('a'));
    assert.deepEqual(p('aaa', 0).value, ['a', 'a', 'a']);
    assert.deepEqual(p('bbb', 0).value, []);
  });

  it('many1 requires at least one', () => {
    const p = many1(char('a'));
    assert.equal(p('aaa', 0).value.length, 3);
    assert.equal(p('bbb', 0), null);
  });

  it('optional returns default on failure', () => {
    const p = optional(char('a'), 'default');
    assert.equal(p('a', 0).value, 'a');
    assert.equal(p('b', 0).value, 'default');
  });

  it('between matches delimited content', () => {
    const p = between(char('('), regex(/\d+/), char(')'));
    const r = p('(42)', 0);
    assert.equal(r.value, '42');
  });

  it('sepBy matches separated items', () => {
    const p = sepBy(regex(/\d+/), char(','));
    const r = p('1,2,3', 0);
    assert.deepEqual(r.value, ['1', '2', '3']);
  });

  it('sepBy handles empty', () => {
    const p = sepBy(regex(/\d+/), char(','));
    const r = p('abc', 0);
    assert.deepEqual(r.value, []);
  });

  it('lazy enables recursive parsers', () => {
    // Match nested parens: () or (nested)
    const parens = lazy(() => alt(
      map(seq(char('('), parens, char(')')), ([, inner]) => `(${inner})`),
      map(string(''), () => ''),
    ));
    assert.equal(parens('(())', 0).value, '(())');
  });
});

describe('JSON parser', () => {
  it('parses null', () => {
    assert.equal(parseJSON('null'), null);
  });

  it('parses true', () => {
    assert.equal(parseJSON('true'), true);
  });

  it('parses false', () => {
    assert.equal(parseJSON('false'), false);
  });

  it('parses integer', () => {
    assert.equal(parseJSON('42'), 42);
  });

  it('parses negative number', () => {
    assert.equal(parseJSON('-3.14'), -3.14);
  });

  it('parses scientific notation', () => {
    assert.equal(parseJSON('1e10'), 1e10);
  });

  it('parses string', () => {
    assert.equal(parseJSON('"hello"'), 'hello');
  });

  it('parses string with escapes', () => {
    assert.equal(parseJSON('"hello\\nworld"'), 'hello\nworld');
    assert.equal(parseJSON('"tab\\there"'), 'tab\there');
  });

  it('parses empty array', () => {
    assert.deepEqual(parseJSON('[]'), []);
  });

  it('parses array of numbers', () => {
    assert.deepEqual(parseJSON('[1, 2, 3]'), [1, 2, 3]);
  });

  it('parses nested array', () => {
    assert.deepEqual(parseJSON('[[1, 2], [3, 4]]'), [[1, 2], [3, 4]]);
  });

  it('parses empty object', () => {
    assert.deepEqual(parseJSON('{}'), {});
  });

  it('parses simple object', () => {
    const r = parseJSON('{"a": 1, "b": 2}');
    assert.equal(r.a, 1);
    assert.equal(r.b, 2);
  });

  it('parses nested object', () => {
    const r = parseJSON('{"outer": {"inner": true}}');
    assert.equal(r.outer.inner, true);
  });

  it('parses complex JSON', () => {
    const input = `{
      "name": "test",
      "version": 1,
      "tags": ["a", "b"],
      "metadata": {
        "nested": true,
        "count": 42
      },
      "empty": null
    }`;
    const r = parseJSON(input);
    assert.equal(r.name, 'test');
    assert.equal(r.version, 1);
    assert.deepEqual(r.tags, ['a', 'b']);
    assert.equal(r.metadata.nested, true);
    assert.equal(r.metadata.count, 42);
    assert.equal(r.empty, null);
  });

  it('parses mixed array', () => {
    assert.deepEqual(parseJSON('[1, "two", true, null]'), [1, 'two', true, null]);
  });

  it('handles whitespace', () => {
    assert.equal(parseJSON('  42  '), 42);
    assert.deepEqual(parseJSON('  [ 1 , 2 ]  '), [1, 2]);
  });

  it('agrees with JSON.parse on complex input', () => {
    const inputs = [
      '{"a":1}',
      '[1,2,3]',
      '"hello"',
      '42',
      'true',
      'null',
      '{"nested":{"deep":[1,2,{"x":3}]}}',
    ];
    for (const input of inputs) {
      assert.deepEqual(parseJSON(input), JSON.parse(input), `Failed on: ${input}`);
    }
  });
});
