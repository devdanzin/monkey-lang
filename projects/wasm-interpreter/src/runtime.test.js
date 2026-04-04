// runtime.test.js — Tests for the WASM stack machine interpreter

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { instantiate, WasmTrap } from './runtime.js';
import { buildModule, encodeI32, encodeU32, Op } from './encoder.js';

// Helper: build + instantiate + call export
function run(desc, funcName = 'main', args = [], imports = {}) {
  const wasm = buildModule(desc);
  const inst = instantiate(wasm, imports);
  return inst.exports[funcName](...args);
}

describe('WASM Runtime', () => {

  describe('Constants and returns', () => {
    it('returns i32 constant', () => {
      assert.equal(run({
        types: [{ params: [], results: ['i32'] }],
        functions: [{ typeIdx: 0, body: [Op.i32_const, ...encodeI32(42)] }],
        exports: [{ name: 'main', kind: 'func', index: 0 }]
      }), 42);
    });

    it('returns negative constant', () => {
      assert.equal(run({
        types: [{ params: [], results: ['i32'] }],
        functions: [{ typeIdx: 0, body: [Op.i32_const, ...encodeI32(-7)] }],
        exports: [{ name: 'main', kind: 'func', index: 0 }]
      }), -7);
    });

    it('returns zero', () => {
      assert.equal(run({
        types: [{ params: [], results: ['i32'] }],
        functions: [{ typeIdx: 0, body: [Op.i32_const, ...encodeI32(0)] }],
        exports: [{ name: 'main', kind: 'func', index: 0 }]
      }), 0);
    });
  });

  describe('i32 arithmetic', () => {
    it('add', () => {
      assert.equal(run({
        types: [{ params: ['i32', 'i32'], results: ['i32'] }],
        functions: [{ typeIdx: 0, body: [Op.local_get, ...encodeU32(0), Op.local_get, ...encodeU32(1), Op.i32_add] }],
        exports: [{ name: 'main', kind: 'func', index: 0 }]
      }, 'main', [10, 32]), 42);
    });

    it('sub', () => {
      assert.equal(run({
        types: [{ params: ['i32', 'i32'], results: ['i32'] }],
        functions: [{ typeIdx: 0, body: [Op.local_get, ...encodeU32(0), Op.local_get, ...encodeU32(1), Op.i32_sub] }],
        exports: [{ name: 'main', kind: 'func', index: 0 }]
      }, 'main', [50, 8]), 42);
    });

    it('mul', () => {
      assert.equal(run({
        types: [{ params: ['i32', 'i32'], results: ['i32'] }],
        functions: [{ typeIdx: 0, body: [Op.local_get, ...encodeU32(0), Op.local_get, ...encodeU32(1), Op.i32_mul] }],
        exports: [{ name: 'main', kind: 'func', index: 0 }]
      }, 'main', [6, 7]), 42);
    });

    it('div_s', () => {
      assert.equal(run({
        types: [{ params: ['i32', 'i32'], results: ['i32'] }],
        functions: [{ typeIdx: 0, body: [Op.local_get, ...encodeU32(0), Op.local_get, ...encodeU32(1), Op.i32_div_s] }],
        exports: [{ name: 'main', kind: 'func', index: 0 }]
      }, 'main', [84, 2]), 42);
    });

    it('div by zero traps', () => {
      assert.throws(() => run({
        types: [{ params: [], results: ['i32'] }],
        functions: [{ typeIdx: 0, body: [Op.i32_const, ...encodeI32(1), Op.i32_const, ...encodeI32(0), Op.i32_div_s] }],
        exports: [{ name: 'main', kind: 'func', index: 0 }]
      }), /divide by zero/);
    });

    it('rem_s', () => {
      assert.equal(run({
        types: [{ params: ['i32', 'i32'], results: ['i32'] }],
        functions: [{ typeIdx: 0, body: [Op.local_get, ...encodeU32(0), Op.local_get, ...encodeU32(1), Op.i32_rem_s] }],
        exports: [{ name: 'main', kind: 'func', index: 0 }]
      }, 'main', [10, 3]), 1);
    });

    it('bitwise and/or/xor', () => {
      assert.equal(run({
        types: [{ params: [], results: ['i32'] }],
        functions: [{ typeIdx: 0, body: [Op.i32_const, ...encodeI32(0xFF), Op.i32_const, ...encodeI32(0x0F), Op.i32_and] }],
        exports: [{ name: 'main', kind: 'func', index: 0 }]
      }), 0x0F);
    });

    it('shifts', () => {
      assert.equal(run({
        types: [{ params: [], results: ['i32'] }],
        functions: [{ typeIdx: 0, body: [Op.i32_const, ...encodeI32(1), Op.i32_const, ...encodeI32(3), Op.i32_shl] }],
        exports: [{ name: 'main', kind: 'func', index: 0 }]
      }), 8);
    });
  });

  describe('i32 comparison', () => {
    it('eqz (zero)', () => {
      assert.equal(run({
        types: [{ params: [], results: ['i32'] }],
        functions: [{ typeIdx: 0, body: [Op.i32_const, ...encodeI32(0), Op.i32_eqz] }],
        exports: [{ name: 'main', kind: 'func', index: 0 }]
      }), 1);
    });

    it('eqz (non-zero)', () => {
      assert.equal(run({
        types: [{ params: [], results: ['i32'] }],
        functions: [{ typeIdx: 0, body: [Op.i32_const, ...encodeI32(5), Op.i32_eqz] }],
        exports: [{ name: 'main', kind: 'func', index: 0 }]
      }), 0);
    });

    it('lt_s', () => {
      assert.equal(run({
        types: [{ params: [], results: ['i32'] }],
        functions: [{ typeIdx: 0, body: [Op.i32_const, ...encodeI32(3), Op.i32_const, ...encodeI32(5), Op.i32_lt_s] }],
        exports: [{ name: 'main', kind: 'func', index: 0 }]
      }), 1);
    });

    it('gt_s', () => {
      assert.equal(run({
        types: [{ params: [], results: ['i32'] }],
        functions: [{ typeIdx: 0, body: [Op.i32_const, ...encodeI32(5), Op.i32_const, ...encodeI32(3), Op.i32_gt_s] }],
        exports: [{ name: 'main', kind: 'func', index: 0 }]
      }), 1);
    });
  });

  describe('Locals', () => {
    it('get and set locals', () => {
      assert.equal(run({
        types: [{ params: ['i32'], results: ['i32'] }],
        functions: [{
          typeIdx: 0,
          locals: [{ count: 1, type: 'i32' }],
          body: [
            Op.local_get, ...encodeU32(0),
            Op.i32_const, ...encodeI32(10),
            Op.i32_add,
            Op.local_set, ...encodeU32(1),
            Op.local_get, ...encodeU32(1),
          ]
        }],
        exports: [{ name: 'main', kind: 'func', index: 0 }]
      }, 'main', [32]), 42);
    });

    it('local_tee', () => {
      assert.equal(run({
        types: [{ params: [], results: ['i32'] }],
        functions: [{
          typeIdx: 0,
          locals: [{ count: 1, type: 'i32' }],
          body: [
            Op.i32_const, ...encodeI32(42),
            Op.local_tee, ...encodeU32(0),
          ]
        }],
        exports: [{ name: 'main', kind: 'func', index: 0 }]
      }), 42);
    });
  });

  describe('Control flow', () => {
    it('if-then-else (true branch)', () => {
      assert.equal(run({
        types: [{ params: ['i32'], results: ['i32'] }],
        functions: [{
          typeIdx: 0,
          body: [
            Op.local_get, ...encodeU32(0),
            Op.if, 0x7F, // -> i32
              Op.i32_const, ...encodeI32(1),
            Op.else,
              Op.i32_const, ...encodeI32(0),
            Op.end,
          ]
        }],
        exports: [{ name: 'main', kind: 'func', index: 0 }]
      }, 'main', [1]), 1);
    });

    it('if-then-else (false branch)', () => {
      assert.equal(run({
        types: [{ params: ['i32'], results: ['i32'] }],
        functions: [{
          typeIdx: 0,
          body: [
            Op.local_get, ...encodeU32(0),
            Op.if, 0x7F,
              Op.i32_const, ...encodeI32(1),
            Op.else,
              Op.i32_const, ...encodeI32(0),
            Op.end,
          ]
        }],
        exports: [{ name: 'main', kind: 'func', index: 0 }]
      }, 'main', [0]), 0);
    });

    it('loop counting to 10', () => {
      assert.equal(run({
        types: [{ params: [], results: ['i32'] }],
        functions: [{
          typeIdx: 0,
          locals: [{ count: 1, type: 'i32' }],
          body: [
            Op.i32_const, ...encodeI32(0),
            Op.local_set, ...encodeU32(0),
            Op.loop, 0x40,
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
        }],
        exports: [{ name: 'main', kind: 'func', index: 0 }]
      }), 10);
    });

    it('block with br', () => {
      assert.equal(run({
        types: [{ params: [], results: ['i32'] }],
        functions: [{
          typeIdx: 0,
          body: [
            Op.block, 0x40,
              Op.br, ...encodeU32(0),
            Op.end,
            Op.i32_const, ...encodeI32(99),
          ]
        }],
        exports: [{ name: 'main', kind: 'func', index: 0 }]
      }), 99);
    });

    it('early return', () => {
      assert.equal(run({
        types: [{ params: ['i32'], results: ['i32'] }],
        functions: [{
          typeIdx: 0,
          body: [
            Op.local_get, ...encodeU32(0),
            Op.i32_eqz,
            Op.if, 0x40,
              Op.i32_const, ...encodeI32(-1),
              Op.return,
            Op.end,
            Op.local_get, ...encodeU32(0),
          ]
        }],
        exports: [{ name: 'main', kind: 'func', index: 0 }]
      }, 'main', [0]), -1);
    });
  });

  describe('Function calls', () => {
    it('call another function', () => {
      assert.equal(run({
        types: [
          { params: ['i32'], results: ['i32'] }, // double
          { params: [], results: ['i32'] },       // main
        ],
        functions: [
          { typeIdx: 0, body: [Op.local_get, ...encodeU32(0), Op.i32_const, ...encodeI32(2), Op.i32_mul] },
          { typeIdx: 1, body: [Op.i32_const, ...encodeI32(21), Op.call, ...encodeU32(0)] },
        ],
        exports: [{ name: 'main', kind: 'func', index: 1 }]
      }), 42);
    });

    it('recursive fibonacci', () => {
      // fib(n): if n <= 1 return n; return fib(n-1) + fib(n-2)
      assert.equal(run({
        types: [{ params: ['i32'], results: ['i32'] }],
        functions: [{
          typeIdx: 0,
          body: [
            Op.local_get, ...encodeU32(0),
            Op.i32_const, ...encodeI32(2),
            Op.i32_lt_s,
            Op.if, 0x7F,
              Op.local_get, ...encodeU32(0),
            Op.else,
              Op.local_get, ...encodeU32(0),
              Op.i32_const, ...encodeI32(1),
              Op.i32_sub,
              Op.call, ...encodeU32(0),
              Op.local_get, ...encodeU32(0),
              Op.i32_const, ...encodeI32(2),
              Op.i32_sub,
              Op.call, ...encodeU32(0),
              Op.i32_add,
            Op.end,
          ]
        }],
        exports: [{ name: 'main', kind: 'func', index: 0 }]
      }, 'main', [10]), 55);
    });
  });

  describe('Imports', () => {
    it('calls host function', () => {
      const log = [];
      const result = run({
        types: [
          { params: ['i32'], results: [] },
          { params: [], results: ['i32'] },
        ],
        imports: [{ module: 'env', name: 'log', typeIdx: 0 }],
        functions: [{ typeIdx: 1, body: [
          Op.i32_const, ...encodeI32(42),
          Op.call, ...encodeU32(0), // call imported log
          Op.i32_const, ...encodeI32(1),
        ]}],
        exports: [{ name: 'main', kind: 'func', index: 1 }]
      }, 'main', [], { env: { log: (v) => log.push(v) } });
      assert.equal(result, 1);
      assert.deepStrictEqual(log, [42]);
    });
  });

  describe('Memory', () => {
    it('store and load i32', () => {
      assert.equal(run({
        types: [{ params: [], results: ['i32'] }],
        memories: [{ min: 1 }],
        functions: [{
          typeIdx: 0,
          body: [
            Op.i32_const, ...encodeI32(0),     // addr
            Op.i32_const, ...encodeI32(42),    // value
            Op.i32_store, ...encodeU32(2), ...encodeU32(0),
            Op.i32_const, ...encodeI32(0),     // addr
            Op.i32_load, ...encodeU32(2), ...encodeU32(0),
          ]
        }],
        exports: [{ name: 'main', kind: 'func', index: 0 }]
      }), 42);
    });

    it('store8 and load8_u', () => {
      assert.equal(run({
        types: [{ params: [], results: ['i32'] }],
        memories: [{ min: 1 }],
        functions: [{
          typeIdx: 0,
          body: [
            Op.i32_const, ...encodeI32(0),
            Op.i32_const, ...encodeI32(255),
            Op.i32_store8, ...encodeU32(0), ...encodeU32(0),
            Op.i32_const, ...encodeI32(0),
            Op.i32_load8_u, ...encodeU32(0), ...encodeU32(0),
          ]
        }],
        exports: [{ name: 'main', kind: 'func', index: 0 }]
      }), 255);
    });

    it('memory_size', () => {
      assert.equal(run({
        types: [{ params: [], results: ['i32'] }],
        memories: [{ min: 2 }],
        functions: [{ typeIdx: 0, body: [Op.memory_size, 0x00] }],
        exports: [{ name: 'main', kind: 'func', index: 0 }]
      }), 2);
    });

    it('memory_grow', () => {
      assert.equal(run({
        types: [{ params: [], results: ['i32'] }],
        memories: [{ min: 1 }],
        functions: [{
          typeIdx: 0,
          body: [
            Op.i32_const, ...encodeI32(1),
            Op.memory_grow, 0x00,
            // returns old size (1)
          ]
        }],
        exports: [{ name: 'main', kind: 'func', index: 0 }]
      }), 1);
    });

    it('out of bounds traps', () => {
      assert.throws(() => run({
        types: [{ params: [], results: ['i32'] }],
        memories: [{ min: 1 }],
        functions: [{
          typeIdx: 0,
          body: [
            Op.i32_const, ...encodeI32(65536),
            Op.i32_load, ...encodeU32(2), ...encodeU32(0),
          ]
        }],
        exports: [{ name: 'main', kind: 'func', index: 0 }]
      }), /out of bounds/);
    });

    it('data segment initialization', () => {
      assert.equal(run({
        types: [{ params: [], results: ['i32'] }],
        memories: [{ min: 1 }],
        data: [{ memIdx: 0, offset: [Op.i32_const, ...encodeI32(0)], bytes: [42, 0, 0, 0] }],
        functions: [{
          typeIdx: 0,
          body: [
            Op.i32_const, ...encodeI32(0),
            Op.i32_load, ...encodeU32(2), ...encodeU32(0),
          ]
        }],
        exports: [{ name: 'main', kind: 'func', index: 0 }]
      }), 42);
    });
  });

  describe('Globals', () => {
    it('get and set global', () => {
      assert.equal(run({
        types: [{ params: [], results: ['i32'] }],
        globals: [{ type: 'i32', mutable: true, init: [Op.i32_const, ...encodeI32(10)] }],
        functions: [{
          typeIdx: 0,
          body: [
            Op.global_get, ...encodeU32(0),
            Op.i32_const, ...encodeI32(32),
            Op.i32_add,
            Op.global_set, ...encodeU32(0),
            Op.global_get, ...encodeU32(0),
          ]
        }],
        exports: [{ name: 'main', kind: 'func', index: 0 }]
      }), 42);
    });
  });

  describe('Parametric', () => {
    it('drop', () => {
      assert.equal(run({
        types: [{ params: [], results: ['i32'] }],
        functions: [{
          typeIdx: 0,
          body: [Op.i32_const, ...encodeI32(42), Op.i32_const, ...encodeI32(99), Op.drop]
        }],
        exports: [{ name: 'main', kind: 'func', index: 0 }]
      }), 42);
    });

    it('select (condition true)', () => {
      assert.equal(run({
        types: [{ params: [], results: ['i32'] }],
        functions: [{
          typeIdx: 0,
          body: [
            Op.i32_const, ...encodeI32(42),
            Op.i32_const, ...encodeI32(99),
            Op.i32_const, ...encodeI32(1),
            Op.select,
          ]
        }],
        exports: [{ name: 'main', kind: 'func', index: 0 }]
      }), 42);
    });

    it('select (condition false)', () => {
      assert.equal(run({
        types: [{ params: [], results: ['i32'] }],
        functions: [{
          typeIdx: 0,
          body: [
            Op.i32_const, ...encodeI32(42),
            Op.i32_const, ...encodeI32(99),
            Op.i32_const, ...encodeI32(0),
            Op.select,
          ]
        }],
        exports: [{ name: 'main', kind: 'func', index: 0 }]
      }), 99);
    });
  });

  describe('Table + call_indirect', () => {
    it('indirect function call via table', () => {
      assert.equal(run({
        types: [{ params: [], results: ['i32'] }],
        functions: [
          { typeIdx: 0, body: [Op.i32_const, ...encodeI32(10)] },
          { typeIdx: 0, body: [Op.i32_const, ...encodeI32(20)] },
          { typeIdx: 0, body: [
            Op.i32_const, ...encodeU32(1), // table index 1
            Op.call_indirect, ...encodeU32(0), ...encodeU32(0), // typeIdx=0, tableIdx=0
          ]},
        ],
        tables: [{ min: 2, max: 2 }],
        elements: [{
          tableIdx: 0,
          offset: [Op.i32_const, ...encodeI32(0)],
          funcIndices: [0, 1]
        }],
        exports: [{ name: 'main', kind: 'func', index: 2 }]
      }), 20);
    });
  });

  describe('Traps', () => {
    it('unreachable traps', () => {
      assert.throws(() => run({
        types: [{ params: [], results: [] }],
        functions: [{ typeIdx: 0, body: [Op.unreachable] }],
        exports: [{ name: 'main', kind: 'func', index: 0 }]
      }), /unreachable/);
    });
  });

  describe('Complex programs', () => {
    it('iterative factorial', () => {
      // factorial(n): result = 1; while n > 1: result *= n; n -= 1
      assert.equal(run({
        types: [{ params: ['i32'], results: ['i32'] }],
        functions: [{
          typeIdx: 0,
          locals: [{ count: 1, type: 'i32' }], // local[1] = result
          body: [
            Op.i32_const, ...encodeI32(1),
            Op.local_set, ...encodeU32(1),
            Op.loop, 0x40,
              Op.local_get, ...encodeU32(0),
              Op.i32_const, ...encodeI32(1),
              Op.i32_gt_s,
              Op.if, 0x40,
                // result *= n
                Op.local_get, ...encodeU32(1),
                Op.local_get, ...encodeU32(0),
                Op.i32_mul,
                Op.local_set, ...encodeU32(1),
                // n -= 1
                Op.local_get, ...encodeU32(0),
                Op.i32_const, ...encodeI32(1),
                Op.i32_sub,
                Op.local_set, ...encodeU32(0),
                Op.br, ...encodeU32(1), // continue loop
              Op.end,
            Op.end,
            Op.local_get, ...encodeU32(1),
          ]
        }],
        exports: [{ name: 'main', kind: 'func', index: 0 }]
      }, 'main', [10]), 3628800);
    });

    it('sum 1 to 100', () => {
      assert.equal(run({
        types: [{ params: [], results: ['i32'] }],
        functions: [{
          typeIdx: 0,
          locals: [{ count: 2, type: 'i32' }], // [0]=i, [1]=sum
          body: [
            Op.i32_const, ...encodeI32(1),
            Op.local_set, ...encodeU32(0),
            Op.i32_const, ...encodeI32(0),
            Op.local_set, ...encodeU32(1),
            Op.loop, 0x40,
              // sum += i
              Op.local_get, ...encodeU32(1),
              Op.local_get, ...encodeU32(0),
              Op.i32_add,
              Op.local_set, ...encodeU32(1),
              // i++
              Op.local_get, ...encodeU32(0),
              Op.i32_const, ...encodeI32(1),
              Op.i32_add,
              Op.local_tee, ...encodeU32(0),
              // i <= 100?
              Op.i32_const, ...encodeI32(101),
              Op.i32_lt_s,
              Op.br_if, ...encodeU32(0),
            Op.end,
            Op.local_get, ...encodeU32(1),
          ]
        }],
        exports: [{ name: 'main', kind: 'func', index: 0 }]
      }), 5050);
    });

    it('GCD (Euclidean algorithm)', () => {
      assert.equal(run({
        types: [{ params: ['i32', 'i32'], results: ['i32'] }],
        functions: [{
          typeIdx: 0,
          body: [
            Op.block, 0x40, // outer block for exit
              Op.loop, 0x40,
                Op.local_get, ...encodeU32(1),
                Op.i32_eqz,
                Op.br_if, ...encodeU32(1), // exit to outer block
                // temp = b
                Op.local_get, ...encodeU32(1),
                // b = a % b
                Op.local_get, ...encodeU32(0),
                Op.local_get, ...encodeU32(1),
                Op.i32_rem_s,
                Op.local_set, ...encodeU32(1),
                // a = temp
                Op.local_set, ...encodeU32(0),
                Op.br, ...encodeU32(0), // continue loop
              Op.end,
            Op.end,
            Op.local_get, ...encodeU32(0),
          ]
        }],
        exports: [{ name: 'main', kind: 'func', index: 0 }]
      }, 'main', [48, 18]), 6);
    });
  });
});
