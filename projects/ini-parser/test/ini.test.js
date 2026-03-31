import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parse, stringify, get } from '../src/index.js';

const SAMPLE = `
; Database config
[database]
host = localhost
port = 5432
name = mydb
ssl = true

[server]
host = 0.0.0.0
port = 8080
workers = 4
`;

describe('parse', () => {
  it('sections and keys', () => {
    const ini = parse(SAMPLE);
    assert.equal(ini.database.host, 'localhost');
    assert.equal(ini.database.port, 5432);
    assert.equal(ini.database.ssl, true);
    assert.equal(ini.server.port, 8080);
  });
  it('ignores comments', () => { const ini = parse('; comment\n[s]\nk = v'); assert.equal(ini.s.k, 'v'); });
  it('hash comments', () => { const ini = parse('# comment\n[s]\nk = v'); assert.equal(ini.s.k, 'v'); });
  it('global keys', () => { const ini = parse('key = value'); assert.equal(ini.key, 'value'); });
  it('quoted values', () => { const ini = parse('[s]\nk = "hello world"'); assert.equal(ini.s.k, 'hello world'); });
  it('inline comments', () => { const ini = parse('[s]\nk = val ; comment'); assert.equal(ini.s.k, 'val'); });
  it('boolean false', () => { const ini = parse('[s]\nk = false'); assert.equal(ini.s.k, false); });
  it('float', () => { const ini = parse('[s]\nk = 3.14'); assert.equal(ini.s.k, 3.14); });
  it('empty value', () => { const ini = parse('[s]\nk = '); assert.equal(ini.s.k, ''); });
});

describe('stringify', () => {
  it('roundtrip', () => {
    const obj = { database: { host: 'localhost', port: 5432 }, server: { port: 8080 } };
    const str = stringify(obj);
    const parsed = parse(str);
    assert.equal(parsed.database.host, 'localhost');
    assert.equal(parsed.server.port, 8080);
  });
});

describe('get', () => {
  it('dot path', () => {
    const ini = parse(SAMPLE);
    assert.equal(get(ini, 'database.host'), 'localhost');
    assert.equal(get(ini, 'server.workers'), 4);
  });
  it('missing path', () => {
    const ini = parse(SAMPLE);
    assert.equal(get(ini, 'foo.bar'), undefined);
  });
});
