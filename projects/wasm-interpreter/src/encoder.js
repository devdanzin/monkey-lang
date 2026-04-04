// encoder.js — Minimal WASM binary encoder for testing the decoder
// Generates valid .wasm binaries from a simple description format.

import { Op, TYPE_I32, TYPE_I64, TYPE_F32, TYPE_F64 } from './decoder.js';

function encodeU32(value) {
  const bytes = [];
  do {
    let byte = value & 0x7F;
    value >>>= 7;
    if (value !== 0) byte |= 0x80;
    bytes.push(byte);
  } while (value !== 0);
  return bytes;
}

function encodeI32(value) {
  const bytes = [];
  let more = true;
  while (more) {
    let byte = value & 0x7F;
    value >>= 7;
    if ((value === 0 && (byte & 0x40) === 0) || (value === -1 && (byte & 0x40) !== 0)) {
      more = false;
    } else {
      byte |= 0x80;
    }
    bytes.push(byte);
  }
  return bytes;
}

function encodeI64(value) {
  const bytes = [];
  let v = BigInt(value);
  let more = true;
  while (more) {
    let byte = Number(v & 0x7Fn);
    v >>= 7n;
    if ((v === 0n && (byte & 0x40) === 0) || (v === -1n && (byte & 0x40) !== 0)) {
      more = false;
    } else {
      byte |= 0x80;
    }
    bytes.push(byte);
  }
  return bytes;
}

function encodeString(str) {
  const encoded = new TextEncoder().encode(str);
  return [...encodeU32(encoded.length), ...encoded];
}

function encodeSection(id, content) {
  return [id, ...encodeU32(content.length), ...content];
}

function encodeValType(type) {
  switch (type) {
    case 'i32': return TYPE_I32;
    case 'i64': return TYPE_I64;
    case 'f32': return TYPE_F32;
    case 'f64': return TYPE_F64;
    default: throw new Error(`Unknown type: ${type}`);
  }
}

// Build a WASM module from a description
export function buildModule(desc = {}) {
  const bytes = [];

  // Magic + version
  bytes.push(0x00, 0x61, 0x73, 0x6D); // \0asm
  bytes.push(0x01, 0x00, 0x00, 0x00); // version 1

  // Type section
  if (desc.types && desc.types.length > 0) {
    const content = [];
    content.push(...encodeU32(desc.types.length));
    for (const ft of desc.types) {
      content.push(0x60); // func type tag
      content.push(...encodeU32(ft.params.length));
      for (const p of ft.params) content.push(encodeValType(p));
      content.push(...encodeU32(ft.results.length));
      for (const r of ft.results) content.push(encodeValType(r));
    }
    bytes.push(...encodeSection(1, content));
  }

  // Import section
  if (desc.imports && desc.imports.length > 0) {
    const content = [];
    content.push(...encodeU32(desc.imports.length));
    for (const imp of desc.imports) {
      content.push(...encodeString(imp.module));
      content.push(...encodeString(imp.name));
      content.push(0x00); // func import
      content.push(...encodeU32(imp.typeIdx));
    }
    bytes.push(...encodeSection(2, content));
  }

  // Function section
  if (desc.functions && desc.functions.length > 0) {
    const content = [];
    content.push(...encodeU32(desc.functions.length));
    for (const f of desc.functions) {
      content.push(...encodeU32(f.typeIdx));
    }
    bytes.push(...encodeSection(3, content));
  }

  // Table section
  if (desc.tables && desc.tables.length > 0) {
    const content = [];
    content.push(...encodeU32(desc.tables.length));
    for (const t of desc.tables) {
      content.push(0x70); // funcref
      content.push(t.max !== undefined ? 0x01 : 0x00);
      content.push(...encodeU32(t.min));
      if (t.max !== undefined) content.push(...encodeU32(t.max));
    }
    bytes.push(...encodeSection(4, content));
  }

  // Memory section
  if (desc.memories && desc.memories.length > 0) {
    const content = [];
    content.push(...encodeU32(desc.memories.length));
    for (const m of desc.memories) {
      content.push(m.max !== undefined ? 0x01 : 0x00);
      content.push(...encodeU32(m.min));
      if (m.max !== undefined) content.push(...encodeU32(m.max));
    }
    bytes.push(...encodeSection(5, content));
  }

  // Global section
  if (desc.globals && desc.globals.length > 0) {
    const content = [];
    content.push(...encodeU32(desc.globals.length));
    for (const g of desc.globals) {
      content.push(encodeValType(g.type));
      content.push(g.mutable ? 0x01 : 0x00);
      // Init expression
      content.push(...g.init);
      content.push(Op.end);
    }
    bytes.push(...encodeSection(6, content));
  }

  // Export section
  if (desc.exports && desc.exports.length > 0) {
    const content = [];
    content.push(...encodeU32(desc.exports.length));
    for (const e of desc.exports) {
      content.push(...encodeString(e.name));
      const kindMap = { func: 0, table: 1, memory: 2, global: 3 };
      content.push(kindMap[e.kind] ?? 0);
      content.push(...encodeU32(e.index));
    }
    bytes.push(...encodeSection(7, content));
  }

  // Element section
  if (desc.elements && desc.elements.length > 0) {
    const content = [];
    content.push(...encodeU32(desc.elements.length));
    for (const el of desc.elements) {
      content.push(...encodeU32(el.tableIdx ?? 0));
      content.push(...el.offset);
      content.push(Op.end);
      content.push(...encodeU32(el.funcIndices.length));
      for (const idx of el.funcIndices) content.push(...encodeU32(idx));
    }
    bytes.push(...encodeSection(9, content));
  }

  // Code section
  if (desc.functions && desc.functions.length > 0) {
    const content = [];
    content.push(...encodeU32(desc.functions.length));
    for (const f of desc.functions) {
      const body = [];
      // Local declarations
      const localDecls = f.locals || [];
      body.push(...encodeU32(localDecls.length));
      for (const ld of localDecls) {
        body.push(...encodeU32(ld.count));
        body.push(encodeValType(ld.type));
      }
      // Instructions
      body.push(...(f.body || []));
      body.push(Op.end);

      content.push(...encodeU32(body.length));
      content.push(...body);
    }
    bytes.push(...encodeSection(10, content));
  }

  // Data section
  if (desc.data && desc.data.length > 0) {
    const content = [];
    content.push(...encodeU32(desc.data.length));
    for (const d of desc.data) {
      content.push(...encodeU32(d.memIdx ?? 0));
      content.push(...d.offset);
      content.push(Op.end);
      content.push(...encodeU32(d.bytes.length));
      content.push(...d.bytes);
    }
    bytes.push(...encodeSection(11, content));
  }

  return new Uint8Array(bytes);
}

export { encodeU32, encodeI32, encodeI64, encodeString, Op };
