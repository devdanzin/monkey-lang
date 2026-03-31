import { describe, it } from 'node:test'; import assert from 'node:assert/strict';
import { Tokenizer, jsTokenizer } from '../src/index.js';
describe('Tokenizer', () => {
  it('basic', () => {
    const t = new Tokenizer().addRule('num', /\d+/, { transform: Number }).addRule('op', /[+\-*/]/).addRule('ws', /\s+/, { skip: true });
    const tokens = t.tokenize('1 + 2');
    assert.equal(tokens.length, 3);
    assert.equal(tokens[0].type, 'num');
    assert.equal(tokens[0].value, 1);
  });
  it('unknown char throws', () => { const t = new Tokenizer().addRule('a', /a/); assert.throws(() => t.tokenize('b'), /Unexpected/); });
});
describe('jsTokenizer', () => {
  it('tokenizes JS', () => {
    const tokens = jsTokenizer().tokenize('const x = 42;');
    assert.ok(tokens.some(t => t.type === 'keyword' && t.value === 'const'));
    assert.ok(tokens.some(t => t.type === 'number' && t.value === '42'));
  });
  it('handles strings', () => { const tokens = jsTokenizer().tokenize('"hello"'); assert.equal(tokens[0].type, 'string'); });
  it('skips comments', () => { const tokens = jsTokenizer().tokenize('// comment\n42'); assert.equal(tokens.length, 1); });
  it('skips whitespace', () => assert.ok(jsTokenizer().tokenize('  42  ').every(t => t.type !== 'whitespace')));
});
