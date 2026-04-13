// code.test.js — Tests for Monkey bytecode instruction set
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Opcodes, make, lookup, readOperands, disassemble, concatInstructions } from './code.js';

describe('Bytecode', () => {
  describe('make', () => {
    it('makes OpConstant instruction', () => {
      const inst = make(Opcodes.OpConstant, 65534);
      assert.deepEqual([...inst], [Opcodes.OpConstant, 0xFF, 0xFE]);
    });

    it('makes OpAdd instruction (no operands)', () => {
      const inst = make(Opcodes.OpAdd);
      assert.deepEqual([...inst], [Opcodes.OpAdd]);
    });

    it('makes OpSetLocal instruction (1-byte operand)', () => {
      const inst = make(Opcodes.OpSetLocal, 255);
      assert.deepEqual([...inst], [Opcodes.OpSetLocal, 0xFF]);
    });

    it('makes OpClosure instruction (2 operands)', () => {
      const inst = make(Opcodes.OpClosure, 65534, 255);
      assert.deepEqual([...inst], [Opcodes.OpClosure, 0xFF, 0xFE, 0xFF]);
    });
  });

  describe('readOperands', () => {
    it('reads OpConstant operand', () => {
      const inst = make(Opcodes.OpConstant, 65535);
      const def = lookup(Opcodes.OpConstant);
      const { operands, bytesRead } = readOperands(def, inst, 1);
      assert.deepEqual(operands, [65535]);
      assert.equal(bytesRead, 2);
    });

    it('reads OpSetLocal operand', () => {
      const inst = make(Opcodes.OpSetLocal, 42);
      const def = lookup(Opcodes.OpSetLocal);
      const { operands, bytesRead } = readOperands(def, inst, 1);
      assert.deepEqual(operands, [42]);
      assert.equal(bytesRead, 1);
    });

    it('reads OpClosure operands', () => {
      const inst = make(Opcodes.OpClosure, 100, 3);
      const def = lookup(Opcodes.OpClosure);
      const { operands, bytesRead } = readOperands(def, inst, 1);
      assert.deepEqual(operands, [100, 3]);
      assert.equal(bytesRead, 3);
    });
  });

  describe('disassemble', () => {
    it('disassembles mixed instructions', () => {
      const instructions = concatInstructions(
        make(Opcodes.OpConstant, 1),
        make(Opcodes.OpConstant, 2),
        make(Opcodes.OpAdd),
        make(Opcodes.OpPop),
      );
      const result = disassemble(instructions);
      assert.equal(result, [
        '0000 OpConstant 1',
        '0003 OpConstant 2',
        '0006 OpAdd',
        '0007 OpPop',
      ].join('\n'));
    });

    it('disassembles jump instructions', () => {
      const instructions = concatInstructions(
        make(Opcodes.OpTrue),
        make(Opcodes.OpJumpNotTruthy, 10),
        make(Opcodes.OpConstant, 0),
        make(Opcodes.OpJump, 13),
        make(Opcodes.OpNull),
      );
      const result = disassemble(instructions);
      assert.ok(result.includes('OpJumpNotTruthy 10'));
      assert.ok(result.includes('OpJump 13'));
    });
  });

  describe('concatInstructions', () => {
    it('concatenates instruction arrays', () => {
      const a = make(Opcodes.OpConstant, 1);
      const b = make(Opcodes.OpAdd);
      const c = concatInstructions(a, b);
      assert.equal(c.length, 4);
      assert.equal(c[0], Opcodes.OpConstant);
      assert.equal(c[3], Opcodes.OpAdd);
    });
  });

  describe('lookup', () => {
    it('returns definition for known opcodes', () => {
      const def = lookup(Opcodes.OpConstant);
      assert.equal(def.name, 'OpConstant');
      assert.deepEqual(def.operandWidths, [2]);
    });

    it('returns null for unknown opcodes', () => {
      assert.equal(lookup(0xFF), null);
    });
  });
});
