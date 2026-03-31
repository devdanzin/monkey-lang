import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parse, format, parseQuery, formatQuery, resolve } from '../src/index.js';

describe('parse', () => {
  it('full URL', () => {
    const u = parse('https://user:pass@example.com:8080/path?q=1#frag');
    assert.equal(u.protocol, 'https');
    assert.equal(u.username, 'user');
    assert.equal(u.password, 'pass');
    assert.equal(u.hostname, 'example.com');
    assert.equal(u.port, 8080);
    assert.equal(u.pathname, '/path');
    assert.equal(u.search, 'q=1');
    assert.equal(u.hash, 'frag');
  });
  it('simple URL', () => {
    const u = parse('http://example.com/');
    assert.equal(u.hostname, 'example.com');
    assert.equal(u.port, null);
  });
  it('origin', () => assert.equal(parse('https://x.com:443/p').origin, 'https://x.com:443'));
  it('host', () => assert.equal(parse('http://a.com:3000/').host, 'a.com:3000'));
});

describe('format', () => {
  it('roundtrip', () => {
    const url = 'https://example.com:8080/path';
    assert.equal(format(parse(url)), url);
  });
});

describe('parseQuery', () => {
  it('basic', () => assert.deepEqual(parseQuery('a=1&b=2'), { a: '1', b: '2' }));
  it('duplicate keys', () => { const q = parseQuery('a=1&a=2'); assert.deepEqual(q.a, ['1', '2']); });
  it('encoded', () => assert.equal(parseQuery('name=hello%20world').name, 'hello world'));
});

describe('formatQuery', () => {
  it('basic', () => assert.equal(formatQuery({ a: '1', b: '2' }), 'a=1&b=2'));
  it('arrays', () => assert.equal(formatQuery({ a: ['1', '2'] }), 'a=1&a=2'));
});

describe('resolve', () => {
  it('absolute stays', () => assert.equal(resolve('http://a.com/', 'http://b.com/'), 'http://b.com/'));
  it('root relative', () => assert.equal(resolve('http://a.com/x/y', '/z'), 'http://a.com/z'));
  it('relative path', () => {
    const r = resolve('http://a.com/x/y', 'z');
    assert.equal(r, 'http://a.com/x/z');
  });
});
