import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parse, stringify, specificity } from '../src/index.js';

describe('parse', () => {
  it('simple rule', () => {
    const ast = parse('body { color: red; }');
    assert.equal(ast.rules.length, 1);
    assert.deepEqual(ast.rules[0].selectors, ['body']);
    assert.equal(ast.rules[0].declarations[0].property, 'color');
    assert.equal(ast.rules[0].declarations[0].value, 'red');
  });
  it('multiple selectors', () => {
    const ast = parse('h1, h2, h3 { font-weight: bold; }');
    assert.deepEqual(ast.rules[0].selectors, ['h1', 'h2', 'h3']);
  });
  it('multiple declarations', () => {
    const ast = parse('.box { width: 100px; height: 50px; color: blue; }');
    assert.equal(ast.rules[0].declarations.length, 3);
  });
  it('!important', () => {
    const ast = parse('p { color: red !important; }');
    assert.equal(ast.rules[0].declarations[0].important, true);
  });
  it('skips comments', () => {
    const ast = parse('/* comment */ body { color: red; }');
    assert.equal(ast.rules.length, 1);
  });
  it('at-rules', () => {
    const ast = parse('@media (max-width: 600px) { .box { display: none; } }');
    assert.equal(ast.rules[0].type, 'at-rule');
    assert.equal(ast.rules[0].name, 'media');
    assert.equal(ast.rules[0].rules.length, 1);
  });
  it('multiple rules', () => {
    const ast = parse('h1 { color: red; } p { color: blue; }');
    assert.equal(ast.rules.length, 2);
  });
});

describe('stringify', () => {
  it('roundtrips', () => {
    const css = 'body { color: red; }';
    const ast = parse(css);
    const output = stringify(ast);
    assert.ok(output.includes('color'));
    assert.ok(output.includes('red'));
  });
});

describe('specificity', () => {
  it('element', () => assert.deepEqual(specificity('div'), [0, 0, 1]));
  it('class', () => assert.deepEqual(specificity('.foo'), [0, 1, 0]));
  it('id', () => assert.deepEqual(specificity('#bar'), [1, 0, 0]));
  it('combined', () => assert.deepEqual(specificity('#main .item div'), [1, 1, 1]));
});
