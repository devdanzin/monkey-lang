import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { match, filter, isGlob } from './glob.js';

describe('Star (*)', () => {
  it('matches any', () => { assert.ok(match('*.js', 'foo.js')); });
  it('no match', () => { assert.ok(!match('*.js', 'foo.ts')); });
  it('trailing star', () => { assert.ok(match('foo*', 'foobar')); });
  it('middle star', () => { assert.ok(match('f*r', 'foobar')); });
});

describe('Globstar (**)', () => {
  it('matches deep paths', () => { assert.ok(match('**/*.js', 'src/lib/foo.js')); });
  it('matches root', () => { assert.ok(match('**/*.js', 'foo.js')); });
  it('prefix path', () => { assert.ok(match('src/**/*.js', 'src/a/b/c.js')); });
  it('no match', () => { assert.ok(!match('src/**/*.js', 'lib/foo.js')); });
});

describe('Question mark (?)', () => {
  it('matches single char', () => { assert.ok(match('?.js', 'a.js')); });
  it('no match empty', () => { assert.ok(!match('?.js', '.js')); });
  it('multiple ?', () => { assert.ok(match('???.txt', 'abc.txt')); });
});

describe('Character class []', () => {
  it('single chars', () => { assert.ok(match('[abc].txt', 'a.txt')); assert.ok(!match('[abc].txt', 'd.txt')); });
  it('range', () => { assert.ok(match('[a-z].txt', 'f.txt')); assert.ok(!match('[a-z].txt', 'F.txt')); });
  it('negation', () => { assert.ok(match('[!0-9].txt', 'a.txt')); assert.ok(!match('[!0-9].txt', '5.txt')); });
});

describe('Braces {}', () => {
  it('alternatives', () => { assert.ok(match('*.{js,ts}', 'foo.js')); assert.ok(match('*.{js,ts}', 'bar.ts')); assert.ok(!match('*.{js,ts}', 'baz.py')); });
  it('directory alternatives', () => { assert.ok(match('{src,lib}/*.js', 'src/foo.js')); assert.ok(match('{src,lib}/*.js', 'lib/bar.js')); });
});

describe('Negation (!)', () => {
  it('negate pattern', () => { assert.ok(!match('!*.js', 'foo.js')); assert.ok(match('!*.js', 'foo.ts')); });
});

describe('Dot files', () => {
  it('hidden by default', () => { assert.ok(!match('*', '.gitignore')); });
  it('matched with dot option', () => { assert.ok(match('*', '.gitignore', { dot: true })); });
  it('explicit dot matches', () => { assert.ok(match('.*', '.gitignore')); });
});

describe('Path matching', () => {
  it('exact path', () => { assert.ok(match('src/index.js', 'src/index.js')); });
  it('wildcard in path', () => { assert.ok(match('src/*.js', 'src/index.js')); });
});

describe('Filter', () => {
  it('filters list', () => {
    const files = ['foo.js', 'bar.ts', 'baz.js', 'qux.py'];
    assert.deepStrictEqual(filter('*.js', files), ['foo.js', 'baz.js']);
  });
});

describe('isGlob', () => {
  it('detects glob', () => { assert.ok(isGlob('*.js')); assert.ok(isGlob('foo?')); });
  it('not glob', () => { assert.ok(!isGlob('foo.js')); });
});
