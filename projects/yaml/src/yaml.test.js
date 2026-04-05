import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parse, stringify } from './yaml.js';

describe('Scalars', () => {
  it('string', () => { assert.equal(parse('hello'), 'hello'); });
  it('number', () => { assert.equal(parse('42'), 42); });
  it('float', () => { assert.equal(parse('3.14'), 3.14); });
  it('true', () => { assert.equal(parse('true'), true); });
  it('false', () => { assert.equal(parse('false'), false); });
  it('null', () => { assert.equal(parse('null'), null); });
  it('tilde null', () => { assert.equal(parse('~'), null); });
  it('quoted string', () => { assert.equal(parse('"hello"'), 'hello'); });
});

describe('Block Mapping', () => {
  it('simple', () => {
    const r = parse('name: Alice\nage: 30');
    assert.equal(r.name, 'Alice');
    assert.equal(r.age, 30);
  });
  it('nested', () => {
    const r = parse('person:\n  name: Bob\n  age: 25');
    assert.equal(r.person.name, 'Bob');
    assert.equal(r.person.age, 25);
  });
  it('deep nested', () => {
    const r = parse('a:\n  b:\n    c: 42');
    assert.equal(r.a.b.c, 42);
  });
});

describe('Block Sequence', () => {
  it('simple', () => {
    const r = parse('- 1\n- 2\n- 3');
    assert.deepStrictEqual(r, [1, 2, 3]);
  });
  it('strings', () => {
    const r = parse('- apple\n- banana\n- cherry');
    assert.deepStrictEqual(r, ['apple', 'banana', 'cherry']);
  });
  it('sequence in mapping', () => {
    const r = parse('fruits:\n  - apple\n  - banana');
    assert.deepStrictEqual(r.fruits, ['apple', 'banana']);
  });
});

describe('Flow', () => {
  it('flow sequence', () => {
    const r = parse('[1, 2, 3]');
    assert.deepStrictEqual(r, [1, 2, 3]);
  });
  it('flow mapping', () => {
    const r = parse('{name: Alice, age: 30}');
    assert.equal(r.name, 'Alice');
    assert.equal(r.age, 30);
  });
});

describe('Comments', () => {
  it('full line comment', () => {
    const r = parse('# comment\nkey: value');
    assert.equal(r.key, 'value');
  });
  it('inline comment', () => {
    const r = parse('key: value # comment');
    assert.equal(r.key, 'value');
  });
});

describe('Multiline', () => {
  it('literal block |', () => {
    const r = parse('text: |\n  line 1\n  line 2');
    assert.ok(r.text.includes('line 1'));
    assert.ok(r.text.includes('line 2'));
  });
  it('folded block >', () => {
    const r = parse('text: >\n  hello\n  world');
    assert.ok(r.text.includes('hello'));
    assert.ok(r.text.includes('world'));
    assert.ok(!r.text.includes('\n'));
  });
});

describe('Stringify', () => {
  it('simple object', () => {
    const s = stringify({ name: 'Alice', age: 30 });
    assert.ok(s.includes('name: Alice'));
    assert.ok(s.includes('age: 30'));
  });
  it('array', () => {
    const s = stringify([1, 2, 3]);
    assert.ok(s.includes('- 1'));
  });
  it('nested', () => {
    const s = stringify({ person: { name: 'Bob' } });
    assert.ok(s.includes('person:'));
    assert.ok(s.includes('name: Bob'));
  });
  it('null', () => { assert.equal(stringify(null), 'null'); });
  it('bool', () => { assert.equal(stringify(true), 'true'); });
});
