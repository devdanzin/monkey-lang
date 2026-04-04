import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parse, stringify, tokenize, TokenType } from '../src/index.js';

describe('Tokenizer', () => {
  it('tokenizes string', () => {
    const tokens = tokenize('"hello"');
    assert.equal(tokens[0].type, TokenType.STRING);
    assert.equal(tokens[0].value, 'hello');
  });

  it('tokenizes number', () => {
    assert.equal(tokenize('42')[0].value, 42);
    assert.equal(tokenize('-3.14')[0].value, -3.14);
    assert.equal(tokenize('1e10')[0].value, 1e10);
  });

  it('tokenizes keywords', () => {
    assert.equal(tokenize('true')[0].value, true);
    assert.equal(tokenize('false')[0].value, false);
    assert.equal(tokenize('null')[0].value, null);
  });

  it('tokenizes structural chars', () => {
    const tokens = tokenize('{}[],: ');
    assert.equal(tokens[0].type, TokenType.LBRACE);
    assert.equal(tokens[1].type, TokenType.RBRACE);
    assert.equal(tokens[2].type, TokenType.LBRACKET);
    assert.equal(tokens[3].type, TokenType.RBRACKET);
  });

  it('handles escape sequences', () => {
    const tokens = tokenize('"hello\\nworld"');
    assert.equal(tokens[0].value, 'hello\nworld');
  });

  it('handles unicode escapes', () => {
    const tokens = tokenize('"\\u0041"');
    assert.equal(tokens[0].value, 'A');
  });

  it('throws on invalid input', () => {
    assert.throws(() => tokenize('@'));
  });
});

describe('Parser — primitives', () => {
  it('parses string', () => assert.equal(parse('"hello"'), 'hello'));
  it('parses number', () => assert.equal(parse('42'), 42));
  it('parses float', () => assert.equal(parse('3.14'), 3.14));
  it('parses negative', () => assert.equal(parse('-1'), -1));
  it('parses true', () => assert.equal(parse('true'), true));
  it('parses false', () => assert.equal(parse('false'), false));
  it('parses null', () => assert.equal(parse('null'), null));
});

describe('Parser — arrays', () => {
  it('empty array', () => assert.deepEqual(parse('[]'), []));
  it('number array', () => assert.deepEqual(parse('[1, 2, 3]'), [1, 2, 3]));
  it('mixed array', () => assert.deepEqual(parse('[1, "two", true, null]'), [1, 'two', true, null]));
  it('nested array', () => assert.deepEqual(parse('[[1, 2], [3, 4]]'), [[1, 2], [3, 4]]));
});

describe('Parser — objects', () => {
  it('empty object', () => assert.deepEqual(parse('{}'), {}));
  it('simple object', () => assert.deepEqual(parse('{"a": 1, "b": 2}'), { a: 1, b: 2 }));
  it('nested object', () => {
    assert.deepEqual(parse('{"x": {"y": 1}}'), { x: { y: 1 } });
  });
  it('object with array', () => {
    assert.deepEqual(parse('{"items": [1, 2]}'), { items: [1, 2] });
  });
});

describe('Parser — complex', () => {
  it('parses complex JSON', () => {
    const input = `{
      "name": "Henry",
      "age": 30,
      "active": true,
      "address": null,
      "tags": ["ai", "code"],
      "nested": { "x": 1 }
    }`;
    const result = parse(input);
    assert.equal(result.name, 'Henry');
    assert.equal(result.age, 30);
    assert.equal(result.active, true);
    assert.equal(result.address, null);
    assert.deepEqual(result.tags, ['ai', 'code']);
    assert.deepEqual(result.nested, { x: 1 });
  });
});

describe('Parser — errors', () => {
  it('throws on trailing comma', () => {
    assert.throws(() => parse('[1, 2,]'));
  });
  it('throws on invalid JSON', () => {
    assert.throws(() => parse('{foo: 1}'));
  });
});

describe('Stringify — primitives', () => {
  it('null', () => assert.equal(stringify(null), 'null'));
  it('true', () => assert.equal(stringify(true), 'true'));
  it('false', () => assert.equal(stringify(false), 'false'));
  it('number', () => assert.equal(stringify(42), '42'));
  it('string', () => assert.equal(stringify('hello'), '"hello"'));
  it('escapes', () => assert.equal(stringify('a"b\\c\n'), '"a\\"b\\\\c\\n"'));
  it('Infinity → null', () => assert.equal(stringify(Infinity), 'null'));
});

describe('Stringify — complex', () => {
  it('array', () => assert.equal(stringify([1, 2, 3]), '[1,2,3]'));
  it('object', () => assert.equal(stringify({ a: 1 }), '{"a":1}'));
  it('nested', () => assert.equal(stringify({ a: [1, { b: 2 }] }), '{"a":[1,{"b":2}]}'));
  it('skips undefined', () => assert.equal(stringify({ a: 1, b: undefined }), '{"a":1}'));
  it('skips functions', () => assert.equal(stringify({ a: 1, b: () => {} }), '{"a":1}'));
});

describe('Stringify — pretty', () => {
  it('indents with spaces', () => {
    const result = stringify({ a: 1, b: [2, 3] }, 2);
    assert.ok(result.includes('\n'));
    assert.ok(result.includes('  '));
  });
});

describe('Round-trip', () => {
  it('parse(stringify(x)) === x', () => {
    const data = { name: 'test', nums: [1, 2, 3], nested: { a: true, b: null } };
    assert.deepEqual(parse(stringify(data)), data);
  });

  it('matches JSON.parse/stringify', () => {
    const data = [1, 'two', true, null, { x: [3.14] }];
    assert.deepEqual(parse(JSON.stringify(data)), data);
    assert.deepEqual(JSON.parse(stringify(data)), data);
  });
});
