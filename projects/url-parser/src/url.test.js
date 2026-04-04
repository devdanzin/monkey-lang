import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseUrl, buildUrl, parseSearchParams, resolveUrl, normalizePath, getDefaultPort, isDefaultPort } from './url.js';

describe('parseUrl', () => {
  it('full URL', () => {
    const u = parseUrl('https://user:pass@example.com:8080/path?q=1#frag');
    assert.equal(u.scheme, 'https');
    assert.equal(u.username, 'user');
    assert.equal(u.password, 'pass');
    assert.equal(u.host, 'example.com');
    assert.equal(u.port, 8080);
    assert.equal(u.path, '/path');
    assert.equal(u.query, 'q=1');
    assert.equal(u.fragment, 'frag');
  });
  it('simple URL', () => {
    const u = parseUrl('http://example.com');
    assert.equal(u.scheme, 'http');
    assert.equal(u.host, 'example.com');
    assert.equal(u.port, null);
  });
  it('path only', () => {
    const u = parseUrl('/foo/bar?x=1');
    assert.equal(u.path, '/foo/bar');
    assert.equal(u.query, 'x=1');
  });
  it('origin', () => {
    const u = parseUrl('https://example.com:443/path');
    assert.equal(u.origin, 'https://example.com:443');
  });
  it('href roundtrip', () => {
    const url = 'https://example.com/path?q=1#frag';
    assert.equal(parseUrl(url).href, url);
  });
});

describe('buildUrl', () => {
  it('builds from parts', () => {
    const url = buildUrl({ scheme: 'https', host: 'example.com', path: '/api', query: 'v=2' });
    assert.equal(url, 'https://example.com/api?v=2');
  });
  it('with auth', () => {
    const url = buildUrl({ scheme: 'ftp', username: 'user', password: 'pass', host: 'ftp.example.com', path: '/' });
    assert.ok(url.includes('user:pass@'));
  });
});

describe('SearchParams', () => {
  it('get', () => {
    const sp = parseSearchParams('a=1&b=2');
    assert.equal(sp.get('a'), '1');
    assert.equal(sp.get('b'), '2');
  });
  it('get missing', () => {
    const sp = parseSearchParams('a=1');
    assert.equal(sp.get('x'), null);
  });
  it('getAll (multiple values)', () => {
    const sp = parseSearchParams('a=1&a=2&a=3');
    assert.deepStrictEqual(sp.getAll('a'), ['1', '2', '3']);
  });
  it('has', () => {
    const sp = parseSearchParams('x=1');
    assert.ok(sp.has('x'));
    assert.ok(!sp.has('y'));
  });
  it('set and toString', () => {
    const sp = parseSearchParams('');
    sp.set('key', 'value');
    assert.equal(sp.toString(), 'key=value');
  });
  it('append', () => {
    const sp = parseSearchParams('a=1');
    sp.append('a', '2');
    assert.deepStrictEqual(sp.getAll('a'), ['1', '2']);
  });
  it('keys', () => {
    const sp = parseSearchParams('x=1&y=2');
    assert.deepStrictEqual(sp.keys(), ['x', 'y']);
  });
  it('encoded values', () => {
    const sp = parseSearchParams('q=hello%20world&name=caf%C3%A9');
    assert.equal(sp.get('q'), 'hello world');
    assert.equal(sp.get('name'), 'café');
  });
});

describe('resolveUrl', () => {
  it('absolute path', () => {
    assert.equal(resolveUrl('https://example.com/a/b', '/c/d'), 'https://example.com/c/d');
  });
  it('relative path', () => {
    assert.equal(resolveUrl('https://example.com/a/b', 'c'), 'https://example.com/a/c');
  });
  it('protocol relative', () => {
    assert.equal(resolveUrl('https://example.com', '//other.com/path'), 'https://other.com/path');
  });
  it('absolute URL passthrough', () => {
    assert.equal(resolveUrl('https://a.com', 'http://b.com/x'), 'http://b.com/x');
  });
});

describe('normalizePath', () => {
  it('removes dots', () => { assert.equal(normalizePath('/a/./b'), '/a/b'); });
  it('resolves dotdot', () => { assert.equal(normalizePath('/a/b/../c'), '/a/c'); });
});

describe('Default ports', () => {
  it('http', () => { assert.equal(getDefaultPort('http'), 80); });
  it('https', () => { assert.equal(getDefaultPort('https'), 443); });
  it('isDefault', () => { assert.ok(isDefaultPort('https', 443)); });
  it('not default', () => { assert.ok(!isDefaultPort('https', 8080)); });
});
