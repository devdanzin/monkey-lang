import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import * as ast from './ast.js';
import { eliminateDeadCode } from './dead-code.js';

function optimize(input) {
  const program = new Parser(new Lexer(input)).parseProgram();
  eliminateDeadCode(program);
  return program;
}

describe('Dead Code Elimination', () => {
  describe('after return', () => {
    it('removes code after return in function body', () => {
      const prog = optimize('fn() { return 1; let x = 2; x + 3 }');
      const fn = prog.statements[0].expression;
      assert.equal(fn.body.statements.length, 1); // only return
    });

    it('preserves code before return', () => {
      const prog = optimize('fn() { let x = 5; return x }');
      const fn = prog.statements[0].expression;
      assert.equal(fn.body.statements.length, 2);
    });

    it('handles multiple returns (keeps first)', () => {
      const prog = optimize('fn() { return 1; return 2; return 3 }');
      const fn = prog.statements[0].expression;
      assert.equal(fn.body.statements.length, 1);
    });
  });

  describe('after break/continue', () => {
    it('removes code after break', () => {
      const prog = optimize(`
        while (true) {
          break;
          let x = 5;
        }
      `);
      // Find the while body
      const whileExpr = prog.statements[0].expression;
      assert.equal(whileExpr.body.statements.length, 1);
    });

    it('removes code after continue', () => {
      const prog = optimize(`
        while (true) {
          continue;
          let x = 5;
        }
      `);
      const whileExpr = prog.statements[0].expression;
      assert.equal(whileExpr.body.statements.length, 1);
    });
  });

  describe('nested functions', () => {
    it('eliminates dead code in nested functions', () => {
      const prog = optimize(`
        let f = fn() {
          let g = fn() {
            return 1;
            let dead = 2;
          };
          return g;
          let dead2 = 3;
        }
      `);
      // f's body should have 2 stmts (let g, return g)
      const fn = prog.statements[0].value;
      assert.equal(fn.body.statements.length, 2);
      // g's body should have 1 stmt (return 1)
      const g = fn.body.statements[0].value;
      assert.equal(g.body.statements.length, 1);
    });
  });

  describe('preserves live code', () => {
    it('does not remove code without terminators', () => {
      const prog = optimize('let x = 1; let y = 2; let z = 3');
      assert.equal(prog.statements.length, 3);
    });

    it('preserves if/else branches', () => {
      const prog = optimize('if (true) { 1 } else { 2 }');
      assert.equal(prog.statements.length, 1);
    });

    it('preserves function with no dead code', () => {
      const prog = optimize('fn(x) { x + 1 }');
      const fn = prog.statements[0].expression;
      assert.equal(fn.body.statements.length, 1);
    });
  });

  describe('top-level dead code', () => {
    it('removes top-level code after return', () => {
      const prog = optimize('return 42; let x = 5; puts(x)');
      assert.equal(prog.statements.length, 1);
    });
  });

  describe('if/else dead code', () => {
    it('eliminates dead code inside if branches', () => {
      const prog = optimize(`
        if (true) {
          return 1;
          let dead = 2;
        } else {
          return 3;
          let dead2 = 4;
        }
      `);
      const ifExpr = prog.statements[0].expression;
      assert.equal(ifExpr.consequence.statements.length, 1);
      assert.equal(ifExpr.alternative.statements.length, 1);
    });
  });
});
