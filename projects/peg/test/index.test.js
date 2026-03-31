const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  PEG, lit, regex, seq, seqAction, choice, many, many1,
  optional, lookahead, notFollowedBy, ref, action, token, keyword,
} = require('../src/index.js');

test('literal', () => {
  const peg = new PEG();
  peg.rule('main', lit('hello'));
  assert.equal(peg.parse('hello'), 'hello');
});

test('regex', () => {
  const peg = new PEG();
  peg.rule('main', regex(/[0-9]+/));
  assert.equal(peg.parse('12345'), '12345');
});

test('sequence', () => {
  const peg = new PEG();
  peg.rule('main', seq(lit('a'), lit('b'), lit('c')));
  assert.deepEqual(peg.parse('abc'), ['a', 'b', 'c']);
});

test('choice', () => {
  const peg = new PEG();
  peg.rule('main', choice(lit('cat'), lit('dog')));
  assert.equal(peg.parse('cat'), 'cat');
  assert.equal(peg.parse('dog'), 'dog');
});

test('many (zero or more)', () => {
  const peg = new PEG();
  peg.rule('main', many(lit('a')));
  assert.deepEqual(peg.parse('aaa'), ['a', 'a', 'a']);
  assert.deepEqual(peg.parse(''), []);
});

test('many1 (one or more)', () => {
  const peg = new PEG();
  peg.rule('main', many1(lit('x')));
  assert.deepEqual(peg.parse('xxx'), ['x', 'x', 'x']);
  assert.throws(() => peg.parse(''), /Parse failed/);
});

test('optional', () => {
  const peg = new PEG();
  peg.rule('main', seq(lit('a'), optional(lit('b'))));
  assert.deepEqual(peg.parse('ab'), ['a', 'b']);
  assert.deepEqual(peg.parse('a'), ['a', null]);
});

test('action/transform', () => {
  const peg = new PEG();
  peg.rule('main', action(regex(/[0-9]+/), v => parseInt(v, 10)));
  assert.equal(peg.parse('42'), 42);
});

test('seqAction', () => {
  const peg = new PEG();
  peg.rule('main', seqAction((a, _, b) => a + b, regex(/\d+/), lit('+'), regex(/\d+/)));
  assert.equal(peg.parse('3+4'), '34'); // string concat since no parseInt
});

test('rule reference', () => {
  const peg = new PEG();
  peg.rule('main', seq(ref('word'), lit(' '), ref('word')));
  peg.rule('word', regex(/[a-z]+/));
  assert.deepEqual(peg.parse('hello world'), ['hello', ' ', 'world']);
});

test('lookahead', () => {
  const peg = new PEG();
  peg.rule('main', seq(lookahead(lit('a')), regex(/[a-z]+/)));
  assert.deepEqual(peg.parse('abc'), ['', 'abc']);
  assert.throws(() => peg.parse('xyz'));
});

test('negative lookahead', () => {
  const peg = new PEG();
  peg.rule('main', seq(notFollowedBy(lit('if')), regex(/[a-z]+/)));
  assert.deepEqual(peg.parse('foo'), ['', 'foo']);
  assert.throws(() => peg.parse('if'));
});

test('calculator', () => {
  const peg = new PEG();
  peg.rule('expr', action(
    seq(ref('num'), many(seq(regex(/[+\-]/), ref('num')))),
    v => {
      let [first, rest] = v;
      let result = first;
      for (const [op, num] of rest) {
        result = op === '+' ? result + num : result - num;
      }
      return result;
    }
  ));
  peg.rule('num', action(regex(/\d+/), v => parseInt(v, 10)));
  assert.equal(peg.parse('3+4-1', 'expr'), 6);
});
