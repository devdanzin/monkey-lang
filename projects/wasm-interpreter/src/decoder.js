// decoder.js — WebAssembly binary format decoder
// Parses a .wasm binary into a structured Module object.
// Reference: WebAssembly Binary Format Specification v1.0

// Section IDs
const SECTION_CUSTOM   = 0;
const SECTION_TYPE     = 1;
const SECTION_IMPORT   = 2;
const SECTION_FUNCTION = 3;
const SECTION_TABLE    = 4;
const SECTION_MEMORY   = 5;
const SECTION_GLOBAL   = 6;
const SECTION_EXPORT   = 7;
const SECTION_START    = 8;
const SECTION_ELEMENT  = 9;
const SECTION_CODE     = 10;
const SECTION_DATA     = 11;

// Value types
const TYPE_I32     = 0x7F;
const TYPE_I64     = 0x7E;
const TYPE_F32     = 0x7D;
const TYPE_F64     = 0x7C;
const TYPE_FUNCREF = 0x70;
const TYPE_EXTERNREF = 0x6F;

// Export kinds
const EXPORT_FUNC   = 0x00;
const EXPORT_TABLE  = 0x01;
const EXPORT_MEMORY = 0x02;
const EXPORT_GLOBAL = 0x03;

// Import kinds
const IMPORT_FUNC   = 0x00;
const IMPORT_TABLE  = 0x01;
const IMPORT_MEMORY = 0x02;
const IMPORT_GLOBAL = 0x03;

// Opcodes (subset — add as needed)
const Op = {
  // Control
  unreachable: 0x00, nop: 0x01, block: 0x02, loop: 0x03, if: 0x04, else: 0x05,
  end: 0x0B, br: 0x0C, br_if: 0x0D, br_table: 0x0E, return: 0x0F,
  call: 0x10, call_indirect: 0x11,

  // Parametric
  drop: 0x1A, select: 0x1B,

  // Variable
  local_get: 0x20, local_set: 0x21, local_tee: 0x22,
  global_get: 0x23, global_set: 0x24,

  // Memory
  i32_load: 0x28, i64_load: 0x29, f32_load: 0x2A, f64_load: 0x2B,
  i32_load8_s: 0x2C, i32_load8_u: 0x2D, i32_load16_s: 0x2E, i32_load16_u: 0x2F,
  i32_store: 0x36, i64_store: 0x37, f32_store: 0x38, f64_store: 0x39,
  i32_store8: 0x3A, i32_store16: 0x3B,
  memory_size: 0x3F, memory_grow: 0x40,

  // Constants
  i32_const: 0x41, i64_const: 0x42, f32_const: 0x43, f64_const: 0x44,

  // i32 comparison
  i32_eqz: 0x45, i32_eq: 0x46, i32_ne: 0x47,
  i32_lt_s: 0x48, i32_lt_u: 0x49, i32_gt_s: 0x4A, i32_gt_u: 0x4B,
  i32_le_s: 0x4C, i32_le_u: 0x4D, i32_ge_s: 0x4E, i32_ge_u: 0x4F,

  // i64 comparison
  i64_eqz: 0x50, i64_eq: 0x51, i64_ne: 0x52,
  i64_lt_s: 0x53, i64_lt_u: 0x54, i64_gt_s: 0x55, i64_gt_u: 0x56,
  i64_le_s: 0x57, i64_le_u: 0x58, i64_ge_s: 0x59, i64_ge_u: 0x5A,

  // f32 comparison
  f32_eq: 0x5B, f32_ne: 0x5C, f32_lt: 0x5D, f32_gt: 0x5E, f32_le: 0x5F, f32_ge: 0x60,

  // f64 comparison
  f64_eq: 0x61, f64_ne: 0x62, f64_lt: 0x63, f64_gt: 0x64, f64_le: 0x65, f64_ge: 0x66,

  // i32 arithmetic
  i32_clz: 0x67, i32_ctz: 0x68, i32_popcnt: 0x69,
  i32_add: 0x6A, i32_sub: 0x6B, i32_mul: 0x6C,
  i32_div_s: 0x6D, i32_div_u: 0x6E, i32_rem_s: 0x6F, i32_rem_u: 0x70,
  i32_and: 0x71, i32_or: 0x72, i32_xor: 0x73,
  i32_shl: 0x74, i32_shr_s: 0x75, i32_shr_u: 0x76, i32_rotl: 0x77, i32_rotr: 0x78,

  // i64 arithmetic
  i64_clz: 0x79, i64_ctz: 0x7A, i64_popcnt: 0x7B,
  i64_add: 0x7C, i64_sub: 0x7D, i64_mul: 0x7E,
  i64_div_s: 0x7F, i64_div_u: 0x80, i64_rem_s: 0x81, i64_rem_u: 0x82,
  i64_and: 0x83, i64_or: 0x84, i64_xor: 0x85,
  i64_shl: 0x86, i64_shr_s: 0x87, i64_shr_u: 0x88, i64_rotl: 0x89, i64_rotr: 0x8A,

  // f32 arithmetic
  f32_abs: 0x8B, f32_neg: 0x8C, f32_ceil: 0x8D, f32_floor: 0x8E,
  f32_trunc: 0x8F, f32_nearest: 0x90, f32_sqrt: 0x91,
  f32_add: 0x92, f32_sub: 0x93, f32_mul: 0x94, f32_div: 0x95,
  f32_min: 0x96, f32_max: 0x97, f32_copysign: 0x98,

  // f64 arithmetic
  f64_abs: 0x99, f64_neg: 0x9A, f64_ceil: 0x9B, f64_floor: 0x9C,
  f64_trunc: 0x9D, f64_nearest: 0x9E, f64_sqrt: 0x9F,
  f64_add: 0xA0, f64_sub: 0xA1, f64_mul: 0xA2, f64_div: 0xA3,
  f64_min: 0xA4, f64_max: 0xA5, f64_copysign: 0xA6,

  // Conversions
  i32_wrap_i64: 0xA7,
  i32_trunc_f32_s: 0xA8, i32_trunc_f32_u: 0xA9,
  i32_trunc_f64_s: 0xAA, i32_trunc_f64_u: 0xAB,
  i64_extend_i32_s: 0xAC, i64_extend_i32_u: 0xAD,
  i64_trunc_f32_s: 0xAE, i64_trunc_f32_u: 0xAF,
  i64_trunc_f64_s: 0xB0, i64_trunc_f64_u: 0xB1,
  f32_convert_i32_s: 0xB2, f32_convert_i32_u: 0xB3,
  f32_convert_i64_s: 0xB4, f32_convert_i64_u: 0xB5,
  f32_demote_f64: 0xB6,
  f64_convert_i32_s: 0xB7, f64_convert_i32_u: 0xB8,
  f64_convert_i64_s: 0xB9, f64_convert_i64_u: 0xBA,
  f64_promote_f32: 0xBB,
  i32_reinterpret_f32: 0xBC, i64_reinterpret_f64: 0xBD,
  f32_reinterpret_i32: 0xBE, f64_reinterpret_i64: 0xBF,

  // Sign extension
  i32_extend8_s: 0xC0, i32_extend16_s: 0xC1,
  i64_extend8_s: 0xC2, i64_extend16_s: 0xC3, i64_extend32_s: 0xC4,
};

// Build reverse lookup
const OpName = {};
for (const [name, code] of Object.entries(Op)) {
  OpName[code] = name;
}

// ===== Binary Reader =====

class BinaryReader {
  constructor(buffer) {
    this.buffer = new Uint8Array(buffer);
    this.view = new DataView(buffer instanceof ArrayBuffer ? buffer : buffer.buffer);
    this.offset = 0;
  }

  get remaining() { return this.buffer.length - this.offset; }
  get eof() { return this.offset >= this.buffer.length; }

  readByte() {
    if (this.offset >= this.buffer.length) throw new Error('Unexpected end of input');
    return this.buffer[this.offset++];
  }

  readBytes(n) {
    if (this.offset + n > this.buffer.length) throw new Error('Unexpected end of input');
    const bytes = this.buffer.slice(this.offset, this.offset + n);
    this.offset += n;
    return bytes;
  }

  // LEB128 unsigned integer
  readU32() {
    let result = 0;
    let shift = 0;
    let byte;
    do {
      byte = this.readByte();
      result |= (byte & 0x7F) << shift;
      shift += 7;
      if (shift > 35) throw new Error('LEB128 too long');
    } while (byte & 0x80);
    return result >>> 0; // ensure unsigned
  }

  // LEB128 signed integer (i32)
  readI32() {
    let result = 0;
    let shift = 0;
    let byte;
    do {
      byte = this.readByte();
      result |= (byte & 0x7F) << shift;
      shift += 7;
    } while (byte & 0x80);
    // Sign extend
    if (shift < 32 && (byte & 0x40)) {
      result |= (~0 << shift);
    }
    return result | 0; // ensure signed
  }

  // LEB128 signed integer (i64) — returns BigInt
  readI64() {
    let result = 0n;
    let shift = 0n;
    let byte;
    do {
      byte = this.readByte();
      result |= BigInt(byte & 0x7F) << shift;
      shift += 7n;
    } while (byte & 0x80);
    if (shift < 64n && (byte & 0x40)) {
      result |= (~0n << shift);
    }
    return BigInt.asIntN(64, result);
  }

  readF32() {
    const val = this.view.getFloat32(this.offset, true);
    this.offset += 4;
    return val;
  }

  readF64() {
    const val = this.view.getFloat64(this.offset, true);
    this.offset += 8;
    return val;
  }

  readString() {
    const len = this.readU32();
    const bytes = this.readBytes(len);
    return new TextDecoder().decode(bytes);
  }
}

// ===== Decoder =====

function decodeValueType(reader) {
  const byte = reader.readByte();
  switch (byte) {
    case TYPE_I32: return 'i32';
    case TYPE_I64: return 'i64';
    case TYPE_F32: return 'f32';
    case TYPE_F64: return 'f64';
    case TYPE_FUNCREF: return 'funcref';
    case TYPE_EXTERNREF: return 'externref';
    default: throw new Error(`Unknown value type: 0x${byte.toString(16)}`);
  }
}

function decodeBlockType(reader) {
  const byte = reader.buffer[reader.offset];
  if (byte === 0x40) { reader.offset++; return { kind: 'empty' }; }
  if (byte === TYPE_I32 || byte === TYPE_I64 || byte === TYPE_F32 || byte === TYPE_F64) {
    reader.offset++;
    return { kind: 'valtype', type: decodeValueTypeFromByte(byte) };
  }
  // Type index (signed LEB128)
  const idx = reader.readI32();
  return { kind: 'typeidx', index: idx };
}

function decodeValueTypeFromByte(byte) {
  switch (byte) {
    case TYPE_I32: return 'i32';
    case TYPE_I64: return 'i64';
    case TYPE_F32: return 'f32';
    case TYPE_F64: return 'f64';
    default: throw new Error(`Unknown value type: 0x${byte.toString(16)}`);
  }
}

function decodeFuncType(reader) {
  const tag = reader.readByte();
  if (tag !== 0x60) throw new Error(`Expected functype tag 0x60, got 0x${tag.toString(16)}`);
  const paramCount = reader.readU32();
  const params = [];
  for (let i = 0; i < paramCount; i++) params.push(decodeValueType(reader));
  const resultCount = reader.readU32();
  const results = [];
  for (let i = 0; i < resultCount; i++) results.push(decodeValueType(reader));
  return { params, results };
}

function decodeMemarg(reader) {
  const align = reader.readU32();
  const offset = reader.readU32();
  return { align, offset };
}

function decodeInstruction(reader) {
  const opcode = reader.readByte();
  const name = OpName[opcode];

  switch (opcode) {
    // Control flow with block types
    case Op.block:
    case Op.loop:
    case Op.if:
      return { op: opcode, name, blockType: decodeBlockType(reader) };

    case Op.else:
    case Op.end:
    case Op.unreachable:
    case Op.nop:
    case Op.return:
    case Op.drop:
    case Op.select:
      return { op: opcode, name };

    // Branch
    case Op.br:
    case Op.br_if:
      return { op: opcode, name, labelIdx: reader.readU32() };

    case Op.br_table: {
      const count = reader.readU32();
      const labels = [];
      for (let i = 0; i < count; i++) labels.push(reader.readU32());
      const defaultLabel = reader.readU32();
      return { op: opcode, name, labels, defaultLabel };
    }

    // Call
    case Op.call:
      return { op: opcode, name, funcIdx: reader.readU32() };
    case Op.call_indirect: {
      const typeIdx = reader.readU32();
      const tableIdx = reader.readU32(); // must be 0 in MVP
      return { op: opcode, name, typeIdx, tableIdx };
    }

    // Variables
    case Op.local_get:
    case Op.local_set:
    case Op.local_tee:
      return { op: opcode, name, localIdx: reader.readU32() };

    case Op.global_get:
    case Op.global_set:
      return { op: opcode, name, globalIdx: reader.readU32() };

    // Memory operations
    case Op.i32_load: case Op.i64_load: case Op.f32_load: case Op.f64_load:
    case Op.i32_load8_s: case Op.i32_load8_u: case Op.i32_load16_s: case Op.i32_load16_u:
    case Op.i32_store: case Op.i64_store: case Op.f32_store: case Op.f64_store:
    case Op.i32_store8: case Op.i32_store16:
      return { op: opcode, name, memarg: decodeMemarg(reader) };

    case Op.memory_size:
    case Op.memory_grow:
      reader.readByte(); // reserved byte (must be 0)
      return { op: opcode, name };

    // Constants
    case Op.i32_const:
      return { op: opcode, name, value: reader.readI32() };
    case Op.i64_const:
      return { op: opcode, name, value: reader.readI64() };
    case Op.f32_const:
      return { op: opcode, name, value: reader.readF32() };
    case Op.f64_const:
      return { op: opcode, name, value: reader.readF64() };

    // All other ops (no immediates)
    default:
      if (name) return { op: opcode, name };
      throw new Error(`Unknown opcode: 0x${opcode.toString(16)} at offset ${reader.offset - 1}`);
  }
}

function decodeExpression(reader) {
  const instructions = [];
  let depth = 0;
  while (true) {
    const instr = decodeInstruction(reader);
    if (instr.op === Op.end) {
      if (depth === 0) break;
      depth--;
      instructions.push(instr);
    } else {
      if (instr.op === Op.block || instr.op === Op.loop || instr.op === Op.if) {
        depth++;
      }
      instructions.push(instr);
    }
  }
  return instructions;
}

function decodeCodeBody(reader) {
  const bodySize = reader.readU32();
  const bodyEnd = reader.offset + bodySize;

  // Locals
  const localDeclCount = reader.readU32();
  const locals = [];
  for (let i = 0; i < localDeclCount; i++) {
    const count = reader.readU32();
    const type = decodeValueType(reader);
    for (let j = 0; j < count; j++) locals.push(type);
  }

  // Instructions (until end opcode)
  const instructions = decodeExpression(reader);

  // Ensure we consumed exactly the right amount
  if (reader.offset !== bodyEnd) {
    reader.offset = bodyEnd; // recover
  }

  return { locals, instructions };
}

function decodeLimits(reader) {
  const flag = reader.readByte();
  const min = reader.readU32();
  const max = flag === 0x01 ? reader.readU32() : undefined;
  return { min, max };
}

function decodeTableType(reader) {
  const elemType = reader.readByte(); // 0x70 = funcref
  const limits = decodeLimits(reader);
  return { elemType, limits };
}

function decodeGlobalType(reader) {
  const valType = decodeValueType(reader);
  const mutable = reader.readByte() === 0x01;
  return { valType, mutable };
}

// ===== Main decoder =====

export function decode(buffer) {
  const reader = new BinaryReader(buffer);

  // Magic number: \0asm
  const magic = reader.readBytes(4);
  if (magic[0] !== 0x00 || magic[1] !== 0x61 || magic[2] !== 0x73 || magic[3] !== 0x6D) {
    throw new Error('Not a WebAssembly module (bad magic)');
  }

  // Version
  const version = reader.readBytes(4);
  if (version[0] !== 0x01 || version[1] !== 0x00 || version[2] !== 0x00 || version[3] !== 0x00) {
    throw new Error(`Unsupported WASM version: ${Array.from(version).map(b => b.toString(16)).join(' ')}`);
  }

  const module = {
    types: [],
    imports: [],
    functions: [],   // type indices
    tables: [],
    memories: [],
    globals: [],
    exports: [],
    start: null,
    elements: [],
    code: [],
    data: [],
    customs: [],
  };

  // Read sections
  while (!reader.eof) {
    const sectionId = reader.readByte();
    const sectionSize = reader.readU32();
    const sectionEnd = reader.offset + sectionSize;

    switch (sectionId) {
      case SECTION_CUSTOM: {
        const name = reader.readString();
        const payload = reader.readBytes(sectionEnd - reader.offset);
        module.customs.push({ name, payload });
        break;
      }

      case SECTION_TYPE: {
        const count = reader.readU32();
        for (let i = 0; i < count; i++) {
          module.types.push(decodeFuncType(reader));
        }
        break;
      }

      case SECTION_IMPORT: {
        const count = reader.readU32();
        for (let i = 0; i < count; i++) {
          const moduleName = reader.readString();
          const name = reader.readString();
          const kind = reader.readByte();
          let desc;
          switch (kind) {
            case IMPORT_FUNC: desc = { kind: 'func', typeIdx: reader.readU32() }; break;
            case IMPORT_TABLE: desc = { kind: 'table', tableType: decodeTableType(reader) }; break;
            case IMPORT_MEMORY: desc = { kind: 'memory', limits: decodeLimits(reader) }; break;
            case IMPORT_GLOBAL: desc = { kind: 'global', globalType: decodeGlobalType(reader) }; break;
            default: throw new Error(`Unknown import kind: ${kind}`);
          }
          module.imports.push({ module: moduleName, name, desc });
        }
        break;
      }

      case SECTION_FUNCTION: {
        const count = reader.readU32();
        for (let i = 0; i < count; i++) {
          module.functions.push(reader.readU32()); // type index
        }
        break;
      }

      case SECTION_TABLE: {
        const count = reader.readU32();
        for (let i = 0; i < count; i++) {
          module.tables.push(decodeTableType(reader));
        }
        break;
      }

      case SECTION_MEMORY: {
        const count = reader.readU32();
        for (let i = 0; i < count; i++) {
          module.memories.push(decodeLimits(reader));
        }
        break;
      }

      case SECTION_GLOBAL: {
        const count = reader.readU32();
        for (let i = 0; i < count; i++) {
          const globalType = decodeGlobalType(reader);
          const init = decodeExpression(reader);
          module.globals.push({ globalType, init });
        }
        break;
      }

      case SECTION_EXPORT: {
        const count = reader.readU32();
        for (let i = 0; i < count; i++) {
          const name = reader.readString();
          const kind = reader.readByte();
          const index = reader.readU32();
          let kindName;
          switch (kind) {
            case EXPORT_FUNC: kindName = 'func'; break;
            case EXPORT_TABLE: kindName = 'table'; break;
            case EXPORT_MEMORY: kindName = 'memory'; break;
            case EXPORT_GLOBAL: kindName = 'global'; break;
            default: throw new Error(`Unknown export kind: ${kind}`);
          }
          module.exports.push({ name, kind: kindName, index });
        }
        break;
      }

      case SECTION_START: {
        module.start = reader.readU32();
        break;
      }

      case SECTION_ELEMENT: {
        const count = reader.readU32();
        for (let i = 0; i < count; i++) {
          const tableIdx = reader.readU32();
          const offset = decodeExpression(reader);
          const funcCount = reader.readU32();
          const funcIndices = [];
          for (let j = 0; j < funcCount; j++) {
            funcIndices.push(reader.readU32());
          }
          module.elements.push({ tableIdx, offset, funcIndices });
        }
        break;
      }

      case SECTION_CODE: {
        const count = reader.readU32();
        for (let i = 0; i < count; i++) {
          module.code.push(decodeCodeBody(reader));
        }
        break;
      }

      case SECTION_DATA: {
        const count = reader.readU32();
        for (let i = 0; i < count; i++) {
          const memIdx = reader.readU32();
          const offset = decodeExpression(reader);
          const size = reader.readU32();
          const data = reader.readBytes(size);
          module.data.push({ memIdx, offset, data });
        }
        break;
      }

      default:
        // Skip unknown section
        reader.offset = sectionEnd;
    }

    // Ensure offset is correct
    if (reader.offset !== sectionEnd) {
      reader.offset = sectionEnd;
    }
  }

  return module;
}

export { Op, OpName, BinaryReader, TYPE_I32, TYPE_I64, TYPE_F32, TYPE_F64 };
