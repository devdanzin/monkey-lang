// runtime.js — WebAssembly stack machine interpreter
// Executes decoded WASM modules with full control flow, memory, and imports.

import { decode, Op } from './decoder.js';

const PAGE_SIZE = 65536; // 64KB per WASM memory page

// ===== Trap Error =====
class WasmTrap extends Error {
  constructor(message) {
    super(message);
    this.name = 'WasmTrap';
  }
}

// ===== Control Flow Labels =====
class BranchSignal {
  constructor(depth, values) {
    this.depth = depth;
    this.values = values;
  }
}

class ReturnSignal {
  constructor(values) {
    this.values = values;
  }
}

// ===== Runtime Instance =====
export class WasmInstance {
  constructor(module, importObject = {}) {
    this.module = module;
    this.stack = [];
    this.callStack = [];
    this.globals = [];
    this.memory = null;
    this.table = null;
    this.exports = {};
    this.functions = [];
    this.funcTypes = [];

    // Process imports
    for (const imp of module.imports) {
      const mod = importObject[imp.module];
      if (!mod) throw new Error(`Missing import module: ${imp.module}`);
      const val = mod[imp.name];
      if (val === undefined) throw new Error(`Missing import: ${imp.module}.${imp.name}`);

      if (imp.desc.kind === 'func') {
        this.functions.push({ kind: 'host', func: val, typeIdx: imp.desc.typeIdx });
        this.funcTypes.push(module.types[imp.desc.typeIdx]);
      } else if (imp.desc.kind === 'memory') {
        this.memory = val;
      } else if (imp.desc.kind === 'global') {
        this.globals.push(val);
      } else if (imp.desc.kind === 'table') {
        this.table = val;
      }
    }

    // Add module functions
    for (let i = 0; i < module.functions.length; i++) {
      const typeIdx = module.functions[i];
      this.functions.push({ kind: 'wasm', typeIdx, code: module.code[i] });
      this.funcTypes.push(module.types[typeIdx]);
    }

    // Initialize memory
    if (!this.memory && module.memories.length > 0) {
      const memDef = module.memories[0];
      this.memory = new ArrayBuffer(memDef.min * PAGE_SIZE);
    }

    // Initialize data segments
    for (const seg of module.data) {
      const offset = this._evalConstExpr(seg.offset);
      new Uint8Array(this.memory).set(seg.data, offset);
    }

    // Initialize globals
    for (const g of module.globals) {
      const value = this._evalConstExpr(g.init);
      this.globals.push({ value, mutable: g.globalType.mutable, type: g.globalType.valType });
    }

    // Initialize table
    if (!this.table && module.tables.length > 0) {
      this.table = new Array(module.tables[0].limits.min).fill(null);
    }

    for (const elem of module.elements) {
      const offset = this._evalConstExpr(elem.offset);
      if (this.table) {
        for (let i = 0; i < elem.funcIndices.length; i++) {
          this.table[offset + i] = elem.funcIndices[i];
        }
      }
    }

    // Build exports
    for (const exp of module.exports) {
      switch (exp.kind) {
        case 'func':
          this.exports[exp.name] = (...args) => this.callFunction(exp.index, args);
          break;
        case 'memory':
          this.exports[exp.name] = this.memory;
          break;
        case 'global':
          this.exports[exp.name] = this.globals[exp.index];
          break;
        case 'table':
          this.exports[exp.name] = this.table;
          break;
      }
    }

    if (module.start !== null && module.start !== undefined) {
      this.callFunction(module.start, []);
    }
  }

  _evalConstExpr(instrs) {
    for (const instr of instrs) {
      if (instr.name === 'i32_const') return instr.value;
      if (instr.name === 'i64_const') return instr.value;
      if (instr.name === 'f32_const') return instr.value;
      if (instr.name === 'f64_const') return instr.value;
      if (instr.name === 'global_get') return this.globals[instr.globalIdx].value;
    }
    return 0;
  }

  callFunction(funcIdx, args) {
    const func = this.functions[funcIdx];
    if (!func) throw new WasmTrap(`Unknown function index: ${funcIdx}`);

    if (func.kind === 'host') {
      return func.func(...args);
    }

    const type = this.module.types[func.typeIdx];
    const locals = [...args];
    for (const localType of func.code.locals) {
      locals.push(defaultValue(localType));
    }

    this.callStack.push({ funcIdx, locals });
    try {
      const result = this._executeBlock(func.code.instructions, locals, type.results);
      if (type.results.length === 0) return undefined;
      if (type.results.length === 1) return result[0];
      return result;
    } catch (e) {
      if (e instanceof ReturnSignal) {
        if (type.results.length === 0) return undefined;
        if (type.results.length === 1) return e.values[0];
        return e.values;
      }
      throw e;
    } finally {
      this.callStack.pop();
    }
  }

  _executeBlock(instructions, locals, resultTypes, isLoop = false) {
    const stack = [];
    let ip = 0;

    while (ip < instructions.length) {
      const instr = instructions[ip];
      ip++;

      try {
        this._exec(instr, stack, locals, instructions, ip, (newIp) => { ip = newIp; });
      } catch (e) {
        if (e instanceof BranchSignal) {
          if (e.depth === 0) {
            if (isLoop) {
              ip = 0;
              stack.length = 0;
              for (const v of e.values) stack.push(v);
              continue;
            } else {
              return e.values;
            }
          } else {
            throw new BranchSignal(e.depth - 1, e.values);
          }
        } else if (e instanceof ReturnSignal) {
          throw e;
        } else {
          throw e;
        }
      }
    }

    const results = [];
    for (let i = 0; i < resultTypes.length; i++) {
      results.unshift(stack.pop());
    }
    return results;
  }

  _extractBlock(instructions, startIp) {
    const body = [];
    let elseBody = null;
    let currentTarget = body;
    let depth = 0;
    let ip = startIp;

    while (ip < instructions.length) {
      const instr = instructions[ip++];
      if (instr.op === Op.block || instr.op === Op.loop || instr.op === Op.if) {
        depth++;
        currentTarget.push(instr);
      } else if (instr.op === Op.else && depth === 0) {
        elseBody = [];
        currentTarget = elseBody;
      } else if (instr.op === Op.end) {
        if (depth === 0) break;
        depth--;
        currentTarget.push(instr);
      } else {
        currentTarget.push(instr);
      }
    }
    return { body, elseBody };
  }

  _skipBlock(instructions, startIp) {
    let depth = 0;
    let count = 0;
    for (let ip = startIp + 1; ip < instructions.length; ip++) {
      count++;
      const instr = instructions[ip];
      if (instr.op === Op.block || instr.op === Op.loop || instr.op === Op.if) depth++;
      else if (instr.op === Op.end) {
        if (depth === 0) return count;
        depth--;
      }
    }
    return count;
  }

  _exec(instr, stack, locals, instructions, ip, setIp) {
    const op = instr.op;

    switch (op) {
      case Op.unreachable: throw new WasmTrap('unreachable');
      case Op.nop: break;

      case Op.block: {
        const { body } = this._extractBlock(instructions, ip);
        setIp(ip + this._skipBlock(instructions, ip - 1));
        const results = this._executeBlock(body, locals, blockResultTypes(instr.blockType));
        for (const v of results) stack.push(v);
        break;
      }

      case Op.loop: {
        const { body } = this._extractBlock(instructions, ip);
        setIp(ip + this._skipBlock(instructions, ip - 1));
        const results = this._executeBlock(body, locals, blockResultTypes(instr.blockType), true);
        for (const v of results) stack.push(v);
        break;
      }

      case Op.if: {
        const condition = stack.pop();
        const { body, elseBody } = this._extractBlock(instructions, ip);
        setIp(ip + this._skipBlock(instructions, ip - 1));
        const branch = condition ? body : (elseBody || []);
        const results = this._executeBlock(branch, locals, blockResultTypes(instr.blockType));
        for (const v of results) stack.push(v);
        break;
      }

      case Op.br: throw new BranchSignal(instr.labelIdx, []);
      case Op.br_if: { const c = stack.pop(); if (c) throw new BranchSignal(instr.labelIdx, []); break; }
      case Op.br_table: {
        const idx = stack.pop();
        const target = idx >= 0 && idx < instr.labels.length ? instr.labels[idx] : instr.defaultLabel;
        throw new BranchSignal(target, []);
      }

      case Op.return: {
        const frame = this.callStack[this.callStack.length - 1];
        const funcType = this.funcTypes[frame?.funcIdx ?? 0];
        const values = [];
        if (funcType?.results) {
          for (let i = 0; i < funcType.results.length; i++) values.unshift(stack.pop());
        }
        throw new ReturnSignal(values);
      }

      case Op.call: {
        const func = this.functions[instr.funcIdx];
        const type = this.module.types[func.typeIdx];
        const args = [];
        for (let i = 0; i < type.params.length; i++) args.unshift(stack.pop());
        const result = this.callFunction(instr.funcIdx, args);
        if (type.results.length > 0) stack.push(result);
        break;
      }

      case Op.call_indirect: {
        const tableIdx = stack.pop();
        const type = this.module.types[instr.typeIdx];
        const args = [];
        for (let i = 0; i < type.params.length; i++) args.unshift(stack.pop());
        if (!this.table || tableIdx < 0 || tableIdx >= this.table.length) throw new WasmTrap('undefined element');
        const funcIdx = this.table[tableIdx];
        if (funcIdx === null || funcIdx === undefined) throw new WasmTrap('uninitialized element');
        const result = this.callFunction(funcIdx, args);
        if (type.results.length > 0) stack.push(result);
        break;
      }

      case Op.drop: stack.pop(); break;
      case Op.select: { const c = stack.pop(); const b = stack.pop(); const a = stack.pop(); stack.push(c ? a : b); break; }

      case Op.local_get: stack.push(locals[instr.localIdx]); break;
      case Op.local_set: locals[instr.localIdx] = stack.pop(); break;
      case Op.local_tee: locals[instr.localIdx] = stack[stack.length - 1]; break;
      case Op.global_get: stack.push(this.globals[instr.globalIdx].value); break;
      case Op.global_set: this.globals[instr.globalIdx].value = stack.pop(); break;

      // Memory
      case Op.i32_load: { const a = stack.pop() + instr.memarg.offset; this._chk(a, 4); stack.push(new DataView(this.memory).getInt32(a, true)); break; }
      case Op.i32_load8_s: { const a = stack.pop() + instr.memarg.offset; this._chk(a, 1); stack.push(new DataView(this.memory).getInt8(a)); break; }
      case Op.i32_load8_u: { const a = stack.pop() + instr.memarg.offset; this._chk(a, 1); stack.push(new DataView(this.memory).getUint8(a)); break; }
      case Op.i32_load16_s: { const a = stack.pop() + instr.memarg.offset; this._chk(a, 2); stack.push(new DataView(this.memory).getInt16(a, true)); break; }
      case Op.i32_load16_u: { const a = stack.pop() + instr.memarg.offset; this._chk(a, 2); stack.push(new DataView(this.memory).getUint16(a, true)); break; }
      case Op.i32_store: { const v = stack.pop(); const a = stack.pop() + instr.memarg.offset; this._chk(a, 4); new DataView(this.memory).setInt32(a, v, true); break; }
      case Op.i32_store8: { const v = stack.pop(); const a = stack.pop() + instr.memarg.offset; this._chk(a, 1); new DataView(this.memory).setUint8(a, v & 0xFF); break; }
      case Op.i32_store16: { const v = stack.pop(); const a = stack.pop() + instr.memarg.offset; this._chk(a, 2); new DataView(this.memory).setUint16(a, v & 0xFFFF, true); break; }
      case Op.memory_size: stack.push(Math.floor(this.memory.byteLength / PAGE_SIZE)); break;
      case Op.memory_grow: {
        const pages = stack.pop();
        const oldPages = Math.floor(this.memory.byteLength / PAGE_SIZE);
        const maxPages = this.module.memories[0]?.max ?? 65536;
        if (oldPages + pages > maxPages) { stack.push(-1); }
        else {
          const newMem = new ArrayBuffer((oldPages + pages) * PAGE_SIZE);
          new Uint8Array(newMem).set(new Uint8Array(this.memory));
          this.memory = newMem;
          for (const exp of this.module.exports) { if (exp.kind === 'memory') this.exports[exp.name] = this.memory; }
          stack.push(oldPages);
        }
        break;
      }

      // Constants
      case Op.i32_const: stack.push(instr.value | 0); break;
      case Op.i64_const: stack.push(instr.value); break;
      case Op.f32_const: stack.push(instr.value); break;
      case Op.f64_const: stack.push(instr.value); break;

      // i32 comparison
      case Op.i32_eqz: stack.push(stack.pop() === 0 ? 1 : 0); break;
      case Op.i32_eq: { const b = stack.pop(), a = stack.pop(); stack.push(a === b ? 1 : 0); break; }
      case Op.i32_ne: { const b = stack.pop(), a = stack.pop(); stack.push(a !== b ? 1 : 0); break; }
      case Op.i32_lt_s: { const b = stack.pop(), a = stack.pop(); stack.push((a | 0) < (b | 0) ? 1 : 0); break; }
      case Op.i32_lt_u: { const b = stack.pop(), a = stack.pop(); stack.push((a >>> 0) < (b >>> 0) ? 1 : 0); break; }
      case Op.i32_gt_s: { const b = stack.pop(), a = stack.pop(); stack.push((a | 0) > (b | 0) ? 1 : 0); break; }
      case Op.i32_gt_u: { const b = stack.pop(), a = stack.pop(); stack.push((a >>> 0) > (b >>> 0) ? 1 : 0); break; }
      case Op.i32_le_s: { const b = stack.pop(), a = stack.pop(); stack.push((a | 0) <= (b | 0) ? 1 : 0); break; }
      case Op.i32_le_u: { const b = stack.pop(), a = stack.pop(); stack.push((a >>> 0) <= (b >>> 0) ? 1 : 0); break; }
      case Op.i32_ge_s: { const b = stack.pop(), a = stack.pop(); stack.push((a | 0) >= (b | 0) ? 1 : 0); break; }
      case Op.i32_ge_u: { const b = stack.pop(), a = stack.pop(); stack.push((a >>> 0) >= (b >>> 0) ? 1 : 0); break; }

      // i32 arithmetic
      case Op.i32_clz: stack.push(Math.clz32(stack.pop())); break;
      case Op.i32_ctz: { const v = stack.pop(); stack.push(v === 0 ? 32 : 31 - Math.clz32(v & -v)); break; }
      case Op.i32_popcnt: { let v = stack.pop() >>> 0, c = 0; while (v) { c += v & 1; v >>>= 1; } stack.push(c); break; }
      case Op.i32_add: { const b = stack.pop(), a = stack.pop(); stack.push((a + b) | 0); break; }
      case Op.i32_sub: { const b = stack.pop(), a = stack.pop(); stack.push((a - b) | 0); break; }
      case Op.i32_mul: { const b = stack.pop(), a = stack.pop(); stack.push(Math.imul(a, b)); break; }
      case Op.i32_div_s: {
        const b = stack.pop() | 0, a = stack.pop() | 0;
        if (b === 0) throw new WasmTrap('integer divide by zero');
        if (a === -2147483648 && b === -1) throw new WasmTrap('integer overflow');
        stack.push((a / b) | 0); break;
      }
      case Op.i32_div_u: {
        const b = stack.pop() >>> 0, a = stack.pop() >>> 0;
        if (b === 0) throw new WasmTrap('integer divide by zero');
        stack.push((a / b) >>> 0); break;
      }
      case Op.i32_rem_s: {
        const b = stack.pop() | 0, a = stack.pop() | 0;
        if (b === 0) throw new WasmTrap('integer divide by zero');
        stack.push(b === -1 ? 0 : (a % b) | 0); break;
      }
      case Op.i32_rem_u: {
        const b = stack.pop() >>> 0, a = stack.pop() >>> 0;
        if (b === 0) throw new WasmTrap('integer divide by zero');
        stack.push((a % b) >>> 0); break;
      }
      case Op.i32_and: { const b = stack.pop(), a = stack.pop(); stack.push(a & b); break; }
      case Op.i32_or: { const b = stack.pop(), a = stack.pop(); stack.push(a | b); break; }
      case Op.i32_xor: { const b = stack.pop(), a = stack.pop(); stack.push(a ^ b); break; }
      case Op.i32_shl: { const b = stack.pop(), a = stack.pop(); stack.push((a << (b & 31)) | 0); break; }
      case Op.i32_shr_s: { const b = stack.pop(), a = stack.pop(); stack.push((a >> (b & 31)) | 0); break; }
      case Op.i32_shr_u: { const b = stack.pop(), a = stack.pop(); stack.push((a >>> (b & 31)) | 0); break; }
      case Op.i32_rotl: { const b = stack.pop() & 31, a = stack.pop() >>> 0; stack.push(((a << b) | (a >>> (32 - b))) | 0); break; }
      case Op.i32_rotr: { const b = stack.pop() & 31, a = stack.pop() >>> 0; stack.push(((a >>> b) | (a << (32 - b))) | 0); break; }

      // f64
      case Op.f64_add: { const b = stack.pop(), a = stack.pop(); stack.push(a + b); break; }
      case Op.f64_sub: { const b = stack.pop(), a = stack.pop(); stack.push(a - b); break; }
      case Op.f64_mul: { const b = stack.pop(), a = stack.pop(); stack.push(a * b); break; }
      case Op.f64_div: { const b = stack.pop(), a = stack.pop(); stack.push(a / b); break; }
      case Op.f64_neg: stack.push(-stack.pop()); break;
      case Op.f64_abs: stack.push(Math.abs(stack.pop())); break;
      case Op.f64_ceil: stack.push(Math.ceil(stack.pop())); break;
      case Op.f64_floor: stack.push(Math.floor(stack.pop())); break;
      case Op.f64_sqrt: stack.push(Math.sqrt(stack.pop())); break;
      case Op.f64_min: { const b = stack.pop(), a = stack.pop(); stack.push(Math.min(a, b)); break; }
      case Op.f64_max: { const b = stack.pop(), a = stack.pop(); stack.push(Math.max(a, b)); break; }
      case Op.f64_eq: { const b = stack.pop(), a = stack.pop(); stack.push(a === b ? 1 : 0); break; }
      case Op.f64_ne: { const b = stack.pop(), a = stack.pop(); stack.push(a !== b ? 1 : 0); break; }
      case Op.f64_lt: { const b = stack.pop(), a = stack.pop(); stack.push(a < b ? 1 : 0); break; }
      case Op.f64_gt: { const b = stack.pop(), a = stack.pop(); stack.push(a > b ? 1 : 0); break; }
      case Op.f64_le: { const b = stack.pop(), a = stack.pop(); stack.push(a <= b ? 1 : 0); break; }
      case Op.f64_ge: { const b = stack.pop(), a = stack.pop(); stack.push(a >= b ? 1 : 0); break; }

      // Conversions
      case Op.i32_wrap_i64: stack.push(Number(BigInt.asIntN(32, stack.pop())) | 0); break;
      case Op.i64_extend_i32_s: stack.push(BigInt(stack.pop() | 0)); break;
      case Op.i64_extend_i32_u: stack.push(BigInt(stack.pop() >>> 0)); break;
      case Op.f64_convert_i32_s: stack.push(stack.pop() | 0); break;
      case Op.f64_convert_i32_u: stack.push(stack.pop() >>> 0); break;
      case Op.i32_trunc_f64_s: {
        const v = stack.pop();
        if (isNaN(v)) throw new WasmTrap('invalid conversion to integer');
        if (v >= 2147483648 || v < -2147483648) throw new WasmTrap('integer overflow');
        stack.push(Math.trunc(v) | 0); break;
      }
      case Op.i32_extend8_s: { const v = stack.pop(); stack.push((v << 24) >> 24); break; }
      case Op.i32_extend16_s: { const v = stack.pop(); stack.push((v << 16) >> 16); break; }

      default:
        throw new WasmTrap(`Unimplemented opcode: 0x${op.toString(16)} (${instr.name})`);
    }
  }

  _chk(addr, size) {
    if (!this.memory) throw new WasmTrap('out of bounds memory access');
    if (addr < 0 || addr + size > this.memory.byteLength) throw new WasmTrap('out of bounds memory access');
  }
}

function blockResultTypes(bt) {
  if (!bt) return [];
  if (bt.kind === 'empty') return [];
  if (bt.kind === 'valtype') return [bt.type];
  return [];
}

function defaultValue(type) {
  switch (type) {
    case 'i32': return 0;
    case 'i64': return 0n;
    case 'f32': case 'f64': return 0.0;
    default: return 0;
  }
}

export function instantiate(buffer, importObject = {}) {
  const module = decode(buffer);
  return new WasmInstance(module, importObject);
}

export { WasmTrap, PAGE_SIZE };
