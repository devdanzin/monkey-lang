// Tracing JIT Tests
// Tests the IR recording, trace compilation, and execution

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { IR, Trace, TraceRecorder, JIT, TraceCompiler } from './jit.js';  // Note: TraceCompiler not exported yet
import {
  MonkeyInteger, MonkeyBoolean, MonkeyString,
  TRUE, FALSE, NULL, cachedInteger,
} from './object.js';

describe('IR and Trace', () => {
  it('should create a trace with IR instructions', () => {
    const trace = new Trace('test', 0);
    const id1 = trace.addInst(IR.LOOP_START);
    const id2 = trace.addInst(IR.CONST_INT, { value: 42 });
    const id3 = trace.addInst(IR.LOOP_END);

    assert.equal(trace.ir.length, 3);
    assert.equal(trace.ir[0].op, IR.LOOP_START);
    assert.equal(trace.ir[1].op, IR.CONST_INT);
    assert.equal(trace.ir[1].operands.value, 42);
    assert.equal(id1, 0);
    assert.equal(id2, 1);
    assert.equal(id3, 2);
  });

  it('should record integer addition trace', () => {
    const trace = new Trace('test', 0);
    trace.addInst(IR.LOOP_START);

    // Simulate: load local x (int), load const 1 (int), add, store local x
    const loadRef = trace.addInst(IR.LOAD_LOCAL, { slot: 0 });
    const guardRef = trace.addInst(IR.GUARD_INT, { ref: loadRef });
    trace.guardCount++;
    const unbox1 = trace.addInst(IR.UNBOX_INT, { ref: loadRef });

    const constRef = trace.addInst(IR.CONST_INT, { value: 1 });
    // No guard needed for constants — we know the type

    const addRef = trace.addInst(IR.ADD_INT, { left: unbox1, right: constRef });
    const boxRef = trace.addInst(IR.BOX_INT, { ref: addRef });
    const storeRef = trace.addInst(IR.STORE_LOCAL, { slot: 0, value: boxRef });

    trace.addInst(IR.LOOP_END);

    assert.equal(trace.ir.length, 9);
    assert.equal(trace.guardCount, 1);
  });
});

describe('JIT hot counting', () => {
  it('should detect hot loops', () => {
    const jit = new JIT();
    for (let i = 0; i < 15; i++) {
      assert.equal(jit.countEdge('fn1', 10), false);
    }
    assert.equal(jit.countEdge('fn1', 10), true); // 16th hit
  });

  it('should track different locations independently', () => {
    const jit = new JIT();
    for (let i = 0; i < 15; i++) {
      jit.countEdge('fn1', 10);
    }
    assert.equal(jit.countEdge('fn2', 10), false); // different function
    assert.equal(jit.countEdge('fn1', 10), true);  // fn1 is hot
  });
});

describe('Trace compilation', () => {
  it('should compile a simple counter trace to JS', () => {
    const trace = new Trace('test', 0);
    trace.addInst(IR.LOOP_START);

    // x = x + 1 where x is local slot 0
    const loadRef = trace.addInst(IR.LOAD_LOCAL, { slot: 0 });
    const guardRef = trace.addInst(IR.GUARD_INT, { ref: loadRef });
    trace.guardCount++;
    const unboxRef = trace.addInst(IR.UNBOX_INT, { ref: loadRef });
    const constRef = trace.addInst(IR.CONST_INT, { value: 1 });
    const addRef = trace.addInst(IR.ADD_INT, { left: unboxRef, right: constRef });
    const boxRef = trace.addInst(IR.BOX_INT, { ref: addRef });
    trace.addInst(IR.STORE_LOCAL, { slot: 0, value: boxRef });

    // Guard: x < 100
    const load2 = trace.addInst(IR.LOAD_LOCAL, { slot: 0 });
    const guard2 = trace.addInst(IR.GUARD_INT, { ref: load2 });
    trace.guardCount++;
    const unbox2 = trace.addInst(IR.UNBOX_INT, { ref: load2 });
    const limit = trace.addInst(IR.CONST_INT, { value: 100 });
    const cmpRef = trace.addInst(IR.LT, { left: unbox2, right: limit });
    trace.addInst(IR.GUARD_TRUTHY, { ref: cmpRef, exitIp: 99 });
    trace.guardCount++;

    trace.addInst(IR.LOOP_END);

    // Compile
    const jit = new JIT();
    const compiled = jit.compile(trace, null);
    assert.equal(compiled, true);
    assert.ok(trace.compiled);

    // Execute: start with x = 0
    const stack = [cachedInteger(0)];
    const result = trace.compiled(
      stack, 1, 0, [], [], [],
      MonkeyInteger, MonkeyBoolean, MonkeyString,
      TRUE, FALSE, NULL,
      cachedInteger,
      (obj) => {
        if (obj instanceof MonkeyBoolean) return obj.value;
        if (obj === NULL) return false;
        return true;
      }
    );

    // Should have counted x up to 100 then exited via guard
    assert.equal(stack[0].value, 100);
    assert.equal(result.exit, 'guard_falsy');
  });
});
