const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createParser, tokenize } = require('../src/index.js');

function parse(src) {
  const parser = createParser();
  return parser.parse(tokenize(src));
}

test('number literal', () => {
  assert.deepEqual(parse('42'), { type: 'number', value: 42 });
});

test('binary operators', () => {
  const ast = parse('1 + 2');
  assert.equal(ast.type, 'infix');
  assert.equal(ast.op, '+');
});

test('precedence: * before +', () => {
  const ast = parse('1 + 2 * 3');
  assert.equal(ast.op, '+');
  assert.equal(ast.right.op, '*');
});

test('grouping', () => {
  const ast = parse('(1 + 2) * 3');
  assert.equal(ast.op, '*');
  assert.equal(ast.left.op, '+');
});

test('prefix operator', () => {
  const ast = parse('-5');
  assert.equal(ast.type, 'prefix');
  assert.equal(ast.op, '-');
});

test('right-associative: **', () => {
  const ast = parse('2 ** 3 ** 4');
  assert.equal(ast.op, '**');
  assert.equal(ast.right.op, '**');
});

test('comparison chain', () => {
  const ast = parse('a == b && c != d');
  assert.equal(ast.op, '&&');
});

test('function call', () => {
  const ast = parse('foo(1, 2)');
  assert.equal(ast.type, 'call');
  assert.equal(ast.callee.name, 'foo');
  assert.equal(ast.args.length, 2);
});

test('member access', () => {
  const ast = parse('a.b');
  assert.equal(ast.type, 'member');
  assert.equal(ast.property, 'b');
});

test('index access', () => {
  const ast = parse('a[0]');
  assert.equal(ast.type, 'index');
});

test('ternary', () => {
  const ast = parse('x ? 1 : 2');
  assert.equal(ast.type, 'ternary');
});

test('complex expression', () => {
  const ast = parse('a + b * c - d / e');
  assert.ok(ast); // Just check it parses
});
