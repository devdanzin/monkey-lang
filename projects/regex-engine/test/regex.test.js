import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Regex } from '../src/index.js';

describe('Regex — literals', () => {
  it('matches exact string', () => {
    assert.equal(new Regex('hello').test('hello'), true);
    assert.equal(new Regex('hello').test('world'), false);
  });

  it('empty pattern matches empty string', () => {
    assert.equal(new Regex('').test(''), true);
  });

  it('single char', () => {
    assert.equal(new Regex('a').test('a'), true);
    assert.equal(new Regex('a').test('b'), false);
  });
});

describe('Regex — alternation', () => {
  it('basic alternation', () => {
    const r = new Regex('cat|dog');
    assert.equal(r.test('cat'), true);
    assert.equal(r.test('dog'), true);
    assert.equal(r.test('bird'), false);
  });

  it('three alternatives', () => {
    const r = new Regex('a|b|c');
    assert.equal(r.test('a'), true);
    assert.equal(r.test('b'), true);
    assert.equal(r.test('c'), true);
    assert.equal(r.test('d'), false);
  });
});

describe('Regex — repetition', () => {
  it('star: zero or more', () => {
    const r = new Regex('ab*c');
    assert.equal(r.test('ac'), true);
    assert.equal(r.test('abc'), true);
    assert.equal(r.test('abbc'), true);
    assert.equal(r.test('abbbc'), true);
    assert.equal(r.test('adc'), false);
  });

  it('plus: one or more', () => {
    const r = new Regex('ab+c');
    assert.equal(r.test('ac'), false);
    assert.equal(r.test('abc'), true);
    assert.equal(r.test('abbc'), true);
  });

  it('question: zero or one', () => {
    const r = new Regex('ab?c');
    assert.equal(r.test('ac'), true);
    assert.equal(r.test('abc'), true);
    assert.equal(r.test('abbc'), false);
  });
});

describe('Regex — dot (any char)', () => {
  it('matches any character', () => {
    const r = new Regex('a.c');
    assert.equal(r.test('abc'), true);
    assert.equal(r.test('axc'), true);
    assert.equal(r.test('ac'), false);
  });

  it('dot does not match newline', () => {
    assert.equal(new Regex('.').test('\n'), false);
  });
});

describe('Regex — character classes', () => {
  it('[abc] matches a, b, or c', () => {
    const r = new Regex('[abc]');
    assert.equal(r.test('a'), true);
    assert.equal(r.test('b'), true);
    assert.equal(r.test('d'), false);
  });

  it('[a-z] matches lowercase', () => {
    const r = new Regex('[a-z]');
    assert.equal(r.test('m'), true);
    assert.equal(r.test('A'), false);
  });

  it('[^abc] negated class', () => {
    const r = new Regex('[^abc]');
    assert.equal(r.test('d'), true);
    assert.equal(r.test('a'), false);
  });

  it('[0-9] digit range', () => {
    const r = new Regex('[0-9]+');
    assert.equal(r.test('123'), true);
    assert.equal(r.test('abc'), false);
  });
});

describe('Regex — escape sequences', () => {
  it('\\d matches digit', () => {
    assert.equal(new Regex('\\d').test('5'), true);
    assert.equal(new Regex('\\d').test('a'), false);
  });

  it('\\w matches word character', () => {
    assert.equal(new Regex('\\w').test('a'), true);
    assert.equal(new Regex('\\w').test('_'), true);
    assert.equal(new Regex('\\w').test(' '), false);
  });

  it('\\s matches whitespace', () => {
    assert.equal(new Regex('\\s').test(' '), true);
    assert.equal(new Regex('\\s').test('a'), false);
  });
});

describe('Regex — grouping', () => {
  it('grouping with alternation', () => {
    const r = new Regex('(ab|cd)e');
    assert.equal(r.test('abe'), true);
    assert.equal(r.test('cde'), true);
    assert.equal(r.test('ace'), false);
  });

  it('grouping with repetition', () => {
    const r = new Regex('(ab)+');
    assert.equal(r.test('ab'), true);
    assert.equal(r.test('abab'), true);
    assert.equal(r.test('aba'), false);
  });
});

describe('Regex — search', () => {
  it('finds match in middle of string', () => {
    const r = new Regex('world');
    const m = r.search('hello world!');
    assert.equal(m.index, 6);
    assert.equal(m.match, 'world');
  });

  it('returns null for no match', () => {
    assert.equal(new Regex('xyz').search('hello'), null);
  });
});

describe('Regex — matchAll', () => {
  it('finds all matches', () => {
    const r = new Regex('[0-9]+');
    const matches = r.matchAll('abc 123 def 456 ghi');
    assert.equal(matches.length, 2);
    assert.equal(matches[0].match, '123');
    assert.equal(matches[1].match, '456');
  });
});

describe('Regex — replace', () => {
  it('replaces all matches', () => {
    const r = new Regex('[0-9]+');
    assert.equal(r.replace('a1b2c3', '#'), 'a#b#c#');
  });
});

describe('Regex — complex patterns', () => {
  it('email-like pattern', () => {
    const r = new Regex('[a-z]+@[a-z]+\\.[a-z]+');
    assert.equal(r.test('foo@bar.com'), true);
    assert.equal(r.test('invalid'), false);
  });

  it('nested groups', () => {
    const r = new Regex('((a|b)*c)+');
    assert.equal(r.test('aabcc'), true);
    assert.equal(r.test('c'), true);
    assert.equal(r.test('d'), false);
  });

  it('complex alternation', () => {
    const r = new Regex('(hello|hi|hey) (world|there)');
    assert.equal(r.test('hello world'), true);
    assert.equal(r.test('hi there'), true);
    assert.equal(r.test('hey world'), true);
    assert.equal(r.test('bye world'), false);
  });
});
