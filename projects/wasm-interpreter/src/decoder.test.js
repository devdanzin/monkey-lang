// decoder.test.js — Tests for the WASM binary decoder

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { decode, Op } from './decoder.js';
import { buildModule, encodeI32, encodeU32 } from './encoder.js';

describe('WASM Decoder', () => {
  describe('Module header', () => {
    it('decodes minimal valid module', () => {
      const wasm = buildModule({});
      const mod = decode(wasm);
      assert.deepStrictEqual(mod.types, []);
      assert.deepStrictEqual(mod.functions, []);
      assert.deepStrictEqual(mod.exports, []);
    });

    it('rejects invalid magic', () => {
      const bad = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x01, 0x00, 0x00, 0x00]);
      assert.throws(() => decode(bad), /bad magic/);
    });

    it('rejects wrong version', () => {
      const bad = new Uint8Array([0x00, 0x61, 0x73, 0x6D, 0x02, 0x00, 0x00, 0x00]);
      assert.throws(() => decode(bad), /version/);
    });
  });

  describe('Type section', () => {
    it('decodes function types', () => {
      const mod = decode(buildModule({
        types: [
          { params: [], results: ['i32'] },
          { params: ['i32', 'i32'], results: ['i32'] },
          { params: ['i32'], results: [] },
        ]
      }));
      assert.equal(mod.types.length, 3);
      assert.deepStrictEqual(mod.types[0], { params: [], results: ['i32'] });
      assert.deepStrictEqual(mod.types[1], { params: ['i32', 'i32'], results: ['i32'] });
      assert.deepStrictEqual(mod.types[2], { params: ['i32'], results: [] });
    });

    it('decodes i64 and f64 types', () => {
      const mod = decode(buildModule({
        types: [{ params: ['i64', 'f32'], results: ['f64'] }]
      }));
      assert.deepStrictEqual(mod.types[0], { params: ['i64', 'f32'], results: ['f64'] });
    });

    it('decodes multi-result type', () => {
      const mod = decode(buildModule({
        types: [{ params: [], results: ['i32', 'i32'] }]
      }));
      assert.deepStrictEqual(mod.types[0].results, ['i32', 'i32']);
    });
  });

  describe('Function + Code sections', () => {
    it('decodes a simple function returning constant', () => {
      const mod = decode(buildModule({
        types: [{ params: [], results: ['i32'] }],
        functions: [{
          typeIdx: 0,
          body: [Op.i32_const, ...encodeI32(42)]
        }],
        exports: [{ name: 'answer', kind: 'func', index: 0 }]
      }));
      assert.equal(mod.functions.length, 1);
      assert.equal(mod.functions[0], 0); // type index
      assert.equal(mod.code.length, 1);
      assert.equal(mod.code[0].locals.length, 0);
      assert.equal(mod.code[0].instructions.length, 1);
      assert.equal(mod.code[0].instructions[0].name, 'i32_const');
      assert.equal(mod.code[0].instructions[0].value, 42);
    });

    it('decodes function with locals', () => {
      const mod = decode(buildModule({
        types: [{ params: ['i32'], results: ['i32'] }],
        functions: [{
          typeIdx: 0,
          locals: [{ count: 2, type: 'i32' }],
          body: [
            Op.local_get, ...encodeU32(0),
            Op.local_set, ...encodeU32(1),
            Op.local_get, ...encodeU32(1),
          ]
        }]
      }));
      assert.equal(mod.code[0].locals.length, 2);
      assert.equal(mod.code[0].locals[0], 'i32');
      assert.equal(mod.code[0].instructions.length, 3);
    });

    it('decodes i32 arithmetic', () => {
      const mod = decode(buildModule({
        types: [{ params: ['i32', 'i32'], results: ['i32'] }],
        functions: [{
          typeIdx: 0,
          body: [
            Op.local_get, ...encodeU32(0),
            Op.local_get, ...encodeU32(1),
            Op.i32_add
          ]
        }]
      }));
      const instrs = mod.code[0].instructions;
      assert.equal(instrs.length, 3);
      assert.equal(instrs[2].name, 'i32_add');
    });

    it('decodes negative i32 constant', () => {
      const mod = decode(buildModule({
        types: [{ params: [], results: ['i32'] }],
        functions: [{
          typeIdx: 0,
          body: [Op.i32_const, ...encodeI32(-100)]
        }]
      }));
      assert.equal(mod.code[0].instructions[0].value, -100);
    });
  });

  describe('Memory section', () => {
    it('decodes memory with min only', () => {
      const mod = decode(buildModule({
        memories: [{ min: 1 }]
      }));
      assert.equal(mod.memories.length, 1);
      assert.equal(mod.memories[0].min, 1);
      assert.equal(mod.memories[0].max, undefined);
    });

    it('decodes memory with min and max', () => {
      const mod = decode(buildModule({
        memories: [{ min: 1, max: 10 }]
      }));
      assert.equal(mod.memories[0].min, 1);
      assert.equal(mod.memories[0].max, 10);
    });
  });

  describe('Export section', () => {
    it('decodes function exports', () => {
      const mod = decode(buildModule({
        types: [{ params: [], results: ['i32'] }],
        functions: [{ typeIdx: 0, body: [Op.i32_const, ...encodeI32(1)] }],
        exports: [
          { name: 'main', kind: 'func', index: 0 },
          { name: 'mem', kind: 'memory', index: 0 },
        ]
      }));
      assert.equal(mod.exports.length, 2);
      assert.equal(mod.exports[0].name, 'main');
      assert.equal(mod.exports[0].kind, 'func');
      assert.equal(mod.exports[1].kind, 'memory');
    });
  });

  describe('Import section', () => {
    it('decodes function imports', () => {
      const mod = decode(buildModule({
        types: [{ params: ['i32'], results: [] }],
        imports: [{ module: 'env', name: 'log', typeIdx: 0 }]
      }));
      assert.equal(mod.imports.length, 1);
      assert.equal(mod.imports[0].module, 'env');
      assert.equal(mod.imports[0].name, 'log');
      assert.equal(mod.imports[0].desc.kind, 'func');
      assert.equal(mod.imports[0].desc.typeIdx, 0);
    });
  });

  describe('Global section', () => {
    it('decodes mutable global', () => {
      const mod = decode(buildModule({
        globals: [{
          type: 'i32',
          mutable: true,
          init: [Op.i32_const, ...encodeI32(0)]
        }]
      }));
      assert.equal(mod.globals.length, 1);
      assert.equal(mod.globals[0].globalType.valType, 'i32');
      assert.equal(mod.globals[0].globalType.mutable, true);
    });
  });

  describe('Control flow instructions', () => {
    it('decodes block + br_if', () => {
      const mod = decode(buildModule({
        types: [{ params: ['i32'], results: ['i32'] }],
        functions: [{
          typeIdx: 0,
          body: [
            Op.block, 0x40, // block (void)
              Op.local_get, ...encodeU32(0),
              Op.br_if, ...encodeU32(0),
            Op.end,
            Op.i32_const, ...encodeI32(0),
          ]
        }]
      }));
      const instrs = mod.code[0].instructions;
      assert.equal(instrs[0].name, 'block');
      assert.equal(instrs[2].name, 'br_if');
      assert.equal(instrs[2].labelIdx, 0);
    });

    it('decodes if/else', () => {
      const mod = decode(buildModule({
        types: [{ params: ['i32'], results: ['i32'] }],
        functions: [{
          typeIdx: 0,
          body: [
            Op.local_get, ...encodeU32(0),
            Op.if, 0x7F, // if -> i32
              Op.i32_const, ...encodeI32(1),
            Op.else,
              Op.i32_const, ...encodeI32(0),
            Op.end,
          ]
        }]
      }));
      const instrs = mod.code[0].instructions;
      const ifInstr = instrs.find(i => i.name === 'if');
      assert.ok(ifInstr);
      assert.equal(ifInstr.blockType.kind, 'valtype');
    });

    it('decodes loop', () => {
      const mod = decode(buildModule({
        types: [{ params: [], results: ['i32'] }],
        functions: [{
          typeIdx: 0,
          locals: [{ count: 1, type: 'i32' }],
          body: [
            Op.i32_const, ...encodeI32(0),
            Op.local_set, ...encodeU32(0),
            Op.loop, 0x40, // loop (void)
              Op.local_get, ...encodeU32(0),
              Op.i32_const, ...encodeI32(1),
              Op.i32_add,
              Op.local_tee, ...encodeU32(0),
              Op.i32_const, ...encodeI32(10),
              Op.i32_lt_s,
              Op.br_if, ...encodeU32(0),
            Op.end,
            Op.local_get, ...encodeU32(0),
          ]
        }]
      }));
      const loopInstr = mod.code[0].instructions.find(i => i.name === 'loop');
      assert.ok(loopInstr);
    });

    it('decodes call', () => {
      const mod = decode(buildModule({
        types: [
          { params: [], results: ['i32'] },
          { params: [], results: ['i32'] },
        ],
        functions: [
          { typeIdx: 0, body: [Op.i32_const, ...encodeI32(42)] },
          { typeIdx: 1, body: [Op.call, ...encodeU32(0)] },
        ]
      }));
      const callInstr = mod.code[1].instructions.find(i => i.name === 'call');
      assert.ok(callInstr);
      assert.equal(callInstr.funcIdx, 0);
    });
  });

  describe('Memory instructions', () => {
    it('decodes i32.load and i32.store', () => {
      const mod = decode(buildModule({
        types: [{ params: [], results: [] }],
        memories: [{ min: 1 }],
        functions: [{
          typeIdx: 0,
          body: [
            Op.i32_const, ...encodeI32(0),  // address
            Op.i32_const, ...encodeI32(42), // value
            Op.i32_store, ...encodeU32(2), ...encodeU32(0), // align=2, offset=0
            Op.i32_const, ...encodeI32(0),
            Op.i32_load, ...encodeU32(2), ...encodeU32(0),
            Op.drop,
          ]
        }]
      }));
      const instrs = mod.code[0].instructions;
      const store = instrs.find(i => i.name === 'i32_store');
      assert.ok(store);
      assert.equal(store.memarg.align, 2);
      assert.equal(store.memarg.offset, 0);
    });
  });

  describe('Data section', () => {
    it('decodes data segment', () => {
      const mod = decode(buildModule({
        memories: [{ min: 1 }],
        data: [{
          memIdx: 0,
          offset: [Op.i32_const, ...encodeI32(0)],
          bytes: [72, 101, 108, 108, 111] // "Hello"
        }]
      }));
      assert.equal(mod.data.length, 1);
      assert.deepStrictEqual(Array.from(mod.data[0].data), [72, 101, 108, 108, 111]);
    });
  });

  describe('Table + Element sections', () => {
    it('decodes table and element segment', () => {
      const mod = decode(buildModule({
        types: [{ params: [], results: ['i32'] }],
        functions: [
          { typeIdx: 0, body: [Op.i32_const, ...encodeI32(1)] },
          { typeIdx: 0, body: [Op.i32_const, ...encodeI32(2)] },
        ],
        tables: [{ min: 2, max: 2 }],
        elements: [{
          tableIdx: 0,
          offset: [Op.i32_const, ...encodeI32(0)],
          funcIndices: [0, 1]
        }]
      }));
      assert.equal(mod.tables.length, 1);
      assert.equal(mod.elements.length, 1);
      assert.deepStrictEqual(mod.elements[0].funcIndices, [0, 1]);
    });
  });

  describe('LEB128 encoding', () => {
    it('handles zero', () => {
      const mod = decode(buildModule({
        types: [{ params: [], results: ['i32'] }],
        functions: [{ typeIdx: 0, body: [Op.i32_const, ...encodeI32(0)] }]
      }));
      assert.equal(mod.code[0].instructions[0].value, 0);
    });

    it('handles max positive i32', () => {
      const mod = decode(buildModule({
        types: [{ params: [], results: ['i32'] }],
        functions: [{ typeIdx: 0, body: [Op.i32_const, ...encodeI32(2147483647)] }]
      }));
      assert.equal(mod.code[0].instructions[0].value, 2147483647);
    });

    it('handles min negative i32', () => {
      const mod = decode(buildModule({
        types: [{ params: [], results: ['i32'] }],
        functions: [{ typeIdx: 0, body: [Op.i32_const, ...encodeI32(-2147483648)] }]
      }));
      assert.equal(mod.code[0].instructions[0].value, -2147483648);
    });
  });

  describe('Multiple functions', () => {
    it('decodes module with multiple functions and exports', () => {
      const mod = decode(buildModule({
        types: [
          { params: ['i32', 'i32'], results: ['i32'] },
        ],
        functions: [
          { typeIdx: 0, body: [Op.local_get, ...encodeU32(0), Op.local_get, ...encodeU32(1), Op.i32_add] },
          { typeIdx: 0, body: [Op.local_get, ...encodeU32(0), Op.local_get, ...encodeU32(1), Op.i32_mul] },
          { typeIdx: 0, body: [Op.local_get, ...encodeU32(0), Op.local_get, ...encodeU32(1), Op.i32_sub] },
        ],
        exports: [
          { name: 'add', kind: 'func', index: 0 },
          { name: 'mul', kind: 'func', index: 1 },
          { name: 'sub', kind: 'func', index: 2 },
        ]
      }));
      assert.equal(mod.functions.length, 3);
      assert.equal(mod.code.length, 3);
      assert.equal(mod.exports.length, 3);
    });
  });

  describe('Complex instructions', () => {
    it('decodes br_table', () => {
      const mod = decode(buildModule({
        types: [{ params: ['i32'], results: ['i32'] }],
        functions: [{
          typeIdx: 0,
          body: [
            Op.block, 0x7F, // block -> i32
              Op.block, 0x40, // block (void)
                Op.block, 0x40,
                  Op.local_get, ...encodeU32(0),
                  Op.br_table,
                    ...encodeU32(2), // 2 labels
                    ...encodeU32(0), // case 0
                    ...encodeU32(1), // case 1
                    ...encodeU32(2), // default
                Op.end,
                Op.i32_const, ...encodeI32(10),
                Op.br, ...encodeU32(1),
              Op.end,
              Op.i32_const, ...encodeI32(20),
              Op.br, ...encodeU32(0),
            Op.end,
            Op.i32_const, ...encodeI32(30),
          ]
        }]
      }));
      const brTable = mod.code[0].instructions.find(i => i.name === 'br_table');
      assert.ok(brTable);
      assert.equal(brTable.labels.length, 2);
      assert.equal(brTable.defaultLabel, 2);
    });

    it('decodes all i32 arithmetic ops', () => {
      const ops = [
        Op.i32_add, Op.i32_sub, Op.i32_mul, Op.i32_div_s, Op.i32_div_u,
        Op.i32_rem_s, Op.i32_rem_u, Op.i32_and, Op.i32_or, Op.i32_xor,
        Op.i32_shl, Op.i32_shr_s, Op.i32_shr_u, Op.i32_rotl, Op.i32_rotr,
      ];
      const body = [];
      for (const op of ops) {
        body.push(Op.i32_const, ...encodeI32(10));
        body.push(Op.i32_const, ...encodeI32(3));
        body.push(op);
        body.push(Op.drop);
      }
      const mod = decode(buildModule({
        types: [{ params: [], results: [] }],
        functions: [{ typeIdx: 0, body }]
      }));
      // Should have 4 instructions per op: const, const, op, drop = 60 total
      assert.equal(mod.code[0].instructions.length, ops.length * 4);
    });

    it('decodes comparison ops', () => {
      const mod = decode(buildModule({
        types: [{ params: [], results: ['i32'] }],
        functions: [{
          typeIdx: 0,
          body: [
            Op.i32_const, ...encodeI32(5),
            Op.i32_const, ...encodeI32(3),
            Op.i32_gt_s,
          ]
        }]
      }));
      assert.equal(mod.code[0].instructions[2].name, 'i32_gt_s');
    });

    it('decodes select', () => {
      const mod = decode(buildModule({
        types: [{ params: [], results: ['i32'] }],
        functions: [{
          typeIdx: 0,
          body: [
            Op.i32_const, ...encodeI32(10),
            Op.i32_const, ...encodeI32(20),
            Op.i32_const, ...encodeI32(1),
            Op.select,
          ]
        }]
      }));
      assert.ok(mod.code[0].instructions.find(i => i.name === 'select'));
    });
  });
});
