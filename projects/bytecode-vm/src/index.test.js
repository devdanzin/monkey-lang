// index.test.js — Comprehensive tests for bytecode VM, Compiler, and Chunk

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Op, Chunk, VM, Compiler, evaluate } from './index.js';

// Helper: create chunk, emit instructions, run
function runChunk(fn) {
  const chunk = new Chunk();
  fn(chunk);
  chunk.emit(Op.HALT);
  return new VM(chunk).run();
}

// Helper: create AST node shortcuts
const lit = (value) => ({ tag: 'lit', value });
const bin = (op, left, right) => ({ tag: 'binop', op, left, right });
const vr = (name) => ({ tag: 'var', name });
const letExpr = (name, value, body) => ({ tag: 'let', name, value, body });
const ifExpr = (cond, then, els) => ({ tag: 'if', cond, then, else: els });
const lam = (param, body) => ({ tag: 'lam', param, body });
const app = (fn, arg) => ({ tag: 'app', fn, arg });

describe('Chunk', () => {
  it('emits instructions', () => {
    const chunk = new Chunk();
    chunk.emit(Op.CONST, 0);
    assert.equal(chunk.code.length, 2);
    assert.equal(chunk.code[0], Op.CONST);
  });

  it('adds constants', () => {
    const chunk = new Chunk();
    const idx = chunk.addConstant(42);
    assert.equal(idx, 0);
    assert.equal(chunk.constants[0], 42);
  });

  it('patches jumps', () => {
    const chunk = new Chunk();
    const jumpAddr = chunk.emit(Op.JUMP, 0);
    chunk.emit(Op.CONST, 0);
    chunk.patchJump(jumpAddr);
    assert.equal(chunk.code[jumpAddr + 1], chunk.code.length);
  });

  it('disassembles correctly', () => {
    const chunk = new Chunk();
    chunk.addConstant(42);
    chunk.emit(Op.CONST, 0);
    chunk.emit(Op.HALT);
    const dis = chunk.disassemble();
    assert.ok(dis.includes('CONST'));
    assert.ok(dis.includes('HALT'));
  });
});

describe('VM — Arithmetic', () => {
  it('adds two numbers', () => {
    const result = runChunk(c => {
      c.emit(Op.CONST, c.addConstant(3));
      c.emit(Op.CONST, c.addConstant(4));
      c.emit(Op.ADD);
    });
    assert.equal(result, 7);
  });

  it('subtracts', () => {
    const result = runChunk(c => {
      c.emit(Op.CONST, c.addConstant(10));
      c.emit(Op.CONST, c.addConstant(3));
      c.emit(Op.SUB);
    });
    assert.equal(result, 7);
  });

  it('multiplies', () => {
    const result = runChunk(c => {
      c.emit(Op.CONST, c.addConstant(6));
      c.emit(Op.CONST, c.addConstant(7));
      c.emit(Op.MUL);
    });
    assert.equal(result, 42);
  });

  it('integer divides', () => {
    const result = runChunk(c => {
      c.emit(Op.CONST, c.addConstant(10));
      c.emit(Op.CONST, c.addConstant(3));
      c.emit(Op.DIV);
    });
    assert.equal(result, 3); // integer division
  });

  it('modulo', () => {
    const result = runChunk(c => {
      c.emit(Op.CONST, c.addConstant(10));
      c.emit(Op.CONST, c.addConstant(3));
      c.emit(Op.MOD);
    });
    assert.equal(result, 1);
  });

  it('negates', () => {
    const result = runChunk(c => {
      c.emit(Op.CONST, c.addConstant(42));
      c.emit(Op.NEGATE);
    });
    assert.equal(result, -42);
  });

  it('complex expression: (3 + 4) * 2 - 1', () => {
    const result = runChunk(c => {
      c.emit(Op.CONST, c.addConstant(3));
      c.emit(Op.CONST, c.addConstant(4));
      c.emit(Op.ADD);
      c.emit(Op.CONST, c.addConstant(2));
      c.emit(Op.MUL);
      c.emit(Op.CONST, c.addConstant(1));
      c.emit(Op.SUB);
    });
    assert.equal(result, 13);
  });
});

describe('VM — Comparisons', () => {
  it('equal', () => {
    assert.equal(runChunk(c => {
      c.emit(Op.CONST, c.addConstant(5));
      c.emit(Op.CONST, c.addConstant(5));
      c.emit(Op.EQ);
    }), true);
  });

  it('not equal', () => {
    assert.equal(runChunk(c => {
      c.emit(Op.CONST, c.addConstant(5));
      c.emit(Op.CONST, c.addConstant(3));
      c.emit(Op.NE);
    }), true);
  });

  it('less than', () => {
    assert.equal(runChunk(c => {
      c.emit(Op.CONST, c.addConstant(3));
      c.emit(Op.CONST, c.addConstant(5));
      c.emit(Op.LT);
    }), true);
  });

  it('greater than', () => {
    assert.equal(runChunk(c => {
      c.emit(Op.CONST, c.addConstant(5));
      c.emit(Op.CONST, c.addConstant(3));
      c.emit(Op.GT);
    }), true);
  });

  it('less or equal', () => {
    assert.equal(runChunk(c => {
      c.emit(Op.CONST, c.addConstant(5));
      c.emit(Op.CONST, c.addConstant(5));
      c.emit(Op.LE);
    }), true);
  });

  it('greater or equal false', () => {
    assert.equal(runChunk(c => {
      c.emit(Op.CONST, c.addConstant(3));
      c.emit(Op.CONST, c.addConstant(5));
      c.emit(Op.GE);
    }), false);
  });
});

describe('VM — Logic', () => {
  it('and (truthy)', () => {
    assert.equal(runChunk(c => {
      c.emit(Op.CONST, c.addConstant(1));
      c.emit(Op.CONST, c.addConstant(2));
      c.emit(Op.AND);
    }), 2);
  });

  it('and (falsy)', () => {
    assert.equal(runChunk(c => {
      c.emit(Op.CONST, c.addConstant(0));
      c.emit(Op.CONST, c.addConstant(2));
      c.emit(Op.AND);
    }), 0);
  });

  it('or', () => {
    assert.equal(runChunk(c => {
      c.emit(Op.CONST, c.addConstant(0));
      c.emit(Op.CONST, c.addConstant(42));
      c.emit(Op.OR);
    }), 42);
  });

  it('not', () => {
    assert.equal(runChunk(c => {
      c.emit(Op.CONST, c.addConstant(true));
      c.emit(Op.NOT);
    }), false);
  });
});

describe('VM — Control Flow', () => {
  it('unconditional jump', () => {
    const result = runChunk(c => {
      const jumpAddr = c.emit(Op.JUMP, 0);
      c.emit(Op.CONST, c.addConstant(99)); // skipped
      c.patchJump(jumpAddr);
      c.emit(Op.CONST, c.addConstant(42));
    });
    assert.equal(result, 42);
  });

  it('conditional jump (true — no jump)', () => {
    const result = runChunk(c => {
      c.emit(Op.CONST, c.addConstant(true));
      const jumpAddr = c.emit(Op.JUMP_IF_FALSE, 0);
      c.emit(Op.CONST, c.addConstant(42));
      const jumpEnd = c.emit(Op.JUMP, 0);
      c.patchJump(jumpAddr);
      c.emit(Op.CONST, c.addConstant(99));
      c.patchJump(jumpEnd);
    });
    assert.equal(result, 42);
  });

  it('conditional jump (false — jumps)', () => {
    const result = runChunk(c => {
      c.emit(Op.CONST, c.addConstant(false));
      const jumpAddr = c.emit(Op.JUMP_IF_FALSE, 0);
      c.emit(Op.CONST, c.addConstant(42));
      const jumpEnd = c.emit(Op.JUMP, 0);
      c.patchJump(jumpAddr);
      c.emit(Op.CONST, c.addConstant(99));
      c.patchJump(jumpEnd);
    });
    assert.equal(result, 99);
  });
});

describe('VM — Variables', () => {
  it('store and load', () => {
    const result = runChunk(c => {
      c.emit(Op.CONST, c.addConstant(42));
      c.emit(Op.STORE, 0);
      c.emit(Op.LOAD, 0);
    });
    assert.equal(result, 42);
  });

  it('multiple variables', () => {
    const result = runChunk(c => {
      c.emit(Op.CONST, c.addConstant(10));
      c.emit(Op.STORE, 0);
      c.emit(Op.CONST, c.addConstant(20));
      c.emit(Op.STORE, 1);
      c.emit(Op.LOAD, 0);
      c.emit(Op.LOAD, 1);
      c.emit(Op.ADD);
    });
    assert.equal(result, 30);
  });
});

describe('VM — Stack ops', () => {
  it('pop discards top', () => {
    const result = runChunk(c => {
      c.emit(Op.CONST, c.addConstant(42));
      c.emit(Op.CONST, c.addConstant(99));
      c.emit(Op.POP);
    });
    assert.equal(result, 42);
  });
});

describe('VM — Functions', () => {
  it('calls native function', () => {
    const chunk = new Chunk();
    chunk.emit(Op.CONST, chunk.addConstant(Math.abs));
    chunk.emit(Op.CONST, chunk.addConstant(-42));
    chunk.emit(Op.CALL, 1);
    chunk.emit(Op.HALT);
    assert.equal(new VM(chunk).run(), 42);
  });

  it('calls closure', () => {
    const chunk = new Chunk();
    // Jump over function body
    const jumpOver = chunk.emit(Op.JUMP, 0);
    const fnAddr = chunk.code.length;
    // Function body: load arg, add 10, return
    chunk.emit(Op.LOAD, 0);
    chunk.emit(Op.CONST, chunk.addConstant(10));
    chunk.emit(Op.ADD);
    chunk.emit(Op.RETURN);
    chunk.patchJump(jumpOver);
    // Create closure and call it
    chunk.emit(Op.CLOSURE, fnAddr, 0);
    chunk.emit(Op.CONST, chunk.addConstant(32));
    chunk.emit(Op.CALL, 1);
    chunk.emit(Op.HALT);
    assert.equal(new VM(chunk).run(), 42);
  });
});

describe('VM — Error handling', () => {
  it('throws on unknown opcode', () => {
    const chunk = new Chunk();
    chunk.code.push(255);
    assert.throws(() => new VM(chunk).run(), /Unknown opcode/);
  });

  it('throws on max steps', () => {
    const chunk = new Chunk();
    chunk.emit(Op.JUMP, 0); // infinite loop
    const vm = new VM(chunk);
    vm.maxSteps = 100;
    assert.throws(() => vm.run(), /Max steps/);
  });

  it('throws on calling non-function', () => {
    const chunk = new Chunk();
    chunk.emit(Op.CONST, chunk.addConstant(42));
    chunk.emit(Op.CONST, chunk.addConstant(1));
    chunk.emit(Op.CALL, 1);
    chunk.emit(Op.HALT);
    assert.throws(() => new VM(chunk).run(), /Cannot call/);
  });
});

describe('Compiler — evaluate', () => {
  it('evaluates literal', () => {
    assert.equal(evaluate(lit(42)), 42);
  });

  it('evaluates string literal', () => {
    assert.equal(evaluate(lit('hello')), 'hello');
  });

  it('evaluates boolean literal', () => {
    assert.equal(evaluate(lit(true)), true);
  });

  it('evaluates addition', () => {
    assert.equal(evaluate(bin('+', lit(3), lit(4))), 7);
  });

  it('evaluates subtraction', () => {
    assert.equal(evaluate(bin('-', lit(10), lit(3))), 7);
  });

  it('evaluates multiplication', () => {
    assert.equal(evaluate(bin('*', lit(6), lit(7))), 42);
  });

  it('evaluates division', () => {
    assert.equal(evaluate(bin('/', lit(10), lit(3))), 3);
  });

  it('evaluates nested arithmetic: (2 + 3) * 4', () => {
    assert.equal(evaluate(bin('*', bin('+', lit(2), lit(3)), lit(4))), 20);
  });

  it('evaluates comparison', () => {
    assert.equal(evaluate(bin('<', lit(3), lit(5))), true);
    assert.equal(evaluate(bin('>', lit(3), lit(5))), false);
    assert.equal(evaluate(bin('==', lit(5), lit(5))), true);
  });

  it('evaluates if-then-else (true)', () => {
    assert.equal(evaluate(ifExpr(lit(true), lit(42), lit(99))), 42);
  });

  it('evaluates if-then-else (false)', () => {
    assert.equal(evaluate(ifExpr(lit(false), lit(42), lit(99))), 99);
  });

  it('evaluates if with comparison', () => {
    assert.equal(evaluate(
      ifExpr(bin('<', lit(3), lit(5)), lit('yes'), lit('no'))
    ), 'yes');
  });

  it('evaluates let binding', () => {
    assert.equal(evaluate(
      letExpr('x', lit(42), vr('x'))
    ), 42);
  });

  it('evaluates let with usage in expression', () => {
    assert.equal(evaluate(
      letExpr('x', lit(10), bin('+', vr('x'), lit(5)))
    ), 15);
  });

  it('evaluates nested let', () => {
    assert.equal(evaluate(
      letExpr('x', lit(10),
        letExpr('y', lit(20),
          bin('+', vr('x'), vr('y'))
        )
      )
    ), 30);
  });

  it('evaluates lambda application', () => {
    assert.equal(evaluate(
      app(lam('x', bin('+', vr('x'), lit(1))), lit(41))
    ), 42);
  });

  it('evaluates lambda with let', () => {
    assert.equal(evaluate(
      letExpr('double', lam('x', bin('*', vr('x'), lit(2))),
        app(vr('double'), lit(21))
      )
    ), 42);
  });

  it('evaluates complex expression', () => {
    // let x = 5 in let y = 10 in if x < y then x + y else x - y
    assert.equal(evaluate(
      letExpr('x', lit(5),
        letExpr('y', lit(10),
          ifExpr(bin('<', vr('x'), vr('y')),
            bin('+', vr('x'), vr('y')),
            bin('-', vr('x'), vr('y'))
          )
        )
      )
    ), 15);
  });

  it('evaluates string concatenation', () => {
    assert.equal(evaluate(bin('+', lit('hello '), lit('world'))), 'hello world');
  });

  it('throws on undefined variable', () => {
    assert.throws(() => evaluate(vr('x')), /Undefined variable/);
  });
});

describe('Compiler — Chunk inspection', () => {
  it('produces valid bytecode', () => {
    const compiler = new Compiler();
    const chunk = compiler.compile(lit(42));
    assert.ok(chunk.code.length > 0);
    assert.ok(chunk.constants.includes(42));
  });

  it('disassembly includes expected ops', () => {
    const compiler = new Compiler();
    const chunk = compiler.compile(bin('+', lit(3), lit(4)));
    const dis = chunk.disassemble();
    assert.ok(dis.includes('CONST'));
    assert.ok(dis.includes('ADD'));
    assert.ok(dis.includes('HALT'));
  });
});
