// Parser tests
import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import * as ast from './ast.js';
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

function parse(input) {
  const l = new Lexer(input);
  const p = new Parser(l);
  const program = p.parseProgram();
  if (p.errors.length > 0) {
    throw new Error(`Parser errors:\n${p.errors.join('\n')}`);
  }
  return program;
}

describe('Parser', () => {
  it('parses let statements', () => {
    const tests = [
      ['let x = 5;', 'x', 5],
      ['let y = true;', 'y', true],
      ['let foobar = y;', 'foobar', 'y'],
    ];
    for (const [input, name, value] of tests) {
      const p = parse(input);
      assert.equal(p.statements.length, 1);
      const stmt = p.statements[0];
      assert.equal(stmt.name.value, name);
      checkLiteralExpression(stmt.value, value);
    }
  });

  it('parses return statements', () => {
    const p = parse('return 5; return 10; return add(15);');
    assert.equal(p.statements.length, 3);
    for (const stmt of p.statements) {
      assert.equal(stmt.tokenLiteral(), 'return');
    }
  });

  it('parses identifier expression', () => {
    const p = parse('foobar;');
    assert.equal(p.statements.length, 1);
    const expr = p.statements[0].expression;
    assert.equal(expr.value, 'foobar');
  });

  it('parses integer literal', () => {
    const p = parse('5;');
    const expr = p.statements[0].expression;
    assert.equal(expr.value, 5);
  });

  it('parses string literal', () => {
    const p = parse('"hello world";');
    const expr = p.statements[0].expression;
    assert.equal(expr.value, 'hello world');
  });

  it('parses boolean literals', () => {
    const p = parse('true; false;');
    assert.equal(p.statements[0].expression.value, true);
    assert.equal(p.statements[1].expression.value, false);
  });

  it('parses prefix expressions', () => {
    const tests = [
      ['!5;', '!', 5],
      ['-15;', '-', 15],
      ['!true;', '!', true],
    ];
    for (const [input, op, val] of tests) {
      const expr = parse(input).statements[0].expression;
      assert.equal(expr.operator, op);
      checkLiteralExpression(expr.right, val);
    }
  });

  it('parses infix expressions', () => {
    const tests = [
      ['5 + 5;', 5, '+', 5],
      ['5 - 5;', 5, '-', 5],
      ['5 * 5;', 5, '*', 5],
      ['5 / 5;', 5, '/', 5],
      ['5 > 5;', 5, '>', 5],
      ['5 < 5;', 5, '<', 5],
      ['5 == 5;', 5, '==', 5],
      ['5 != 5;', 5, '!=', 5],
      ['true == true;', true, '==', true],
    ];
    for (const [input, left, op, right] of tests) {
      const expr = parse(input).statements[0].expression;
      checkLiteralExpression(expr.left, left);
      assert.equal(expr.operator, op);
      checkLiteralExpression(expr.right, right);
    }
  });

  it('handles operator precedence', () => {
    const tests = [
      ['-a * b', '((-a) * b)'],
      ['a + b + c', '((a + b) + c)'],
      ['a + b * c + d / e - f', '(((a + (b * c)) + (d / e)) - f)'],
      ['1 + (2 + 3) + 4', '((1 + (2 + 3)) + 4)'],
      ['a * [1, 2, 3, 4][b * c] * d', '((a * ([1, 2, 3, 4][(b * c)])) * d)'],
    ];
    for (const [input, expected] of tests) {
      const p = parse(input);
      assert.equal(p.statements[0].expression.toString(), expected);
    }
  });

  it('parses if expression', () => {
    const p = parse('if (x < y) { x }');
    const expr = p.statements[0].expression;
    assert.equal(expr.condition.operator, '<');
    assert.equal(expr.consequence.statements.length, 1);
    assert.equal(expr.alternative, null);
  });

  it('parses if-else expression', () => {
    const p = parse('if (x < y) { x } else { y }');
    const expr = p.statements[0].expression;
    assert.equal(expr.consequence.statements.length, 1);
    assert.equal(expr.alternative.statements.length, 1);
  });

  it('parses function literal', () => {
    const p = parse('fn(x, y) { x + y; }');
    const fn = p.statements[0].expression;
    assert.equal(fn.parameters.length, 2);
    assert.equal(fn.parameters[0].value, 'x');
    assert.equal(fn.parameters[1].value, 'y');
    assert.equal(fn.body.statements.length, 1);
  });

  it('parses call expression', () => {
    const p = parse('add(1, 2 * 3, 4 + 5);');
    const call = p.statements[0].expression;
    assert.equal(call.function.value, 'add');
    assert.equal(call.arguments.length, 3);
  });

  it('parses array literal', () => {
    const p = parse('[1, 2 * 2, 3 + 3]');
    const arr = p.statements[0].expression;
    assert.equal(arr.elements.length, 3);
    checkLiteralExpression(arr.elements[0], 1);
  });

  it('parses index expression', () => {
    const p = parse('myArray[1 + 1]');
    const idx = p.statements[0].expression;
    assert.equal(idx.left.value, 'myArray');
    assert.equal(idx.index.operator, '+');
  });

  it('parses hash literal', () => {
    const p = parse('{"one": 1, "two": 2}');
    const hash = p.statements[0].expression;
    assert.equal(hash.pairs.size, 2);
  });

  it('parses empty hash literal', () => {
    const p = parse('{}');
    const hash = p.statements[0].expression;
    assert.equal(hash.pairs.size, 0);
  });
});

function checkLiteralExpression(expr, expected) {
  if (typeof expected === 'number') {
    assert.equal(expr.value, expected);
  } else if (typeof expected === 'boolean') {
    assert.equal(expr.value, expected);
  } else if (typeof expected === 'string') {
    assert.equal(expr.value, expected);
  }
}

describe('New Syntax Parsing', () => {
  it('parses for loop', () => {
    const prog = parse('for (let i = 0; i < 10; i++) { x }');
    assert.ok(prog.statements.length > 0);
  });
  it('parses for-in', () => {
    const prog = parse('for (x in arr) { x }');
    assert.ok(prog.statements.length > 0);
  });
  it('parses break', () => {
    const prog = parse('break');
    assert.ok(prog.statements.length > 0);
  });
  it('parses continue', () => {
    const prog = parse('continue');
    assert.ok(prog.statements.length > 0);
  });
  it('parses match', () => {
    const prog = parse('match (x) { 1 => "a", _ => "b" }');
    assert.ok(prog.statements.length > 0);
  });
  it('parses ternary', () => {
    const prog = parse('x > 0 ? 1 : 0');
    assert.ok(prog.statements.length > 0);
  });
  it('parses do-while', () => {
    const prog = parse('do { x } while (true)');
    assert.ok(prog.statements.length > 0);
  });
  it('parses destructuring let', () => {
    const prog = parse('let [a, b] = [1, 2]');
    assert.ok(prog.statements.length > 0);
  });
  it('parses compound assignment', () => {
    const prog = parse('x += 1');
    assert.ok(prog.statements.length > 0);
  });
  it('parses i++', () => {
    const prog = parse('i++');
    assert.ok(prog.statements.length > 0);
  });
  it('parses else-if', () => {
    const prog = parse('if (x) { 1 } else if (y) { 2 } else { 3 }');
    assert.ok(prog.statements.length > 0);
  });
  it('parses slice', () => {
    const prog = parse('arr[1:3]');
    assert.ok(prog.statements.length > 0);
  });
  it('parses default params', () => {
    const prog = parse('fn(x, y = 10) { x + y }');
    assert.ok(prog.statements.length > 0);
  });
  it('parses template literal', () => {
    const prog = parse('`hello ${x}`');
    assert.ok(prog.statements.length > 0);
  });
  it('parses null', () => {
    const prog = parse('null');
    assert.ok(prog.statements.length > 0);
  });
  it('parses array mutation', () => {
    const prog = parse('arr[0] = 1');
    assert.ok(prog.statements.length > 0);
  });
  it('parses <=', () => {
    const prog = parse('a <= b');
    assert.ok(prog.statements.length > 0);
  });
  it('parses &&', () => {
    const prog = parse('a && b');
    assert.ok(prog.statements.length > 0);
  });
});

describe('Parser Edge Cases', () => {
  it('multiple statements', () => {
    const prog = parse('let x = 1; let y = 2; x + y');
    assert.equal(prog.statements.length, 3);
  });
  it('empty block', () => {
    const prog = parse('if (true) {}');
    assert.ok(prog.statements.length > 0);
  });
  it('deeply nested expression', () => {
    const prog = parse('((((1 + 2))))');
    assert.ok(prog.statements.length > 0);
  });
  it('function with no params', () => {
    const prog = parse('fn() { 42 }');
    assert.ok(prog.statements.length > 0);
  });
  it('complex for-in', () => {
    const prog = parse('for ([a, b] in [[1,2],[3,4]]) { a + b }');
    assert.ok(prog.statements.length > 0);
  });
  it('match with multiple arms', () => {
    const prog = parse('match (x) { 1 => "a", 2 => "b", 3 => "c", 4 => "d", _ => "e" }');
    assert.ok(prog.statements.length > 0);
  });
});

describe('Type Annotations', () => {
  it('parses single typed parameter', () => {
    const prog = parse('fn(x: int) { x }');
    const fn = prog.statements[0].expression;
    assert.equal(fn.parameters.length, 1);
    assert.deepEqual(fn.paramTypes, ['int']);
    assert.equal(fn.returnType, null);
  });

  it('parses multiple typed parameters', () => {
    const prog = parse('fn(x: int, y: string) { x }');
    const fn = prog.statements[0].expression;
    assert.equal(fn.parameters.length, 2);
    assert.deepEqual(fn.paramTypes, ['int', 'string']);
  });

  it('parses return type annotation', () => {
    const prog = parse('fn(x: int) -> int { x }');
    const fn = prog.statements[0].expression;
    assert.deepEqual(fn.paramTypes, ['int']);
    assert.equal(fn.returnType, 'int');
  });

  it('parses mixed typed and untyped params', () => {
    const prog = parse('fn(x: int, y) { x + y }');
    const fn = prog.statements[0].expression;
    assert.deepEqual(fn.paramTypes, ['int', null]);
  });

  it('works with default values', () => {
    const prog = parse('fn(x: int = 5) { x }');
    const fn = prog.statements[0].expression;
    assert.deepEqual(fn.paramTypes, ['int']);
    assert.ok(fn.defaults[0] !== null);
  });

  it('untyped function has null paramTypes', () => {
    const prog = parse('fn(x, y) { x + y }');
    const fn = prog.statements[0].expression;
    assert.equal(fn.paramTypes, null);
  });

  it('parses all type names', () => {
    const prog = parse('fn(a: int, b: bool, c: string, d: array, e: hash, f: fn) -> null { a }');
    const fn = prog.statements[0].expression;
    assert.deepEqual(fn.paramTypes, ['int', 'bool', 'string', 'array', 'hash', 'fn']);
    assert.equal(fn.returnType, 'null');
  });

  it('toString includes type annotations', () => {
    const prog = parse('fn(x: int, y: string) -> bool { x }');
    const fn = prog.statements[0].expression;
    const s = fn.toString();
    assert.ok(s.includes('x: int'));
    assert.ok(s.includes('y: string'));
    assert.ok(s.includes('-> bool'));
  });
});
