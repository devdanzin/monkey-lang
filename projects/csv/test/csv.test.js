import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parse, parseRows, stringify } from '../src/index.js';

describe('parseRows', () => {
  it('basic', () => assert.deepEqual(parseRows('a,b,c\n1,2,3'), [['a','b','c'],['1','2','3']]));
  it('quoted fields', () => assert.deepEqual(parseRows('"hello, world",b'), [['hello, world', 'b']]));
  it('escaped quotes', () => assert.deepEqual(parseRows('"say ""hi""",b'), [['say "hi"', 'b']]));
  it('newline in quotes', () => assert.deepEqual(parseRows('"line1\nline2",b'), [['line1\nline2', 'b']]));
  it('CRLF', () => assert.deepEqual(parseRows('a,b\r\nc,d'), [['a','b'],['c','d']]));
  it('empty fields', () => assert.deepEqual(parseRows('a,,c'), [['a','','c']]));
});

describe('parse with header', () => {
  it('objects', () => {
    const result = parse('name,age\nAlice,30\nBob,25');
    assert.equal(result.length, 2);
    assert.equal(result[0].name, 'Alice');
    assert.equal(result[0].age, '30');
    assert.equal(result[1].name, 'Bob');
  });
  it('no header', () => {
    const result = parse('a,b\nc,d', { header: false });
    assert.deepEqual(result, [['a','b'],['c','d']]);
  });
});

describe('stringify', () => {
  it('from objects', () => {
    const csv = stringify([{ name: 'Alice', age: 30 }, { name: 'Bob', age: 25 }]);
    assert.ok(csv.includes('name,age'));
    assert.ok(csv.includes('Alice,30'));
  });
  it('escapes commas', () => {
    const csv = stringify([{ a: 'hello, world' }]);
    assert.ok(csv.includes('"hello, world"'));
  });
  it('escapes quotes', () => {
    const csv = stringify([{ a: 'say "hi"' }]);
    assert.ok(csv.includes('"say ""hi"""'));
  });
  it('from arrays', () => {
    const csv = stringify([['a','b'],['c','d']], { header: false });
    assert.equal(csv, 'a,b\nc,d');
  });
  it('roundtrip', () => {
    const data = [{ x: '1', y: '2' }, { x: '3', y: '4' }];
    const roundtripped = parse(stringify(data));
    assert.deepEqual(roundtripped, data);
  });
});
