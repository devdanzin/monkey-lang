import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { match, globToRegex, filter } from '../src/index.js';

describe('match', () => {
  it('exact', () => assert.equal(match('hello', 'hello'), true));
  it('* wildcard', () => assert.equal(match('*.js', 'app.js'), true));
  it('* no path sep', () => assert.equal(match('*.js', 'src/app.js'), false));
  it('?', () => assert.equal(match('?.txt', 'a.txt'), true));
  it('? no match', () => assert.equal(match('?.txt', 'ab.txt'), false));
  it('** globstar', () => assert.equal(match('**/*.js', 'src/lib/app.js'), true));
  it('** deep', () => assert.equal(match('src/**', 'src/a/b/c'), true));
  it('[abc]', () => assert.equal(match('[abc].txt', 'b.txt'), true));
  it('[!abc]', () => assert.equal(match('[!abc].txt', 'd.txt'), true));
  it('[a-z]', () => assert.equal(match('[a-z].txt', 'x.txt'), true));
  it('dotfile hidden', () => assert.equal(match('*', '.hidden'), false));
  it('dotfile explicit', () => assert.equal(match('.hidden', '.hidden'), true));
  it('dotfile opt-in', () => assert.equal(match('*', '.hidden', { dot: true }), true));
  it('case insensitive', () => assert.equal(match('*.JS', 'app.js', { caseSensitive: false }), true));
  it('backslash escape', () => assert.equal(match('hello\\*', 'hello*'), true));
});

describe('globToRegex', () => {
  it('converts', () => {
    const re = globToRegex('*.js');
    assert.ok(re.test('app.js'));
    assert.ok(!re.test('src/app.js'));
  });
});

describe('filter', () => {
  it('filters list', () => {
    const files = ['a.js', 'b.ts', 'c.js', 'd.css'];
    assert.deepEqual(filter('*.js', files), ['a.js', 'c.js']);
  });
});
