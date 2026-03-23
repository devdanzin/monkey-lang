// Tracing JIT Tests
// Tests the IR recording, trace compilation, and execution

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { IR, Trace, TraceRecorder, JIT, TraceCompiler, TraceOptimizer } from './jit.js';
import {
  MonkeyInteger, MonkeyBoolean, MonkeyString,
  TRUE, FALSE, NULL, cachedInteger, internString,
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

  it('should forward store-to-load for locals', () => {
    const trace = new Trace('test', 0);
    trace.addInst(IR.LOOP_START);                              // 0
    const constVal = trace.addInst(IR.CONST_INT, { value: 42 }); // 1
    const boxed = trace.addInst(IR.BOX_INT, { ref: constVal });   // 2
    trace.addInst(IR.STORE_LOCAL, { slot: 0, value: boxed });     // 3
    const load = trace.addInst(IR.LOAD_LOCAL, { slot: 0 });       // 4 — should be forwarded to boxed
    trace.addInst(IR.GUARD_INT, { ref: load }); trace.guardCount++; // 5
    trace.addInst(IR.LOOP_END);                                   // 6

    const opt = new TraceOptimizer(trace);
    const forwarded = opt.storeToLoadForwarding();
    assert.ok(forwarded >= 1, 'should forward at least one load');
    // The LOAD_LOCAL should be gone
    assert.ok(!trace.ir.find(i => i.op === IR.LOAD_LOCAL && i.operands.slot === 0),
      'LOAD_LOCAL should be eliminated');
  });

  it('should forward store-to-load for globals', () => {
    const trace = new Trace('test', 0);
    trace.addInst(IR.LOOP_START);
    const constVal = trace.addInst(IR.CONST_INT, { value: 7 });
    const boxed = trace.addInst(IR.BOX_INT, { ref: constVal });
    trace.addInst(IR.STORE_GLOBAL, { index: 0, value: boxed });
    const load = trace.addInst(IR.LOAD_GLOBAL, { index: 0 });  // should be forwarded
    trace.addInst(IR.GUARD_INT, { ref: load }); trace.guardCount++;
    trace.addInst(IR.LOOP_END);

    const opt = new TraceOptimizer(trace);
    const forwarded = opt.storeToLoadForwarding();
    assert.ok(forwarded >= 1);
    assert.ok(!trace.ir.find(i => i.op === IR.LOAD_GLOBAL));
  });

  it('should not forward across a CALL (store invalidation)', () => {
    const trace = new Trace('test', 0);
    trace.addInst(IR.LOOP_START);
    const constVal = trace.addInst(IR.CONST_INT, { value: 5 });
    const boxed = trace.addInst(IR.BOX_INT, { ref: constVal });
    trace.addInst(IR.STORE_LOCAL, { slot: 0, value: boxed });
    trace.addInst(IR.CALL, { numArgs: 0 });  // invalidates stores
    const load = trace.addInst(IR.LOAD_LOCAL, { slot: 0 });  // should NOT be forwarded
    trace.addInst(IR.GUARD_INT, { ref: load }); trace.guardCount++;
    trace.addInst(IR.LOOP_END);

    const opt = new TraceOptimizer(trace);
    const forwarded = opt.storeToLoadForwarding();
    assert.equal(forwarded, 0, 'should not forward across CALL');
  });

  it('should hoist loop-invariant code above LOOP_START', () => {
    const trace = new Trace('test', 0);
    // Pre-loop: load x
    const loadX = trace.addInst(IR.LOAD_LOCAL, { slot: 0 });       // 0
    trace.addInst(IR.GUARD_INT, { ref: loadX }); trace.guardCount++; // 1
    const unboxX = trace.addInst(IR.UNBOX_INT, { ref: loadX });     // 2
    // LOOP_START
    trace.addInst(IR.LOOP_START);                                    // 3
    // Loop body: uses unboxX + a constant (both loop-invariant individually,
    // but the constant is defined inside the loop)
    const constVal = trace.addInst(IR.CONST_INT, { value: 10 });    // 4 — loop-invariant
    const mul = trace.addInst(IR.MUL_INT, { left: unboxX, right: constVal }); // 5 — loop-invariant
    const boxed = trace.addInst(IR.BOX_INT, { ref: mul });          // 6 — loop-invariant
    trace.addInst(IR.STORE_LOCAL, { slot: 1, value: boxed });       // 7 — side effect, stays
    trace.addInst(IR.LOOP_END);                                      // 8

    const opt = new TraceOptimizer(trace);
    const hoisted = opt.loopInvariantCodeMotion();
    assert.ok(hoisted >= 2, `should hoist at least const + mul, got ${hoisted}`);

    // Find LOOP_START position in optimized IR
    const loopIdx = trace.ir.findIndex(i => i.op === IR.LOOP_START);
    // CONST_INT(10) and MUL_INT should be before LOOP_START
    const constIdx = trace.ir.findIndex(i => i.op === IR.CONST_INT && i.operands.value === 10);
    const mulIdx = trace.ir.findIndex(i => i.op === IR.MUL_INT);
    assert.ok(constIdx < loopIdx, 'CONST_INT should be hoisted before LOOP_START');
    assert.ok(mulIdx < loopIdx, 'MUL_INT should be hoisted before LOOP_START');
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

  it('should eliminate UNBOX_INT(BOX_INT(x)) → x', () => {
    const trace = new Trace('test', 0);
    trace.addInst(IR.LOOP_START);
    const raw = trace.addInst(IR.CONST_INT, { value: 42 });
    const boxed = trace.addInst(IR.BOX_INT, { ref: raw });
    const unboxed = trace.addInst(IR.UNBOX_INT, { ref: boxed });
    const add = trace.addInst(IR.ADD_INT, { left: unboxed, right: raw });
    const boxResult = trace.addInst(IR.BOX_INT, { ref: add });
    trace.addInst(IR.STORE_LOCAL, { slot: 0, value: boxResult });
    trace.addInst(IR.LOOP_END);

    const opt = new TraceOptimizer(trace);
    const eliminated = opt.boxUnboxElimination();
    assert.ok(eliminated >= 1, `should eliminate at least 1 box-unbox pair, got ${eliminated}`);
    // The UNBOX_INT should be gone — ADD_INT should reference the raw CONST_INT directly
    assert.ok(!trace.ir.find(i => i.op === IR.UNBOX_INT));
  });

  it('should eliminate BOX_INT(UNBOX_INT(x)) → x', () => {
    const trace = new Trace('test', 0);
    trace.addInst(IR.LOOP_START);
    const load = trace.addInst(IR.LOAD_LOCAL, { slot: 0 });
    trace.addInst(IR.GUARD_INT, { ref: load }); trace.guardCount++;
    const unboxed = trace.addInst(IR.UNBOX_INT, { ref: load });
    const reboxed = trace.addInst(IR.BOX_INT, { ref: unboxed });
    trace.addInst(IR.STORE_LOCAL, { slot: 1, value: reboxed });
    trace.addInst(IR.LOOP_END);

    const opt = new TraceOptimizer(trace);
    const eliminated = opt.boxUnboxElimination();
    assert.ok(eliminated >= 1);
    // The rebox should be gone — STORE should reference the original load
    const store = trace.ir.find(i => i.op === IR.STORE_LOCAL && i.operands.slot === 1);
    assert.ok(store);
    // The value ref should point to the load, not a BOX_INT
    const valInst = trace.ir[store.operands.value];
    assert.ok(valInst.op !== IR.BOX_INT, 'BOX_INT(UNBOX_INT(x)) should be eliminated');
  });

  it('should eliminate dead stores (overwritten before read)', () => {
    const trace = new Trace('test', 0);
    trace.addInst(IR.LOOP_START);
    const c1 = trace.addInst(IR.CONST_INT, { value: 1 });
    const b1 = trace.addInst(IR.BOX_INT, { ref: c1 });
    trace.addInst(IR.STORE_LOCAL, { slot: 0, value: b1 }); // dead — overwritten below
    const c2 = trace.addInst(IR.CONST_INT, { value: 2 });
    const b2 = trace.addInst(IR.BOX_INT, { ref: c2 });
    trace.addInst(IR.STORE_LOCAL, { slot: 0, value: b2 }); // this one survives
    trace.addInst(IR.LOOP_END);

    const opt = new TraceOptimizer(trace);
    const eliminated = opt.deadStoreElimination();
    assert.ok(eliminated >= 1, `should eliminate at least 1 dead store, got ${eliminated}`);
    // Only one STORE_LOCAL to slot 0 should remain
    const stores = trace.ir.filter(i => i.op === IR.STORE_LOCAL && i.operands.slot === 0);
    assert.equal(stores.length, 1, 'should have exactly one store to slot 0');
  });

  it('should eliminate common subexpressions (duplicate loads)', () => {
    const trace = new Trace('test', 0);
    trace.addInst(IR.LOOP_START);
    const l1 = trace.addInst(IR.LOAD_GLOBAL, { index: 0 });
    trace.addInst(IR.GUARD_INT, { ref: l1 }); trace.guardCount++;
    const u1 = trace.addInst(IR.UNBOX_INT, { ref: l1 });
    const l2 = trace.addInst(IR.LOAD_GLOBAL, { index: 0 }); // duplicate
    trace.addInst(IR.GUARD_INT, { ref: l2 }); trace.guardCount++;
    const u2 = trace.addInst(IR.UNBOX_INT, { ref: l2 });
    const add = trace.addInst(IR.ADD_INT, { left: u1, right: u2 });
    trace.addInst(IR.LOOP_END);

    const opt = new TraceOptimizer(trace);
    const eliminated = opt.commonSubexpressionElimination();
    assert.ok(eliminated >= 1, `should eliminate duplicate load, got ${eliminated}`);

    // The duplicate LOAD_GLOBAL should be removed
    const loads = trace.ir.filter(i => i && i.op === IR.LOAD_GLOBAL);
    assert.equal(loads.length, 1, 'only one load should remain');
  });

  it('should NOT CSE loads across a store to the same slot', () => {
    const trace = new Trace('test', 0);
    trace.addInst(IR.LOOP_START);
    const l1 = trace.addInst(IR.LOAD_GLOBAL, { index: 0 });
    const c1 = trace.addInst(IR.CONST_INT, { value: 42 });
    const b1 = trace.addInst(IR.BOX_INT, { ref: c1 });
    trace.addInst(IR.STORE_GLOBAL, { index: 0, value: b1 }); // invalidates
    const l2 = trace.addInst(IR.LOAD_GLOBAL, { index: 0 }); // NOT a duplicate
    trace.addInst(IR.LOOP_END);

    const opt = new TraceOptimizer(trace);
    const eliminated = opt.commonSubexpressionElimination();
    // l2 should NOT be eliminated — it loads after a store
    const loads = trace.ir.filter(i => i && i.op === IR.LOAD_GLOBAL);
    assert.equal(loads.length, 2, 'both loads should remain');
  });

  it('should not eliminate stores separated by a load', () => {
    const trace = new Trace('test', 0);
    trace.addInst(IR.LOOP_START);
    const c1 = trace.addInst(IR.CONST_INT, { value: 1 });
    const b1 = trace.addInst(IR.BOX_INT, { ref: c1 });
    trace.addInst(IR.STORE_LOCAL, { slot: 0, value: b1 }); // needed — load follows
    const load = trace.addInst(IR.LOAD_LOCAL, { slot: 0 });
    trace.addInst(IR.GUARD_INT, { ref: load }); trace.guardCount++;
    const c2 = trace.addInst(IR.CONST_INT, { value: 2 });
    const b2 = trace.addInst(IR.BOX_INT, { ref: c2 });
    trace.addInst(IR.STORE_LOCAL, { slot: 0, value: b2 });
    trace.addInst(IR.LOOP_END);

    const opt = new TraceOptimizer(trace);
    const eliminated = opt.deadStoreElimination();
    assert.equal(eliminated, 0, 'should not eliminate stores separated by a load');
  });
});

describe('Constant propagation', () => {
  it('should propagate constants through UNBOX_INT of known boxed value', () => {
    const trace = new Trace('test', 0);
    trace.addInst(IR.LOOP_START);
    const c1 = trace.addInst(IR.CONST_INT, { value: 10 });
    const b1 = trace.addInst(IR.BOX_INT, { ref: c1 });
    trace.addInst(IR.STORE_LOCAL, { slot: 0, value: b1 });
    const load = trace.addInst(IR.LOAD_LOCAL, { slot: 0 });
    const unboxed = trace.addInst(IR.UNBOX_INT, { ref: load });
    trace.addInst(IR.LOOP_END);

    const opt = new TraceOptimizer(trace);
    const propagated = opt.constantPropagation();
    assert.ok(propagated >= 1, `should propagate at least 1 constant, got ${propagated}`);
    // The UNBOX_INT should have been replaced with CONST_INT(10)
    const unboxInst = trace.ir.find(inst => inst && inst.id === unboxed);
    // After propagation, the instruction that was UNBOX_INT should now be CONST_INT
    const resultInst = trace.ir[unboxed];
    assert.equal(resultInst.op, IR.CONST_INT);
    assert.equal(resultInst.operands.value, 10);
  });

  it('should propagate through NEG of known constant', () => {
    const trace = new Trace('test', 0);
    trace.addInst(IR.LOOP_START);
    const c1 = trace.addInst(IR.CONST_INT, { value: 7 });
    const neg = trace.addInst(IR.NEG, { ref: c1 });
    trace.addInst(IR.LOOP_END);

    const opt = new TraceOptimizer(trace);
    const propagated = opt.constantPropagation();
    assert.equal(propagated, 1);
    assert.equal(trace.ir[neg].op, IR.CONST_INT);
    assert.equal(trace.ir[neg].operands.value, -7);
  });

  it('should NOT propagate through slots modified by CALL', () => {
    const trace = new Trace('test', 0);
    trace.addInst(IR.LOOP_START);
    const c1 = trace.addInst(IR.CONST_INT, { value: 5 });
    const b1 = trace.addInst(IR.BOX_INT, { ref: c1 });
    trace.addInst(IR.STORE_GLOBAL, { index: 0, value: b1 });
    trace.addInst(IR.CALL, {}); // invalidates
    const load = trace.addInst(IR.LOAD_GLOBAL, { index: 0 });
    const unboxed = trace.addInst(IR.UNBOX_INT, { ref: load });
    trace.addInst(IR.LOOP_END);

    const opt = new TraceOptimizer(trace);
    const propagated = opt.constantPropagation();
    assert.equal(propagated, 0, 'should not propagate across CALL');
  });
});

describe('Algebraic simplification', () => {
  it('should simplify x + 0 → x', () => {
    const trace = new Trace('test', 0);
    trace.addInst(IR.LOOP_START);
    const x = trace.addInst(IR.CONST_INT, { value: 42 });
    const zero = trace.addInst(IR.CONST_INT, { value: 0 });
    const add = trace.addInst(IR.ADD_INT, { left: x, right: zero });
    const store = trace.addInst(IR.STORE_GLOBAL, { index: 0, value: add });
    trace.addInst(IR.LOOP_END);

    const opt = new TraceOptimizer(trace);
    const simplified = opt.algebraicSimplification();
    assert.equal(simplified, 1);
    const storeInst = trace.ir.find(i => i.op === IR.STORE_GLOBAL);
    const constInst = trace.ir.find(i => i.op === IR.CONST_INT && i.operands.value === 42);
    assert.equal(storeInst.operands.value, constInst.id);
  });

  it('should simplify x * 0 → 0', () => {
    const trace = new Trace('test', 0);
    trace.addInst(IR.LOOP_START);
    const x = trace.addInst(IR.CONST_INT, { value: 42 });
    const zero = trace.addInst(IR.CONST_INT, { value: 0 });
    const mul = trace.addInst(IR.MUL_INT, { left: x, right: zero });
    const store = trace.addInst(IR.STORE_GLOBAL, { index: 0, value: mul });
    trace.addInst(IR.LOOP_END);

    const opt = new TraceOptimizer(trace);
    const simplified = opt.algebraicSimplification();
    assert.equal(simplified, 1);
    const storeInst = trace.ir.find(i => i.op === IR.STORE_GLOBAL);
    const valInst = trace.ir[storeInst.operands.value];
    assert.equal(valInst.op, IR.CONST_INT);
    assert.equal(valInst.operands.value, 0);
  });

  it('should simplify x * 2 → x + x', () => {
    const trace = new Trace('test', 0);
    trace.addInst(IR.LOOP_START);
    const x = trace.addInst(IR.CONST_INT, { value: 7 });
    const two = trace.addInst(IR.CONST_INT, { value: 2 });
    const mul = trace.addInst(IR.MUL_INT, { left: x, right: two });
    const store = trace.addInst(IR.STORE_GLOBAL, { index: 0, value: mul });
    trace.addInst(IR.LOOP_END);

    const opt = new TraceOptimizer(trace);
    const simplified = opt.algebraicSimplification();
    assert.equal(simplified, 1);
    const storeInst = trace.ir.find(i => i.op === IR.STORE_GLOBAL);
    const addInst = trace.ir[storeInst.operands.value];
    assert.equal(addInst.op, IR.ADD_INT);
    assert.equal(addInst.operands.left, addInst.operands.right);
  });

  it('should simplify x - x → 0', () => {
    const trace = new Trace('test', 0);
    trace.addInst(IR.LOOP_START);
    const x = trace.addInst(IR.CONST_INT, { value: 5 });
    const sub = trace.addInst(IR.SUB_INT, { left: x, right: x });
    const store = trace.addInst(IR.STORE_GLOBAL, { index: 0, value: sub });
    trace.addInst(IR.LOOP_END);

    const opt = new TraceOptimizer(trace);
    const simplified = opt.algebraicSimplification();
    assert.equal(simplified, 1);
    const storeInst = trace.ir.find(i => i.op === IR.STORE_GLOBAL);
    const valInst = trace.ir[storeInst.operands.value];
    assert.equal(valInst.op, IR.CONST_INT);
    assert.equal(valInst.operands.value, 0);
  });

  it('should simplify x / 1 → x', () => {
    const trace = new Trace('test', 0);
    trace.addInst(IR.LOOP_START);
    const x = trace.addInst(IR.CONST_INT, { value: 99 });
    const one = trace.addInst(IR.CONST_INT, { value: 1 });
    const div = trace.addInst(IR.DIV_INT, { left: x, right: one });
    const store = trace.addInst(IR.STORE_GLOBAL, { index: 0, value: div });
    trace.addInst(IR.LOOP_END);

    const opt = new TraceOptimizer(trace);
    const simplified = opt.algebraicSimplification();
    assert.equal(simplified, 1);
    const storeInst = trace.ir.find(i => i.op === IR.STORE_GLOBAL);
    const constInst = trace.ir.find(i => i.op === IR.CONST_INT && i.operands.value === 99);
    assert.equal(storeInst.operands.value, constInst.id);
  });

  it('should simplify NEG(NEG(x)) → x', () => {
    const trace = new Trace('test', 0);
    trace.addInst(IR.LOOP_START);
    const loadRef = trace.addInst(IR.LOAD_LOCAL, { slot: 0 });
    const unboxRef = trace.addInst(IR.UNBOX_INT, { ref: loadRef });
    const neg1 = trace.addInst(IR.NEG, { ref: unboxRef });
    const neg2 = trace.addInst(IR.NEG, { ref: neg1 });
    const boxRef = trace.addInst(IR.BOX_INT, { ref: neg2 });
    trace.addInst(IR.STORE_GLOBAL, { index: 0, value: boxRef });
    trace.addInst(IR.LOOP_END);

    const opt = new TraceOptimizer(trace);
    const simplified = opt.algebraicSimplification();
    assert.equal(simplified, 1);
    // The outer NEG is eliminated; inner NEG remains but is now dead (DCE will clean it)
    // BOX_INT should now reference the original unboxed value, not a NEG
    const boxInst = trace.ir.find(i => i.op === IR.BOX_INT);
    const boxTarget = trace.ir[boxInst.operands.ref];
    assert.equal(boxTarget.op, IR.UNBOX_INT, 'BOX_INT should point to unboxed value, not NEG');
  });

  it('should simplify x / x → 1', () => {
    const trace = new Trace('test', 0);
    trace.addInst(IR.LOOP_START);
    const loadRef = trace.addInst(IR.LOAD_LOCAL, { slot: 0 });
    const unboxRef = trace.addInst(IR.UNBOX_INT, { ref: loadRef });
    const divRef = trace.addInst(IR.DIV_INT, { left: unboxRef, right: unboxRef });
    const boxRef = trace.addInst(IR.BOX_INT, { ref: divRef });
    trace.addInst(IR.STORE_GLOBAL, { index: 0, value: boxRef });
    trace.addInst(IR.LOOP_END);

    const opt = new TraceOptimizer(trace);
    const simplified = opt.algebraicSimplification();
    assert.equal(simplified, 1);
    const constInst = trace.ir.find(i => i.op === IR.CONST_INT && i.operands.value === 1);
    assert.ok(constInst, 'x / x should be folded to CONST_INT(1)');
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
      internString,
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

  it('should return JIT stats', () => {
    const jit = new JIT();
    const stats = jit.getStats();
    assert.equal(stats.enabled, true);
    assert.equal(stats.rootTraces, 0);
    assert.equal(stats.totalTraces, 0);
    assert.equal(stats.blacklisted, 0);
    assert.equal(stats.aborts, 0);
    assert.ok(Array.isArray(stats.traces));
  });

  it('should dump trace IR as string', () => {
    const jit = new JIT();
    const trace = new Trace('test', 0);
    trace.addInst(IR.LOOP_START);
    trace.addInst(IR.CONST_INT, { value: 42 });
    trace.addInst(IR.LOOP_END);
    const dump = jit.dumpTrace(trace);
    assert.ok(dump.includes('loop_start'));
    assert.ok(dump.includes('const_int'));
    assert.ok(dump.includes('val=42'));
  });

  it('should handle dumpTrace with no trace', () => {
    const jit = new JIT();
    assert.equal(jit.dumpTrace(null), '(no trace)');
  });
});
