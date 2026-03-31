// Tiny VM — stack-based bytecode interpreter + assembler

export const OP = {
  HALT: 0x00, PUSH: 0x01, POP: 0x02, DUP: 0x03, SWAP: 0x04,
  ADD: 0x10, SUB: 0x11, MUL: 0x12, DIV: 0x13, MOD: 0x14, NEG: 0x15,
  AND: 0x20, OR: 0x21, XOR: 0x22, NOT: 0x23, SHL: 0x24, SHR: 0x25,
  EQ: 0x30, NE: 0x31, LT: 0x32, GT: 0x33, LE: 0x34, GE: 0x35,
  JMP: 0x40, JZ: 0x41, JNZ: 0x42, CALL: 0x43, RET: 0x44,
  LOAD: 0x50, STORE: 0x51,
  PRINT: 0x60, READ: 0x61,
};

const OP_NAME = Object.fromEntries(Object.entries(OP).map(([k, v]) => [v, k]));

export class VM {
  constructor(program, { memSize = 256, stackSize = 256, maxSteps = 100000 } = {}) {
    this.program = program instanceof Uint8Array ? program : new Uint8Array(program);
    this.stack = new Int32Array(stackSize);
    this.memory = new Int32Array(memSize);
    this.sp = 0; // stack pointer
    this.pc = 0; // program counter
    this.callStack = [];
    this.maxSteps = maxSteps;
    this.output = [];
    this.halted = false;
  }

  push(val) { this.stack[this.sp++] = val; }
  pop() { if (this.sp <= 0) throw new Error('Stack underflow'); return this.stack[--this.sp]; }
  peek() { return this.stack[this.sp - 1]; }

  readU16() { const v = (this.program[this.pc] << 8) | this.program[this.pc + 1]; this.pc += 2; return v; }
  readI32() { const v = (this.program[this.pc] << 24) | (this.program[this.pc+1] << 16) | (this.program[this.pc+2] << 8) | this.program[this.pc+3]; this.pc += 4; return v; }

  run() {
    let steps = 0;
    while (!this.halted && this.pc < this.program.length) {
      if (++steps > this.maxSteps) throw new Error('Execution limit');
      this.step();
    }
    return this.output;
  }

  step() {
    const op = this.program[this.pc++];
    switch (op) {
      case OP.HALT: this.halted = true; break;
      case OP.PUSH: this.push(this.readI32()); break;
      case OP.POP: this.pop(); break;
      case OP.DUP: this.push(this.peek()); break;
      case OP.SWAP: { const b = this.pop(), a = this.pop(); this.push(b); this.push(a); break; }
      case OP.ADD: { const b = this.pop(), a = this.pop(); this.push(a + b); break; }
      case OP.SUB: { const b = this.pop(), a = this.pop(); this.push(a - b); break; }
      case OP.MUL: { const b = this.pop(), a = this.pop(); this.push(a * b); break; }
      case OP.DIV: { const b = this.pop(), a = this.pop(); this.push(Math.trunc(a / b)); break; }
      case OP.MOD: { const b = this.pop(), a = this.pop(); this.push(a % b); break; }
      case OP.NEG: this.push(-this.pop()); break;
      case OP.AND: { const b = this.pop(), a = this.pop(); this.push(a & b); break; }
      case OP.OR: { const b = this.pop(), a = this.pop(); this.push(a | b); break; }
      case OP.XOR: { const b = this.pop(), a = this.pop(); this.push(a ^ b); break; }
      case OP.NOT: this.push(~this.pop()); break;
      case OP.SHL: { const b = this.pop(), a = this.pop(); this.push(a << b); break; }
      case OP.SHR: { const b = this.pop(), a = this.pop(); this.push(a >> b); break; }
      case OP.EQ: { const b = this.pop(), a = this.pop(); this.push(a === b ? 1 : 0); break; }
      case OP.NE: { const b = this.pop(), a = this.pop(); this.push(a !== b ? 1 : 0); break; }
      case OP.LT: { const b = this.pop(), a = this.pop(); this.push(a < b ? 1 : 0); break; }
      case OP.GT: { const b = this.pop(), a = this.pop(); this.push(a > b ? 1 : 0); break; }
      case OP.LE: { const b = this.pop(), a = this.pop(); this.push(a <= b ? 1 : 0); break; }
      case OP.GE: { const b = this.pop(), a = this.pop(); this.push(a >= b ? 1 : 0); break; }
      case OP.JMP: this.pc = this.readU16(); break;
      case OP.JZ: { const addr = this.readU16(); if (this.pop() === 0) this.pc = addr; break; }
      case OP.JNZ: { const addr = this.readU16(); if (this.pop() !== 0) this.pc = addr; break; }
      case OP.CALL: { const addr = this.readU16(); this.callStack.push(this.pc); this.pc = addr; break; }
      case OP.RET: { if (this.callStack.length === 0) { this.halted = true; break; } this.pc = this.callStack.pop(); break; }
      case OP.LOAD: { const addr = this.readU16(); this.push(this.memory[addr]); break; }
      case OP.STORE: { const addr = this.readU16(); this.memory[addr] = this.pop(); break; }
      case OP.PRINT: this.output.push(this.pop()); break;
      default: throw new Error(`Unknown opcode: 0x${op.toString(16)} at pc=${this.pc - 1}`);
    }
  }
}

// Assembler: text → bytecode
export function assemble(source) {
  const labels = new Map();
  const fixups = [];
  const bytes = [];

  function emit(b) { bytes.push(b & 0xFF); }
  function emitU16(v) { bytes.push((v >> 8) & 0xFF, v & 0xFF); }
  function emitI32(v) { bytes.push((v >> 24) & 0xFF, (v >> 16) & 0xFF, (v >> 8) & 0xFF, v & 0xFF); }

  const opMap = Object.fromEntries(Object.entries(OP).map(([k, v]) => [k.toLowerCase(), v]));

  for (const rawLine of source.split('\n')) {
    const line = rawLine.replace(/;.*$/, '').trim();
    if (!line) continue;

    if (line.endsWith(':')) { labels.set(line.slice(0, -1), bytes.length); continue; }

    const [mnem, ...args] = line.split(/\s+/);
    const mn = mnem.toLowerCase();
    const opcode = opMap[mn];
    if (opcode === undefined) throw new Error(`Unknown mnemonic: ${mnem}`);
    emit(opcode);

    if (mn === 'push') emitI32(parseInt(args[0]));
    else if (['jmp', 'jz', 'jnz', 'call', 'load', 'store'].includes(mn)) {
      const arg = args[0];
      if (/^\d+$/.test(arg)) emitU16(parseInt(arg));
      else { fixups.push({ label: arg, pos: bytes.length }); emitU16(0); }
    }
  }

  // Resolve labels
  for (const { label, pos } of fixups) {
    const addr = labels.get(label);
    if (addr === undefined) throw new Error(`Undefined label: ${label}`);
    bytes[pos] = (addr >> 8) & 0xFF;
    bytes[pos + 1] = addr & 0xFF;
  }

  return new Uint8Array(bytes);
}

export function disassemble(program) {
  const bytes = program instanceof Uint8Array ? program : new Uint8Array(program);
  const lines = [];
  let pc = 0;
  while (pc < bytes.length) {
    const addr = pc;
    const op = bytes[pc++];
    const name = OP_NAME[op] || `0x${op.toString(16)}`;
    let line = `${String(addr).padStart(4, '0')}: ${name.padEnd(6)}`;
    if (op === OP.PUSH) { const v = (bytes[pc]<<24)|(bytes[pc+1]<<16)|(bytes[pc+2]<<8)|bytes[pc+3]; pc += 4; line += ` ${v}`; }
    else if ([OP.JMP,OP.JZ,OP.JNZ,OP.CALL,OP.LOAD,OP.STORE].includes(op)) { const v = (bytes[pc]<<8)|bytes[pc+1]; pc += 2; line += ` ${v}`; }
    lines.push(line);
  }
  return lines.join('\n');
}
