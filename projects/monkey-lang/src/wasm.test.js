// Tests for WASM binary encoder
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  WasmModuleBuilder, FuncBodyBuilder, Op, ValType, ExportKind,
  encodeULEB128, encodeSLEB128, instantiateModule
} from './wasm.js';

describe('WASM Binary Encoder', () => {

  describe('LEB128 encoding', () => {
    it('encodeULEB128 small values', () => {
      assert.deepStrictEqual(encodeULEB128(0), [0]);
      assert.deepStrictEqual(encodeULEB128(1), [1]);
      assert.deepStrictEqual(encodeULEB128(127), [127]);
    });

    it('encodeULEB128 multi-byte', () => {
      assert.deepStrictEqual(encodeULEB128(128), [0x80, 0x01]);
      assert.deepStrictEqual(encodeULEB128(624485), [0xe5, 0x8e, 0x26]);
    });

    it('encodeSLEB128 positive', () => {
      assert.deepStrictEqual(encodeSLEB128(0), [0]);
      assert.deepStrictEqual(encodeSLEB128(1), [1]);
      assert.deepStrictEqual(encodeSLEB128(63), [63]);
      assert.deepStrictEqual(encodeSLEB128(64), [0xc0, 0x00]);
    });

    it('encodeSLEB128 negative', () => {
      assert.deepStrictEqual(encodeSLEB128(-1), [0x7f]);
      assert.deepStrictEqual(encodeSLEB128(-64), [0x40]);
      assert.deepStrictEqual(encodeSLEB128(-65), [0xbf, 0x7f]);
    });
  });

  describe('Module builder basics', () => {
    it('builds empty module', async () => {
      const builder = new WasmModuleBuilder();
      const binary = builder.build();
      assert.strictEqual(binary[0], 0x00);
      assert.strictEqual(binary[1], 0x61);
      assert.strictEqual(binary[2], 0x73);
      assert.strictEqual(binary[3], 0x6d);
      assert.strictEqual(binary[4], 0x01);
      const module = await WebAssembly.compile(binary);
      assert.ok(module);
    });

    it('builds module with single function returning constant', async () => {
      const builder = new WasmModuleBuilder();
      const { index, body } = builder.addFunction([], [ValType.i32]);
      body.i32Const(42);
      builder.addExport('answer', ExportKind.Func, index);

      const instance = await instantiateModule(builder);
      assert.strictEqual(instance.exports.answer(), 42);
    });

    it('builds module with addition function', async () => {
      const builder = new WasmModuleBuilder();
      const { index, body } = builder.addFunction(
        [ValType.i32, ValType.i32],
        [ValType.i32]
      );
      body.localGet(0).localGet(1).emit(Op.i32_add);
      builder.addExport('add', ExportKind.Func, index);

      const instance = await instantiateModule(builder);
      assert.strictEqual(instance.exports.add(10, 32), 42);
      assert.strictEqual(instance.exports.add(-5, 8), 3);
    });

    it('builds module with locals', async () => {
      const builder = new WasmModuleBuilder();
      const { index, body } = builder.addFunction(
        [ValType.i32],
        [ValType.i32]
      );
      body.addLocal(ValType.i32);
      body
        .localGet(0).i32Const(2).emit(Op.i32_mul).localSet(1)
        .localGet(1).i32Const(1).emit(Op.i32_add);
      builder.addExport('doubleAndInc', ExportKind.Func, index);

      const instance = await instantiateModule(builder);
      assert.strictEqual(instance.exports.doubleAndInc(5), 11);
      assert.strictEqual(instance.exports.doubleAndInc(0), 1);
    });

    it('builds module with if/else', async () => {
      const builder = new WasmModuleBuilder();
      const { index, body } = builder.addFunction(
        [ValType.i32],
        [ValType.i32]
      );
      // if param > 0 then 1 else -1
      body
        .localGet(0).i32Const(0).emit(Op.i32_gt_s)
        .if_(ValType.i32)
          .i32Const(1)
        .else_()
          .i32Const(-1)
        .end(); // closes if — function end added by encode()
      builder.addExport('sign', ExportKind.Func, index);

      const instance = await instantiateModule(builder);
      assert.strictEqual(instance.exports.sign(10), 1);
      assert.strictEqual(instance.exports.sign(-5), -1);
      assert.strictEqual(instance.exports.sign(0), -1);
    });

    it('builds module with loop (sum 1..n)', async () => {
      const builder = new WasmModuleBuilder();
      const { index, body } = builder.addFunction(
        [ValType.i32],
        [ValType.i32]
      );
      body.addLocal(ValType.i32); // sum
      body.addLocal(ValType.i32); // i

      body.i32Const(0).localSet(1);
      body.i32Const(1).localSet(2);

      body.block().loop();
        body.localGet(2).localGet(0).emit(Op.i32_gt_s).brIf(1);
        body.localGet(1).localGet(2).emit(Op.i32_add).localSet(1);
        body.localGet(2).i32Const(1).emit(Op.i32_add).localSet(2);
        body.br(0);
      body.end().end(); // closes loop + block

      body.localGet(1); // implicit return via fallthrough
      builder.addExport('sum', ExportKind.Func, index);

      const instance = await instantiateModule(builder);
      assert.strictEqual(instance.exports.sum(10), 55);
      assert.strictEqual(instance.exports.sum(100), 5050);
      assert.strictEqual(instance.exports.sum(0), 0);
    });

    it('builds module with function calls', async () => {
      const builder = new WasmModuleBuilder();

      const { index: sqIdx, body: sqBody } = builder.addFunction(
        [ValType.i32], [ValType.i32]
      );
      sqBody.localGet(0).localGet(0).emit(Op.i32_mul);

      const { index: sosIdx, body: sosBody } = builder.addFunction(
        [ValType.i32, ValType.i32], [ValType.i32]
      );
      sosBody.localGet(0).call(sqIdx).localGet(1).call(sqIdx).emit(Op.i32_add);

      builder.addExport('square', ExportKind.Func, sqIdx);
      builder.addExport('sumOfSquares', ExportKind.Func, sosIdx);

      const instance = await instantiateModule(builder);
      assert.strictEqual(instance.exports.square(5), 25);
      assert.strictEqual(instance.exports.sumOfSquares(3, 4), 25);
    });

    it('builds module with memory', async () => {
      const builder = new WasmModuleBuilder();
      builder.addMemory(1);

      const { index, body } = builder.addFunction([], [ValType.i32]);
      body
        .i32Const(0).i32Const(42).i32Store()
        .i32Const(0).i32Load();
      builder.addExport('memory', ExportKind.Memory, 0);
      builder.addExport('test', ExportKind.Func, index);

      const instance = await instantiateModule(builder);
      assert.strictEqual(instance.exports.test(), 42);
    });

    it('builds module with globals', async () => {
      const builder = new WasmModuleBuilder();
      const gIdx = builder.addGlobal(ValType.i32, true, 0);

      const { index, body } = builder.addFunction([], [ValType.i32]);
      body
        .globalGet(gIdx).i32Const(1).emit(Op.i32_add).globalSet(gIdx)
        .globalGet(gIdx);
      builder.addExport('increment', ExportKind.Func, index);

      const instance = await instantiateModule(builder);
      assert.strictEqual(instance.exports.increment(), 1);
      assert.strictEqual(instance.exports.increment(), 2);
      assert.strictEqual(instance.exports.increment(), 3);
    });

    it('builds module with data segment', async () => {
      const builder = new WasmModuleBuilder();
      builder.addMemory(1);

      const hello = [72, 101, 108, 108, 111]; // "Hello"
      builder.addDataSegment(0, hello);

      const { index, body } = builder.addFunction([ValType.i32], [ValType.i32]);
      body.localGet(0).emit(Op.i32_load8_u, ...encodeULEB128(0), ...encodeULEB128(0));
      builder.addExport('memory', ExportKind.Memory, 0);
      builder.addExport('loadByte', ExportKind.Func, index);

      const instance = await instantiateModule(builder);
      assert.strictEqual(instance.exports.loadByte(0), 72);  // 'H'
      assert.strictEqual(instance.exports.loadByte(1), 101); // 'e'
      assert.strictEqual(instance.exports.loadByte(4), 111); // 'o'
    });

    it('deduplicates type signatures', () => {
      const builder = new WasmModuleBuilder();
      const t1 = builder.addType([ValType.i32], [ValType.i32]);
      const t2 = builder.addType([ValType.i32], [ValType.i32]);
      const t3 = builder.addType([ValType.i32, ValType.i32], [ValType.i32]);
      assert.strictEqual(t1, t2);
      assert.notStrictEqual(t1, t3);
      assert.strictEqual(builder.types.length, 2);
    });

    it('fibonacci via WASM', async () => {
      const builder = new WasmModuleBuilder();
      const { index, body } = builder.addFunction([ValType.i32], [ValType.i32]);
      body.addLocal(ValType.i32); // a
      body.addLocal(ValType.i32); // b
      body.addLocal(ValType.i32); // temp
      body.addLocal(ValType.i32); // i

      body.i32Const(0).localSet(1);
      body.i32Const(1).localSet(2);
      body.i32Const(0).localSet(4);

      body.block().loop();
        body.localGet(4).localGet(0).emit(Op.i32_ge_s).brIf(1);
        body.localGet(1).localGet(2).emit(Op.i32_add).localSet(3);
        body.localGet(2).localSet(1);
        body.localGet(3).localSet(2);
        body.localGet(4).i32Const(1).emit(Op.i32_add).localSet(4);
        body.br(0);
      body.end().end(); // closes loop + block

      body.localGet(1);
      builder.addExport('fib', ExportKind.Func, index);

      const instance = await instantiateModule(builder);
      assert.strictEqual(instance.exports.fib(0), 0);
      assert.strictEqual(instance.exports.fib(1), 1);
      assert.strictEqual(instance.exports.fib(10), 55);
      assert.strictEqual(instance.exports.fib(20), 6765);
    });

    it('builds module with imports', async () => {
      const builder = new WasmModuleBuilder();
      const printIdx = builder.addImport('env', 'print', [ValType.i32], []);

      const { index, body } = builder.addFunction([ValType.i32], []);
      body.localGet(0).call(printIdx);
      builder.addExport('callPrint', ExportKind.Func, index);

      let printed = null;
      const instance = await instantiateModule(builder, {
        env: { print: (v) => { printed = v; } }
      });
      instance.exports.callPrint(99);
      assert.strictEqual(printed, 99);
    });

    it('handles f64 constants and arithmetic', async () => {
      const builder = new WasmModuleBuilder();
      const { index, body } = builder.addFunction(
        [ValType.f64, ValType.f64],
        [ValType.f64]
      );
      body.localGet(0).localGet(1).emit(Op.f64_add);
      builder.addExport('addF64', ExportKind.Func, index);

      const instance = await instantiateModule(builder);
      assert.strictEqual(instance.exports.addF64(1.5, 2.5), 4.0);
      assert.strictEqual(instance.exports.addF64(-1.0, 1.0), 0.0);
    });

    it('table + call_indirect', async () => {
      const builder = new WasmModuleBuilder();

      // Two functions with the same signature: (i32) -> i32
      const typeIdx = builder.addType([ValType.i32], [ValType.i32]);

      // func0: double(x) = x * 2
      const { index: f0, body: b0 } = builder.addFunction([ValType.i32], [ValType.i32]);
      b0.localGet(0).i32Const(2).emit(Op.i32_mul);

      // func1: triple(x) = x * 3
      const { index: f1, body: b1 } = builder.addFunction([ValType.i32], [ValType.i32]);
      b1.localGet(0).i32Const(3).emit(Op.i32_mul);

      // Table with 2 entries
      builder.addTable(ValType.funcref, 2, 2);
      builder.addElement(0, 0, [f0, f1]);

      // Dispatch: call function at table[idx](arg)
      const { index: dispatchIdx, body: dispatchBody } = builder.addFunction(
        [ValType.i32, ValType.i32], [ValType.i32]
      );
      // arg=local[0], table_idx=local[1]
      dispatchBody.localGet(0).localGet(1).callIndirect(typeIdx);

      builder.addExport('dispatch', ExportKind.Func, dispatchIdx);

      const instance = await instantiateModule(builder);
      assert.strictEqual(instance.exports.dispatch(5, 0), 10);  // double(5)
      assert.strictEqual(instance.exports.dispatch(5, 1), 15);  // triple(5)
    });
  });
});
