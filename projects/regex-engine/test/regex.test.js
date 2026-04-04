import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Regex, parse, DFA, LazyDFA, backtrackerMatch } from '../src/index.js';

// ===== Literals =====
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
  it('longer mismatch', () => {
    assert.equal(new Regex('abc').test('abd'), false);
    assert.equal(new Regex('abc').test('ab'), false);
  });
  it('escaped special characters', () => {
    assert.equal(new Regex('a\\.b').test('a.b'), true);
    assert.equal(new Regex('a\\.b').test('axb'), false);
    assert.equal(new Regex('a\\*b').test('a*b'), true);
    assert.equal(new Regex('a\\+b').test('a+b'), true);
    assert.equal(new Regex('a\\?b').test('a?b'), true);
  });
});

// ===== Alternation =====
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
  it('alternation with concatenation', () => {
    const r = new Regex('ab|cd');
    assert.equal(r.test('ab'), true);
    assert.equal(r.test('cd'), true);
    assert.equal(r.test('ac'), false);
    assert.equal(r.test('ad'), false);
  });
  it('empty alternative', () => {
    const r = new Regex('a|');
    assert.equal(r.test('a'), true);
    assert.equal(r.test(''), true);
  });
});

// ===== Repetition =====
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
  it('star on empty produces empty match', () => {
    assert.equal(new Regex('a*').test(''), true);
    assert.equal(new Regex('a*').test('aaa'), true);
  });
});

// ===== Dot =====
describe('Regex — dot (any char)', () => {
  it('matches any character', () => {
    const r = new Regex('a.c');
    assert.equal(r.test('abc'), true);
    assert.equal(r.test('axc'), true);
    assert.equal(r.test('a1c'), true);
    assert.equal(r.test('ac'), false);
  });
  it('dot does not match newline', () => {
    assert.equal(new Regex('.').test('\n'), false);
  });
  it('dot with quantifiers', () => {
    assert.equal(new Regex('a.+c').test('abxc'), true);
    assert.equal(new Regex('a.*c').test('ac'), true);
    assert.equal(new Regex('a.?c').test('ac'), true);
    assert.equal(new Regex('a.?c').test('axc'), true);
  });
});

// ===== Character Classes =====
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
  it('[a-zA-Z] multiple ranges', () => {
    const r = new Regex('[a-zA-Z]+');
    assert.equal(r.test('Hello'), true);
    assert.equal(r.test('123'), false);
  });
  it('escape inside char class', () => {
    const r = new Regex('[\\d]+');
    assert.equal(r.test('123'), true);
    assert.equal(r.test('abc'), false);
  });
  it('combined set and predicate in class', () => {
    const r = new Regex('[a\\d]');
    assert.equal(r.test('a'), true);
    assert.equal(r.test('5'), true);
    assert.equal(r.test('b'), false);
  });
});

// ===== Escape Sequences =====
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
    assert.equal(new Regex('\\s').test('\t'), true);
    assert.equal(new Regex('\\s').test('a'), false);
  });
  it('\\D, \\W, \\S negated classes', () => {
    assert.equal(new Regex('\\D').test('a'), true);
    assert.equal(new Regex('\\D').test('5'), false);
    assert.equal(new Regex('\\W').test(' '), true);
    assert.equal(new Regex('\\W').test('a'), false);
    assert.equal(new Regex('\\S').test('a'), true);
    assert.equal(new Regex('\\S').test(' '), false);
  });
  it('\\t, \\n, \\r match special chars', () => {
    assert.equal(new Regex('\\t').test('\t'), true);
    assert.equal(new Regex('\\n').test('\n'), true);
    assert.equal(new Regex('\\r').test('\r'), true);
  });
});

// ===== Grouping =====
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
  it('non-capturing group', () => {
    const r = new Regex('(?:ab|cd)e');
    assert.equal(r.test('abe'), true);
    assert.equal(r.test('cde'), true);
    assert.equal(r.test('ace'), false);
    assert.equal(r.groupCount, 0);
  });
  it('nested groups', () => {
    const r = new Regex('((a|b)*c)+');
    assert.equal(r.test('aabcc'), true);
    assert.equal(r.test('c'), true);
    assert.equal(r.test('d'), false);
  });
  it('multiple groups parse correctly', () => {
    const parsed = parse('(a)(b)(c)');
    assert.equal(parsed.groupCount, 3);
  });
});

// ===== Anchors =====
describe('Regex — anchors', () => {
  it('^ matches start of string', () => {
    const r = new Regex('^hello');
    assert.equal(r.test('hello'), true);
    assert.equal(r.test('hello world'), false); // full match, not search
  });
  it('$ matches end of string', () => {
    const r = new Regex('world$');
    assert.equal(r.test('world'), true);
  });
  it('^...$ full line match', () => {
    const r = new Regex('^abc$');
    assert.equal(r.test('abc'), true);
    assert.equal(r.test('abcd'), false);
    assert.equal(r.test('xabc'), false);
  });
  it('search with ^ anchor', () => {
    const r = new Regex('^hello');
    const m = r.search('hello world');
    assert.ok(m);
    assert.equal(m.match, 'hello');
    assert.equal(m.index, 0);
  });
  it('search with ^ does not match mid-string', () => {
    const r = new Regex('^world');
    assert.equal(r.search('hello world'), null);
  });
  it('\\b word boundary', () => {
    const r = new Regex('\\bcat\\b');
    assert.ok(r.search('the cat sat'));
    assert.equal(r.search('concatenate'), null);
  });
});

// ===== Quantifiers {n,m} =====
describe('Regex — counted quantifiers {n,m}', () => {
  it('{3} exactly 3', () => {
    const r = new Regex('a{3}');
    assert.equal(r.test('aaa'), true);
    assert.equal(r.test('aa'), false);
    assert.equal(r.test('aaaa'), false);
  });
  it('{2,4} between 2 and 4', () => {
    const r = new Regex('a{2,4}');
    assert.equal(r.test('a'), false);
    assert.equal(r.test('aa'), true);
    assert.equal(r.test('aaa'), true);
    assert.equal(r.test('aaaa'), true);
    assert.equal(r.test('aaaaa'), false);
  });
  it('{2,} two or more', () => {
    const r = new Regex('a{2,}');
    assert.equal(r.test('a'), false);
    assert.equal(r.test('aa'), true);
    assert.equal(r.test('aaaaaaa'), true);
  });
  it('{0,1} same as ?', () => {
    const r = new Regex('ab{0,1}c');
    assert.equal(r.test('ac'), true);
    assert.equal(r.test('abc'), true);
    assert.equal(r.test('abbc'), false);
  });
  it('{0,} same as *', () => {
    const r = new Regex('ab{0,}c');
    assert.equal(r.test('ac'), true);
    assert.equal(r.test('abbbbc'), true);
  });
});

// ===== Search =====
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
  it('finds first match', () => {
    const r = new Regex('\\d+');
    const m = r.search('abc 123 def 456');
    assert.equal(m.match, '123');
    assert.equal(m.index, 4);
  });
  it('greedy match finds longest', () => {
    const r = new Regex('a+');
    const m = r.search('baaab');
    assert.equal(m.match, 'aaa');
  });
});

// ===== matchAll =====
describe('Regex — matchAll', () => {
  it('finds all matches', () => {
    const r = new Regex('[0-9]+');
    const matches = r.matchAll('abc 123 def 456 ghi');
    assert.equal(matches.length, 2);
    assert.equal(matches[0].match, '123');
    assert.equal(matches[1].match, '456');
  });
  it('finds words', () => {
    const r = new Regex('[a-z]+');
    const matches = r.matchAll('hello world foo');
    assert.equal(matches.length, 3);
    assert.equal(matches[0].match, 'hello');
    assert.equal(matches[1].match, 'world');
    assert.equal(matches[2].match, 'foo');
  });
  it('no matches returns empty array', () => {
    assert.deepEqual(new Regex('[0-9]+').matchAll('hello'), []);
  });
});

// ===== Replace =====
describe('Regex — replace', () => {
  it('replaces all matches with string', () => {
    const r = new Regex('[0-9]+');
    assert.equal(r.replace('a1b2c3', '#'), 'a#b#c#');
  });
  it('replaces with function', () => {
    const r = new Regex('[0-9]+');
    assert.equal(r.replace('a1b22c333', (m) => `[${m}]`), 'a[1]b[22]c[333]');
  });
  it('no match returns original', () => {
    assert.equal(new Regex('xyz').replace('hello', '#'), 'hello');
  });
});

// ===== Split =====
describe('Regex — split', () => {
  it('splits on pattern', () => {
    const r = new Regex('\\s+');
    assert.deepEqual(r.split('hello   world  foo'), ['hello', 'world', 'foo']);
  });
  it('splits with limit', () => {
    const r = new Regex(',');
    assert.deepEqual(r.split('a,b,c,d', 3), ['a', 'b', 'c,d']);
  });
  it('no match returns original in array', () => {
    assert.deepEqual(new Regex('x').split('hello'), ['hello']);
  });
  it('split on comma-space', () => {
    assert.deepEqual(new Regex(',\\s*').split('a, b,c, d'), ['a', 'b', 'c', 'd']);
  });
});

// ===== Complex Patterns =====
describe('Regex — complex patterns', () => {
  it('email-like pattern', () => {
    const r = new Regex('[a-z]+@[a-z]+\\.[a-z]+');
    assert.equal(r.test('foo@bar.com'), true);
    assert.equal(r.test('invalid'), false);
  });
  it('IP address pattern', () => {
    const r = new Regex('\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}');
    assert.equal(r.test('192.168.1.1'), true);
    assert.equal(r.test('10.0.0.1'), true);
    assert.equal(r.test('abc'), false);
  });
  it('hex color pattern', () => {
    const r = new Regex('#[0-9a-fA-F]{6}');
    assert.equal(r.test('#FF00AA'), true);
    assert.equal(r.test('#abc123'), true);
    assert.equal(r.test('#xyz'), false);
  });
  it('complex alternation', () => {
    const r = new Regex('(hello|hi|hey) (world|there)');
    assert.equal(r.test('hello world'), true);
    assert.equal(r.test('hi there'), true);
    assert.equal(r.test('hey world'), true);
    assert.equal(r.test('bye world'), false);
  });
  it('phone number pattern', () => {
    const r = new Regex('\\d{3}-\\d{3}-\\d{4}');
    assert.equal(r.test('123-456-7890'), true);
    assert.equal(r.test('12-345-6789'), false);
  });
  it('URL-like pattern', () => {
    const r = new Regex('https?://[a-z]+\\.[a-z]+');
    assert.equal(r.test('http://foo.com'), true);
    assert.equal(r.test('https://bar.org'), true);
    assert.equal(r.test('ftp://x.y'), false);
  });
});

// ===== Lookahead =====
describe('Regex — lookahead', () => {
  it('positive lookahead', () => {
    const r = new Regex('foo(?=bar)');
    // "foo" followed by "bar" but bar not consumed
    // For full match, "foo" alone should test true since lookahead just peeks
    // But as a full-string match, "foo" + lookahead("bar") means the remaining input must start with "bar"
    // So test("foobar") should match "foo" part only — but test does full match
    // Actually, test("foo") with lookahead for "bar" in remaining: remaining is "" which doesn't match "bar"
    // test("foobar") → "foo" consumed, at position 3, remaining is "bar", lookahead succeeds, but then we need to match rest of pattern (nothing) against "bar" — fails
    // Hmm, lookaheads are complex with full match semantics
    // Let's test via search instead
    const m = r.search('foobar');
    assert.ok(m);
    assert.equal(m.match, 'foo');
  });
  it('negative lookahead', () => {
    const r = new Regex('foo(?!bar)');
    const m1 = r.search('foobaz');
    assert.ok(m1);
    assert.equal(m1.match, 'foo');
    // foobar should NOT match 'foo' at position 0 because bar follows
    const m2 = r.search('foobar');
    assert.equal(m2, null);
  });
});

// ===== DFA =====
describe('Regex — DFA subset construction', () => {
  it('basic DFA matching', () => {
    const r = new Regex('abc');
    assert.equal(r.testDFA('abc'), true);
    assert.equal(r.testDFA('abd'), false);
  });
  it('DFA with alternation', () => {
    const r = new Regex('cat|dog');
    assert.equal(r.testDFA('cat'), true);
    assert.equal(r.testDFA('dog'), true);
    assert.equal(r.testDFA('bird'), false);
  });
  it('DFA with star', () => {
    const r = new Regex('a*b');
    assert.equal(r.testDFA('b'), true);
    assert.equal(r.testDFA('ab'), true);
    assert.equal(r.testDFA('aaab'), true);
    assert.equal(r.testDFA('aaa'), false);
  });
  it('DFA with character class', () => {
    const r = new Regex('[a-z]+');
    assert.equal(r.testDFA('hello'), true);
    assert.equal(r.testDFA('123'), false);
  });
  it('DFA state count', () => {
    const r = new Regex('ab|cd');
    assert.ok(r.dfaStats.states > 0);
    assert.ok(r.dfaStats.states <= 10); // should be small
  });
  it('DFA matches same as NFA', () => {
    const patterns = ['a*b', '(a|b)*c', 'ab+c', '[0-9]+', 'hello|world'];
    const inputs = ['b', 'ab', 'aaab', 'c', 'abc', 'bbc', '123', 'hello', 'world', 'xyz'];
    for (const pat of patterns) {
      const r = new Regex(pat);
      for (const inp of inputs) {
        assert.equal(r.test(inp), r.testDFA(inp), `NFA/DFA mismatch for /${pat}/ on "${inp}"`);
      }
    }
  });
});

// ===== Edge Cases =====
describe('Regex — edge cases', () => {
  it('empty pattern with star', () => {
    assert.equal(new Regex('(a*)*').test(''), true);
  });
  it('nested quantifiers', () => {
    const r = new Regex('(a+)+b');
    assert.equal(r.test('aab'), true);
    assert.equal(r.test('b'), false);
  });
  it('escaped backslash', () => {
    assert.equal(new Regex('a\\\\b').test('a\\b'), true);
  });
  it('multiple dots', () => {
    assert.equal(new Regex('..').test('ab'), true);
    assert.equal(new Regex('..').test('a'), false);
  });
  it('alternation priority', () => {
    // Should match longest in NFA
    const r = new Regex('a|ab');
    assert.equal(r.test('a'), true);
    assert.equal(r.test('ab'), true);
  });
  it('unicode characters', () => {
    assert.equal(new Regex('café').test('café'), true);
  });
});

// ===== Performance-ish =====
describe('Regex — performance', () => {
  it('a*a does not catastrophic backtrack (NFA is linear)', () => {
    // Classic catastrophic backtracking pattern: a?^n a^n
    // NFA simulation handles this in O(nm) time
    const n = 20;
    const r = new Regex('a?'.repeat(n) + 'a'.repeat(n));
    assert.equal(r.test('a'.repeat(n)), true);
  });
  it('DFA handles long strings efficiently', () => {
    const r = new Regex('[a-z]+');
    const input = 'a'.repeat(10000);
    assert.equal(r.testDFA(input), true);
  });
});

// ===== Backreferences =====
describe('Regex — backreferences', () => {
  it('\\1 matches captured group', () => {
    const r = new Regex('(a+)b\\1');
    assert.equal(r.test('aabaa'), true);
    assert.equal(r.test('abab'), false); // \\1 = 'a', so 'ab' + 'a' = 'aba' not 'abab'
    assert.equal(r.test('aba'), true);   // (a)b\\1 = 'a' + 'b' + 'a'
  });
  it('\\1 with alternation', () => {
    const r = new Regex('(cat|dog) and \\1');
    assert.equal(r.test('cat and cat'), true);
    assert.equal(r.test('dog and dog'), true);
    assert.equal(r.test('cat and dog'), false);
  });
  it('multiple backreferences', () => {
    const r = new Regex('(a)(b)\\2\\1');
    assert.equal(r.test('abba'), true);
    assert.equal(r.test('abab'), false);
  });
  it('backreference to empty group', () => {
    const r = new Regex('(a?)b\\1');
    assert.equal(r.test('aba'), true);  // group captures 'a'
    assert.equal(r.test('b'), true);    // group captures ''
  });
});

// ===== exec (capturing groups) =====
describe('Regex — exec (capturing groups)', () => {
  it('returns captured groups', () => {
    const r = new Regex('(\\d+)-(\\d+)');
    const m = r.exec('123-456');
    assert.ok(m);
    assert.equal(m[0], '123-456');
    assert.equal(m[1], '123');
    assert.equal(m[2], '456');
  });
  it('returns undefined for unmatched optional group', () => {
    const r = new Regex('(a)(b)?c');
    const m = r.exec('ac');
    assert.ok(m);
    assert.equal(m[1], 'a');
    assert.equal(m[2], undefined);
  });
  it('nested capturing groups', () => {
    const r = new Regex('((a+)(b+))c');
    const m = r.exec('aabbc');
    assert.ok(m);
    assert.equal(m[0], 'aabbc');
    assert.equal(m[1], 'aabb');  // outer group
    assert.equal(m[2], 'aa');     // first inner
    assert.equal(m[3], 'bb');     // second inner
  });
  it('returns null for no match', () => {
    assert.equal(new Regex('xyz').exec('abc'), null);
  });
  it('named groups', () => {
    const r = new Regex('(?<year>\\d{4})-(?<month>\\d{2})');
    const m = r.exec('2026-04');
    assert.ok(m);
    assert.equal(m[1], '2026');
    assert.equal(m[2], '04');
    assert.equal(m.groups.year, '2026');
    assert.equal(m.groups.month, '04');
  });
});

// ===== execSearch (search with groups) =====
describe('Regex — execSearch', () => {
  it('finds match with groups in middle of string', () => {
    const r = new Regex('(\\w+)@(\\w+)');
    const m = r.execSearch('email: foo@bar end');
    assert.ok(m);
    assert.equal(m[0], 'foo@bar');
    assert.equal(m[1], 'foo');
    assert.equal(m[2], 'bar');
    assert.equal(m.index, 7);
  });
  it('returns null for no match', () => {
    assert.equal(new Regex('\\d+').execSearch('no digits here'), null);
  });
});

// ===== Advanced character classes =====
describe('Regex — advanced character classes', () => {
  it('] as first char in class', () => {
    const r = new Regex('[]abc]');
    assert.equal(r.test(']'), true);
    assert.equal(r.test('a'), true);
    assert.equal(r.test('d'), false);
  });
  it('hyphen in class', () => {
    const r = new Regex('[a\\-z]');
    assert.equal(r.test('a'), true);
    assert.equal(r.test('-'), true);
    assert.equal(r.test('z'), true);
    assert.equal(r.test('m'), false);
  });
  it('negated class with range', () => {
    const r = new Regex('[^0-9]');
    assert.equal(r.test('a'), true);
    assert.equal(r.test('5'), false);
  });
  it('\\w and \\d combined in class', () => {
    const r = new Regex('[\\w@.]+');
    assert.equal(r.test('user@host.com'), true);
  });
  it('class with escape sequences', () => {
    const r = new Regex('[\\t\\n]');
    assert.equal(r.test('\t'), true);
    assert.equal(r.test('\n'), true);
    assert.equal(r.test(' '), false);
  });
});

// ===== Advanced anchors =====
describe('Regex — advanced anchors', () => {
  it('\\b at start and end', () => {
    const r = new Regex('\\bhello\\b');
    assert.ok(r.search('say hello world'));
    assert.equal(r.search('sayhelloworld'), null);
  });
  it('\\B non-word boundary', () => {
    const r = new Regex('\\Bcat\\B');
    assert.ok(r.search('concatenate'));
    assert.equal(r.search('cat sat'), null);
  });
  it('$ with search', () => {
    const r = new Regex('end$');
    const m = r.search('the end');
    assert.ok(m);
    assert.equal(m.match, 'end');
  });
  it('anchors with alternation', () => {
    const r = new Regex('^(hello|hi)$');
    assert.equal(r.test('hello'), true);
    assert.equal(r.test('hi'), true);
    assert.equal(r.test('hey'), false);
  });
});

// ===== Advanced quantifiers =====
describe('Regex — advanced quantifiers', () => {
  it('{0} matches empty', () => {
    const r = new Regex('a{0}b');
    assert.equal(r.test('b'), true);
    assert.equal(r.test('ab'), false);
  });
  it('{1} exactly one', () => {
    const r = new Regex('a{1}');
    assert.equal(r.test('a'), true);
    assert.equal(r.test(''), false);
    assert.equal(r.test('aa'), false);
  });
  it('nested quantifiers in group', () => {
    const r = new Regex('(ab){2,3}');
    assert.equal(r.test('abab'), true);
    assert.equal(r.test('ababab'), true);
    assert.equal(r.test('ab'), false);
    assert.equal(r.test('abababab'), false);
  });
  it('{n,m} with character class', () => {
    const r = new Regex('[a-z]{3,5}');
    assert.equal(r.test('ab'), false);
    assert.equal(r.test('abc'), true);
    assert.equal(r.test('abcde'), true);
    assert.equal(r.test('abcdef'), false);
  });
});

// ===== Named groups =====
describe('Regex — named groups', () => {
  it('(?<name>...) creates named group', () => {
    const parsed = parse('(?<foo>abc)');
    assert.equal(parsed.groupCount, 1);
  });
  it('named group captures via exec', () => {
    const r = new Regex('(?<first>\\w+) (?<last>\\w+)');
    const m = r.exec('John Doe');
    assert.ok(m);
    assert.equal(m.groups.first, 'John');
    assert.equal(m.groups.last, 'Doe');
  });
});

// ===== Lazy quantifiers =====
describe('Regex — lazy quantifiers', () => {
  it('*? finds shortest match', () => {
    const r = new Regex('a.*?b');
    const m = r.search('aXXbYYb');
    assert.ok(m);
    assert.equal(m.match, 'aXXb');
  });
  it('+? finds shortest non-empty', () => {
    const r = new Regex('a.+?b');
    const m = r.search('aXbYb');
    assert.ok(m);
    assert.equal(m.match, 'aXb');
  });
  it('?? prefers zero', () => {
    const r = new Regex('ab??');
    // Full match: 'a' matches because b?? prefers 0
    assert.equal(r.test('a'), true);
    assert.equal(r.test('ab'), true);
  });
});

// ===== Real-world patterns =====
describe('Regex — real-world patterns', () => {
  it('date pattern YYYY-MM-DD', () => {
    const r = new Regex('\\d{4}-\\d{2}-\\d{2}');
    assert.equal(r.test('2026-04-03'), true);
    assert.equal(r.test('26-4-3'), false);
  });
  it('time pattern HH:MM:SS', () => {
    const r = new Regex('\\d{2}:\\d{2}:\\d{2}');
    assert.equal(r.test('23:59:59'), true);
    assert.equal(r.test('1:2:3'), false);
  });
  it('simple HTML tag', () => {
    const r = new Regex('<([a-z]+)>[^<]*</\\1>');
    assert.equal(r.test('<b>bold</b>'), true);
    assert.equal(r.test('<i>italic</i>'), true);
    assert.equal(r.test('<b>mismatch</i>'), false);
  });
  it('quoted string', () => {
    const r = new Regex('"[^"]*"');
    assert.ok(r.search('say "hello world" end'));
  });
  it('CSV-like field', () => {
    const r = new Regex('[^,]+');
    const matches = r.matchAll('a,bb,ccc');
    assert.equal(matches.length, 3);
    assert.equal(matches[0].match, 'a');
    assert.equal(matches[1].match, 'bb');
    assert.equal(matches[2].match, 'ccc');
  });
  it('variable name pattern', () => {
    const r = new Regex('[a-zA-Z_][a-zA-Z0-9_]*');
    assert.equal(r.test('myVar_123'), true);
    assert.equal(r.test('_private'), true);
    assert.equal(r.test('123abc'), false);
  });
  it('repeated word detection', () => {
    const r = new Regex('(\\w+) \\1');
    assert.equal(r.test('the the'), true);
    assert.equal(r.test('hello hello'), true);
    assert.equal(r.test('hello world'), false);
  });
  it('markdown bold pattern', () => {
    const r = new Regex('\\*\\*[^*]+\\*\\*');
    assert.ok(r.search('this is **bold** text'));
  });
  it('file extension pattern', () => {
    const r = new Regex('\\.[a-zA-Z]{1,4}$');
    assert.equal(r.test('.js'), true);
    assert.equal(r.test('.html'), true);
    assert.equal(r.test('.toolong'), false);
  });
});

// ===== DFA advanced =====
describe('Regex — DFA advanced', () => {
  it('DFA with quantifiers {n,m}', () => {
    const r = new Regex('a{2,4}b');
    assert.equal(r.testDFA('aab'), true);
    assert.equal(r.testDFA('aaaab'), true);
    assert.equal(r.testDFA('ab'), false);
    assert.equal(r.testDFA('aaaaab'), false);
  });
  it('DFA with dot', () => {
    const r = new Regex('a.b');
    assert.equal(r.testDFA('axb'), true);
    assert.equal(r.testDFA('ab'), false);
  });
  it('DFA with complex alternation', () => {
    const r = new Regex('(abc|def|ghi)+');
    assert.equal(r.testDFA('abcdef'), true);
    assert.equal(r.testDFA('ghiabc'), true);
    assert.equal(r.testDFA('abd'), false);
  });
  it('DFA with negated class', () => {
    const r = new Regex('[^abc]+');
    assert.equal(r.testDFA('xyz'), true);
    assert.equal(r.testDFA('abc'), false);
  });
  it('DFA stress: long alternation', () => {
    const r = new Regex('aa|bb|cc|dd|ee|ff|gg|hh');
    assert.equal(r.testDFA('aa'), true);
    assert.equal(r.testDFA('hh'), true);
    assert.equal(r.testDFA('ab'), false);
  });
});

// ===== Hopcroft Minimization =====
describe('Regex — DFA minimization', () => {
  it('minimized DFA produces same results', () => {
    const patterns = ['a*b', '(a|b)*c', 'ab+c', '[0-9]+', 'hello|world', 'a{2,4}'];
    const inputs = ['b', 'ab', 'aaab', 'c', 'abc', 'bbc', '123', 'hello', 'world', 'xyz', 'aa', 'aaaa'];
    for (const pat of patterns) {
      const r = new Regex(pat);
      for (const inp of inputs) {
        assert.equal(r.testDFA(inp), r.testMinDFA(inp), `DFA/MinDFA mismatch for /${pat}/ on "${inp}"`);
      }
    }
  });
  it('minimization reduces state count', () => {
    // Pattern with redundant states
    const r = new Regex('(a|a)b');
    const stats = r.dfaStats;
    assert.ok(stats.minimizedStates <= stats.states, 
      `minimized (${stats.minimizedStates}) should be <= original (${stats.states})`);
  });
  it('minimized DFA for (a|b)* has few states', () => {
    const r = new Regex('(a|b)*');
    const stats = r.dfaStats;
    assert.ok(stats.minimizedStates <= 2, `Expected <=2 states, got ${stats.minimizedStates}`);
  });
  it('identity: already minimal DFA unchanged', () => {
    const r = new Regex('abc');
    const stats = r.dfaStats;
    // abc has 4 states (start, a, ab, abc-accept) — already minimal
    assert.equal(stats.minimizedStates, stats.states);
  });
  it('minimized handles complex patterns', () => {
    const r = new Regex('[a-z]+@[a-z]+\\.[a-z]+');
    assert.equal(r.testMinDFA('foo@bar.com'), true);
    assert.equal(r.testMinDFA('invalid'), false);
  });
});

// ===== Lazy DFA =====
describe('Regex — lazy DFA', () => {
  it('lazy DFA matches same as eager DFA', () => {
    const patterns = ['a*b', '(a|b)*c', '[0-9]+', 'hello|world'];
    const inputs = ['b', 'ab', 'aaab', 'c', 'abc', '123', 'hello', 'world', 'xyz'];
    for (const pat of patterns) {
      const r = new Regex(pat);
      for (const inp of inputs) {
        assert.equal(r.testDFA(inp), r.testLazyDFA(inp), `DFA/LazyDFA mismatch for /${pat}/ on "${inp}"`);
      }
    }
  });
  it('lazy DFA builds fewer states for targeted input', () => {
    // Pattern with many possible states, but input only explores a subset
    const r = new Regex('[a-z]{1,5}');
    r.lazyDfa.test('abc');
    // Should have built only the states needed for 'abc' (3-4 states)
    assert.ok(r.lazyDfa.stateCount < r.dfa.stateCount,
      `lazy (${r.lazyDfa.stateCount}) should be < eager (${r.dfa.stateCount})`);
  });
  it('lazy DFA caches transitions', () => {
    const r = new Regex('[a-z]+');
    r.lazyDfa.test('abc');
    const sizeAfterFirst = r.lazyDfa.cacheSize;
    r.lazyDfa.test('abc'); // same input — should use cache
    assert.equal(r.lazyDfa.cacheSize, sizeAfterFirst, 'cache should not grow on repeated input');
  });
  it('lazy DFA handles long strings', () => {
    const r = new Regex('[a-z]+');
    assert.equal(r.testLazyDFA('a'.repeat(10000)), true);
  });
  it('lazy DFA incremental growth', () => {
    const r = new Regex('(a|b|c)(d|e|f)(g|h|i)');
    r.lazyDfa.test('adg');
    const statesAfterOne = r.lazyDfa.stateCount;
    r.lazyDfa.test('beh');
    const statesAfterTwo = r.lazyDfa.stateCount;
    assert.ok(statesAfterTwo >= statesAfterOne, 'states should grow or stay same');
  });
  it('lazy DFA returns false for non-match', () => {
    const r = new Regex('abc');
    assert.equal(r.testLazyDFA('abd'), false);
    assert.equal(r.testLazyDFA('ab'), false);
  });
  it('lazy DFA with quantifiers', () => {
    const r = new Regex('a{2,4}b');
    assert.equal(r.testLazyDFA('aab'), true);
    assert.equal(r.testLazyDFA('aaaab'), true);
    assert.equal(r.testLazyDFA('ab'), false);
  });
});

// ===== API completeness =====
describe('Regex — API completeness', () => {
  it('toString returns pattern', () => {
    assert.equal(new Regex('abc').toString(), '/abc/');
    assert.equal(new Regex('[a-z]+').toString(), '/[a-z]+/');
  });
  it('groupCount tracks capturing groups', () => {
    assert.equal(new Regex('(a)(b)(c)').groupCount, 3);
    assert.equal(new Regex('(?:a)(b)').groupCount, 1);
    assert.equal(new Regex('abc').groupCount, 0);
  });
  it('matchAll with groups-like pattern', () => {
    const r = new Regex('[A-Z][a-z]+');
    const m = r.matchAll('Hello World Foo');
    assert.equal(m.length, 3);
    assert.equal(m[0].match, 'Hello');
    assert.equal(m[1].match, 'World');
    assert.equal(m[2].match, 'Foo');
  });
  it('replace with function receives match and index', () => {
    const r = new Regex('[0-9]+');
    const result = r.replace('x1y22z', (match, idx) => `${match}@${idx}`);
    assert.equal(result, 'x1@1y22@3z');
  });
  it('split preserves empty strings', () => {
    const r = new Regex(',');
    assert.deepEqual(r.split(',a,b,'), ['', 'a', 'b', '']);
  });
  it('search returns null for empty pattern on empty string', () => {
    // Empty pattern can match empty string; search behavior
    const r = new Regex('x');
    assert.equal(r.search(''), null);
  });
  it('all three DFA modes agree', () => {
    const patterns = ['abc', 'a*b+c?', '[a-z]{2,5}', '(x|y|z)+'];
    const inputs = ['abc', 'bc', 'bc', 'ab', 'abcde', 'xyz', 'xyzzy', ''];
    for (const pat of patterns) {
      const r = new Regex(pat);
      for (const inp of inputs) {
        const nfa = r.test(inp);
        const dfa = r.testDFA(inp);
        const minDfa = r.testMinDFA(inp);
        const lazyDfa = r.testLazyDFA(inp);
        assert.equal(nfa, dfa, `NFA/DFA mismatch: /${pat}/ on "${inp}"`);
        assert.equal(dfa, minDfa, `DFA/MinDFA mismatch: /${pat}/ on "${inp}"`);
        assert.equal(dfa, lazyDfa, `DFA/LazyDFA mismatch: /${pat}/ on "${inp}"`);
      }
    }
  });
  it('exec with no groups returns array with full match only', () => {
    const r = new Regex('abc');
    const m = r.exec('abc');
    assert.ok(m);
    assert.equal(m[0], 'abc');
    assert.equal(m.length, 1);
  });
});

// ===== Performance =====
describe('Regex — performance', () => {
  it('a*a does not catastrophic backtrack (NFA is linear)', () => {
    const n = 20;
    const r = new Regex('a?'.repeat(n) + 'a'.repeat(n));
    assert.equal(r.test('a'.repeat(n)), true);
  });
  it('DFA handles long strings efficiently', () => {
    const r = new Regex('[a-z]+');
    const input = 'a'.repeat(10000);
    assert.equal(r.testDFA(input), true);
  });
  it('lazy DFA handles long strings', () => {
    const r = new Regex('[a-z]+');
    assert.equal(r.testLazyDFA('a'.repeat(10000)), true);
  });
  it('matchAll on large input', () => {
    const r = new Regex('[0-9]+');
    const input = Array.from({ length: 100 }, (_, i) => `word${i}`).join(' ');
    const matches = r.matchAll(input);
    assert.equal(matches.length, 100);
  });
});

// ===== Lookbehind =====
describe('Regex — lookbehind', () => {
  it('positive lookbehind: match digits after $', () => {
    const r = new Regex('(?<=\\$)\\d+');
    const m = r.search('Price: $100');
    assert.ok(m);
    assert.equal(m.match, '100');
  });

  it('positive lookbehind: single char', () => {
    const r = new Regex('(?<=a)b');
    const m1 = r.search('ab');
    assert.ok(m1);
    assert.equal(m1.match, 'b');
    assert.equal(r.search('cb'), null);
    assert.equal(r.search('b'), null);
  });

  it('positive lookbehind: multi-char', () => {
    const r = new Regex('(?<=foo)bar');
    const m1 = r.search('foobar');
    assert.ok(m1);
    assert.equal(m1.match, 'bar');
    assert.equal(r.search('bazbar'), null);
  });

  it('negative lookbehind: match digits NOT after $', () => {
    const r = new Regex('(?<!\\$)\\d+');
    const m = r.search('price 42');
    assert.ok(m);
    assert.equal(m.match, '42');
  });

  it('negative lookbehind: single char', () => {
    const r = new Regex('(?<!a)b');
    const m1 = r.search('cb');
    assert.ok(m1);
    assert.equal(m1.match, 'b');
    const m2 = r.search('b');
    assert.ok(m2);
    assert.equal(r.search('ab'), null);
  });

  it('negative lookbehind: multi-char', () => {
    const r = new Regex('(?<!foo)bar');
    const m1 = r.search('bazbar');
    assert.ok(m1);
    assert.equal(m1.match, 'bar');
    assert.equal(r.search('foobar'), null);
  });

  it('lookbehind at start of string', () => {
    const r = new Regex('(?<=x)a');
    assert.equal(r.search('a'), null);
    const m = r.search('xa');
    assert.ok(m);
    assert.equal(m.match, 'a');
  });

  it('negative lookbehind at start of string', () => {
    const r = new Regex('(?<!x)a');
    const m = r.search('a');
    assert.ok(m);
    assert.equal(m.match, 'a');
    assert.equal(r.search('xa'), null);
  });

  it('lookbehind with character class', () => {
    const r = new Regex('(?<=[a-z])\\d');
    const m1 = r.search('a1');
    assert.ok(m1);
    assert.equal(m1.match, '1');
    assert.equal(r.search('A1'), null);
    assert.equal(r.search('1'), null);
  });

  it('combined lookahead and lookbehind', () => {
    const r = new Regex('(?<=\\()\\d+(?=\\))');
    const m = r.search('value is (42) here');
    assert.ok(m);
    assert.equal(m.match, '42');
  });

  it('lookbehind with alternation', () => {
    const r = new Regex('(?<=cat|dog)fish');
    const m1 = r.search('catfish');
    assert.ok(m1);
    assert.equal(m1.match, 'fish');
    const m2 = r.search('dogfish');
    assert.ok(m2);
    assert.equal(r.search('ratfish'), null);
  });

  it('matchAll with lookbehind', () => {
    const r = new Regex('(?<=@)\\w+');
    const matches = r.matchAll('email @alice and @bob');
    assert.equal(matches.length, 2);
    assert.equal(matches[0].match, 'alice');
    assert.equal(matches[1].match, 'bob');
  });
});

// ===== Atomic Groups and Possessive Quantifiers =====
describe('Regex — atomic groups', () => {
  it('atomic group: basic match', () => {
    const r = new Regex('(?>abc)');
    assert.equal(r.test('abc'), true);
    assert.equal(r.test('ab'), false);
  });

  it('atomic group: prevents backtracking', () => {
    // Without atomic: a*a matches "aaa" (a* takes 2, a takes 1)
    // With atomic: (?>a*)a fails on "aaa" because a* takes all 3, then a can't match
    const r1 = new Regex('a*a');
    assert.equal(r1.test('aaa'), true); // normal: works

    const r2 = new Regex('(?>a*)a');
    assert.equal(r2.test('aaa'), false); // atomic: fails (a* eats everything)
  });

  it('atomic group: alternation', () => {
    // (?>foo|foobar) against "foobar" — first alt "foo" matches, atomic locks it, rest fails
    const r = new Regex('(?>foo|foobar)bar');
    assert.equal(r.test('foobar'), true); // "foo" matches, then "bar" matches
    
    // But: (?>foobar|foo)bar — "foobar" matches first, atomic locks, "bar" from input is gone
    const r2 = new Regex('(?>foobar|foo)bar');
    assert.equal(r2.test('foobar'), false); // "foobar" consumed all input, no "bar" left
    assert.equal(r2.test('foobarbar'), true); // "foobar" + "bar" works
  });

  it('possessive quantifier: *+', () => {
    const r = new Regex('a*+a');
    assert.equal(r.test('aaa'), false); // a*+ eats all, can't give back
    
    const r2 = new Regex('a*+b');
    assert.equal(r2.test('aaab'), true); // a*+ eats a's, b matches
  });

  it('possessive quantifier: ++', () => {
    const r = new Regex('a++a');
    assert.equal(r.test('aaa'), false); // a++ eats all, can't give back
    
    const r2 = new Regex('a++b');
    assert.equal(r2.test('aaab'), true);
    assert.equal(r2.test('b'), false); // ++ requires at least 1
  });

  it('possessive quantifier: ?+', () => {
    const r = new Regex('a?+a');
    assert.equal(r.test('a'), false); // a?+ takes the a, nothing left
    assert.equal(r.test('aa'), true); // a?+ takes first a, second a matches
  });

  it('possessive quantifier with character class', () => {
    const r = new Regex('[a-z]++\\d');
    assert.equal(r.search('abc123') !== null, true);
    const m = r.search('abc1');
    assert.ok(m);
    assert.equal(m.match, 'abc1');
  });

  it('atomic group in search context', () => {
    const r = new Regex('(?>\\d+)\\.');
    const m = r.search('test 123.456');
    assert.ok(m);
    assert.equal(m.match, '123.');
  });

  it('nested atomic group', () => {
    const r = new Regex('(?>(?>a+)b)c');
    assert.equal(r.test('aabc'), true);
    assert.equal(r.test('abc'), true);
    assert.equal(r.test('ac'), false);
  });

  it('atomic group with quantifier', () => {
    // (?>ab){2} matches "abab"
    const r = new Regex('(?>ab){2}');
    assert.equal(r.test('abab'), true);
    assert.equal(r.test('ab'), false);
  });
});
