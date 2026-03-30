import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Chip8 } from '../src/index.js';

describe('Chip8', () => {
  let cpu;

  beforeEach(() => {
    cpu = new Chip8();
  });

  describe('initialization', () => {
    it('starts with correct state', () => {
      assert.equal(cpu.pc, 0x200);
      assert.equal(cpu.sp, 0);
      assert.equal(cpu.I, 0);
      assert.equal(cpu.delayTimer, 0);
      assert.equal(cpu.soundTimer, 0);
      assert.equal(cpu.memory.length, 4096);
      assert.equal(cpu.V.length, 16);
      assert.equal(cpu.display.length, 64 * 32);
    });

    it('has font loaded at 0x050', () => {
      assert.equal(cpu.memory[0x050], 0xF0); // '0' sprite first byte
      assert.equal(cpu.memory[0x050 + 5], 0x20); // '1' sprite first byte
    });

    it('loads ROM at 0x200', () => {
      cpu.loadROM(new Uint8Array([0x12, 0x34, 0x56, 0x78]));
      assert.equal(cpu.memory[0x200], 0x12);
      assert.equal(cpu.memory[0x201], 0x34);
      assert.equal(cpu.memory[0x202], 0x56);
      assert.equal(cpu.memory[0x203], 0x78);
    });

    it('rejects ROMs that are too large', () => {
      assert.throws(() => cpu.loadROM(new Uint8Array(4000)));
    });
  });

  describe('opcodes — flow control', () => {
    it('1nnn: JP — jump to address', () => {
      loadOpcode(cpu, 0x1ABC);
      cpu.cycle();
      assert.equal(cpu.pc, 0xABC);
    });

    it('2nnn/00EE: CALL/RET — subroutine', () => {
      loadOpcode(cpu, 0x2400); // CALL 0x400
      cpu.cycle();
      assert.equal(cpu.pc, 0x400);
      assert.equal(cpu.sp, 1);
      assert.equal(cpu.stack[0], 0x202);

      // Put RET at 0x400
      cpu.memory[0x400] = 0x00;
      cpu.memory[0x401] = 0xEE;
      cpu.cycle();
      assert.equal(cpu.pc, 0x202);
      assert.equal(cpu.sp, 0);
    });

    it('Bnnn: JP V0 — jump to nnn + V0', () => {
      cpu.V[0] = 0x10;
      loadOpcode(cpu, 0xB300);
      cpu.cycle();
      assert.equal(cpu.pc, 0x310);
    });
  });

  describe('opcodes — skip', () => {
    it('3xnn: SE — skip if Vx == nn', () => {
      cpu.V[5] = 0x42;
      loadOpcode(cpu, 0x3542);
      cpu.cycle();
      assert.equal(cpu.pc, 0x204); // Skipped

      cpu.pc = 0x200;
      loadOpcode(cpu, 0x3543);
      cpu.cycle();
      assert.equal(cpu.pc, 0x202); // Not skipped
    });

    it('4xnn: SNE — skip if Vx != nn', () => {
      cpu.V[3] = 0x10;
      loadOpcode(cpu, 0x4320);
      cpu.cycle();
      assert.equal(cpu.pc, 0x204); // Skipped (0x10 != 0x20)
    });

    it('5xy0: SE — skip if Vx == Vy', () => {
      cpu.V[1] = 0x55;
      cpu.V[2] = 0x55;
      loadOpcode(cpu, 0x5120);
      cpu.cycle();
      assert.equal(cpu.pc, 0x204);
    });

    it('9xy0: SNE — skip if Vx != Vy', () => {
      cpu.V[1] = 0x55;
      cpu.V[2] = 0x66;
      loadOpcode(cpu, 0x9120);
      cpu.cycle();
      assert.equal(cpu.pc, 0x204);
    });
  });

  describe('opcodes — load/math', () => {
    it('6xnn: LD — set Vx = nn', () => {
      loadOpcode(cpu, 0x6A42);
      cpu.cycle();
      assert.equal(cpu.V[0xA], 0x42);
    });

    it('7xnn: ADD — Vx += nn (no carry flag)', () => {
      cpu.V[3] = 0x10;
      loadOpcode(cpu, 0x7305);
      cpu.cycle();
      assert.equal(cpu.V[3], 0x15);
    });

    it('7xnn: ADD wraps at 255', () => {
      cpu.V[0] = 0xFE;
      loadOpcode(cpu, 0x7005);
      cpu.cycle();
      assert.equal(cpu.V[0], 0x03);
    });

    it('Annn: LD I — set I = nnn', () => {
      loadOpcode(cpu, 0xA123);
      cpu.cycle();
      assert.equal(cpu.I, 0x123);
    });
  });

  describe('opcodes — 8xy ALU', () => {
    it('8xy0: LD Vx, Vy', () => {
      cpu.V[2] = 0x42;
      loadOpcode(cpu, 0x8120);
      cpu.cycle();
      assert.equal(cpu.V[1], 0x42);
    });

    it('8xy1: OR', () => {
      cpu.V[1] = 0x0F;
      cpu.V[2] = 0xF0;
      loadOpcode(cpu, 0x8121);
      cpu.cycle();
      assert.equal(cpu.V[1], 0xFF);
      assert.equal(cpu.V[0xF], 0); // VF reset
    });

    it('8xy2: AND', () => {
      cpu.V[1] = 0x0F;
      cpu.V[2] = 0xFF;
      loadOpcode(cpu, 0x8122);
      cpu.cycle();
      assert.equal(cpu.V[1], 0x0F);
      assert.equal(cpu.V[0xF], 0);
    });

    it('8xy3: XOR', () => {
      cpu.V[1] = 0xFF;
      cpu.V[2] = 0x0F;
      loadOpcode(cpu, 0x8123);
      cpu.cycle();
      assert.equal(cpu.V[1], 0xF0);
      assert.equal(cpu.V[0xF], 0);
    });

    it('8xy4: ADD with carry', () => {
      cpu.V[1] = 0xFF;
      cpu.V[2] = 0x02;
      loadOpcode(cpu, 0x8124);
      cpu.cycle();
      assert.equal(cpu.V[1], 0x01);
      assert.equal(cpu.V[0xF], 1); // Carry
    });

    it('8xy4: ADD without carry', () => {
      cpu.V[1] = 0x01;
      cpu.V[2] = 0x02;
      loadOpcode(cpu, 0x8124);
      cpu.cycle();
      assert.equal(cpu.V[1], 0x03);
      assert.equal(cpu.V[0xF], 0);
    });

    it('8xy5: SUB (Vx - Vy)', () => {
      cpu.V[1] = 0x05;
      cpu.V[2] = 0x03;
      loadOpcode(cpu, 0x8125);
      cpu.cycle();
      assert.equal(cpu.V[1], 0x02);
      assert.equal(cpu.V[0xF], 1); // No borrow
    });

    it('8xy5: SUB with borrow', () => {
      cpu.V[1] = 0x03;
      cpu.V[2] = 0x05;
      loadOpcode(cpu, 0x8125);
      cpu.cycle();
      assert.equal(cpu.V[1], 0xFE);
      assert.equal(cpu.V[0xF], 0); // Borrow
    });

    it('8xy6: SHR (shift right)', () => {
      cpu.V[2] = 0x07;
      loadOpcode(cpu, 0x8126);
      cpu.cycle();
      assert.equal(cpu.V[1], 0x03);
      assert.equal(cpu.V[0xF], 1); // LSB was 1
    });

    it('8xy7: SUBN (Vy - Vx)', () => {
      cpu.V[1] = 0x03;
      cpu.V[2] = 0x05;
      loadOpcode(cpu, 0x8127);
      cpu.cycle();
      assert.equal(cpu.V[1], 0x02);
      assert.equal(cpu.V[0xF], 1);
    });

    it('8xyE: SHL (shift left)', () => {
      cpu.V[2] = 0x81;
      loadOpcode(cpu, 0x812E);
      cpu.cycle();
      assert.equal(cpu.V[1], 0x02);
      assert.equal(cpu.V[0xF], 1); // MSB was 1
    });
  });

  describe('opcodes — memory/timer', () => {
    it('Fx33: BCD', () => {
      cpu.V[1] = 234;
      cpu.I = 0x300;
      loadOpcode(cpu, 0xF133);
      cpu.cycle();
      assert.equal(cpu.memory[0x300], 2);
      assert.equal(cpu.memory[0x301], 3);
      assert.equal(cpu.memory[0x302], 4);
    });

    it('Fx55/Fx65: store/load registers', () => {
      cpu.V[0] = 0x11;
      cpu.V[1] = 0x22;
      cpu.V[2] = 0x33;
      cpu.I = 0x300;
      loadOpcode(cpu, 0xF255); // Store V0-V2
      cpu.cycle();
      assert.equal(cpu.memory[0x300], 0x11);
      assert.equal(cpu.memory[0x301], 0x22);
      assert.equal(cpu.memory[0x302], 0x33);

      // Clear registers
      cpu.V[0] = cpu.V[1] = cpu.V[2] = 0;
      cpu.I = 0x300;
      loadOpcode(cpu, 0xF265); // Load V0-V2
      cpu.cycle();
      assert.equal(cpu.V[0], 0x11);
      assert.equal(cpu.V[1], 0x22);
      assert.equal(cpu.V[2], 0x33);
    });

    it('Fx07/Fx15: delay timer', () => {
      cpu.V[0] = 30;
      loadOpcode(cpu, 0xF015); // LD DT, V0
      cpu.cycle();
      assert.equal(cpu.delayTimer, 30);

      loadOpcode(cpu, 0xF107); // LD V1, DT
      cpu.cycle();
      assert.equal(cpu.V[1], 30);
    });

    it('Fx29: font sprite address', () => {
      cpu.V[0] = 0xA;
      loadOpcode(cpu, 0xF029);
      cpu.cycle();
      assert.equal(cpu.I, 0x050 + 0xA * 5);
    });

    it('Fx1E: ADD I, Vx', () => {
      cpu.I = 0x100;
      cpu.V[3] = 0x20;
      loadOpcode(cpu, 0xF31E);
      cpu.cycle();
      assert.equal(cpu.I, 0x120);
    });
  });

  describe('opcodes — display', () => {
    it('00E0: CLS — clears display', () => {
      cpu.display[0] = 1;
      cpu.display[100] = 1;
      loadOpcode(cpu, 0x00E0);
      cpu.cycle();
      assert.equal(cpu.display[0], 0);
      assert.equal(cpu.display[100], 0);
      assert.equal(cpu.drawFlag, true);
    });

    it('Dxyn: DRW — draws sprite and sets collision', () => {
      // Store a simple 1-byte sprite at I
      cpu.I = 0x300;
      cpu.memory[0x300] = 0x80; // 10000000 — one pixel at left

      cpu.V[0] = 0; // x
      cpu.V[1] = 0; // y
      loadOpcode(cpu, 0xD011); // DRW V0, V1, 1
      cpu.cycle();

      assert.equal(cpu.display[0], 1); // Pixel drawn
      assert.equal(cpu.V[0xF], 0); // No collision

      // Draw again — should XOR (erase) and set collision
      cpu.pc = 0x200;
      loadOpcode(cpu, 0xD011);
      cpu.cycle();
      assert.equal(cpu.display[0], 0); // Pixel erased
      assert.equal(cpu.V[0xF], 1); // Collision
    });

    it('DRW: clips at screen edges', () => {
      cpu.I = 0x300;
      cpu.memory[0x300] = 0xFF; // 8 pixels wide

      cpu.V[0] = 60; // x near right edge
      cpu.V[1] = 0;
      loadOpcode(cpu, 0xD011);
      cpu.cycle();

      // Should only draw 4 pixels (60-63), clipping the rest
      assert.equal(cpu.display[60], 1);
      assert.equal(cpu.display[63], 1);
    });
  });

  describe('opcodes — keyboard', () => {
    it('Ex9E: SKP — skip if key pressed', () => {
      cpu.V[0] = 5;
      cpu.keys[5] = 1;
      loadOpcode(cpu, 0xE09E);
      cpu.cycle();
      assert.equal(cpu.pc, 0x204); // Skipped
    });

    it('ExA1: SKNP — skip if key NOT pressed', () => {
      cpu.V[0] = 5;
      loadOpcode(cpu, 0xE0A1);
      cpu.cycle();
      assert.equal(cpu.pc, 0x204); // Skipped (key not pressed)
    });

    it('Fx0A: wait for key press', () => {
      cpu.V[0] = 0;
      loadOpcode(cpu, 0xF00A);
      cpu.cycle();
      assert.equal(cpu.waitingForKey, true);

      // Simulate key press
      cpu.keyDown(7);
      assert.equal(cpu.waitingForKey, false);
      assert.equal(cpu.V[0], 7);
    });
  });

  describe('opcodes — random', () => {
    it('Cxnn: RND — produces masked random value', () => {
      loadOpcode(cpu, 0xC00F); // V0 = random & 0x0F
      cpu.cycle();
      assert.ok(cpu.V[0] <= 0x0F);
    });
  });

  describe('timers', () => {
    it('count down', () => {
      cpu.delayTimer = 3;
      cpu.soundTimer = 2;
      cpu.updateTimers();
      assert.equal(cpu.delayTimer, 2);
      assert.equal(cpu.soundTimer, 1);
      cpu.updateTimers();
      assert.equal(cpu.delayTimer, 1);
      assert.equal(cpu.soundTimer, 0);
      cpu.updateTimers();
      assert.equal(cpu.delayTimer, 0);
      assert.equal(cpu.soundTimer, 0); // Doesn't go negative
    });
  });

  describe('disassembler', () => {
    it('disassembles common opcodes', () => {
      assert.equal(Chip8.disassemble(0x00E0), 'CLS');
      assert.equal(Chip8.disassemble(0x00EE), 'RET');
      assert.equal(Chip8.disassemble(0x1234), 'JP 234');
      assert.equal(Chip8.disassemble(0x2456), 'CALL 456');
      assert.equal(Chip8.disassemble(0x6A42), 'LD Va, 66');
      assert.equal(Chip8.disassemble(0xA123), 'LD I, 123');
      assert.equal(Chip8.disassemble(0xD125), 'DRW V1, V2, 5');
    });
  });
});

// Helper: load a 2-byte opcode at the current PC
function loadOpcode(cpu, opcode) {
  cpu.memory[cpu.pc] = (opcode >> 8) & 0xFF;
  cpu.memory[cpu.pc + 1] = opcode & 0xFF;
}
