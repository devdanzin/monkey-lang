import { describe, it } from 'node:test'; import assert from 'node:assert/strict';
import { parse } from '../src/index.js';
describe('parse', () => {
  it('long flags', () => assert.equal(parse(['--name', 'henry']).name, 'henry'));
  it('long = syntax', () => assert.equal(parse(['--name=henry']).name, 'henry'));
  it('short flags', () => assert.equal(parse(['-n', 'henry']).n, 'henry'));
  it('boolean', () => assert.equal(parse(['--verbose'], { boolean: ['verbose'] }).verbose, true));
  it('numbers', () => assert.equal(parse(['--port', '3000']).port, 3000));
  it('positional', () => assert.deepEqual(parse(['file.js', '--out', 'dist'])._, ['file.js']));
  it('-- separator', () => assert.deepEqual(parse(['--', '-a', '-b'])._, ['-a', '-b']));
  it('combined short', () => { const r = parse(['-abc'], { boolean: ['a', 'b', 'c'] }); assert.ok(r.a && r.b && r.c); });
  it('alias', () => assert.equal(parse(['-v'], { alias: { verbose: 'v' }, boolean: ['verbose'] }).verbose, true));
  it('defaults', () => assert.equal(parse([], { default: { port: 8080 } }).port, 8080));
});
