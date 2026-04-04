import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parse, parseRows, stringify, CsvStream } from './csv.js';

describe('parseRows', () => {
  it('simple row', () => {
    assert.deepStrictEqual(parseRows('a,b,c'), [['a', 'b', 'c']]);
  });
  it('multiple rows', () => {
    assert.deepStrictEqual(parseRows('a,b\nc,d'), [['a', 'b'], ['c', 'd']]);
  });
  it('quoted fields', () => {
    assert.deepStrictEqual(parseRows('"hello, world",b'), [['hello, world', 'b']]);
  });
  it('escaped quotes', () => {
    assert.deepStrictEqual(parseRows('"say ""hi""",b'), [['say "hi"', 'b']]);
  });
  it('newlines in quotes', () => {
    assert.deepStrictEqual(parseRows('"line1\nline2",b'), [['line1\nline2', 'b']]);
  });
  it('CRLF', () => {
    assert.deepStrictEqual(parseRows('a,b\r\nc,d'), [['a', 'b'], ['c', 'd']]);
  });
  it('empty fields', () => {
    assert.deepStrictEqual(parseRows('a,,c'), [['a', '', 'c']]);
  });
  it('custom delimiter (tab)', () => {
    assert.deepStrictEqual(parseRows('a\tb\tc', '\t'), [['a', 'b', 'c']]);
  });
});

describe('parse (with header)', () => {
  it('returns objects', () => {
    const result = parse('name,age\nAlice,30\nBob,25');
    assert.equal(result.length, 2);
    assert.equal(result[0].name, 'Alice');
    assert.equal(result[0].age, 30); // type inferred
    assert.equal(result[1].name, 'Bob');
  });
  it('type inference', () => {
    const result = parse('val\ntrue\nfalse\nnull\n42\nhello');
    assert.equal(result[0].val, true);
    assert.equal(result[1].val, false);
    assert.equal(result[2].val, null);
    assert.equal(result[3].val, 42);
    assert.equal(result[4].val, 'hello');
  });
  it('without header', () => {
    const result = parse('a,b\nc,d', { header: false });
    assert.deepStrictEqual(result, [['a', 'b'], ['c', 'd']]);
  });
  it('disable type inference', () => {
    const result = parse('val\n42', { types: false });
    assert.equal(result[0].val, '42');
  });
});

describe('stringify', () => {
  it('array of objects', () => {
    const csv = stringify([{ name: 'Alice', age: 30 }, { name: 'Bob', age: 25 }]);
    assert.equal(csv, 'name,age\nAlice,30\nBob,25');
  });
  it('escapes fields with commas', () => {
    const csv = stringify([{ text: 'hello, world' }]);
    assert.ok(csv.includes('"hello, world"'));
  });
  it('escapes quotes', () => {
    const csv = stringify([{ text: 'say "hi"' }]);
    assert.ok(csv.includes('"say ""hi"""'));
  });
  it('array of arrays', () => {
    const csv = stringify([['a', 'b'], ['c', 'd']]);
    assert.equal(csv, 'a,b\nc,d');
  });
  it('custom columns', () => {
    const csv = stringify([{ a: 1, b: 2, c: 3 }], { columns: ['c', 'a'] });
    assert.equal(csv, 'c,a\n3,1');
  });
  it('without header', () => {
    const csv = stringify([{ a: 1 }], { header: false });
    assert.equal(csv, '1');
  });
});

describe('Roundtrip', () => {
  it('parse then stringify', () => {
    const data = [{ name: 'Alice', age: 30 }, { name: 'Bob', age: 25 }];
    const csv = stringify(data);
    const parsed = parse(csv);
    assert.deepStrictEqual(parsed, data);
  });
});

describe('CsvStream', () => {
  it('streaming parse', () => {
    const stream = new CsvStream();
    stream.write('name,age\n');
    stream.write('Alice,30\n');
    stream.write('Bob,');
    const rows = stream.end();
    assert.equal(rows.length, 2);
    assert.equal(rows[0].name, 'Alice');
    assert.equal(rows[1].name, 'Bob');
  });
  it('streaming without header', () => {
    const stream = new CsvStream({ header: false });
    stream.write('a,b\nc,d\n');
    const rows = stream.end();
    assert.deepStrictEqual(rows, [['a', 'b'], ['c', 'd']]);
  });
});
