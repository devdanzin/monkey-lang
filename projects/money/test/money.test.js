import { describe, it } from 'node:test'; import assert from 'node:assert/strict';
import { format, parse, add, subtract, split } from '../src/index.js';
describe('format', () => {
  it('USD', () => assert.equal(format(1234.56), '$1,234.56'));
  it('JPY', () => assert.equal(format(1234, 'JPY'), '¥1,234'));
  it('EUR', () => assert.equal(format(9.99, 'EUR'), '€9.99'));
  it('showCode', () => assert.ok(format(10, 'USD', { showCode: true }).includes('USD')));
});
describe('parse', () => { it('basic', () => assert.equal(parse('$1,234.56'), 1234.56)); });
describe('arithmetic', () => {
  it('add avoids float errors', () => assert.equal(add(0.1, 0.2), 0.30));
  it('subtract', () => assert.equal(subtract(1.0, 0.1), 0.90));
});
describe('split', () => {
  it('even split', () => { const s = split(10, 3); assert.equal(s.reduce((a, b) => add(a, b), 0), 10); assert.equal(s.length, 3); });
  it('no penny lost', () => { const s = split(100, 3); const total = s.reduce((a, b) => add(a, b), 0); assert.equal(total, 100); });
});
