'use strict';

// ============================================================
// Forth Bytecode Compiler + VM
// Compiles Forth words to compact bytecode, executes on stack VM
// ============================================================

// Opcodes
const OP = {
  NOP:    0x00,
  PUSH:   0x01,  // push i32 literal (4 bytes follow)
  DUP:    0x02,
  DROP:   0x03,
  SWAP:   0x04,
  OVER:   0x05,
  ROT:    0x06,
  ADD:    0x10,
  SUB:    0x11,
  MUL:    0x12,
  DIV:    0x13,
  MOD:    0x14,
  NEGATE: 0x15,
  AND:    0x16,
  OR:     0x17,
  XOR:    0x18,
  INVERT: 0x19,
  LSHIFT: 0x1A,
  RSHIFT: 0x1B,
  EQ:     0x20,
  NE:     0x21,
  LT:     0x22,
  GT:     0x23,
  LE:     0x24,
  GE:     0x25,
  ZEQ:    0x26,
  ZLT:    0x27,
  NOT:    0x28,
  BRANCH: 0x30,  // unconditional jump (2 bytes offset follow)
  BRANCH0:0x31,  // branch if TOS == 0 (2 bytes offset follow)
  CALL:   0x32,  // call word (2 bytes word index follow)
  RET:    0x33,
  // Loop
  DO:     0x34,  // ( limit start -- ) push to rstack
  LOOP:   0x35,  // increment, check, branch (2 bytes offset)
  PLUSLOOP:0x36,  // ( inc -- ) add to index, check, branch
  I:      0x37,
  J:      0x38,
  // Return stack
  TOR:    0x39,  // >R
  RFROM:  0x3A,  // R>
  RAT:    0x3B,  // R@
  // Memory
  STORE:  0x40,  // !
  FETCH:  0x41,  // @
  PSTORE: 0x42,  // +!
  // I/O
  DOT:    0x50,  // .
  EMIT:   0x51,
  CR:     0x52,
  TYPE_S: 0x53,  // type string (2 bytes string index follow)
  // Stack extras
  NIP:    0x60,
  TUCK:   0x61,
  DDUP:   0x62,  // 2DUP
  DDROP:  0x63,  // 2DROP
  QDUP:   0x64,  // ?DUP
  DEPTH:  0x65,
  PICK:   0x66,
  // Arithmetic extras
  INC:    0x70,  // 1+
  DEC:    0x71,  // 1-
  MUL2:   0x72,  // 2*
  DIV2:   0x73,  // 2/
  ABS:    0x74,
  MIN:    0x75,
  MAX:    0x76,
  ZGT:    0x77,  // 0>
  // HALT
  HALT:   0xFF,
};

// Reverse lookup
const OP_NAMES = {};
for (const [name, code] of Object.entries(OP)) OP_NAMES[code] = name;

class BytecodeCompiler {
  constructor() {
    this.words = new Map();       // name -> { index, bytecode, strings }
    this.wordList = [];           // ordered list of compiled words
    this.strings = [];            // string constant pool
  }

  // Map Forth primitive names to opcodes
  static PRIM_OPS = {
    '+': OP.ADD, '-': OP.SUB, '*': OP.MUL, '/': OP.DIV, 'MOD': OP.MOD,
    'NEGATE': OP.NEGATE, 'ABS': OP.ABS, 'MIN': OP.MIN, 'MAX': OP.MAX,
    '1+': OP.INC, '1-': OP.DEC, '2*': OP.MUL2, '2/': OP.DIV2,
    'AND': OP.AND, 'OR': OP.OR, 'XOR': OP.XOR, 'INVERT': OP.INVERT,
    'LSHIFT': OP.LSHIFT, 'RSHIFT': OP.RSHIFT,
    '=': OP.EQ, '<>': OP.NE, '<': OP.LT, '>': OP.GT, '<=': OP.LE, '>=': OP.GE,
    '0=': OP.ZEQ, '0<': OP.ZLT, '0>': OP.ZGT, 'NOT': OP.NOT,
    'DUP': OP.DUP, 'DROP': OP.DROP, 'SWAP': OP.SWAP, 'OVER': OP.OVER, 'ROT': OP.ROT,
    'NIP': OP.NIP, 'TUCK': OP.TUCK, '2DUP': OP.DDUP, '2DROP': OP.DDROP,
    '?DUP': OP.QDUP, 'DEPTH': OP.DEPTH, 'PICK': OP.PICK,
    '>R': OP.TOR, 'R>': OP.RFROM, 'R@': OP.RAT,
    '!': OP.STORE, '@': OP.FETCH, '+!': OP.PSTORE,
    '.': OP.DOT, 'EMIT': OP.EMIT, 'CR': OP.CR,
    'TRUE': null, 'FALSE': null, // handled as literals
  };

  // Compile a Forth instruction buffer (from the interpreter's compileBuffer) to bytecode
  compileWord(name, instructions) {
    const buf = [];
    const strings = [];
    const patchList = []; // forward references to patch

    for (let i = 0; i < instructions.length; i++) {
      const instr = instructions[i];

      switch (instr.type) {
        case 'literal':
          buf.push(OP.PUSH);
          this._pushI32(buf, instr.value);
          break;

        case 'call': {
          const wname = instr.word.name;
          if (wname && BytecodeCompiler.PRIM_OPS[wname] !== undefined) {
            const op = BytecodeCompiler.PRIM_OPS[wname];
            if (op !== null) {
              buf.push(op);
            }
          } else if (wname && this.words.has(wname)) {
            buf.push(OP.CALL);
            this._pushU16(buf, this.words.get(wname).index);
          } else {
            // Inline code call — treat as a string output or special
            // For ." strings, we compile to TYPE_S
            buf.push(OP.NOP); // fallback
          }
          break;
        }

        case 'branch':
          patchList.push({ pos: buf.length, target: instr.target, type: 'branch' });
          buf.push(OP.BRANCH);
          this._pushU16(buf, 0); // placeholder
          break;

        case 'branch0':
          patchList.push({ pos: buf.length, target: instr.target, type: 'branch0' });
          buf.push(OP.BRANCH0);
          this._pushU16(buf, 0); // placeholder
          break;

        case 'do':
          buf.push(OP.DO);
          break;

        case 'loop':
          patchList.push({ pos: buf.length, target: instr.target, type: 'loop' });
          buf.push(OP.LOOP);
          this._pushU16(buf, 0);
          break;

        case 'plusloop':
          patchList.push({ pos: buf.length, target: instr.target, type: 'plusloop' });
          buf.push(OP.PLUSLOOP);
          this._pushU16(buf, 0);
          break;

        case 'i':
          buf.push(OP.I);
          break;

        case 'j':
          buf.push(OP.J);
          break;

        case 'recurse':
          buf.push(OP.CALL);
          this._pushU16(buf, this.wordList.length); // self-reference
          break;
      }
    }

    buf.push(OP.RET);

    // Build instruction offset map: instruction index -> byte offset
    const offsetMap = this._buildOffsetMap(instructions, buf);
    
    // Patch forward references
    for (const patch of patchList) {
      const targetOffset = offsetMap[patch.target] || buf.length;
      buf[patch.pos + 1] = (targetOffset >> 8) & 0xFF;
      buf[patch.pos + 2] = targetOffset & 0xFF;
    }

    const compiled = { 
      name, 
      index: this.wordList.length, 
      bytecode: new Uint8Array(buf),
      strings 
    };
    this.words.set(name.toUpperCase(), compiled);
    this.wordList.push(compiled);
    return compiled;
  }

  _buildOffsetMap(instructions, buf) {
    // Map instruction indices to byte offsets
    const map = {};
    let byteOffset = 0;
    
    for (let i = 0; i < instructions.length; i++) {
      map[i] = byteOffset;
      const instr = instructions[i];
      switch (instr.type) {
        case 'literal': byteOffset += 5; break; // PUSH + 4 bytes
        case 'call':
          if (instr.word.name && BytecodeCompiler.PRIM_OPS[instr.word.name] !== undefined) {
            const op = BytecodeCompiler.PRIM_OPS[instr.word.name];
            byteOffset += (op !== null) ? 1 : 0;
          } else if (instr.word.name && this.words.has(instr.word.name)) {
            byteOffset += 3;
          } else {
            byteOffset += 1; // NOP
          }
          break;
        case 'branch': case 'branch0': byteOffset += 3; break;
        case 'do': byteOffset += 1; break;
        case 'loop': case 'plusloop': byteOffset += 3; break;
        case 'i': case 'j': byteOffset += 1; break;
        case 'recurse': byteOffset += 3; break;
        default: byteOffset += 1; break;
      }
    }
    map[instructions.length] = byteOffset; // for end-of-code references
    return map;
  }

  _pushI32(buf, val) {
    buf.push((val >> 24) & 0xFF, (val >> 16) & 0xFF, (val >> 8) & 0xFF, val & 0xFF);
  }

  _pushU16(buf, val) {
    buf.push((val >> 8) & 0xFF, val & 0xFF);
  }

  // Disassemble bytecode
  disassemble(bytecode) {
    const lines = [];
    let ip = 0;
    while (ip < bytecode.length) {
      const op = bytecode[ip];
      const name = OP_NAMES[op] || `??? (0x${op.toString(16)})`;
      let line = `${ip.toString().padStart(4)}: ${name}`;
      
      if (op === OP.PUSH) {
        const val = (bytecode[ip+1] << 24) | (bytecode[ip+2] << 16) | (bytecode[ip+3] << 8) | bytecode[ip+4];
        line += ` ${val}`;
        ip += 5;
      } else if (op === OP.BRANCH || op === OP.BRANCH0 || op === OP.LOOP || op === OP.PLUSLOOP || op === OP.CALL || op === OP.TYPE_S) {
        const arg = (bytecode[ip+1] << 8) | bytecode[ip+2];
        line += ` ${arg}`;
        ip += 3;
      } else {
        ip++;
      }
      
      lines.push(line);
      if (op === OP.HALT || op === OP.RET) break;
    }
    return lines.join('\n');
  }
}

class BytecodeVM {
  constructor(opts = {}) {
    this.stack = new Int32Array(opts.stackSize || 1024);
    this.sp = 0;
    this.rstack = new Int32Array(opts.rstackSize || 256);
    this.rsp = 0;
    this.memory = new Int32Array(opts.memorySize || 65536);
    this.output = '';
    this.words = []; // compiled word bytecodes
  }

  push(v) { this.stack[this.sp++] = v; }
  pop() { if (this.sp <= 0) throw new Error('Stack underflow'); return this.stack[--this.sp]; }
  peek() { return this.stack[this.sp - 1]; }
  rpush(v) { this.rstack[this.rsp++] = v; }
  rpop() { return this.rstack[--this.rsp]; }

  loadWord(compiled) {
    this.words[compiled.index] = compiled.bytecode;
  }

  execute(bytecode) {
    let ip = 0;
    const code = bytecode;

    while (ip < code.length) {
      const op = code[ip];

      switch (op) {
        case OP.NOP: ip++; break;
        case OP.HALT: return;

        case OP.PUSH: {
          const val = (code[ip+1] << 24) | (code[ip+2] << 16) | (code[ip+3] << 8) | code[ip+4];
          this.push(val | 0); // ensure i32
          ip += 5;
          break;
        }

        // Stack
        case OP.DUP: this.push(this.peek()); ip++; break;
        case OP.DROP: this.sp--; ip++; break;
        case OP.SWAP: {
          const a = this.stack[this.sp-1];
          this.stack[this.sp-1] = this.stack[this.sp-2];
          this.stack[this.sp-2] = a;
          ip++; break;
        }
        case OP.OVER: this.push(this.stack[this.sp-2]); ip++; break;
        case OP.ROT: {
          const c = this.stack[this.sp-1], b = this.stack[this.sp-2], a = this.stack[this.sp-3];
          this.stack[this.sp-3] = b; this.stack[this.sp-2] = c; this.stack[this.sp-1] = a;
          ip++; break;
        }
        case OP.NIP: this.stack[this.sp-2] = this.stack[this.sp-1]; this.sp--; ip++; break;
        case OP.TUCK: {
          const b = this.pop(), a = this.pop();
          this.push(b); this.push(a); this.push(b);
          ip++; break;
        }
        case OP.DDUP: {
          this.push(this.stack[this.sp-2]); this.push(this.stack[this.sp-2]);
          ip++; break;
        }
        case OP.DDROP: this.sp -= 2; ip++; break;
        case OP.QDUP: if (this.peek() !== 0) this.push(this.peek()); ip++; break;
        case OP.DEPTH: this.push(this.sp); ip++; break;
        case OP.PICK: { const n = this.pop(); this.push(this.stack[this.sp-1-n]); ip++; break; }

        // Arithmetic
        case OP.ADD: { const b = this.pop(); this.stack[this.sp-1] += b; ip++; break; }
        case OP.SUB: { const b = this.pop(); this.stack[this.sp-1] -= b; ip++; break; }
        case OP.MUL: { const b = this.pop(); this.stack[this.sp-1] *= b; ip++; break; }
        case OP.DIV: { const b = this.pop(); this.stack[this.sp-1] = Math.trunc(this.stack[this.sp-1] / b); ip++; break; }
        case OP.MOD: { const b = this.pop(); this.stack[this.sp-1] %= b; ip++; break; }
        case OP.NEGATE: this.stack[this.sp-1] = -this.stack[this.sp-1]; ip++; break;
        case OP.ABS: this.stack[this.sp-1] = Math.abs(this.stack[this.sp-1]); ip++; break;
        case OP.MIN: { const b = this.pop(); if (b < this.stack[this.sp-1]) this.stack[this.sp-1] = b; ip++; break; }
        case OP.MAX: { const b = this.pop(); if (b > this.stack[this.sp-1]) this.stack[this.sp-1] = b; ip++; break; }
        case OP.INC: this.stack[this.sp-1]++; ip++; break;
        case OP.DEC: this.stack[this.sp-1]--; ip++; break;
        case OP.MUL2: this.stack[this.sp-1] <<= 1; ip++; break;
        case OP.DIV2: this.stack[this.sp-1] >>= 1; ip++; break;

        // Bitwise
        case OP.AND: { const b = this.pop(); this.stack[this.sp-1] &= b; ip++; break; }
        case OP.OR: { const b = this.pop(); this.stack[this.sp-1] |= b; ip++; break; }
        case OP.XOR: { const b = this.pop(); this.stack[this.sp-1] ^= b; ip++; break; }
        case OP.INVERT: this.stack[this.sp-1] = ~this.stack[this.sp-1]; ip++; break;
        case OP.LSHIFT: { const n = this.pop(); this.stack[this.sp-1] <<= n; ip++; break; }
        case OP.RSHIFT: { const n = this.pop(); this.stack[this.sp-1] >>>= n; ip++; break; }

        // Comparison
        case OP.EQ: { const b = this.pop(); this.stack[this.sp-1] = (this.stack[this.sp-1] === b) ? -1 : 0; ip++; break; }
        case OP.NE: { const b = this.pop(); this.stack[this.sp-1] = (this.stack[this.sp-1] !== b) ? -1 : 0; ip++; break; }
        case OP.LT: { const b = this.pop(); this.stack[this.sp-1] = (this.stack[this.sp-1] < b) ? -1 : 0; ip++; break; }
        case OP.GT: { const b = this.pop(); this.stack[this.sp-1] = (this.stack[this.sp-1] > b) ? -1 : 0; ip++; break; }
        case OP.LE: { const b = this.pop(); this.stack[this.sp-1] = (this.stack[this.sp-1] <= b) ? -1 : 0; ip++; break; }
        case OP.GE: { const b = this.pop(); this.stack[this.sp-1] = (this.stack[this.sp-1] >= b) ? -1 : 0; ip++; break; }
        case OP.ZEQ: this.stack[this.sp-1] = (this.stack[this.sp-1] === 0) ? -1 : 0; ip++; break;
        case OP.ZLT: this.stack[this.sp-1] = (this.stack[this.sp-1] < 0) ? -1 : 0; ip++; break;
        case OP.ZGT: this.stack[this.sp-1] = (this.stack[this.sp-1] > 0) ? -1 : 0; ip++; break;
        case OP.NOT: this.stack[this.sp-1] = (this.stack[this.sp-1] === 0) ? -1 : 0; ip++; break;

        // Branch
        case OP.BRANCH: {
          ip = (code[ip+1] << 8) | code[ip+2];
          break;
        }
        case OP.BRANCH0: {
          const target = (code[ip+1] << 8) | code[ip+2];
          if (this.pop() === 0) ip = target;
          else ip += 3;
          break;
        }

        // Loop
        case OP.DO: {
          const start = this.pop();
          const limit = this.pop();
          this.rpush(start);
          this.rpush(limit);
          ip++;
          break;
        }
        case OP.LOOP: {
          const target = (code[ip+1] << 8) | code[ip+2];
          const limit = this.rpop();
          let index = this.rpop();
          index++;
          if (index < limit) {
            this.rpush(index);
            this.rpush(limit);
            ip = target;
          } else {
            ip += 3;
          }
          break;
        }
        case OP.PLUSLOOP: {
          const target = (code[ip+1] << 8) | code[ip+2];
          const limit = this.rpop();
          let index = this.rpop();
          const inc = this.pop();
          const oldDiff = index - limit;
          index += inc;
          const newDiff = index - limit;
          if ((oldDiff < 0 && newDiff >= 0) || (oldDiff >= 0 && newDiff < 0)) {
            ip += 3;
          } else {
            this.rpush(index);
            this.rpush(limit);
            ip = target;
          }
          break;
        }
        case OP.I: this.push(this.rstack[this.rsp - 2]); ip++; break;
        case OP.J: this.push(this.rstack[this.rsp - 4]); ip++; break;

        // Return stack
        case OP.TOR: this.rpush(this.pop()); ip++; break;
        case OP.RFROM: this.push(this.rpop()); ip++; break;
        case OP.RAT: this.push(this.rstack[this.rsp - 1]); ip++; break;

        // Memory
        case OP.STORE: {
          const addr = this.pop(), val = this.pop();
          this.memory[addr] = val;
          ip++; break;
        }
        case OP.FETCH: {
          this.stack[this.sp-1] = this.memory[this.stack[this.sp-1]];
          ip++; break;
        }
        case OP.PSTORE: {
          const addr = this.pop(), val = this.pop();
          this.memory[addr] += val;
          ip++; break;
        }

        // I/O
        case OP.DOT: this.output += this.pop() + ' '; ip++; break;
        case OP.EMIT: this.output += String.fromCharCode(this.pop()); ip++; break;
        case OP.CR: this.output += '\n'; ip++; break;

        // Call
        case OP.CALL: {
          const wordIdx = (code[ip+1] << 8) | code[ip+2];
          const wordCode = this.words[wordIdx];
          if (!wordCode) throw new Error(`Unknown word index: ${wordIdx}`);
          // Save return address
          this.rpush(ip + 3);
          // Use a separate call to execute to support recursion properly
          this.execute(wordCode);
          ip = this.rpop();
          break;
        }

        case OP.RET:
          return;

        default:
          throw new Error(`Unknown opcode: 0x${op.toString(16)} at ip=${ip}`);
      }
    }
  }

  getStack() {
    return Array.from(this.stack.slice(0, this.sp));
  }

  run(bytecode) {
    this.output = '';
    this.execute(bytecode);
    return this.output;
  }
}

module.exports = { OP, OP_NAMES, BytecodeCompiler, BytecodeVM };
