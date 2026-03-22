// Monkey Language Tracing JIT Compiler
// Records hot loop traces in the VM, compiles to JavaScript functions
//
// Architecture:
//   1. Profile: count loop back-edge executions
//   2. Record: when hot, record a linear trace of operations
//   3. Optimize: constant fold, dead guard elimination on the linear IR
//   4. Compile: emit a JavaScript function via new Function()
//   5. Execute: replace interpreter loop with compiled trace
//
// Key insight: since we're in JS, we can't emit machine code.
// But we CAN generate optimized JS that V8/SpiderMonkey will JIT-compile.
// This eliminates: dispatch overhead, stack push/pop, object wrapping.
// The generated JS operates on raw values where possible.

import { Opcodes, lookup } from './code.js';
import {
  MonkeyInteger, MonkeyBoolean, MonkeyString, MonkeyNull,
  MonkeyArray, MonkeyHash, MonkeyBuiltin, MonkeyError,
  TRUE, FALSE, NULL, cachedInteger,
} from './object.js';
import { CompiledFunction } from './compiler.js';

// --- Configuration ---
const HOT_LOOP_THRESHOLD = 16;   // iterations before tracing starts
const MAX_TRACE_LENGTH = 200;    // max IR instructions per trace
const MAX_TRACES = 64;           // max compiled traces

// --- IR Opcodes ---
// Linear SSA-style IR. Each instruction produces a value (referenced by index).
// Guards cause trace exits on failure.
export const IR = {
  // Constants & loads
  CONST_INT:    'const_int',     // value: number
  CONST_BOOL:   'const_bool',    // value: boolean
  CONST_NULL:   'const_null',
  CONST_OBJ:    'const_obj',     // value: MonkeyObject ref
  LOAD_LOCAL:   'load_local',    // slot: number
  LOAD_GLOBAL:  'load_global',   // index: number
  LOAD_FREE:    'load_free',     // index: number
  LOAD_CONST:   'load_const',    // index: number (from constant pool)

  // Stores
  STORE_LOCAL:  'store_local',   // slot: number, value: ref
  STORE_GLOBAL: 'store_global',  // index: number, value: ref

  // Arithmetic (operate on raw JS numbers)
  ADD_INT:      'add_int',       // left: ref, right: ref
  SUB_INT:      'sub_int',
  MUL_INT:      'mul_int',
  DIV_INT:      'div_int',

  // String
  CONCAT:       'concat',        // left: ref, right: ref

  // Comparison (produce raw JS booleans)
  EQ:           'eq',
  NEQ:          'neq',
  GT:           'gt',
  LT:           'lt',

  // Unary
  NEG:          'neg',           // operand: ref
  NOT:          'not',           // operand: ref

  // Guards (exit trace on failure)
  GUARD_INT:    'guard_int',     // ref: check this value is MonkeyInteger
  GUARD_BOOL:   'guard_bool',
  GUARD_STRING: 'guard_string',
  GUARD_TRUTHY: 'guard_truthy',  // ref: check truthy, exit if not
  GUARD_FALSY:  'guard_falsy',   // ref: check falsy, exit if not

  // Control
  PHI:          'phi',           // loop header: merge initial and back-edge values
  LOOP_START:   'loop_start',
  LOOP_END:     'loop_end',      // back-edge: jump to loop start

  // Function calls (bail out to interpreter for now)
  CALL:         'call',          // closure: ref, args: ref[], numArgs: number

  // Boxing/unboxing
  UNBOX_INT:    'unbox_int',     // ref → raw number
  BOX_INT:      'box_int',       // raw number → MonkeyInteger
};

// --- IR Instruction ---
class IRInst {
  constructor(op, operands = {}) {
    this.op = op;
    this.operands = operands;  // { left, right, value, slot, ref, etc. }
    this.type = null;          // 'int' | 'bool' | 'string' | 'object' | null
    this.id = -1;              // set during recording
  }
}

// --- Trace ---
// A recorded linear trace through a hot loop
export class Trace {
  constructor(frameId, startIp) {
    this.frameId = frameId;       // which frame (closure identity)
    this.startIp = startIp;       // bytecode IP where trace starts (loop header)
    this.ir = [];                 // IRInst[]
    this.guardCount = 0;
    this.compiled = null;         // compiled JS function
    this.executionCount = 0;
    this.sideExits = new Map();   // guard index → exit count
  }

  addInst(op, operands = {}) {
    const inst = new IRInst(op, operands);
    inst.id = this.ir.length;
    this.ir.push(inst);
    return inst.id;
  }
}

// --- Trace Recorder ---
// Hooks into VM execution to record traces
export class TraceRecorder {
  constructor(vm) {
    this.vm = vm;
    this.trace = null;
    this.recording = false;
    this.startIp = -1;
    this.startFrame = -1;
    this.irStack = [];         // maps VM stack positions to IR refs
    this.loopHeaderSeen = false;
    this.instrCount = 0;

    // Track types seen during recording for guards
    this.typeMap = new Map();  // IR ref → observed type
  }

  start(frameId, ip) {
    this.trace = new Trace(frameId, ip);
    this.recording = true;
    this.startIp = ip;
    this.startFrame = this.vm.framesIndex;
    this.irStack = [];
    this.loopHeaderSeen = false;
    this.instrCount = 0;
    this.typeMap.clear();

    // Record loop start marker
    this.trace.addInst(IR.LOOP_START);
  }

  stop() {
    if (!this.recording) return null;
    this.recording = false;
    this.trace.addInst(IR.LOOP_END);
    const trace = this.trace;
    this.trace = null;
    return trace;
  }

  abort() {
    this.recording = false;
    this.trace = null;
    this.irStack = [];
  }

  // Push an IR ref onto the virtual stack
  pushRef(ref) {
    this.irStack.push(ref);
  }

  // Pop an IR ref from the virtual stack
  popRef() {
    return this.irStack.pop();
  }

  // Record a guard for a value's type
  guardType(ref, value) {
    if (value instanceof MonkeyInteger) {
      const gid = this.trace.addInst(IR.GUARD_INT, { ref });
      this.typeMap.set(ref, 'int');
      this.trace.guardCount++;
      return 'int';
    } else if (value instanceof MonkeyBoolean) {
      const gid = this.trace.addInst(IR.GUARD_BOOL, { ref });
      this.typeMap.set(ref, 'bool');
      this.trace.guardCount++;
      return 'bool';
    } else if (value instanceof MonkeyString) {
      const gid = this.trace.addInst(IR.GUARD_STRING, { ref });
      this.typeMap.set(ref, 'string');
      this.trace.guardCount++;
      return 'string';
    }
    this.typeMap.set(ref, 'object');
    return 'object';
  }

  // Check if we already know a ref's type (skip redundant guards)
  knownType(ref) {
    return this.typeMap.get(ref) || null;
  }

  // Record an integer arithmetic operation
  recordIntArith(op, leftVal, rightVal) {
    const rightRef = this.popRef();
    const leftRef = this.popRef();

    // Guard types if not already known
    if (this.knownType(leftRef) !== 'int' && this.knownType(leftRef) !== 'raw_int') {
      this.guardType(leftRef, leftVal);
    }
    if (this.knownType(rightRef) !== 'int' && this.knownType(rightRef) !== 'raw_int') {
      this.guardType(rightRef, rightVal);
    }

    // Unbox (skip if already raw)
    let leftUnboxed = leftRef;
    if (this.knownType(leftRef) !== 'raw_int') {
      leftUnboxed = this.trace.addInst(IR.UNBOX_INT, { ref: leftRef });
      this.typeMap.set(leftUnboxed, 'raw_int');
    }
    let rightUnboxed = rightRef;
    if (this.knownType(rightRef) !== 'raw_int') {
      rightUnboxed = this.trace.addInst(IR.UNBOX_INT, { ref: rightRef });
      this.typeMap.set(rightUnboxed, 'raw_int');
    }

    // Operate on raw values
    let irOp;
    switch (op) {
      case Opcodes.OpAdd: case Opcodes.OpAddInt: case Opcodes.OpAddConst: irOp = IR.ADD_INT; break;
      case Opcodes.OpSub: case Opcodes.OpSubInt: case Opcodes.OpSubConst: irOp = IR.SUB_INT; break;
      case Opcodes.OpMul: case Opcodes.OpMulConst: irOp = IR.MUL_INT; break;
      case Opcodes.OpDiv: case Opcodes.OpDivConst: irOp = IR.DIV_INT; break;
    }
    const resultRef = this.trace.addInst(irOp, { left: leftUnboxed, right: rightUnboxed });
    this.typeMap.set(resultRef, 'raw_int');

    // Box result
    const boxedRef = this.trace.addInst(IR.BOX_INT, { ref: resultRef });
    this.typeMap.set(boxedRef, 'int');

    this.pushRef(boxedRef);
  }

  recordComparison(op, leftVal, rightVal) {
    const rightRef = this.popRef();
    const leftRef = this.popRef();

    if (leftVal instanceof MonkeyInteger && rightVal instanceof MonkeyInteger) {
      if (this.knownType(leftRef) !== 'int' && this.knownType(leftRef) !== 'raw_int') this.guardType(leftRef, leftVal);
      if (this.knownType(rightRef) !== 'int' && this.knownType(rightRef) !== 'raw_int') this.guardType(rightRef, rightVal);

      let lu = leftRef;
      if (this.knownType(leftRef) !== 'raw_int') {
        lu = this.trace.addInst(IR.UNBOX_INT, { ref: leftRef });
      }
      let ru = rightRef;
      if (this.knownType(rightRef) !== 'raw_int') {
        ru = this.trace.addInst(IR.UNBOX_INT, { ref: rightRef });
      }

      let irOp;
      switch (op) {
        case Opcodes.OpEqual: case Opcodes.OpEqualInt: irOp = IR.EQ; break;
        case Opcodes.OpNotEqual: case Opcodes.OpNotEqualInt: irOp = IR.NEQ; break;
        case Opcodes.OpGreaterThan: case Opcodes.OpGreaterThanInt: irOp = IR.GT; break;
        case Opcodes.OpLessThanInt: irOp = IR.LT; break;
      }
      const ref = this.trace.addInst(irOp, { left: lu, right: ru });
      this.typeMap.set(ref, 'raw_bool');

      // Result needs to be a MonkeyBoolean for the VM
      const boxed = this.trace.addInst(IR.CONST_BOOL, { ref });
      this.typeMap.set(boxed, 'bool');
      this.pushRef(boxed);
    } else {
      // Bail — too complex for now
      this.abort();
    }
  }
}

// --- JIT Engine ---
// Manages profiling, recording, compilation, and execution
export class JIT {
  constructor() {
    this.hotCounts = new Map();    // "frameId:ip" → count
    this.traces = new Map();       // "frameId:ip" → Trace
    this.traceCount = 0;
    this.enabled = true;
  }

  // Get a trace key for a loop back-edge
  traceKey(closureId, ip) {
    return `${closureId}:${ip}`;
  }

  // Count a loop back-edge hit. Returns true if hot.
  countEdge(closureId, ip) {
    const key = this.traceKey(closureId, ip);
    const count = (this.hotCounts.get(key) || 0) + 1;
    this.hotCounts.set(key, count);
    return count >= HOT_LOOP_THRESHOLD;
  }

  // Check if we have a compiled trace for this location
  getTrace(closureId, ip) {
    return this.traces.get(this.traceKey(closureId, ip)) || null;
  }

  // Store a compiled trace
  storeTrace(trace) {
    if (this.traceCount >= MAX_TRACES) return false;
    const key = this.traceKey(trace.frameId, trace.startIp);
    this.traces.set(key, trace);
    this.traceCount++;
    return true;
  }

  // Compile a trace to a JavaScript function
  compile(trace, vm) {
    // Optimize the trace before compilation
    const optimizer = new TraceOptimizer(trace);
    optimizer.optimize();

    const compiler = new TraceCompiler(trace, vm);
    trace.compiled = compiler.compile();
    return trace.compiled !== null;
  }
}

// --- Trace Compiler ---
// Converts IR to a JavaScript function
export class TraceCompiler {
  constructor(trace, vm) {
    this.trace = trace;
    this.vm = vm;
    this.lines = [];
    this.varCount = 0;
  }

  freshVar() {
    return `v${this.varCount++}`;
  }

  compile() {
    const ir = this.trace.ir;
    const varNames = new Map(); // IR id → JS variable name

    // Function signature: receives VM state, returns { exitType, ip, ... }
    // Parameters: stack, sp, locals (basePointer slice), globals, constants, closureFree
    this.lines.push('"use strict";');
    this.lines.push('let __iterations = 0;');
    this.lines.push('const MAX_ITER = 10000;');
    this.lines.push('loop: while (true) {');
    this.lines.push('  if (++__iterations > MAX_ITER) return { exit: "max_iter" };');

    for (let i = 0; i < ir.length; i++) {
      const inst = ir[i];
      const v = this.freshVar();
      varNames.set(i, v);

      switch (inst.op) {
        case IR.LOOP_START:
          // Already handled by the while loop
          break;

        case IR.LOOP_END:
          this.lines.push('  continue loop;');
          break;

        case IR.CONST_INT:
          this.lines.push(`  const ${v} = ${inst.operands.value};`);
          break;

        case IR.CONST_BOOL:
          if (inst.operands.ref !== undefined) {
            // Boolean from comparison result — use the raw bool ref
            const rawRef = varNames.get(inst.operands.ref);
            this.lines.push(`  const ${v} = ${rawRef} ? __TRUE : __FALSE;`);
          } else {
            this.lines.push(`  const ${v} = ${inst.operands.value} ? __TRUE : __FALSE;`);
          }
          break;

        case IR.CONST_NULL:
          this.lines.push(`  const ${v} = __NULL;`);
          break;

        case IR.CONST_OBJ:
          // Store as a constant index and look up
          this.lines.push(`  const ${v} = __consts[${inst.operands.constIdx}];`);
          break;

        case IR.LOAD_LOCAL:
          this.lines.push(`  const ${v} = __stack[__bp + ${inst.operands.slot}];`);
          break;

        case IR.LOAD_GLOBAL:
          this.lines.push(`  const ${v} = __globals[${inst.operands.index}];`);
          break;

        case IR.LOAD_FREE:
          this.lines.push(`  const ${v} = __free[${inst.operands.index}];`);
          break;

        case IR.LOAD_CONST:
          this.lines.push(`  const ${v} = __consts[${inst.operands.index}];`);
          break;

        case IR.STORE_LOCAL: {
          const valRef = varNames.get(inst.operands.value);
          this.lines.push(`  __stack[__bp + ${inst.operands.slot}] = ${valRef};`);
          this.lines.push(`  const ${v} = ${valRef};`);
          break;
        }

        case IR.STORE_GLOBAL: {
          const valRef = varNames.get(inst.operands.value);
          this.lines.push(`  __globals[${inst.operands.index}] = ${valRef};`);
          this.lines.push(`  const ${v} = ${valRef};`);
          break;
        }

        case IR.GUARD_INT: {
          const ref = varNames.get(inst.operands.ref);
          this.lines.push(`  if (!(${ref} instanceof __MonkeyInteger)) return { exit: "guard", guardIdx: ${i}, ip: ${this.trace.startIp} };`);
          this.lines.push(`  const ${v} = ${ref};`);
          break;
        }

        case IR.GUARD_BOOL: {
          const ref = varNames.get(inst.operands.ref);
          this.lines.push(`  if (!(${ref} instanceof __MonkeyBoolean)) return { exit: "guard", guardIdx: ${i}, ip: ${this.trace.startIp} };`);
          this.lines.push(`  const ${v} = ${ref};`);
          break;
        }

        case IR.GUARD_STRING: {
          const ref = varNames.get(inst.operands.ref);
          this.lines.push(`  if (!(${ref} instanceof __MonkeyString)) return { exit: "guard", guardIdx: ${i}, ip: ${this.trace.startIp} };`);
          this.lines.push(`  const ${v} = ${ref};`);
          break;
        }

        case IR.GUARD_TRUTHY: {
          const ref = varNames.get(inst.operands.ref);
          // ref may be a raw JS boolean or a MonkeyObject — use __isTruthy for objects
          this.lines.push(`  if (typeof ${ref} === 'boolean' ? !${ref} : !__isTruthy(${ref})) return { exit: "guard_falsy", guardIdx: ${i}, ip: ${inst.operands.exitIp} };`);
          this.lines.push(`  const ${v} = true;`);
          break;
        }

        case IR.GUARD_FALSY: {
          const ref = varNames.get(inst.operands.ref);
          this.lines.push(`  if (typeof ${ref} === 'boolean' ? ${ref} : __isTruthy(${ref})) return { exit: "guard_truthy", guardIdx: ${i}, ip: ${inst.operands.exitIp} };`);
          this.lines.push(`  const ${v} = true;`);
          break;
        }

        case IR.UNBOX_INT: {
          const ref = varNames.get(inst.operands.ref);
          this.lines.push(`  const ${v} = ${ref}.value;`);
          break;
        }

        case IR.BOX_INT: {
          const ref = varNames.get(inst.operands.ref);
          this.lines.push(`  const ${v} = __cachedInteger(${ref});`);
          break;
        }

        case IR.ADD_INT: {
          const l = varNames.get(inst.operands.left);
          const r = varNames.get(inst.operands.right);
          this.lines.push(`  const ${v} = (${l} + ${r}) | 0;`);
          break;
        }

        case IR.SUB_INT: {
          const l = varNames.get(inst.operands.left);
          const r = varNames.get(inst.operands.right);
          this.lines.push(`  const ${v} = (${l} - ${r}) | 0;`);
          break;
        }

        case IR.MUL_INT: {
          const l = varNames.get(inst.operands.left);
          const r = varNames.get(inst.operands.right);
          this.lines.push(`  const ${v} = (${l} * ${r}) | 0;`);
          break;
        }

        case IR.DIV_INT: {
          const l = varNames.get(inst.operands.left);
          const r = varNames.get(inst.operands.right);
          this.lines.push(`  const ${v} = (${l} / ${r}) | 0;`);
          break;
        }

        case IR.EQ: {
          const l = varNames.get(inst.operands.left);
          const r = varNames.get(inst.operands.right);
          this.lines.push(`  const ${v} = ${l} === ${r};`);
          break;
        }

        case IR.NEQ: {
          const l = varNames.get(inst.operands.left);
          const r = varNames.get(inst.operands.right);
          this.lines.push(`  const ${v} = ${l} !== ${r};`);
          break;
        }

        case IR.GT: {
          const l = varNames.get(inst.operands.left);
          const r = varNames.get(inst.operands.right);
          this.lines.push(`  const ${v} = ${l} > ${r};`);
          break;
        }

        case IR.LT: {
          const l = varNames.get(inst.operands.left);
          const r = varNames.get(inst.operands.right);
          this.lines.push(`  const ${v} = ${l} < ${r};`);
          break;
        }

        case IR.NEG: {
          const ref = varNames.get(inst.operands.ref);
          this.lines.push(`  const ${v} = -${ref};`);
          break;
        }

        case IR.NOT: {
          const ref = varNames.get(inst.operands.ref);
          // Handle raw bools and MonkeyObjects
          this.lines.push(`  const ${v} = (typeof ${ref} === 'boolean') ? !${ref} : !__isTruthy(${ref});`);
          break;
        }

        case IR.CONCAT: {
          const l = varNames.get(inst.operands.left);
          const r = varNames.get(inst.operands.right);
          this.lines.push(`  const ${v} = new __MonkeyString(${l}.value + ${r}.value);`);
          break;
        }

        case IR.CALL:
          // For now, calls bail to interpreter
          this.lines.push(`  return { exit: "call", ip: ${this.trace.startIp} };`);
          break;

        default:
          this.lines.push(`  /* unknown IR: ${inst.op} */`);
      }
    }

    this.lines.push('}'); // end while loop

    const body = this.lines.join('\n');

    try {
      const fn = new Function(
        '__stack', '__sp', '__bp', '__globals', '__consts', '__free',
        '__MonkeyInteger', '__MonkeyBoolean', '__MonkeyString',
        '__TRUE', '__FALSE', '__NULL',
        '__cachedInteger', '__isTruthy',
        body
      );
      return fn;
    } catch (e) {
      // Compilation failed — trace had issues
      return null;
    }
  }
}

// --- Trace Optimization Passes ---
// Run between recording and compilation to improve generated code quality.
// Key insight from LuaJIT: optimizations on linear traces are trivially simple
// because there's no control flow graph — just a flat instruction sequence.

export class TraceOptimizer {
  constructor(trace) {
    this.trace = trace;
  }

  // Run all optimization passes in order
  optimize() {
    this.redundantGuardElimination();
    this.constantFolding();
    this.deadCodeElimination();
    return this.trace;
  }

  // --- Pass 1: Redundant Guard Elimination ---
  // If a value has already been guarded as a type, subsequent guards for the
  // same ref and type are redundant. Also, constants don't need guards at all.
  // This is the biggest win — recording often emits duplicate guards for values
  // that are loaded and used multiple times in a loop iteration.
  redundantGuardElimination() {
    const ir = this.trace.ir;
    const guardedTypes = new Map(); // ref → Set of guarded types

    // First, mark all constant refs — they never need guards
    for (let i = 0; i < ir.length; i++) {
      const inst = ir[i];
      if (!inst) continue;
      if (inst.op === IR.CONST_INT) guardedTypes.set(i, new Set(['int']));
      else if (inst.op === IR.CONST_BOOL) guardedTypes.set(i, new Set(['bool']));
      else if (inst.op === IR.CONST_NULL) guardedTypes.set(i, new Set(['null']));
    }

    // Also mark unboxed/boxed refs
    for (let i = 0; i < ir.length; i++) {
      const inst = ir[i];
      if (!inst) continue;
      if (inst.op === IR.UNBOX_INT || inst.op === IR.BOX_INT) {
        guardedTypes.set(i, new Set(['int']));
      }
      if (inst.op === IR.ADD_INT || inst.op === IR.SUB_INT ||
          inst.op === IR.MUL_INT || inst.op === IR.DIV_INT ||
          inst.op === IR.NEG) {
        guardedTypes.set(i, new Set(['int']));
      }
    }

    let eliminated = 0;
    for (let i = 0; i < ir.length; i++) {
      const inst = ir[i];
      if (!inst) continue;

      let guardType = null;
      if (inst.op === IR.GUARD_INT) guardType = 'int';
      else if (inst.op === IR.GUARD_BOOL) guardType = 'bool';
      else if (inst.op === IR.GUARD_STRING) guardType = 'string';
      else continue;

      const ref = inst.operands.ref;
      const known = guardedTypes.get(ref);
      if (known && known.has(guardType)) {
        // Already guarded or known type — eliminate
        ir[i] = null;
        eliminated++;
        this.trace.guardCount--;
      } else {
        // Record that this ref is now guarded
        if (!guardedTypes.has(ref)) guardedTypes.set(ref, new Set());
        guardedTypes.get(ref).add(guardType);
      }
    }

    // Compact: remove nulls and rebuild id mapping
    if (eliminated > 0) this._compact();
    return eliminated;
  }

  // --- Pass 2: Constant Folding ---
  // Fold arithmetic on two CONST_INT values into a single CONST_INT.
  // Also fold UNBOX_INT(CONST_INT) → same constant value, and
  // BOX_INT of a known constant → CONST_INT.
  constantFolding() {
    const ir = this.trace.ir;
    const constValues = new Map(); // ref → numeric value (for raw int constants)

    let folded = 0;
    for (let i = 0; i < ir.length; i++) {
      const inst = ir[i];
      if (!inst) continue;

      // Track constant values
      if (inst.op === IR.CONST_INT) {
        constValues.set(i, inst.operands.value);
        continue;
      }

      // UNBOX_INT of a CONST_INT → the constant's value is already raw
      if (inst.op === IR.UNBOX_INT) {
        const refInst = ir[inst.operands.ref];
        if (refInst && refInst.op === IR.CONST_INT) {
          // Replace with const_int (same value, it's already raw)
          inst.op = IR.CONST_INT;
          inst.operands = { value: refInst.operands.value };
          constValues.set(i, refInst.operands.value);
          folded++;
          continue;
        }
        // If the ref has a known constant value from folding
        if (constValues.has(inst.operands.ref)) {
          inst.op = IR.CONST_INT;
          inst.operands = { value: constValues.get(inst.operands.ref) };
          constValues.set(i, inst.operands.value);
          folded++;
          continue;
        }
      }

      // Fold arithmetic on two constants
      if (inst.op === IR.ADD_INT || inst.op === IR.SUB_INT ||
          inst.op === IR.MUL_INT || inst.op === IR.DIV_INT) {
        const leftVal = constValues.get(inst.operands.left);
        const rightVal = constValues.get(inst.operands.right);
        if (leftVal !== undefined && rightVal !== undefined) {
          let result;
          switch (inst.op) {
            case IR.ADD_INT: result = (leftVal + rightVal) | 0; break;
            case IR.SUB_INT: result = (leftVal - rightVal) | 0; break;
            case IR.MUL_INT: result = (leftVal * rightVal) | 0; break;
            case IR.DIV_INT: result = (leftVal / rightVal) | 0; break;
          }
          inst.op = IR.CONST_INT;
          inst.operands = { value: result };
          constValues.set(i, result);
          folded++;
        }
      }

      // Fold comparisons on two constants
      if (inst.op === IR.EQ || inst.op === IR.NEQ ||
          inst.op === IR.GT || inst.op === IR.LT) {
        const leftVal = constValues.get(inst.operands.left);
        const rightVal = constValues.get(inst.operands.right);
        if (leftVal !== undefined && rightVal !== undefined) {
          let result;
          switch (inst.op) {
            case IR.EQ: result = leftVal === rightVal; break;
            case IR.NEQ: result = leftVal !== rightVal; break;
            case IR.GT: result = leftVal > rightVal; break;
            case IR.LT: result = leftVal < rightVal; break;
          }
          inst.op = IR.CONST_BOOL;
          inst.operands = { value: result };
          folded++;
        }
      }
    }
    return folded;
  }

  // --- Pass 3: Dead Code Elimination ---
  // Remove instructions whose results are never referenced by any live instruction.
  // Walk backwards marking live refs, then null out dead ones.
  deadCodeElimination() {
    const ir = this.trace.ir;
    const live = new Set();

    // All side-effecting instructions are always live
    for (let i = 0; i < ir.length; i++) {
      const inst = ir[i];
      if (!inst) continue;
      if (inst.op === IR.STORE_LOCAL || inst.op === IR.STORE_GLOBAL ||
          inst.op === IR.GUARD_INT || inst.op === IR.GUARD_BOOL ||
          inst.op === IR.GUARD_STRING || inst.op === IR.GUARD_TRUTHY ||
          inst.op === IR.GUARD_FALSY ||
          inst.op === IR.LOOP_START || inst.op === IR.LOOP_END ||
          inst.op === IR.CALL) {
        live.add(i);
      }
    }

    // BOX_INT that feeds a STORE is live (transitively)
    // Walk live set and mark operands as live (only follow IR ref keys)
    const VALUE_IS_REF = new Set([IR.STORE_LOCAL, IR.STORE_GLOBAL]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const idx of live) {
        const inst = ir[idx];
        if (!inst) continue;
        const ops = inst.operands;
        for (const key of Object.keys(ops)) {
          const val = ops[key];
          if (typeof val !== 'number' || val < 0 || val >= ir.length || !ir[val] || live.has(val)) continue;
          // Only follow keys that are IR references
          if (key === 'ref' || key === 'left' || key === 'right' ||
              (key === 'value' && VALUE_IS_REF.has(inst.op))) {
            live.add(val);
            changed = true;
          }
        }
      }
    }

    let eliminated = 0;
    for (let i = 0; i < ir.length; i++) {
      if (ir[i] && !live.has(i)) {
        ir[i] = null;
        eliminated++;
      }
    }

    if (eliminated > 0) this._compact();
    return eliminated;
  }

  // Compact the IR array: remove nulls, remap all references
  _compact() {
    const ir = this.trace.ir;
    const remap = new Map();
    const newIr = [];

    for (let i = 0; i < ir.length; i++) {
      if (ir[i] !== null) {
        remap.set(i, newIr.length);
        ir[i].id = newIr.length;
        newIr.push(ir[i]);
      }
    }

    // Only remap operand keys that are IR references (not value/slot/index/exitIp/constIdx/numArgs)
    const REF_KEYS = new Set(['ref', 'left', 'right', 'value']);
    // 'value' is a ref ONLY for STORE_LOCAL/STORE_GLOBAL — not for CONST_INT etc.
    const VALUE_IS_REF = new Set([IR.STORE_LOCAL, IR.STORE_GLOBAL]);

    for (const inst of newIr) {
      const ops = inst.operands;
      for (const key of Object.keys(ops)) {
        if (typeof ops[key] !== 'number') continue;
        // 'ref', 'left', 'right' are always IR references
        if (key === 'ref' || key === 'left' || key === 'right') {
          if (remap.has(ops[key])) ops[key] = remap.get(ops[key]);
        }
        // 'value' is an IR ref only for stores
        if (key === 'value' && VALUE_IS_REF.has(inst.op)) {
          if (remap.has(ops[key])) ops[key] = remap.get(ops[key]);
        }
        // For CONST_BOOL with a 'ref' — already handled above
      }
    }

    this.trace.ir = newIr;
  }
}
