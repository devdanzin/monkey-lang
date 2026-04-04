import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parse, constantFold, eliminateDeadCode, generateCode, compile, Num, BinOp, Var } from '../src/index.js';

describe('Parser', () => {
  it('parses number', () => {
    const ast = parse('42;');
    assert.equal(ast.stmts[0].value, 42);
  });

  it('parses binary operation', () => {
    const ast = parse('1 + 2;');
    assert.equal(ast.stmts[0].type, 'BinOp');
    assert.equal(ast.stmts[0].op, '+');
  });

  it('parses nested operations', () => {
    const ast = parse('(1 + 2) * 3;');
    assert.equal(ast.stmts[0].type, 'BinOp');
    assert.equal(ast.stmts[0].op, '*');
  });

  it('respects precedence', () => {
    const ast = parse('1 + 2 * 3;');
    // Should be 1 + (2 * 3)
    assert.equal(ast.stmts[0].op, '+');
    assert.equal(ast.stmts[0].right.op, '*');
  });

  it('parses assignment', () => {
    const ast = parse('x = 42;');
    assert.equal(ast.stmts[0].type, 'Assign');
    assert.equal(ast.stmts[0].name, 'x');
  });

  it('parses if statement', () => {
    const ast = parse('if (x == 1) { print 42; }');
    assert.equal(ast.stmts[0].type, 'If');
  });

  it('parses if/else', () => {
    const ast = parse('if (x > 0) { print 1; } else { print 0; }');
    assert.ok(ast.stmts[0].els);
  });

  it('parses print', () => {
    const ast = parse('print 42;');
    assert.equal(ast.stmts[0].type, 'Print');
  });

  it('parses program', () => {
    const ast = parse('x = 1; y = 2; print x + y;');
    assert.equal(ast.stmts.length, 3);
  });
});

describe('Constant Folding', () => {
  it('folds simple arithmetic', () => {
    const ast = parse('1 + 2;');
    const folded = constantFold(ast);
    assert.equal(folded.stmts[0].value, 3);
  });

  it('folds nested arithmetic', () => {
    const ast = parse('(2 + 3) * (4 - 1);');
    const folded = constantFold(ast);
    assert.equal(folded.stmts[0].value, 15);
  });

  it('x + 0 → x', () => {
    const node = new BinOp('+', new Var('x'), new Num(0));
    const folded = constantFold(node);
    assert.equal(folded.type, 'Var');
    assert.equal(folded.name, 'x');
  });

  it('x * 1 → x', () => {
    const node = new BinOp('*', new Var('x'), new Num(1));
    const folded = constantFold(node);
    assert.equal(folded.type, 'Var');
  });

  it('x * 0 → 0', () => {
    const node = new BinOp('*', new Var('x'), new Num(0));
    const folded = constantFold(node);
    assert.equal(folded.type, 'Num');
    assert.equal(folded.value, 0);
  });

  it('folds unary minus', () => {
    const ast = parse('-5;');
    const folded = constantFold(ast);
    assert.equal(folded.stmts[0].value, -5);
  });

  it('folds constant if condition (true)', () => {
    const ast = parse('if (1) { print 42; } else { print 0; }');
    const folded = constantFold(ast);
    // Should eliminate the branch
    assert.equal(folded.stmts[0].type, 'Block');
  });

  it('folds constant if condition (false)', () => {
    const ast = parse('if (0) { print 42; } else { print 99; }');
    const folded = constantFold(ast);
    assert.equal(folded.stmts[0].type, 'Block');
  });
});

describe('Dead Code Elimination', () => {
  it('removes unused assignments', () => {
    const ast = parse('x = 1; y = 2; print x;');
    const dce = eliminateDeadCode(ast);
    // y is never used, should be removed
    const assigns = dce.stmts.filter(s => s.type === 'Assign');
    assert.equal(assigns.length, 1);
    assert.equal(assigns[0].name, 'x');
  });

  it('keeps used assignments', () => {
    const ast = parse('x = 1; print x;');
    const dce = eliminateDeadCode(ast);
    assert.equal(dce.stmts.length, 2);
  });
});

describe('Code Generation', () => {
  it('generates for constant', () => {
    const ast = parse('42;');
    const code = generateCode(ast);
    assert.ok(code.some(c => c.includes('42')));
  });

  it('generates for assignment', () => {
    const code = generateCode(parse('x = 5;'));
    assert.ok(code.some(c => c.includes('x =')));
  });

  it('generates for print', () => {
    const code = generateCode(parse('print 42;'));
    assert.ok(code.some(c => c.startsWith('print')));
  });

  it('generates 3-address code', () => {
    const code = generateCode(parse('x = 1 + 2 * 3;'));
    // Should have temp variables
    assert.ok(code.length >= 3);
  });
});

describe('Compile (full pipeline)', () => {
  it('compiles simple program', () => {
    const { code } = compile('x = 2 + 3; print x;');
    // Should fold 2+3 to 5
    assert.ok(code.some(c => c.includes('5')));
  });

  it('folds and generates', () => {
    const { code } = compile('x = (10 + 20) * 2; print x;');
    assert.ok(code.some(c => c.includes('60')));
  });

  it('eliminates dead code', () => {
    const { code } = compile('x = 1; y = 2; print x;');
    // y should not appear
    assert.ok(!code.some(c => c.includes('y')));
  });
});
