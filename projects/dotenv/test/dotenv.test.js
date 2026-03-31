import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parse, stringify } from '../src/index.js';

describe('parse', () => {
  it('basic', () => assert.deepEqual(parse('KEY=value'), { KEY: 'value' }));
  it('comments', () => assert.deepEqual(parse('# comment\nKEY=value'), { KEY: 'value' }));
  it('empty lines', () => assert.deepEqual(parse('\n\nKEY=value\n\n'), { KEY: 'value' }));
  it('double quotes', () => assert.equal(parse('KEY="hello world"').KEY, 'hello world'));
  it('single quotes', () => assert.equal(parse("KEY='hello'").KEY, 'hello'));
  it('escape newline', () => assert.equal(parse('KEY="line1\\nline2"').KEY, 'line1\nline2'));
  it('export prefix', () => assert.equal(parse('export KEY=value').KEY, 'value'));
  it('variable expansion', () => {
    const env = parse('A=hello\nB=${A} world');
    assert.equal(env.B, 'hello world');
  });
  it('multiple vars', () => {
    const env = parse('HOST=localhost\nPORT=3000\nURL=http://$HOST:$PORT');
    assert.equal(env.URL, 'http://localhost:3000');
  });
});

describe('stringify', () => {
  it('basic', () => assert.equal(stringify({ KEY: 'value' }), 'KEY=value'));
  it('quotes spaces', () => assert.ok(stringify({ KEY: 'hello world' }).includes('"')));
  it('roundtrip', () => {
    const env = { A: 'hello', B: '123' };
    assert.deepEqual(parse(stringify(env)), env);
  });
});
