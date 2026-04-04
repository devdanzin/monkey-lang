import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Rope } from '../src/index.js';

describe('Rope — basic', () => {
  it('creates from string', () => {
    const r = new Rope('hello');
    assert.equal(r.toString(), 'hello');
    assert.equal(r.length, 5);
  });

  it('empty rope', () => {
    const r = new Rope('');
    assert.equal(r.length, 0);
    assert.equal(r.toString(), '');
  });

  it('charAt', () => {
    const r = new Rope('hello');
    assert.equal(r.charAt(0), 'h');
    assert.equal(r.charAt(4), 'o');
    assert.equal(r.charAt(5), undefined);
  });
});

describe('Rope — concat', () => {
  it('concatenates ropes', () => {
    const a = new Rope('hello');
    const b = new Rope(' world');
    const c = a.concat(b);
    assert.equal(c.toString(), 'hello world');
    assert.equal(c.length, 11);
  });

  it('concatenates with string', () => {
    const r = new Rope('hello').concat(' world');
    assert.equal(r.toString(), 'hello world');
  });

  it('concat with empty', () => {
    const r = new Rope('hello');
    assert.equal(r.concat('').toString(), 'hello');
    assert.equal(new Rope('').concat(r).toString(), 'hello');
  });
});

describe('Rope — split', () => {
  it('splits at middle', () => {
    const [left, right] = new Rope('hello world').split(5);
    assert.equal(left.toString(), 'hello');
    assert.equal(right.toString(), ' world');
  });

  it('splits at start', () => {
    const [left, right] = new Rope('hello').split(0);
    assert.equal(left.toString(), '');
    assert.equal(right.toString(), 'hello');
  });

  it('splits at end', () => {
    const [left, right] = new Rope('hello').split(5);
    assert.equal(left.toString(), 'hello');
    assert.equal(right.toString(), '');
  });
});

describe('Rope — insert', () => {
  it('inserts at beginning', () => {
    const r = new Rope('world').insert(0, 'hello ');
    assert.equal(r.toString(), 'hello world');
  });

  it('inserts at end', () => {
    const r = new Rope('hello').insert(5, ' world');
    assert.equal(r.toString(), 'hello world');
  });

  it('inserts in middle', () => {
    const r = new Rope('helo').insert(2, 'l');
    assert.equal(r.toString(), 'hello');
  });
});

describe('Rope — delete', () => {
  it('deletes range', () => {
    const r = new Rope('hello world').delete(5, 11);
    assert.equal(r.toString(), 'hello');
  });

  it('deletes from beginning', () => {
    const r = new Rope('hello world').delete(0, 6);
    assert.equal(r.toString(), 'world');
  });

  it('deletes from middle', () => {
    const r = new Rope('abcde').delete(1, 4);
    assert.equal(r.toString(), 'ae');
  });
});

describe('Rope — substring', () => {
  it('extracts substring', () => {
    const r = new Rope('hello world');
    assert.equal(r.substring(0, 5), 'hello');
    assert.equal(r.substring(6, 11), 'world');
  });
});

describe('Rope — lines', () => {
  it('counts lines', () => {
    const r = new Rope('line1\nline2\nline3');
    assert.equal(r.lineCount(), 3);
  });

  it('returns lines array', () => {
    const r = new Rope('a\nb\nc');
    assert.deepEqual(r.lines(), ['a', 'b', 'c']);
  });
});

describe('Rope — large', () => {
  it('handles long strings', () => {
    const str = 'a'.repeat(10000);
    const r = new Rope(str);
    assert.equal(r.length, 10000);
    assert.equal(r.charAt(5000), 'a');
    assert.equal(r.toString().length, 10000);
  });

  it('multiple operations', () => {
    let r = new Rope('hello');
    r = r.insert(5, ' world');
    r = r.insert(11, '!');
    r = r.delete(0, 6);
    assert.equal(r.toString(), 'world!');
  });
});
