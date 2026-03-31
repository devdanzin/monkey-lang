import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { join, normalize, dirname, basename, extname, isAbsolute, relative, resolve, parse, format } from '../src/index.js';

describe('join', () => {
  it('basic', () => assert.equal(join('a', 'b', 'c'), 'a/b/c'));
  it('with dots', () => assert.equal(join('a', '.', 'b', '..', 'c'), 'a/c'));
  it('absolute', () => assert.equal(join('/a', 'b'), '/a/b'));
});
describe('normalize', () => {
  it('removes dots', () => assert.equal(normalize('/a/b/../c/./d'), '/a/c/d'));
  it('empty', () => assert.equal(normalize(''), '.'));
});
describe('dirname', () => { it('basic', () => assert.equal(dirname('/a/b/c'), '/a/b')); it('root', () => assert.equal(dirname('/a'), '/')); });
describe('basename', () => { it('basic', () => assert.equal(basename('/a/b/c.js'), 'c.js')); it('with ext', () => assert.equal(basename('/a/c.js', '.js'), 'c')); });
describe('extname', () => { it('basic', () => assert.equal(extname('file.txt'), '.txt')); it('no ext', () => assert.equal(extname('file'), '')); it('dotfile', () => assert.equal(extname('.gitignore'), '')); });
describe('isAbsolute', () => { it('yes', () => assert.ok(isAbsolute('/a'))); it('no', () => assert.ok(!isAbsolute('a'))); });
describe('relative', () => { it('basic', () => assert.equal(relative('/a/b', '/a/c'), '../c')); it('same', () => assert.equal(relative('/a', '/a'), '.')); });
describe('resolve', () => { it('absolute wins', () => assert.equal(resolve('/a', '/b', 'c'), '/b/c')); });
describe('parse/format', () => {
  it('roundtrip', () => { const p = parse('/a/b/c.txt'); assert.equal(p.dir, '/a/b'); assert.equal(p.base, 'c.txt'); assert.equal(p.ext, '.txt'); assert.equal(p.name, 'c'); });
});
