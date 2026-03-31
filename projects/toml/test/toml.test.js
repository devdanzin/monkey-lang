import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../src/index.js';

describe('basic values', () => {
  it('string', () => assert.equal(parse('key = "hello"').key, 'hello'));
  it('literal string', () => assert.equal(parse("key = 'hello'").key, 'hello'));
  it('integer', () => assert.equal(parse('key = 42').key, 42));
  it('float', () => assert.equal(parse('key = 3.14').key, 3.14));
  it('boolean', () => { assert.equal(parse('a = true').a, true); assert.equal(parse('b = false').b, false); });
  it('hex', () => assert.equal(parse('key = 0xFF').key, 255));
  it('array', () => assert.deepEqual(parse('key = [1, 2, 3]').key, [1, 2, 3]));
  it('inline table', () => assert.deepEqual(parse('key = {a = 1, b = "x"}').key, { a: 1, b: 'x' }));
});

describe('tables', () => {
  it('basic table', () => {
    const r = parse('[server]\nhost = "localhost"\nport = 8080');
    assert.equal(r.server.host, 'localhost');
    assert.equal(r.server.port, 8080);
  });
  it('nested table', () => {
    const r = parse('[a.b]\nc = 1');
    assert.equal(r.a.b.c, 1);
  });
});

describe('array of tables', () => {
  it('basic', () => {
    const r = parse('[[products]]\nname = "A"\n[[products]]\nname = "B"');
    assert.equal(r.products.length, 2);
    assert.equal(r.products[0].name, 'A');
    assert.equal(r.products[1].name, 'B');
  });
});

describe('comments', () => {
  it('ignores comments', () => { const r = parse('# comment\nkey = 1'); assert.equal(r.key, 1); });
  it('inline comments', () => { const r = parse('key = 1 # comment'); assert.equal(r.key, 1); });
});

describe('escapes', () => {
  it('newline', () => assert.equal(parse('key = "hello\\nworld"').key, 'hello\nworld'));
});
