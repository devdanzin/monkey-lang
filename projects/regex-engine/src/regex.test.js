import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { match, test as regexTest, parse, buildNFA } from './regex.js';

describe('Parser', () => {
  it('parses simple char', () => {
    const ast = parse('a');
    assert.equal(ast.type, 'char');
    assert.equal(ast.char, 'a');
  });

  it('parses concatenation', () => {
    const ast = parse('abc');
    assert.equal(ast.type, 'concat');
    assert.equal(ast.parts.length, 3);
  });

  it('parses alternation', () => {
    const ast = parse('a|b');
    assert.equal(ast.type, 'alt');
  });

  it('parses star', () => {
    const ast = parse('a*');
    assert.equal(ast.type, 'star');
  });

  it('parses group', () => {
    const ast = parse('(ab)');
    assert.equal(ast.type, 'group');
  });

  it('parses character class', () => {
    const ast = parse('[abc]');
    assert.equal(ast.type, 'class');
    assert.ok(ast.chars.includes('a'));
  });

  it('parses range in class', () => {
    const ast = parse('[a-z]');
    assert.ok(ast.chars.includes('m'));
    assert.equal(ast.chars.length, 26);
  });

  it('parses negated class', () => {
    const ast = parse('[^0-9]');
    assert.ok(ast.negate);
  });

  it('parses escaped char', () => {
    const ast = parse('\\d');
    assert.equal(ast.type, 'class');
    assert.ok(ast.chars.includes('5'));
  });
});

describe('Full Match', () => {
  it('exact match', () => {
    assert.ok(match('hello', 'hello'));
    assert.ok(!match('hello', 'world'));
  });

  it('dot matches any', () => {
    assert.ok(match('h.llo', 'hello'));
    assert.ok(match('h.llo', 'hxllo'));
    assert.ok(!match('h.llo', 'hlo'));
  });

  it('star (zero or more)', () => {
    assert.ok(match('ab*c', 'ac'));
    assert.ok(match('ab*c', 'abc'));
    assert.ok(match('ab*c', 'abbbbc'));
    assert.ok(!match('ab*c', 'abbd'));
  });

  it('plus (one or more)', () => {
    assert.ok(!match('ab+c', 'ac'));
    assert.ok(match('ab+c', 'abc'));
    assert.ok(match('ab+c', 'abbc'));
  });

  it('optional (?)', () => {
    assert.ok(match('colou?r', 'color'));
    assert.ok(match('colou?r', 'colour'));
    assert.ok(!match('colou?r', 'colouuur'));
  });

  it('alternation', () => {
    assert.ok(match('cat|dog', 'cat'));
    assert.ok(match('cat|dog', 'dog'));
    assert.ok(!match('cat|dog', 'bird'));
  });

  it('groups', () => {
    assert.ok(match('(ab)+', 'abab'));
    assert.ok(!match('(ab)+', 'aabb'));
  });

  it('character class', () => {
    assert.ok(match('[abc]', 'a'));
    assert.ok(match('[abc]', 'b'));
    assert.ok(!match('[abc]', 'd'));
  });

  it('character range', () => {
    assert.ok(match('[a-z]+', 'hello'));
    assert.ok(!match('[a-z]+', 'HELLO'));
  });

  it('negated class', () => {
    assert.ok(match('[^0-9]+', 'abc'));
    assert.ok(!match('[^0-9]+', '123'));
  });

  it('digit shorthand', () => {
    assert.ok(match('\\d+', '42'));
    assert.ok(!match('\\d+', 'abc'));
  });

  it('word shorthand', () => {
    assert.ok(match('\\w+', 'hello_42'));
    assert.ok(!match('\\w+', '---'));
  });

  it('complex pattern', () => {
    assert.ok(match('[a-z]+@[a-z]+\\.[a-z]+', 'user@example.com'));
    assert.ok(!match('[a-z]+@[a-z]+\\.[a-z]+', 'bad@'));
  });

  it('empty pattern matches empty string', () => {
    assert.ok(match('', ''));
  });
});

describe('Search (test)', () => {
  it('finds pattern anywhere in string', () => {
    assert.ok(regexTest('world', 'hello world'));
    assert.ok(!regexTest('xyz', 'hello world'));
  });

  it('finds at start', () => {
    assert.ok(regexTest('hel', 'hello'));
  });

  it('finds at end', () => {
    assert.ok(regexTest('llo', 'hello'));
  });

  it('finds pattern with quantifiers', () => {
    assert.ok(regexTest('\\d+', 'abc 42 def'));
    assert.ok(!regexTest('\\d+', 'no numbers'));
  });

  it('finds email-like pattern', () => {
    assert.ok(regexTest('[a-z]+@[a-z]+', 'send to user@example please'));
  });
});

describe('Edge cases', () => {
  it('a*a*a* matches empty', () => { assert.ok(match('a*', '')); });
  it('nested groups', () => { assert.ok(match('((a|b)c)+', 'acbc')); });
  it('dot star', () => { assert.ok(match('.*', 'anything goes')); });
  it('complex alternation', () => { assert.ok(match('(abc|def|ghi)', 'def')); });
});
