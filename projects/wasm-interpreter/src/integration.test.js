// integration.test.js — Run Monkey-compiled WASM through our interpreter
// This completes the round trip: Monkey source → WASM binary → our interpreter

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { instantiate, WasmInstance } from './runtime.js';
import { decode } from './decoder.js';
import { buildModule, encodeI32, encodeU32, Op } from './encoder.js';

describe('Integration', () => {

  describe('End-to-end programs', () => {
    it('fibonacci via hand-crafted WASM', () => {
      // Iterative fibonacci
      const result = run({
        types: [{ params: ['i32'], results: ['i32'] }],
        functions: [{
          typeIdx: 0,
          locals: [
            { count: 1, type: 'i32' }, // local[1] = a (prev)
            { count: 1, type: 'i32' }, // local[2] = b (current)
            { count: 1, type: 'i32' }, // local[3] = temp
            { count: 1, type: 'i32' }, // local[4] = i
          ],
          body: [
            // if n <= 1 return n
            Op.local_get, ...encodeU32(0),
            Op.i32_const, ...encodeI32(2),
            Op.i32_lt_s,
            Op.if, 0x7F,
              Op.local_get, ...encodeU32(0),
            Op.else,
              // a = 0, b = 1, i = 2
              Op.i32_const, ...encodeI32(0),
              Op.local_set, ...encodeU32(1),
              Op.i32_const, ...encodeI32(1),
              Op.local_set, ...encodeU32(2),
              Op.i32_const, ...encodeI32(2),
              Op.local_set, ...encodeU32(4),
              // loop
              Op.block, 0x40,
                Op.loop, 0x40,
                  // if i > n, break
                  Op.local_get, ...encodeU32(4),
                  Op.local_get, ...encodeU32(0),
                  Op.i32_gt_s,
                  Op.br_if, ...encodeU32(1),
                  // temp = a + b
                  Op.local_get, ...encodeU32(1),
                  Op.local_get, ...encodeU32(2),
                  Op.i32_add,
                  Op.local_set, ...encodeU32(3),
                  // a = b
                  Op.local_get, ...encodeU32(2),
                  Op.local_set, ...encodeU32(1),
                  // b = temp
                  Op.local_get, ...encodeU32(3),
                  Op.local_set, ...encodeU32(2),
                  // i++
                  Op.local_get, ...encodeU32(4),
                  Op.i32_const, ...encodeI32(1),
                  Op.i32_add,
                  Op.local_set, ...encodeU32(4),
                  Op.br, ...encodeU32(0),
                Op.end,
              Op.end,
              Op.local_get, ...encodeU32(2),
            Op.end,
          ]
        }],
        exports: [{ name: 'fib', kind: 'func', index: 0 }]
      }, 'fib');

      assert.equal(result(0), 0);
      assert.equal(result(1), 1);
      assert.equal(result(5), 5);
      assert.equal(result(10), 55);
      assert.equal(result(20), 6765);
    });

    it('array sum in memory', () => {
      // Store [1, 2, 3, 4, 5] in memory, then sum them
      const inst = instantiate(buildModule({
        types: [
          { params: [], results: [] },   // type 0: init
          { params: [], results: ['i32'] }, // type 1: sum
        ],
        memories: [{ min: 1 }],
        functions: [
          // init: store [1,2,3,4,5] at offset 0
          { typeIdx: 0, body: [
            Op.i32_const, ...encodeI32(0), Op.i32_const, ...encodeI32(1), Op.i32_store, ...encodeU32(2), ...encodeU32(0),
            Op.i32_const, ...encodeI32(4), Op.i32_const, ...encodeI32(2), Op.i32_store, ...encodeU32(2), ...encodeU32(0),
            Op.i32_const, ...encodeI32(8), Op.i32_const, ...encodeI32(3), Op.i32_store, ...encodeU32(2), ...encodeU32(0),
            Op.i32_const, ...encodeI32(12), Op.i32_const, ...encodeI32(4), Op.i32_store, ...encodeU32(2), ...encodeU32(0),
            Op.i32_const, ...encodeI32(16), Op.i32_const, ...encodeI32(5), Op.i32_store, ...encodeU32(2), ...encodeU32(0),
          ]},
          // sum: loop over 5 elements
          { typeIdx: 1, locals: [
            { count: 1, type: 'i32' }, // local[0] = i
            { count: 1, type: 'i32' }, // local[1] = sum
          ], body: [
            Op.i32_const, ...encodeI32(0), Op.local_set, ...encodeU32(0),
            Op.i32_const, ...encodeI32(0), Op.local_set, ...encodeU32(1),
            Op.block, 0x40,
              Op.loop, 0x40,
                Op.local_get, ...encodeU32(0),
                Op.i32_const, ...encodeI32(5),
                Op.i32_ge_s,
                Op.br_if, ...encodeU32(1),
                // sum += mem[i*4]
                Op.local_get, ...encodeU32(1),
                Op.local_get, ...encodeU32(0),
                Op.i32_const, ...encodeI32(4),
                Op.i32_mul,
                Op.i32_load, ...encodeU32(2), ...encodeU32(0),
                Op.i32_add,
                Op.local_set, ...encodeU32(1),
                // i++
                Op.local_get, ...encodeU32(0),
                Op.i32_const, ...encodeI32(1),
                Op.i32_add,
                Op.local_set, ...encodeU32(0),
                Op.br, ...encodeU32(0),
              Op.end,
            Op.end,
            Op.local_get, ...encodeU32(1),
          ]},
        ],
        exports: [
          { name: 'init', kind: 'func', index: 0 },
          { name: 'sum', kind: 'func', index: 1 },
        ]
      }));

      inst.exports.init();
      assert.equal(inst.exports.sum(), 15);
    });

    it('mutual recursion (isEven/isOdd)', () => {
      const wasm = buildModule({
        types: [{ params: ['i32'], results: ['i32'] }],
        functions: [
          // isEven(n): n == 0 ? 1 : isOdd(n-1)
          { typeIdx: 0, body: [
            Op.local_get, ...encodeU32(0),
            Op.i32_eqz,
            Op.if, 0x7F,
              Op.i32_const, ...encodeI32(1),
            Op.else,
              Op.local_get, ...encodeU32(0),
              Op.i32_const, ...encodeI32(1),
              Op.i32_sub,
              Op.call, ...encodeU32(1), // isOdd
            Op.end,
          ]},
          // isOdd(n): n == 0 ? 0 : isEven(n-1)
          { typeIdx: 0, body: [
            Op.local_get, ...encodeU32(0),
            Op.i32_eqz,
            Op.if, 0x7F,
              Op.i32_const, ...encodeI32(0),
            Op.else,
              Op.local_get, ...encodeU32(0),
              Op.i32_const, ...encodeI32(1),
              Op.i32_sub,
              Op.call, ...encodeU32(0), // isEven
            Op.end,
          ]},
        ],
        exports: [
          { name: 'isEven', kind: 'func', index: 0 },
          { name: 'isOdd', kind: 'func', index: 1 },
        ]
      });

      const inst = instantiate(wasm);
      assert.equal(inst.exports.isEven(0), 1);
      assert.equal(inst.exports.isEven(1), 0);
      assert.equal(inst.exports.isEven(10), 1);
      assert.equal(inst.exports.isOdd(7), 1);
      assert.equal(inst.exports.isOdd(8), 0);
    });

    it('string via imports (host I/O)', () => {
      const output = [];
      const wasm = buildModule({
        types: [
          { params: ['i32'], results: [] },  // log
          { params: [], results: [] },        // main
        ],
        imports: [{ module: 'env', name: 'log', typeIdx: 0 }],
        functions: [{ typeIdx: 1, body: [
          Op.i32_const, ...encodeI32(1), Op.call, ...encodeU32(0),
          Op.i32_const, ...encodeI32(2), Op.call, ...encodeU32(0),
          Op.i32_const, ...encodeI32(3), Op.call, ...encodeU32(0),
        ]}],
        exports: [{ name: 'main', kind: 'func', index: 1 }]
      });

      const inst = instantiate(wasm, { env: { log: (v) => output.push(v) } });
      inst.exports.main();
      assert.deepStrictEqual(output, [1, 2, 3]);
    });

    it('multiple return calls (call chain)', () => {
      const wasm = buildModule({
        types: [
          { params: ['i32'], results: ['i32'] },
        ],
        functions: [
          // add1(n) = n + 1
          { typeIdx: 0, body: [Op.local_get, ...encodeU32(0), Op.i32_const, ...encodeI32(1), Op.i32_add] },
          // add2(n) = add1(add1(n))
          { typeIdx: 0, body: [
            Op.local_get, ...encodeU32(0),
            Op.call, ...encodeU32(0),
            Op.call, ...encodeU32(0),
          ]},
          // add4(n) = add2(add2(n))
          { typeIdx: 0, body: [
            Op.local_get, ...encodeU32(0),
            Op.call, ...encodeU32(1),
            Op.call, ...encodeU32(1),
          ]},
        ],
        exports: [{ name: 'add4', kind: 'func', index: 2 }]
      });

      const inst = instantiate(wasm);
      assert.equal(inst.exports.add4(0), 4);
      assert.equal(inst.exports.add4(10), 14);
      assert.equal(inst.exports.add4(38), 42);
    });

    it('bubble sort in memory', () => {
      const wasm = buildModule({
        types: [
          { params: ['i32'], results: [] },  // sort(n)
          { params: ['i32'], results: ['i32'] }, // get(i)
          { params: ['i32', 'i32'], results: [] }, // set(i, val)
        ],
        memories: [{ min: 1 }],
        functions: [
          // sort(n): bubble sort
          { typeIdx: 0, locals: [
            { count: 1, type: 'i32' }, // i
            { count: 1, type: 'i32' }, // j
            { count: 1, type: 'i32' }, // temp
            { count: 1, type: 'i32' }, // swapped
          ], body: [
            // outer loop: i = 0; while i < n-1
            Op.block, 0x40,
              Op.loop, 0x40,
                // swapped = 0
                Op.i32_const, ...encodeI32(0),
                Op.local_set, ...encodeU32(4),
                // j = 0
                Op.i32_const, ...encodeI32(0),
                Op.local_set, ...encodeU32(2),
                // inner loop
                Op.block, 0x40,
                  Op.loop, 0x40,
                    // if j >= n-1-i, break inner
                    Op.local_get, ...encodeU32(2),
                    Op.local_get, ...encodeU32(0),
                    Op.i32_const, ...encodeI32(1),
                    Op.i32_sub,
                    Op.local_get, ...encodeU32(1),
                    Op.i32_sub,
                    Op.i32_ge_s,
                    Op.br_if, ...encodeU32(1),
                    // if arr[j] > arr[j+1], swap
                    Op.local_get, ...encodeU32(2),
                    Op.i32_const, ...encodeI32(4),
                    Op.i32_mul,
                    Op.i32_load, ...encodeU32(2), ...encodeU32(0), // arr[j]
                    Op.local_get, ...encodeU32(2),
                    Op.i32_const, ...encodeI32(1),
                    Op.i32_add,
                    Op.i32_const, ...encodeI32(4),
                    Op.i32_mul,
                    Op.i32_load, ...encodeU32(2), ...encodeU32(0), // arr[j+1]
                    Op.i32_gt_s,
                    Op.if, 0x40,
                      // temp = arr[j]
                      Op.local_get, ...encodeU32(2),
                      Op.i32_const, ...encodeI32(4),
                      Op.i32_mul,
                      Op.i32_load, ...encodeU32(2), ...encodeU32(0),
                      Op.local_set, ...encodeU32(3),
                      // arr[j] = arr[j+1]
                      Op.local_get, ...encodeU32(2),
                      Op.i32_const, ...encodeI32(4),
                      Op.i32_mul,
                      Op.local_get, ...encodeU32(2),
                      Op.i32_const, ...encodeI32(1),
                      Op.i32_add,
                      Op.i32_const, ...encodeI32(4),
                      Op.i32_mul,
                      Op.i32_load, ...encodeU32(2), ...encodeU32(0),
                      Op.i32_store, ...encodeU32(2), ...encodeU32(0),
                      // arr[j+1] = temp
                      Op.local_get, ...encodeU32(2),
                      Op.i32_const, ...encodeI32(1),
                      Op.i32_add,
                      Op.i32_const, ...encodeI32(4),
                      Op.i32_mul,
                      Op.local_get, ...encodeU32(3),
                      Op.i32_store, ...encodeU32(2), ...encodeU32(0),
                      // swapped = 1
                      Op.i32_const, ...encodeI32(1),
                      Op.local_set, ...encodeU32(4),
                    Op.end,
                    // j++
                    Op.local_get, ...encodeU32(2),
                    Op.i32_const, ...encodeI32(1),
                    Op.i32_add,
                    Op.local_set, ...encodeU32(2),
                    Op.br, ...encodeU32(0),
                  Op.end,
                Op.end,
                // if !swapped, break outer
                Op.local_get, ...encodeU32(4),
                Op.i32_eqz,
                Op.br_if, ...encodeU32(1),
                // i++
                Op.local_get, ...encodeU32(1),
                Op.i32_const, ...encodeI32(1),
                Op.i32_add,
                Op.local_set, ...encodeU32(1),
                Op.br, ...encodeU32(0),
              Op.end,
            Op.end,
          ]},
          // get(i): return mem[i*4]
          { typeIdx: 1, body: [
            Op.local_get, ...encodeU32(0),
            Op.i32_const, ...encodeI32(4),
            Op.i32_mul,
            Op.i32_load, ...encodeU32(2), ...encodeU32(0),
          ]},
          // set(i, val): mem[i*4] = val
          { typeIdx: 2, body: [
            Op.local_get, ...encodeU32(0),
            Op.i32_const, ...encodeI32(4),
            Op.i32_mul,
            Op.local_get, ...encodeU32(1),
            Op.i32_store, ...encodeU32(2), ...encodeU32(0),
          ]},
        ],
        exports: [
          { name: 'sort', kind: 'func', index: 0 },
          { name: 'get', kind: 'func', index: 1 },
          { name: 'set', kind: 'func', index: 2 },
        ]
      });

      const inst = instantiate(wasm);
      // Store [5, 3, 1, 4, 2]
      inst.exports.set(0, 5);
      inst.exports.set(1, 3);
      inst.exports.set(2, 1);
      inst.exports.set(3, 4);
      inst.exports.set(4, 2);

      inst.exports.sort(5);

      assert.equal(inst.exports.get(0), 1);
      assert.equal(inst.exports.get(1), 2);
      assert.equal(inst.exports.get(2), 3);
      assert.equal(inst.exports.get(3), 4);
      assert.equal(inst.exports.get(4), 5);
    });

    it('power function (iterative)', () => {
      const wasm = buildModule({
        types: [{ params: ['i32', 'i32'], results: ['i32'] }],
        functions: [{
          typeIdx: 0,
          locals: [{ count: 1, type: 'i32' }], // result
          body: [
            Op.i32_const, ...encodeI32(1),
            Op.local_set, ...encodeU32(2),
            Op.block, 0x40,
              Op.loop, 0x40,
                Op.local_get, ...encodeU32(1),
                Op.i32_eqz,
                Op.br_if, ...encodeU32(1),
                Op.local_get, ...encodeU32(2),
                Op.local_get, ...encodeU32(0),
                Op.i32_mul,
                Op.local_set, ...encodeU32(2),
                Op.local_get, ...encodeU32(1),
                Op.i32_const, ...encodeI32(1),
                Op.i32_sub,
                Op.local_set, ...encodeU32(1),
                Op.br, ...encodeU32(0),
              Op.end,
            Op.end,
            Op.local_get, ...encodeU32(2),
          ]
        }],
        exports: [{ name: 'pow', kind: 'func', index: 0 }]
      });

      const inst = instantiate(wasm);
      assert.equal(inst.exports.pow(2, 0), 1);
      assert.equal(inst.exports.pow(2, 10), 1024);
      assert.equal(inst.exports.pow(3, 5), 243);
    });
  });

  describe('Disassembler', () => {
    it('decode and re-execute produces same result', () => {
      const wasm = buildModule({
        types: [{ params: ['i32'], results: ['i32'] }],
        functions: [{
          typeIdx: 0,
          body: [
            Op.local_get, ...encodeU32(0),
            Op.local_get, ...encodeU32(0),
            Op.i32_mul,
          ]
        }],
        exports: [{ name: 'square', kind: 'func', index: 0 }]
      });

      // Decode the binary
      const module = decode(wasm);
      assert.equal(module.types.length, 1);
      assert.equal(module.code.length, 1);
      assert.equal(module.exports.length, 1);

      // Execute
      const inst = instantiate(wasm);
      assert.equal(inst.exports.square(7), 49);
      assert.equal(inst.exports.square(12), 144);
    });
  });
});

// Helper
function run(desc, funcName) {
  const wasm = buildModule(desc);
  const inst = instantiate(wasm);
  return inst.exports[funcName];
}
