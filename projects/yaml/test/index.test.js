const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parse, stringify } = require('../src/index.js');

test('scalars', () => {
  assert.equal(parse('42'), 42);
  assert.equal(parse('3.14'), 3.14);
  assert.equal(parse('true'), true);
  assert.equal(parse('false'), false);
  assert.equal(parse('null'), null);
  assert.equal(parse('~'), null);
  assert.equal(parse('hello'), 'hello');
});

test('quoted strings', () => {
  assert.equal(parse('"hello world"'), 'hello world');
  assert.equal(parse("'single quotes'"), 'single quotes');
  assert.equal(parse('"escaped\\nnewline"'), 'escaped\nnewline');
});

test('simple mapping', () => {
  const result = parse('name: Alice\nage: 30');
  assert.deepEqual(result, { name: 'Alice', age: 30 });
});

test('nested mapping', () => {
  const result = parse('person:\n  name: Bob\n  age: 25');
  assert.deepEqual(result, { person: { name: 'Bob', age: 25 } });
});

test('simple sequence', () => {
  const result = parse('- apple\n- banana\n- cherry');
  assert.deepEqual(result, ['apple', 'banana', 'cherry']);
});

test('sequence of numbers', () => {
  const result = parse('- 1\n- 2\n- 3');
  assert.deepEqual(result, [1, 2, 3]);
});

test('mapping with sequence', () => {
  const result = parse('fruits:\n  - apple\n  - banana');
  assert.deepEqual(result, { fruits: ['apple', 'banana'] });
});

test('sequence of mappings', () => {
  const yaml = `- name: Alice
  age: 30
- name: Bob
  age: 25`;
  const result = parse(yaml);
  assert.equal(result.length, 2);
  assert.equal(result[0].name, 'Alice');
  assert.equal(result[1].age, 25);
});

test('comments', () => {
  const result = parse('name: Alice # comment\n# full line comment\nage: 30');
  assert.deepEqual(result, { name: 'Alice', age: 30 });
});

test('flow sequence', () => {
  const result = parse('items: [1, 2, 3]');
  assert.deepEqual(result, { items: [1, 2, 3] });
});

test('flow mapping', () => {
  const result = parse('point: {x: 1, y: 2}');
  assert.deepEqual(result, { point: { x: 1, y: 2 } });
});

test('document marker', () => {
  const result = parse('---\nname: test');
  assert.deepEqual(result, { name: 'test' });
});

test('hex and octal', () => {
  assert.equal(parse('0xff'), 255);
  assert.equal(parse('0o77'), 63);
});

test('stringify simple', () => {
  const yaml = stringify({ name: 'Alice', age: 30 });
  assert.ok(yaml.includes('name: Alice'));
  assert.ok(yaml.includes('age: 30'));
});

test('stringify array', () => {
  const yaml = stringify(['a', 'b', 'c']);
  assert.ok(yaml.includes('- a'));
  assert.ok(yaml.includes('- b'));
});

test('stringify nested', () => {
  const yaml = stringify({ person: { name: 'Bob' } });
  assert.ok(yaml.includes('person:'));
  assert.ok(yaml.includes('  name: Bob'));
});

test('roundtrip', () => {
  const original = { name: 'Alice', age: 30, active: true };
  const yaml = stringify(original);
  const parsed = parse(yaml);
  assert.deepEqual(parsed, original);
});
