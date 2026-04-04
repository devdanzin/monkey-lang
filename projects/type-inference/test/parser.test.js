import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parse, typeOf, tokenize } from '../src/parser.js';

describe('Mini-ML tokenizer', () => {
  it('tokenizes integers', () => {
    const tokens = tokenize('42');
    assert.equal(tokens[0].type, 'int');
    assert.equal(tokens[0].value, 42);
  });

  it('tokenizes identifiers and keywords', () => {
    const tokens = tokenize('let x = 42 in x');
    assert.equal(tokens[0].type, 'kw');
    assert.equal(tokens[0].value, 'let');
    assert.equal(tokens[1].type, 'id');
    assert.equal(tokens[1].value, 'x');
  });

  it('tokenizes operators', () => {
    const tokens = tokenize('x + y == z');
    assert.equal(tokens[1].value, '+');
    assert.equal(tokens[3].value, '==');
  });

  it('tokenizes strings', () => {
    const tokens = tokenize('"hello"');
    assert.equal(tokens[0].type, 'string');
    assert.equal(tokens[0].value, 'hello');
  });
});

describe('Mini-ML parser', () => {
  it('parses integer literal', () => {
    const ast = parse('42');
    assert.equal(ast.tag, 'lit');
    assert.equal(ast.value, 42);
  });

  it('parses boolean literal', () => {
    assert.equal(parse('true').tag, 'lit');
    assert.equal(parse('false').value, false);
  });

  it('parses string literal', () => {
    const ast = parse('"hello"');
    assert.equal(ast.tag, 'lit');
    assert.equal(ast.value, 'hello');
  });

  it('parses variable', () => {
    const ast = parse('x');
    assert.equal(ast.tag, 'var');
    assert.equal(ast.name, 'x');
  });

  it('parses binary operators', () => {
    const ast = parse('1 + 2');
    assert.equal(ast.tag, 'binop');
    assert.equal(ast.op, '+');
  });

  it('parses operator precedence', () => {
    const ast = parse('1 + 2 * 3');
    assert.equal(ast.tag, 'binop');
    assert.equal(ast.op, '+');
    assert.equal(ast.right.op, '*');
  });

  it('parses comparison', () => {
    const ast = parse('x == y');
    assert.equal(ast.tag, 'binop');
    assert.equal(ast.op, '==');
  });

  it('parses lambda', () => {
    const ast = parse('fn x => x');
    assert.equal(ast.tag, 'lam');
    assert.equal(ast.param, 'x');
  });

  it('parses let', () => {
    const ast = parse('let x = 42 in x');
    assert.equal(ast.tag, 'let');
    assert.equal(ast.name, 'x');
  });

  it('parses let rec', () => {
    const ast = parse('let rec f = fn x => f x in f');
    assert.equal(ast.tag, 'letrec');
    assert.equal(ast.name, 'f');
  });

  it('parses if-then-else', () => {
    const ast = parse('if true then 1 else 2');
    assert.equal(ast.tag, 'if');
  });

  it('parses application', () => {
    const ast = parse('f x');
    assert.equal(ast.tag, 'app');
  });

  it('parses parenthesized expression', () => {
    const ast = parse('(1 + 2) * 3');
    assert.equal(ast.tag, 'binop');
    assert.equal(ast.op, '*');
  });

  it('parses nested lets', () => {
    const ast = parse('let x = 1 in let y = 2 in x + y');
    assert.equal(ast.tag, 'let');
    assert.equal(ast.body.tag, 'let');
  });

  it('parses match expression', () => {
    const ast = parse('match x with | 0 => true | _ => false');
    assert.equal(ast.tag, 'match');
    assert.equal(ast.cases.length, 2);
  });
});

describe('Mini-ML type inference via parser', () => {
  it('infers integer type', () => {
    assert.equal(typeOf('42').toString(), 'Int');
  });

  it('infers boolean type', () => {
    assert.equal(typeOf('true').toString(), 'Bool');
  });

  it('infers string type', () => {
    assert.equal(typeOf('"hello"').toString(), 'String');
  });

  it('infers arithmetic', () => {
    assert.equal(typeOf('1 + 2').toString(), 'Int');
  });

  it('infers comparison', () => {
    assert.equal(typeOf('1 < 2').toString(), 'Bool');
  });

  it('infers lambda', () => {
    const t = typeOf('fn x => x + 1');
    assert.equal(t.toString(), 'Int -> Int');
  });

  it('infers identity function', () => {
    const t = typeOf('fn x => x');
    assert.ok(t.toString().includes('->'));
  });

  it('infers let binding', () => {
    assert.equal(typeOf('let x = 42 in x + 1').toString(), 'Int');
  });

  it('infers let-polymorphism', () => {
    const t = typeOf('let id = fn x => x in id 42');
    assert.equal(t.toString(), 'Int');
  });

  it('infers if-then-else', () => {
    assert.equal(typeOf('if true then 1 else 2').toString(), 'Int');
  });

  it('infers application of identity', () => {
    assert.equal(typeOf('let id = fn x => x in id true').toString(), 'Bool');
  });

  it('infers recursive factorial', () => {
    const t = typeOf('let rec fact = fn n => if n == 0 then 1 else n * (fact (n - 1)) in fact');
    assert.equal(t.toString(), 'Int -> Int');
  });

  it('infers multi-arg function', () => {
    const t = typeOf('fn x => fn y => x + y');
    assert.equal(t.toString(), 'Int -> Int -> Int');
  });

  it('infers higher-order function', () => {
    const t = typeOf('let apply = fn f => fn x => f x in apply');
    assert.ok(t.toString().includes('->'));
  });

  it('infers match on integers', () => {
    const t = typeOf('match 42 with | 0 => true | _ => false');
    assert.equal(t.toString(), 'Bool');
  });

  it('detects type error: + on bool', () => {
    assert.throws(() => typeOf('true + 1'));
  });

  it('detects type error: if branches disagree', () => {
    assert.throws(() => typeOf('if true then 1 else false'));
  });

  it('detects unbound variable', () => {
    assert.throws(() => typeOf('undefined_var'));
  });
});
