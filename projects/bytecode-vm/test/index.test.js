import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Op, Chunk, VM, Compiler, evaluate } from '../src/index.js';

// Helper AST constructors
const intLit = (n) => ({ tag: 'lit', value: n });
const boolLit = (b) => ({ tag: 'lit', value: b });
const varRef = (name) => ({ tag: 'var', name });
const binOp = (op, left, right) => ({ tag: 'binop', op, left, right });
const ifExpr = (cond, then, else_) => ({ tag: 'if', cond, then, else: else_ });
const letExpr = (name, value, body) => ({ tag: 'let', name, value, body });
const lam = (param, body) => ({ tag: 'lam', param, body });
const app = (fn, arg) => ({ tag: 'app', fn, arg });

// ===== VM Basics =====
describe('VM — direct bytecode', () => {
  it('pushes and returns constant', () => {
    const chunk = new Chunk();
    chunk.addConstant(42);
    chunk.emit(Op.CONST, 0);
    chunk.emit(Op.HALT);
    
    const vm = new VM(chunk);
    assert.equal(vm.run(), 42);
  });

  it('adds two numbers', () => {
    const chunk = new Chunk();
    chunk.addConstant(3);
    chunk.addConstant(4);
    chunk.emit(Op.CONST, 0);
    chunk.emit(Op.CONST, 1);
    chunk.emit(Op.ADD);
    chunk.emit(Op.HALT);
    
    assert.equal(new VM(chunk).run(), 7);
  });

  it('subtracts', () => {
    const chunk = new Chunk();
    chunk.addConstant(10);
    chunk.addConstant(3);
    chunk.emit(Op.CONST, 0);
    chunk.emit(Op.CONST, 1);
    chunk.emit(Op.SUB);
    chunk.emit(Op.HALT);
    
    assert.equal(new VM(chunk).run(), 7);
  });

  it('multiplies', () => {
    const chunk = new Chunk();
    chunk.addConstant(6);
    chunk.addConstant(7);
    chunk.emit(Op.CONST, 0);
    chunk.emit(Op.CONST, 1);
    chunk.emit(Op.MUL);
    chunk.emit(Op.HALT);
    
    assert.equal(new VM(chunk).run(), 42);
  });

  it('comparison operators', () => {
    const chunk = new Chunk();
    chunk.addConstant(3);
    chunk.addConstant(4);
    chunk.emit(Op.CONST, 0);
    chunk.emit(Op.CONST, 1);
    chunk.emit(Op.LT);
    chunk.emit(Op.HALT);
    
    assert.equal(new VM(chunk).run(), true);
  });

  it('conditional jump', () => {
    const chunk = new Chunk();
    chunk.addConstant(true);
    chunk.addConstant(42);
    chunk.addConstant(99);
    
    chunk.emit(Op.CONST, 0);         // push true
    const jmp = chunk.emit(Op.JUMP_IF_FALSE, 0); // jump if false
    chunk.emit(Op.CONST, 1);         // push 42
    const end = chunk.emit(Op.JUMP, 0);
    chunk.patchJump(jmp);
    chunk.emit(Op.CONST, 2);         // push 99
    chunk.patchJump(end);
    chunk.emit(Op.HALT);
    
    assert.equal(new VM(chunk).run(), 42);
  });
});

// ===== Compiler + VM =====
describe('Compiler — literals', () => {
  it('compiles integer', () => {
    assert.equal(evaluate(intLit(42)), 42);
  });

  it('compiles boolean true', () => {
    assert.equal(evaluate(boolLit(true)), true);
  });

  it('compiles boolean false', () => {
    assert.equal(evaluate(boolLit(false)), false);
  });
});

describe('Compiler — arithmetic', () => {
  it('addition', () => {
    assert.equal(evaluate(binOp('+', intLit(3), intLit(4))), 7);
  });

  it('subtraction', () => {
    assert.equal(evaluate(binOp('-', intLit(10), intLit(3))), 7);
  });

  it('multiplication', () => {
    assert.equal(evaluate(binOp('*', intLit(6), intLit(7))), 42);
  });

  it('division', () => {
    assert.equal(evaluate(binOp('/', intLit(10), intLit(3))), 3);
  });

  it('modulo', () => {
    assert.equal(evaluate(binOp('%', intLit(10), intLit(3))), 1);
  });

  it('nested arithmetic: (1 + 2) * 3', () => {
    assert.equal(evaluate(binOp('*', binOp('+', intLit(1), intLit(2)), intLit(3))), 9);
  });

  it('complex: 2 * 3 + 4 * 5', () => {
    assert.equal(evaluate(binOp('+', binOp('*', intLit(2), intLit(3)), binOp('*', intLit(4), intLit(5)))), 26);
  });
});

describe('Compiler — comparison', () => {
  it('less than', () => {
    assert.equal(evaluate(binOp('<', intLit(3), intLit(4))), true);
    assert.equal(evaluate(binOp('<', intLit(4), intLit(3))), false);
  });

  it('equality', () => {
    assert.equal(evaluate(binOp('==', intLit(42), intLit(42))), true);
    assert.equal(evaluate(binOp('==', intLit(42), intLit(43))), false);
  });

  it('logical and', () => {
    assert.equal(evaluate(binOp('&&', boolLit(true), boolLit(true))), true);
    assert.equal(evaluate(binOp('&&', boolLit(true), boolLit(false))), false);
  });
});

describe('Compiler — if-then-else', () => {
  it('true branch', () => {
    assert.equal(evaluate(ifExpr(boolLit(true), intLit(42), intLit(99))), 42);
  });

  it('false branch', () => {
    assert.equal(evaluate(ifExpr(boolLit(false), intLit(42), intLit(99))), 99);
  });

  it('nested if', () => {
    assert.equal(evaluate(
      ifExpr(binOp('<', intLit(1), intLit(2)),
        ifExpr(boolLit(true), intLit(1), intLit(2)),
        intLit(3)
      )
    ), 1);
  });
});

describe('Compiler — let bindings', () => {
  it('simple let', () => {
    assert.equal(evaluate(letExpr('x', intLit(42), varRef('x'))), 42);
  });

  it('let with arithmetic', () => {
    assert.equal(evaluate(
      letExpr('x', intLit(10), binOp('+', varRef('x'), intLit(5)))
    ), 15);
  });

  it('nested let', () => {
    assert.equal(evaluate(
      letExpr('x', intLit(10),
        letExpr('y', intLit(20),
          binOp('+', varRef('x'), varRef('y'))
        )
      )
    ), 30);
  });

  it('let with if', () => {
    assert.equal(evaluate(
      letExpr('x', intLit(5),
        ifExpr(binOp('>', varRef('x'), intLit(3)),
          binOp('*', varRef('x'), intLit(2)),
          varRef('x')
        )
      )
    ), 10);
  });
});

describe('Compiler — functions', () => {
  it('identity function', () => {
    assert.equal(evaluate(
      app(lam('x', varRef('x')), intLit(42))
    ), 42);
  });

  it('add-one function', () => {
    assert.equal(evaluate(
      app(lam('x', binOp('+', varRef('x'), intLit(1))), intLit(41))
    ), 42);
  });

  it('let-bound function', () => {
    assert.equal(evaluate(
      letExpr('double', lam('x', binOp('*', varRef('x'), intLit(2))),
        app(varRef('double'), intLit(21))
      )
    ), 42);
  });
});

describe('Chunk — disassembly', () => {
  it('disassembles simple program', () => {
    const chunk = new Chunk();
    chunk.addConstant(42);
    chunk.emit(Op.CONST, 0);
    chunk.emit(Op.HALT);
    
    const dis = chunk.disassemble();
    assert.ok(dis.includes('CONST'));
    assert.ok(dis.includes('HALT'));
  });
});
