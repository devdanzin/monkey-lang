// WASM Disassembler — binary → WAT (WebAssembly Text Format)
// Reads .wasm binary files and produces human-readable WAT output.

// === Binary Reader ===

export class BinaryReader {
  constructor(buffer) {
    this.buffer = new Uint8Array(buffer);
    this.offset = 0;
  }

  get eof() { return this.offset >= this.buffer.length; }
  get remaining() { return this.buffer.length - this.offset; }

  readByte() {
    if (this.offset >= this.buffer.length) throw new Error('Unexpected end of binary');
    return this.buffer[this.offset++];
  }

  readBytes(n) {
    if (this.offset + n > this.buffer.length) throw new Error('Unexpected end of binary');
    const bytes = this.buffer.slice(this.offset, this.offset + n);
    this.offset += n;
    return bytes;
  }

  readULEB128() {
    let result = 0;
    let shift = 0;
    let byte;
    do {
      byte = this.readByte();
      result |= (byte & 0x7f) << shift;
      shift += 7;
    } while (byte & 0x80);
    return result >>> 0; // Ensure unsigned
  }

  readSLEB128() {
    let result = 0;
    let shift = 0;
    let byte;
    do {
      byte = this.readByte();
      result |= (byte & 0x7f) << shift;
      shift += 7;
    } while (byte & 0x80);
    // Sign extend
    if (shift < 32 && (byte & 0x40)) {
      result |= (~0 << shift);
    }
    return result;
  }

  readF32() {
    const bytes = this.readBytes(4);
    return new Float32Array(bytes.buffer)[0];
  }

  readF64() {
    const bytes = this.readBytes(8);
    return new Float64Array(bytes.buffer)[0];
  }

  readString() {
    const len = this.readULEB128();
    const bytes = this.readBytes(len);
    return new TextDecoder().decode(bytes);
  }
}

// === Section IDs ===
const SectionId = {
  0: 'custom', 1: 'type', 2: 'import', 3: 'function',
  4: 'table', 5: 'memory', 6: 'global', 7: 'export',
  8: 'start', 9: 'element', 10: 'code', 11: 'data',
  12: 'datacount',
};

// === Value Types ===
const ValTypeName = {
  0x7f: 'i32', 0x7e: 'i64', 0x7d: 'f32', 0x7c: 'f64',
  0x70: 'funcref', 0x6f: 'externref',
};

// === Export Kinds ===
const ExportKindName = {
  0: 'func', 1: 'table', 2: 'memory', 3: 'global',
};

// === Opcode Names ===
const OpNames = {
  0x00: 'unreachable', 0x01: 'nop',
  0x02: 'block', 0x03: 'loop', 0x04: 'if', 0x05: 'else',
  0x0b: 'end', 0x0c: 'br', 0x0d: 'br_if', 0x0e: 'br_table',
  0x0f: 'return', 0x10: 'call', 0x11: 'call_indirect',
  0x1a: 'drop', 0x1b: 'select',
  0x20: 'local.get', 0x21: 'local.set', 0x22: 'local.tee',
  0x23: 'global.get', 0x24: 'global.set',
  0x28: 'i32.load', 0x29: 'i64.load', 0x2a: 'f32.load', 0x2b: 'f64.load',
  0x2c: 'i32.load8_s', 0x2d: 'i32.load8_u',
  0x2e: 'i32.load16_s', 0x2f: 'i32.load16_u',
  0x36: 'i32.store', 0x37: 'i64.store', 0x38: 'f32.store', 0x39: 'f64.store',
  0x3a: 'i32.store8', 0x3b: 'i32.store16',
  0x3f: 'memory.size', 0x40: 'memory.grow',
  0x41: 'i32.const', 0x42: 'i64.const', 0x43: 'f32.const', 0x44: 'f64.const',
  0x45: 'i32.eqz', 0x46: 'i32.eq', 0x47: 'i32.ne',
  0x48: 'i32.lt_s', 0x49: 'i32.lt_u', 0x4a: 'i32.gt_s', 0x4b: 'i32.gt_u',
  0x4c: 'i32.le_s', 0x4d: 'i32.le_u', 0x4e: 'i32.ge_s', 0x4f: 'i32.ge_u',
  0x50: 'i64.eqz', 0x51: 'i64.eq', 0x52: 'i64.ne',
  0x61: 'f64.eq', 0x62: 'f64.ne', 0x63: 'f64.lt', 0x64: 'f64.gt',
  0x65: 'f64.le', 0x66: 'f64.ge',
  0x67: 'i32.clz', 0x68: 'i32.ctz', 0x69: 'i32.popcnt',
  0x6a: 'i32.add', 0x6b: 'i32.sub', 0x6c: 'i32.mul',
  0x6d: 'i32.div_s', 0x6e: 'i32.div_u',
  0x6f: 'i32.rem_s', 0x70: 'i32.rem_u',
  0x71: 'i32.and', 0x72: 'i32.or', 0x73: 'i32.xor',
  0x74: 'i32.shl', 0x75: 'i32.shr_s', 0x76: 'i32.shr_u',
  0x77: 'i32.rotl', 0x78: 'i32.rotr',
  0x99: 'f64.abs', 0x9a: 'f64.neg', 0x9b: 'f64.ceil',
  0x9c: 'f64.floor', 0x9d: 'f64.trunc', 0x9f: 'f64.sqrt',
  0xa0: 'f64.add', 0xa1: 'f64.sub', 0xa2: 'f64.mul',
  0xa3: 'f64.div', 0xa4: 'f64.min', 0xa5: 'f64.max',
  0xa7: 'i32.wrap_i64', 0xaa: 'i32.trunc_f64_s',
  0xac: 'i64.extend_i32_s', 0xb7: 'f64.convert_i32_s',
};

// === WASM Module Disassembler ===

export class WasmDisassembler {
  constructor(buffer) {
    this.reader = new BinaryReader(buffer);
    this.module = {
      types: [],
      imports: [],
      functions: [],   // type indices
      tables: [],
      memories: [],
      globals: [],
      exports: [],
      start: null,
      elements: [],
      codes: [],       // function bodies
      datas: [],
    };
  }

  disassemble() {
    this.readHeader();
    this.readSections();
    return this.module;
  }

  readHeader() {
    const magic = this.reader.readBytes(4);
    if (magic[0] !== 0x00 || magic[1] !== 0x61 || magic[2] !== 0x73 || magic[3] !== 0x6d) {
      throw new Error('Not a valid WASM binary (bad magic)');
    }
    const version = this.reader.readBytes(4);
    this.module.version = version[0];
  }

  readSections() {
    this.sectionSizes = {};
    while (!this.reader.eof) {
      const id = this.reader.readByte();
      const size = this.reader.readULEB128();
      const startOffset = this.reader.offset;
      const name = SectionId[id] || `unknown(${id})`;
      this.sectionSizes[name] = size;

      switch (id) {
        case 1: this.readTypeSection(); break;
        case 2: this.readImportSection(); break;
        case 3: this.readFunctionSection(); break;
        case 4: this.readTableSection(); break;
        case 5: this.readMemorySection(); break;
        case 6: this.readGlobalSection(); break;
        case 7: this.readExportSection(); break;
        case 8: this.readStartSection(); break;
        case 9: this.readElementSection(); break;
        case 10: this.readCodeSection(); break;
        case 11: this.readDataSection(); break;
        default:
          // Skip unknown/custom sections
          this.reader.readBytes(size);
      }

      // Ensure we consumed exactly `size` bytes
      const consumed = this.reader.offset - startOffset;
      if (consumed < size) {
        this.reader.readBytes(size - consumed); // skip remainder
      }
    }
  }

  readTypeSection() {
    const count = this.reader.readULEB128();
    for (let i = 0; i < count; i++) {
      const form = this.reader.readByte(); // 0x60 = functype
      const paramCount = this.reader.readULEB128();
      const params = [];
      for (let j = 0; j < paramCount; j++) params.push(this.reader.readByte());
      const resultCount = this.reader.readULEB128();
      const results = [];
      for (let j = 0; j < resultCount; j++) results.push(this.reader.readByte());
      this.module.types.push({ params, results });
    }
  }

  readImportSection() {
    const count = this.reader.readULEB128();
    for (let i = 0; i < count; i++) {
      const module = this.reader.readString();
      const name = this.reader.readString();
      const kind = this.reader.readByte();
      let desc;
      if (kind === 0) { // func
        desc = { kind: 'func', typeIndex: this.reader.readULEB128() };
      } else if (kind === 1) { // table
        const type = this.reader.readByte();
        const { min, max } = this.readLimits();
        desc = { kind: 'table', type, min, max };
      } else if (kind === 2) { // memory
        const { min, max } = this.readLimits();
        desc = { kind: 'memory', min, max };
      } else if (kind === 3) { // global
        const type = this.reader.readByte();
        const mutable = this.reader.readByte();
        desc = { kind: 'global', type, mutable: mutable === 1 };
      }
      this.module.imports.push({ module, name, ...desc });
    }
  }

  readFunctionSection() {
    const count = this.reader.readULEB128();
    for (let i = 0; i < count; i++) {
      this.module.functions.push(this.reader.readULEB128());
    }
  }

  readTableSection() {
    const count = this.reader.readULEB128();
    for (let i = 0; i < count; i++) {
      const type = this.reader.readByte();
      const { min, max } = this.readLimits();
      this.module.tables.push({ type, min, max });
    }
  }

  readMemorySection() {
    const count = this.reader.readULEB128();
    for (let i = 0; i < count; i++) {
      const { min, max } = this.readLimits();
      this.module.memories.push({ min, max });
    }
  }

  readGlobalSection() {
    const count = this.reader.readULEB128();
    for (let i = 0; i < count; i++) {
      const type = this.reader.readByte();
      const mutable = this.reader.readByte();
      const init = this.readInitExpr();
      this.module.globals.push({ type, mutable: mutable === 1, init });
    }
  }

  readExportSection() {
    const count = this.reader.readULEB128();
    for (let i = 0; i < count; i++) {
      const name = this.reader.readString();
      const kind = this.reader.readByte();
      const index = this.reader.readULEB128();
      this.module.exports.push({ name, kind, index });
    }
  }

  readStartSection() {
    this.module.start = this.reader.readULEB128();
  }

  readElementSection() {
    const count = this.reader.readULEB128();
    for (let i = 0; i < count; i++) {
      const flags = this.reader.readByte();
      const offset = this.readInitExpr();
      const funcCount = this.reader.readULEB128();
      const funcIndices = [];
      for (let j = 0; j < funcCount; j++) {
        funcIndices.push(this.reader.readULEB128());
      }
      this.module.elements.push({ flags, offset, funcIndices });
    }
  }

  readCodeSection() {
    const count = this.reader.readULEB128();
    for (let i = 0; i < count; i++) {
      const bodySize = this.reader.readULEB128();
      const bodyStart = this.reader.offset;

      // Read locals
      const localDeclCount = this.reader.readULEB128();
      const locals = [];
      for (let j = 0; j < localDeclCount; j++) {
        const count = this.reader.readULEB128();
        const type = this.reader.readByte();
        locals.push({ count, type });
      }

      // Read instructions until end of body
      const instructions = [];
      while (this.reader.offset < bodyStart + bodySize) {
        instructions.push(this.readInstruction());
      }

      this.module.codes.push({ locals, instructions });
    }
  }

  readDataSection() {
    const count = this.reader.readULEB128();
    for (let i = 0; i < count; i++) {
      const flags = this.reader.readByte();
      let offset = null;
      if (flags === 0) {
        offset = this.readInitExpr();
      }
      const size = this.reader.readULEB128();
      const data = this.reader.readBytes(size);
      this.module.datas.push({ flags, offset, data });
    }
  }

  readLimits() {
    const flags = this.reader.readByte();
    const min = this.reader.readULEB128();
    const max = flags & 1 ? this.reader.readULEB128() : undefined;
    return { min, max };
  }

  readInitExpr() {
    const instructions = [];
    while (true) {
      const inst = this.readInstruction();
      instructions.push(inst);
      if (inst.op === 'end') break;
    }
    // Simplified: extract the constant value if it's a simple init expr
    if (instructions.length === 2 && instructions[0].operands.length > 0) {
      return instructions[0]; // e.g., i32.const 42
    }
    return instructions;
  }

  readInstruction() {
    const opcode = this.reader.readByte();
    const name = OpNames[opcode] || `unknown(0x${opcode.toString(16)})`;
    const operands = [];

    switch (opcode) {
      // Block-type instructions
      case 0x02: case 0x03: case 0x04: { // block, loop, if
        const bt = this.reader.readSLEB128();
        if (bt === -64) { // 0x40 = void
          operands.push('(result)');
        } else if (ValTypeName[bt & 0xff]) {
          operands.push(`(result ${ValTypeName[bt & 0xff]})`);
        }
        break;
      }

      // Branch
      case 0x0c: case 0x0d: // br, br_if
        operands.push(this.reader.readULEB128());
        break;

      // br_table
      case 0x0e: {
        const count = this.reader.readULEB128();
        const targets = [];
        for (let i = 0; i <= count; i++) targets.push(this.reader.readULEB128());
        operands.push(targets);
        break;
      }

      // call
      case 0x10:
        operands.push(this.reader.readULEB128());
        break;

      // call_indirect
      case 0x11:
        operands.push(this.reader.readULEB128()); // type index
        operands.push(this.reader.readULEB128()); // table index
        break;

      // Variable instructions
      case 0x20: case 0x21: case 0x22: // local.get/set/tee
      case 0x23: case 0x24:             // global.get/set
        operands.push(this.reader.readULEB128());
        break;

      // Memory instructions
      case 0x28: case 0x29: case 0x2a: case 0x2b: // load
      case 0x2c: case 0x2d: case 0x2e: case 0x2f:
      case 0x36: case 0x37: case 0x38: case 0x39: // store
      case 0x3a: case 0x3b:
        operands.push({ align: this.reader.readULEB128(), offset: this.reader.readULEB128() });
        break;

      // memory.size, memory.grow
      case 0x3f: case 0x40:
        operands.push(this.reader.readByte()); // memory index (always 0)
        break;

      // Constants
      case 0x41: // i32.const
        operands.push(this.reader.readSLEB128());
        break;
      case 0x42: // i64.const
        operands.push(this.reader.readSLEB128()); // simplified: use SLEB for i64 too
        break;
      case 0x43: // f32.const
        operands.push(this.reader.readF32());
        break;
      case 0x44: // f64.const
        operands.push(this.reader.readF64());
        break;
    }

    return { op: name, opcode, operands };
  }
}

// === WAT Formatter ===

export function formatWAT(module) {
  const lines = [];
  const indent = (depth) => '  '.repeat(depth);

  lines.push('(module');

  // Types
  for (let i = 0; i < module.types.length; i++) {
    const t = module.types[i];
    const params = t.params.map(p => ValTypeName[p] || `0x${p.toString(16)}`).join(' ');
    const results = t.results.map(r => ValTypeName[r] || `0x${r.toString(16)}`).join(' ');
    lines.push(`${indent(1)}(type (;${i};) (func${params ? ' (param ' + params + ')' : ''}${results ? ' (result ' + results + ')' : ''}))`);
  }

  // Imports
  for (let i = 0; i < module.imports.length; i++) {
    const imp = module.imports[i];
    let desc = '';
    if (imp.kind === 'func') desc = `(func (;${i};) (type ${imp.typeIndex}))`;
    else if (imp.kind === 'memory') desc = `(memory (;${i};) ${imp.min}${imp.max !== undefined ? ' ' + imp.max : ''})`;
    else if (imp.kind === 'table') desc = `(table (;${i};) ${imp.min}${imp.max !== undefined ? ' ' + imp.max : ''} ${ValTypeName[imp.type] || 'funcref'})`;
    else if (imp.kind === 'global') desc = `(global (;${i};) ${imp.mutable ? '(mut ' : ''}${ValTypeName[imp.type] || '?'}${imp.mutable ? ')' : ''})`;
    lines.push(`${indent(1)}(import "${imp.module}" "${imp.name}" ${desc})`);
  }

  // Functions (just type index declarations)
  const importFuncCount = module.imports.filter(i => i.kind === 'func').length;

  // Tables
  for (let i = 0; i < module.tables.length; i++) {
    const t = module.tables[i];
    lines.push(`${indent(1)}(table (;${i};) ${t.min}${t.max !== undefined ? ' ' + t.max : ''} ${ValTypeName[t.type] || 'funcref'})`);
  }

  // Memories
  for (let i = 0; i < module.memories.length; i++) {
    const m = module.memories[i];
    lines.push(`${indent(1)}(memory (;${i};) ${m.min}${m.max !== undefined ? ' ' + m.max : ''})`);
  }

  // Globals
  for (let i = 0; i < module.globals.length; i++) {
    const g = module.globals[i];
    const typeName = ValTypeName[g.type] || '?';
    const initStr = g.init?.op ? `(${g.init.op} ${g.init.operands[0]})` : '(i32.const 0)';
    lines.push(`${indent(1)}(global (;${i};) ${g.mutable ? '(mut ' + typeName + ')' : typeName} ${initStr})`);
  }

  // Exports
  for (const exp of module.exports) {
    const kindName = ExportKindName[exp.kind] || '?';
    lines.push(`${indent(1)}(export "${exp.name}" (${kindName} ${exp.index}))`);
  }

  // Element segments
  for (const elem of module.elements) {
    const offsetStr = elem.offset?.op ? `(${elem.offset.op} ${elem.offset.operands[0]})` : '(i32.const 0)';
    lines.push(`${indent(1)}(elem ${offsetStr} func ${elem.funcIndices.join(' ')})`);
  }

  // Build function name map from exports
  const funcNames = {};
  for (const exp of module.exports) {
    if (exp.kind === 0) funcNames[exp.index] = exp.name;
  }

  // Functions with code
  for (let i = 0; i < module.codes.length; i++) {
    const funcIdx = importFuncCount + i;
    const typeIdx = module.functions[i];
    const code = module.codes[i];
    const type = module.types[typeIdx];

    // Find export name
    const exportName = module.exports.find(e => e.kind === 0 && e.index === funcIdx);
    const nameComment = exportName ? ` ;; ${exportName.name}` : '';

    lines.push(`${indent(1)}(func (;${funcIdx};) (type ${typeIdx})${nameComment}`);

    // Parameters
    if (type.params.length > 0) {
      lines.push(`${indent(2)}(param ${type.params.map(p => ValTypeName[p]).join(' ')})`);
    }
    if (type.results.length > 0) {
      lines.push(`${indent(2)}(result ${type.results.map(r => ValTypeName[r]).join(' ')})`);
    }

    // Locals
    for (const local of code.locals) {
      const typeName = ValTypeName[local.type] || '?';
      for (let j = 0; j < local.count; j++) {
        lines.push(`${indent(2)}(local ${typeName})`);
      }
    }

    // Instructions
    let depth = 2;
    for (const inst of code.instructions) {
      if (inst.op === 'end' || inst.op === 'else') depth--;
      const line = formatInstruction(inst, depth, funcNames);
      if (line) lines.push(line);
      if (inst.op === 'block' || inst.op === 'loop' || inst.op === 'if' || inst.op === 'else') depth++;
    }

    lines.push(`${indent(1)})`);
  }

  // Data segments
  for (let i = 0; i < module.datas.length; i++) {
    const d = module.datas[i];
    const offsetStr = d.offset?.op ? `(${d.offset.op} ${d.offset.operands[0]})` : '';
    const hexBytes = Array.from(d.data).map(b => '\\' + b.toString(16).padStart(2, '0')).join('');
    lines.push(`${indent(1)}(data ${offsetStr} "${hexBytes}")`);
  }

  lines.push(')');
  return lines.join('\n');
}

function formatInstruction(inst, depth, funcNames = {}) {
  const ind = '  '.repeat(depth);

  if (inst.op === 'end') return `${ind}${inst.op}`;

  const ops = inst.operands;
  if (ops.length === 0) return `${ind}${inst.op}`;

  // Handle different operand types
  if (typeof ops[0] === 'object' && ops[0] !== null && 'align' in ops[0]) {
    // Memory instruction
    const { align, offset } = ops[0];
    const parts = [];
    if (offset > 0) parts.push(`offset=${offset}`);
    if (align > 0) parts.push(`align=${1 << align}`);
    return `${ind}${inst.op}${parts.length ? ' ' + parts.join(' ') : ''}`;
  }

  if (inst.op === 'block' || inst.op === 'loop' || inst.op === 'if') {
    return `${ind}${inst.op}${ops[0] !== '(result)' ? ' ' + ops[0] : ''}`;
  }

  if (inst.op === 'call') {
    const funcIdx = ops[0];
    const name = funcNames[funcIdx];
    return `${ind}call ${funcIdx}${name ? ' ;; ' + name : ''}`;
  }

  if (inst.op === 'call_indirect') {
    return `${ind}${inst.op} (type ${ops[0]})`;
  }

  return `${ind}${inst.op} ${ops.join(' ')}`;
}

// === High-level API ===

export function disassemble(buffer) {
  const dis = new WasmDisassembler(buffer);
  const module = dis.disassemble();
  return formatWAT(module);
}

export function annotatedDisassemble(binary, source, sourceMaps) {
  const wat = disassemble(binary);
  if (!source || !sourceMaps) return wat;

  const sourceLines = source.split('\n');
  const lines = wat.split('\n');
  const result = [];
  let lastLine = -1;

  for (const line of lines) {
    // Check if this is a function header with a func index
    const funcMatch = line.match(/\(func \(;(\d+);\)/);
    if (funcMatch) {
      const funcIdx = parseInt(funcMatch[1]);
      const map = sourceMaps[funcIdx];
      if (map && map.length > 0) {
        const srcLines = [...new Set(map.map(e => e.line))].sort((a, b) => a - b);
        result.push(line + `  ;; source lines ${srcLines.join(', ')}`);
        continue;
      }
    }
    result.push(line);
  }

  return result.join('\n');
}

/**
 * Analyze a WASM binary and return size breakdown.
 * @param {Uint8Array} buffer - WASM binary
 * @returns {Object} Analysis results
 */
export function binaryAnalysis(buffer) {
  const dis = new WasmDisassembler(buffer);
  const module = dis.disassemble();
  
  const analysis = {
    totalBytes: buffer.length,
    sections: dis.sectionSizes || {},
    functions: {
      total: module.codes.length,
      imported: module.imports.length,
      exported: module.exports.filter(e => e.kind === 0).length,
    },
    exports: module.exports.map(e => ({
      name: e.name,
      kind: ['func', 'table', 'memory', 'global'][e.kind] || 'unknown',
      index: e.index,
    })),
  };
  
  return analysis;
}

/**
 * Format binary analysis as a human-readable string.
 */
export function formatAnalysis(analysis) {
  const lines = [];
  lines.push(`Binary: ${analysis.totalBytes} bytes`);
  lines.push('');
  lines.push('Sections:');
  for (const [name, size] of Object.entries(analysis.sections)) {
    const pct = ((size / analysis.totalBytes) * 100).toFixed(1);
    const bar = '█'.repeat(Math.ceil(pct / 5));
    lines.push(`  ${name.padEnd(10)} ${String(size).padStart(5)} bytes  ${pct.padStart(5)}%  ${bar}`);
  }
  lines.push('');
  lines.push(`Functions: ${analysis.functions.total} defined, ${analysis.functions.imported} imported, ${analysis.functions.exported} exported`);
  lines.push('');
  lines.push('Exports:');
  for (const exp of analysis.exports) {
    lines.push(`  ${exp.name} (${exp.kind} ${exp.index})`);
  }
  return lines.join('\n');
}
