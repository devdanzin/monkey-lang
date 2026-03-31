const { test: t } = require('node:test');
const assert = require('node:assert/strict');
const { test: testRegex, search, compile, match } = require('../src/index.js');

t('literal match', () => {
  assert.ok(testRegex('hello', 'hello'));
  assert.ok(!testRegex('hello', 'world'));
});

t('concatenation', () => {
  assert.ok(testRegex('abc', 'abc'));
  assert.ok(!testRegex('abc', 'ab'));
});

t('alternation', () => {
  assert.ok(testRegex('cat|dog', 'cat'));
  assert.ok(testRegex('cat|dog', 'dog'));
  assert.ok(!testRegex('cat|dog', 'bird'));
});

t('star (zero or more)', () => {
  assert.ok(testRegex('a*', ''));
  assert.ok(testRegex('a*', 'aaa'));
  assert.ok(testRegex('ab*c', 'ac'));
  assert.ok(testRegex('ab*c', 'abbc'));
});

t('plus (one or more)', () => {
  assert.ok(!testRegex('a+', ''));
  assert.ok(testRegex('a+', 'a'));
  assert.ok(testRegex('a+', 'aaa'));
});

t('optional', () => {
  assert.ok(testRegex('colou?r', 'color'));
  assert.ok(testRegex('colou?r', 'colour'));
});

t('dot (any char)', () => {
  assert.ok(testRegex('a.c', 'abc'));
  assert.ok(testRegex('a.c', 'axc'));
  assert.ok(!testRegex('a.c', 'ac'));
});

t('character class', () => {
  assert.ok(testRegex('[abc]', 'a'));
  assert.ok(testRegex('[abc]', 'b'));
  assert.ok(!testRegex('[abc]', 'd'));
});

t('character range', () => {
  assert.ok(testRegex('[a-z]', 'x'));
  assert.ok(!testRegex('[a-z]', 'X'));
});

t('grouping', () => {
  assert.ok(testRegex('(ab)+', 'abab'));
  assert.ok(!testRegex('(ab)+', 'aab'));
});

t('complex pattern', () => {
  assert.ok(testRegex('(a|b)*c', 'ababc'));
  assert.ok(testRegex('(a|b)*c', 'c'));
  assert.ok(!testRegex('(a|b)*c', 'abd'));
});

t('search', () => {
  const result = search('fox', 'the quick brown fox');
  assert.ok(result);
  assert.equal(result.match, 'fox');
  assert.equal(result.index, 16);
});

t('escape sequences', () => {
  assert.ok(testRegex('\\d+', '123'));
  assert.ok(!testRegex('\\d+', 'abc'));
});
