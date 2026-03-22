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

// --- JIT-enabled VM integration ---
// This patches the VM's run() to support tracing.
// Rather than modifying vm.js directly, we provide a wrapper.

// createJITVM will be implemented when we integrate with the VM's run loop
// For now, the JIT components (Trace, TraceRecorder, TraceCompiler, JIT) are standalone
