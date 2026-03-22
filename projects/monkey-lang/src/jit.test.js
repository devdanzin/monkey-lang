// Tracing JIT Tests
// Tests the IR recording, trace compilation, and execution

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { IR, Trace, TraceRecorder, JIT, TraceCompiler, TraceOptimizer } from './jit.js';
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

describe('Trace optimization', () => {
  it('should eliminate redundant guards', () => {
    
    const trace = new Trace('test', 0);
    trace.addInst(IR.LOOP_START);
    const load = trace.addInst(IR.LOAD_LOCAL, { slot: 0 });
    trace.addInst(IR.GUARD_INT, { ref: load }); trace.guardCount++;
    trace.addInst(IR.GUARD_INT, { ref: load }); trace.guardCount++; // redundant
    trace.addInst(IR.UNBOX_INT, { ref: load });
    trace.addInst(IR.LOOP_END);

    const opt = new TraceOptimizer(trace);
    const eliminated = opt.redundantGuardElimination();
    assert.equal(eliminated, 1);
    assert.equal(trace.guardCount, 1);
  });

  it('should eliminate guards on constants', () => {
    
    const trace = new Trace('test', 0);
    trace.addInst(IR.LOOP_START);
    const c = trace.addInst(IR.CONST_INT, { value: 42 });
    trace.addInst(IR.GUARD_INT, { ref: c }); trace.guardCount++;
    trace.addInst(IR.LOOP_END);

    const opt = new TraceOptimizer(trace);
    const eliminated = opt.redundantGuardElimination();
    assert.equal(eliminated, 1);
  });

  it('should fold constant arithmetic', () => {
    
    const trace = new Trace('test', 0);
    trace.addInst(IR.LOOP_START);
    const a = trace.addInst(IR.CONST_INT, { value: 10 });
    const b = trace.addInst(IR.CONST_INT, { value: 3 });
    const sum = trace.addInst(IR.ADD_INT, { left: a, right: b });
    trace.addInst(IR.LOOP_END);

    const opt = new TraceOptimizer(trace);
    const folded = opt.constantFolding();
    assert.equal(folded, 1);
    assert.equal(trace.ir[3].op, IR.CONST_INT);
    assert.equal(trace.ir[3].operands.value, 13);
  });

  it('should not corrupt non-ref numeric operands during compaction', () => {
    
    const trace = new Trace('test', 0);
    trace.addInst(IR.LOOP_START);                        // 0
    const c20 = trace.addInst(IR.CONST_INT, { value: 20 }); // 1
    const load = trace.addInst(IR.LOAD_LOCAL, { slot: 0 });  // 2
    trace.addInst(IR.GUARD_INT, { ref: load }); trace.guardCount++; // 3
    const unbox = trace.addInst(IR.UNBOX_INT, { ref: load }); // 4
    const cmp = trace.addInst(IR.GT, { left: c20, right: unbox }); // 5
    // Add dead instructions to trigger DCE + compaction
    trace.addInst(IR.LOAD_LOCAL, { slot: 1 });  // 6 — dead
    trace.addInst(IR.STORE_LOCAL, { slot: 0, value: cmp }); // 7
    trace.addInst(IR.LOOP_END); // 8

    const opt = new TraceOptimizer(trace);
    opt.optimize();

    // Find the CONST_INT — its value should still be 20
    const constInst = trace.ir.find(i => i.op === IR.CONST_INT && i.operands.value !== undefined);
    assert.equal(constInst.operands.value, 20, 'CONST_INT value was corrupted by compaction');
  });

  it('should eliminate dead code', () => {
    
    const trace = new Trace('test', 0);
    trace.addInst(IR.LOOP_START);                          // 0
    const dead = trace.addInst(IR.CONST_INT, { value: 99 }); // 1 — unused
    const load = trace.addInst(IR.LOAD_LOCAL, { slot: 0 });  // 2
    trace.addInst(IR.GUARD_INT, { ref: load }); trace.guardCount++; // 3
    trace.addInst(IR.LOOP_END);                            // 4

    const opt = new TraceOptimizer(trace);
    const eliminated = opt.deadCodeElimination();
    assert.ok(eliminated >= 1);
    // CONST_INT(99) should be gone
    assert.ok(!trace.ir.find(i => i.op === IR.CONST_INT && i.operands.value === 99));
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
      },
      new Map(),
    );

    // Should have counted x up to 100 then exited via guard
    assert.equal(stack[0].value, 100);
    assert.equal(result.exit, 'guard_falsy');
  });
});
