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
const HOT_EXIT_THRESHOLD = 8;    // guard exit count before side trace
const MAX_SIDE_TRACES = 4;       // max side traces per root trace
const MAX_INLINE_DEPTH = 3;      // max function inlining depth during tracing
const HOT_FUNC_THRESHOLD = 16;   // calls before function trace recording

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

  // Function traces (recursive call support)
  SELF_CALL:    'self_call',     // args: ref[] — recursive call to the traced function
  FUNC_RETURN:  'func_return',   // ref: return value from function trace

  // Function calls (bail out to interpreter for now)
  CALL:         'call',          // closure: ref, args: ref[], numArgs: number

  // Trace stitching (nested loops)
  EXEC_TRACE:   'exec_trace',    // Execute an inner compiled trace; constIdx: index of compiled fn in consts

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
    this.sideTraces = new Map();  // guard index → compiled side Trace
    this.isSideTrace = false;
    this.parentTrace = null;
    this.parentGuardIdx = -1;
    // Function trace support
    this.isFuncTrace = false;     // true if this traces a function entry (not a loop)
    this.numArgs = 0;             // number of args for function traces
    this.tracedFn = null;         // the CompiledFunction being traced
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

    // Side trace support
    this.isSideTrace = false;
    this.parentTrace = null;
    this.parentGuardIdx = -1;

    // Function inlining support
    // Stack of inline frames: each entry is { baseOffset, numLocals, returnIrStack }
    // baseOffset = offset from trace's __bp to this inlined frame's base pointer
    this.inlineFrames = [];    // stack of { baseOffset, numLocals, irStackDepth, callSiteIp }
    this.inlineDepth = 0;
    // Maps absolute stack slot → IR ref for inlined function arguments
    // When a callee does LOAD_LOCAL, we check this map first
    this.inlineSlotRefs = new Map();
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
    this.isSideTrace = false;
    this.parentTrace = null;
    this.parentGuardIdx = -1;

    // Record loop start marker
    this.trace.addInst(IR.LOOP_START);
  }

  // Start recording a side trace from a guard exit
  startSideTrace(parentTrace, guardIdx, exitIp, frameId) {
    this.trace = new Trace(frameId, exitIp);
    this.trace.isSideTrace = true;
    this.trace.parentTrace = parentTrace;
    this.trace.parentGuardIdx = guardIdx;
    this.recording = true;
    this.startIp = exitIp;
    this.startFrame = this.vm.framesIndex;
    this.irStack = [];
    this.loopHeaderSeen = false;
    this.instrCount = 0;
    this.typeMap.clear();
    this.isSideTrace = true;
    this.parentTrace = parentTrace;
    this.parentGuardIdx = guardIdx;

    // No LOOP_START for side traces — they're linear paths
    // that end at the parent's loop header
    this.trace.addInst(IR.LOOP_START);
  }

  // Start recording a function trace (triggered by hot function entry)
  startFuncTrace(frameId, fn, numArgs) {
    this.trace = new Trace(frameId, 0); // startIp=0 (function entry)
    this.trace.isFuncTrace = true;
    this.trace.numArgs = numArgs;
    this.trace.tracedFn = fn;
    this.recording = true;
    this.startIp = 0;
    this.startFrame = this.vm.framesIndex;
    this.irStack = [];
    this.loopHeaderSeen = false;
    this.instrCount = 0;
    this.typeMap.clear();
    this.isSideTrace = false;
    this.isFuncTrace = true;
    this.tracedFn = fn;

    // Load args as LOAD_LOCAL with guard
    for (let i = 0; i < numArgs; i++) {
      const ref = this.trace.addInst(IR.LOAD_LOCAL, { slot: i });
      this.pushRef(ref);
      // We'll pop these immediately — they're in the right slots
    }
    // Clear the stack — args will be accessed via LOAD_LOCAL as the function executes
    this.irStack = [];
  }

  stop() {
    if (!this.recording) return null;
    this.recording = false;
    // For side traces ending at parent loop header, emit LOOP_END so the
    // compiled function returns { exit: "loop_back" }
    // For function traces, we don't emit LOOP_END — FUNC_RETURN is emitted during recording
    if (!this.trace.isFuncTrace) {
      this.trace.addInst(IR.LOOP_END);
    }
    const trace = this.trace;
    this.trace = null;
    return trace;
  }

  // Check if the current IP is the parent trace's loop header (side trace stop condition)
  shouldStopSideTrace(ip, frameIndex) {
    if (!this.isSideTrace || !this.parentTrace) return false;
    return ip === this.parentTrace.startIp && frameIndex === this.startFrame;
  }

  abort() {
    this.recording = false;
    this.trace = null;
    this.irStack = [];
    this.inlineFrames = [];
    this.inlineDepth = 0;
  }

  // Enter an inlined function call during recording
  // baseOffset: the callee's basePointer relative to the trace's root basePointer
  // numLocals: callee's numLocals (to know the stack layout)
  // callSiteIp: the IP in the caller frame right after the OpCall (for guard exit fallback)
  enterInlineFrame(baseOffset, numLocals, callSiteIp) {
    if (this.inlineDepth >= MAX_INLINE_DEPTH) return false;
    this.inlineFrames.push({
      baseOffset,
      numLocals,
      irStackDepth: this.irStack.length,
      callSiteIp,  // used for guard exits inside the inlined function
    });
    this.inlineDepth++;
    return true;
  }

  // Leave an inlined function call, returning the return value IR ref
  leaveInlineFrame() {
    if (this.inlineDepth === 0) return;
    const frame = this.inlineFrames.pop();
    // Clean up slot refs for this inlined frame
    for (let i = 0; i < frame.numLocals; i++) {
      this.inlineSlotRefs.delete(frame.baseOffset + i);
    }
    this.inlineDepth--;
  }

  // Get the current base offset for local variable addressing
  // Returns 0 for root frame, or the inlined frame's baseOffset
  currentBaseOffset() {
    if (this.inlineFrames.length === 0) return 0;
    return this.inlineFrames[this.inlineFrames.length - 1].baseOffset;
  }

  // Get the appropriate exit IP for guard failures.
  // Inside inlined functions, guards should exit to the outermost callSiteIp
  // (the call instruction in the root frame) so the interpreter resumes at the
  // call site and side traces can record the correct alternate path.
  // Callee IPs are meaningless in the caller's frame.
  getGuardExitIp() {
    if (this.inlineDepth > 0) {
      // Return the outermost (bottom) inlined frame's callSiteIp
      // This is the IP in the root frame where the call chain started
      return this.inlineFrames[0].callSiteIp;
    }
    return null; // use the normal exit IP
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
    const exitIp = this.getGuardExitIp();
    if (value instanceof MonkeyInteger) {
      const gid = this.trace.addInst(IR.GUARD_INT, { ref, exitIp });
      this.typeMap.set(ref, 'int');
      this.trace.guardCount++;
      return 'int';
    } else if (value instanceof MonkeyBoolean) {
      const gid = this.trace.addInst(IR.GUARD_BOOL, { ref, exitIp });
      this.typeMap.set(ref, 'bool');
      this.trace.guardCount++;
      return 'bool';
    } else if (value instanceof MonkeyString) {
      const gid = this.trace.addInst(IR.GUARD_STRING, { ref, exitIp });
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
    this.funcTraces = new Map();   // CompiledFunction → Trace (function entry traces)
    this.funcCallCounts = new Map(); // CompiledFunction → count
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
    if (trace.isSideTrace && trace.parentTrace) {
      // Store as side trace on parent
      if (trace.parentTrace.sideTraces.size >= MAX_SIDE_TRACES) return false;
      trace.parentTrace.sideTraces.set(trace.parentGuardIdx, trace);
    } else {
      const key = this.traceKey(trace.frameId, trace.startIp);
      this.traces.set(key, trace);
    }
    this.traceCount++;
    return true;
  }

  // Check if a guard exit is hot enough for a side trace
  shouldRecordSideTrace(trace, guardIdx) {
    if (!this.enabled) return false;
    if (trace.sideTraces.has(guardIdx)) return false; // already have one
    if (trace.sideTraces.size >= MAX_SIDE_TRACES) return false;
    const exitCount = trace.sideExits.get(guardIdx) || 0;
    return exitCount >= HOT_EXIT_THRESHOLD;
  }

  // Count a function call. Returns true if hot enough to trace.
  countFuncCall(fn) {
    const count = (this.funcCallCounts.get(fn) || 0) + 1;
    this.funcCallCounts.set(fn, count);
    return count >= HOT_FUNC_THRESHOLD;
  }

  // Get a compiled function trace
  getFuncTrace(fn) {
    return this.funcTraces.get(fn) || null;
  }

  // Store a compiled function trace
  storeFuncTrace(trace) {
    if (trace.tracedFn) {
      this.funcTraces.set(trace.tracedFn, trace);
      this.traceCount++;
    }
  }

  // Compile a function directly (method JIT, not tracing)
  compileFunction(fn, constants, vm) {
    // Only compile functions that have self-recursive calls (OpCurrentClosure)
    const ins = fn.instructions;
    let hasSelfCall = false;
    for (let i = 0; i < ins.length; i++) {
      if (ins[i] === Opcodes.OpCurrentClosure) { hasSelfCall = true; break; }
    }
    if (!hasSelfCall) return null;

    const compiler = new FunctionCompiler(fn, constants, vm);
    const compiled = compiler.compileSwitch();
    if (!compiled) return null;

    const trace = new Trace(fn, 0);
    trace.isFuncTrace = true;
    trace.tracedFn = fn;
    trace.compiled = compiled;
    trace._compiler = compiler;
    trace._compiledSource = compiler._compiledSource;
    return trace;
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

  // Analyze which globals/locals are loop-carried: loaded and stored with int boxing.
  // Returns sets of indices that can be promoted to raw JS variables.
  _analyzePromotable() {
    const ir = this.trace.ir;
    const globalStored = new Set(); // global indices that have STORE_GLOBAL with BOX_INT
    const localStored = new Set();

    for (const inst of ir) {
      if (!inst) continue;
      if (inst.op === IR.STORE_GLOBAL) {
        const valInst = ir[inst.operands.value];
        if (valInst && valInst.op === IR.BOX_INT) {
          globalStored.add(inst.operands.index);
        }
      } else if (inst.op === IR.STORE_LOCAL) {
        const valInst = ir[inst.operands.value];
        if (valInst && valInst.op === IR.BOX_INT) {
          localStored.add(inst.operands.slot);
        }
      }
    }
    return { globals: globalStored, locals: localStored };
  }

  _emitReturn(exitObj) {
    if (this._wbWrap) {
      return `return __wb(${exitObj});`;
    }
    return `return ${exitObj};`;
  }

  // Check if an IR instruction produces a raw JS number (not a MonkeyInteger)
  _isRawInt(inst) {
    const rawOps = new Set([
      IR.CONST_INT, IR.ADD_INT, IR.SUB_INT, IR.MUL_INT, IR.DIV_INT,
      IR.NEG, IR.UNBOX_INT,
    ]);
    if (rawOps.has(inst.op)) return true;
    // Promoted-raw loads are also raw
    if (inst._promotedRaw) return true;
    return false;
  }

  // Emit write-back of promoted variables to globals/stack
  _emitWriteBack(promoted, promotedVarNames) {
    const lines = [];
    for (const [idx] of promoted.globals) {
      const pv = promotedVarNames.get('g:' + idx);
      lines.push(`    __globals[${idx}] = __cachedInteger(${pv});`);
    }
    for (const [slot] of promoted.locals) {
      const pv = promotedVarNames.get('l:' + slot);
      lines.push(`    __stack[__bp + ${slot}] = __cachedInteger(${pv});`);
    }
    return lines;
  }

  // Emit a guard exit that inlines side trace dispatch.
  // Instead of returning to the VM, if a side trace exists for this guard,
  // call it directly and continue the loop on loop_back.
  _emitGuardExit(guardIdx, exitIp, condition, exitType = 'guard') {
    this.lines.push(`  if (${condition}) {`);
    // Check for side trace inline — __sideTraces is the trace's sideTraces Map (passed by ref)
    this.lines.push(`    const __st_trace = __sideTraces.get(${guardIdx});`);
    this.lines.push(`    if (__st_trace) {`);
    // Write back promoted vars before calling side trace
    if (this._wbWrap) {
      this.lines.push(`      __wb(null);`);
    }
    this.lines.push(`      const __sr = __st_trace.compiled(__stack, __sp, __bp, __globals, __consts, __free, __MonkeyInteger, __MonkeyBoolean, __MonkeyString, __TRUE, __FALSE, __NULL, __cachedInteger, __isTruthy, __sideTraces);`);
    if (this._wbWrap) {
      // Reload promoted vars after side trace (it may have modified globals/locals)
      this.lines.push(`      __reloadPromoted();`);
    }
    this.lines.push(`      if (__sr && __sr.exit === 'loop_back') { continue loop; }`);
    this.lines.push(`      ${this._emitReturn('__sr')}`);
    this.lines.push(`    }`);
    this.lines.push(`    ${this._emitReturn(`{ exit: "${exitType}", guardIdx: ${guardIdx}, ip: ${exitIp} }`)}`);
    this.lines.push(`  }`);
  }

  compile() {
    const ir = this.trace.ir;
    const varNames = new Map(); // IR id → JS variable name

    // Function traces get a completely different compilation path
    if (this.trace.isFuncTrace) {
      return this._compileFuncTrace(ir, varNames);
    }

    // Analyze which globals/locals can be promoted to raw JS variables
    const promotable = this._analyzePromotable();
    const promotedVarNames = new Map(); // 'g:N' or 'l:N' → JS let variable name

    this.lines.push('"use strict";');
    this.lines.push('let __iterations = 0;');
    this.lines.push('const MAX_ITER = 10000;');

    // Initialize promoted variables before the loop
    for (const idx of promotable.globals) {
      const pv = this.freshVar();
      promotedVarNames.set('g:' + idx, pv);
      this.lines.push(`let ${pv} = __globals[${idx}].value;`);
    }
    for (const slot of promotable.locals) {
      const pv = this.freshVar();
      promotedVarNames.set('l:' + slot, pv);
      this.lines.push(`let ${pv} = __stack[__bp + ${slot}].value;`);
    }

    // Generate __wb for write-back on exit
    const hasPromoted = promotable.globals.size > 0 || promotable.locals.size > 0;
    if (hasPromoted) {
      const wbStmts = [];
      for (const idx of promotable.globals) {
        const pv = promotedVarNames.get('g:' + idx);
        wbStmts.push(`__globals[${idx}] = __cachedInteger(${pv})`);
      }
      for (const slot of promotable.locals) {
        const pv = promotedVarNames.get('l:' + slot);
        wbStmts.push(`__stack[__bp + ${slot}] = __cachedInteger(${pv})`);
      }
      this.lines.push(`function __wb(r) { ${wbStmts.join('; ')}; return r; }`);
      // Reload promoted vars after side trace execution (side trace may modify globals/locals)
      const reloadStmts = [];
      for (const idx of promotable.globals) {
        const pv = promotedVarNames.get('g:' + idx);
        reloadStmts.push(`${pv} = __globals[${idx}].value`);
      }
      for (const slot of promotable.locals) {
        const pv = promotedVarNames.get('l:' + slot);
        reloadStmts.push(`${pv} = __stack[__bp + ${slot}].value`);
      }
      this.lines.push(`function __reloadPromoted() { ${reloadStmts.join('; ')}; }`);
      this._wbWrap = true;
    } else {
      this._wbWrap = false;
    }

    this.lines.push('loop: while (true) {');
    this.lines.push(`  if (++__iterations > MAX_ITER) ${this._emitReturn('{ exit: "max_iter" }')}`);

    for (let i = 0; i < ir.length; i++) {
      const inst = ir[i];
      const v = this.freshVar();
      varNames.set(i, v);

      switch (inst.op) {
        case IR.LOOP_START:
          // Already handled by the while loop
          break;

        case IR.LOOP_END:
          if (this.trace.isSideTrace) {
            // Side trace ends → return to parent trace's loop header
            this.lines.push(`  ${this._emitReturn('{ exit: "loop_back" }')}`);
          } else {
            this.lines.push('  continue loop;');
          }
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

        case IR.LOAD_LOCAL: {
          const pv = promotedVarNames.get('l:' + inst.operands.slot);
          if (pv) {
            // Mark this ref as promoted-raw so GUARD/UNBOX can skip
            this.lines.push(`  const ${v} = ${pv}; /* promoted-raw */`);
            inst._promotedRaw = true;
          } else {
            this.lines.push(`  const ${v} = __stack[__bp + ${inst.operands.slot}];`);
          }
          break;
        }

        case IR.LOAD_GLOBAL: {
          const pv = promotedVarNames.get('g:' + inst.operands.index);
          if (pv) {
            // Mark this ref as promoted-raw so GUARD/UNBOX can skip
            this.lines.push(`  const ${v} = ${pv}; /* promoted-raw */`);
            inst._promotedRaw = true;
          } else {
            this.lines.push(`  const ${v} = __globals[${inst.operands.index}];`);
          }
          break;
        }

        case IR.LOAD_FREE:
          this.lines.push(`  const ${v} = __free[${inst.operands.index}];`);
          break;

        case IR.LOAD_CONST:
          this.lines.push(`  const ${v} = __consts[${inst.operands.index}];`);
          break;

        case IR.STORE_LOCAL: {
          const valRef = varNames.get(inst.operands.value);
          const pv = promotedVarNames.get('l:' + inst.operands.slot);
          if (pv) {
            // Find the raw value: if value is BOX_INT, use its raw ref instead
            const valInst = ir[inst.operands.value];
            if (valInst && valInst.op === IR.BOX_INT) {
              this.lines.push(`  ${pv} = ${varNames.get(valInst.operands.ref)};`);
            } else {
              this.lines.push(`  ${pv} = ${valRef};`);
            }
          } else {
            // Non-promoted local: must store a MonkeyObject, not raw values
            const valInst = ir[inst.operands.value];
            if (valInst && this._isRawInt(valInst)) {
              this.lines.push(`  __stack[__bp + ${inst.operands.slot}] = __cachedInteger(${valRef});`);
            } else {
              this.lines.push(`  __stack[__bp + ${inst.operands.slot}] = ${valRef};`);
            }
          }
          this.lines.push(`  const ${v} = undefined;`);
          break;
        }

        case IR.STORE_GLOBAL: {
          const valRef = varNames.get(inst.operands.value);
          const pv = promotedVarNames.get('g:' + inst.operands.index);
          if (pv) {
            const valInst = ir[inst.operands.value];
            if (valInst && valInst.op === IR.BOX_INT) {
              this.lines.push(`  ${pv} = ${varNames.get(valInst.operands.ref)};`);
            } else {
              this.lines.push(`  ${pv} = ${valRef};`);
            }
          } else {
            // Non-promoted global: must store a MonkeyObject, not raw values
            const valInst = ir[inst.operands.value];
            if (valInst && this._isRawInt(valInst)) {
              this.lines.push(`  __globals[${inst.operands.index}] = __cachedInteger(${valRef});`);
            } else {
              this.lines.push(`  __globals[${inst.operands.index}] = ${valRef};`);
            }
          }
          this.lines.push(`  const ${v} = undefined;`);
          break;
        }

        case IR.GUARD_INT: {
          const refInst = ir[inst.operands.ref];
          if (refInst && refInst._promotedRaw) {
            // Promoted var is always int — skip guard
            this.lines.push(`  const ${v} = ${varNames.get(inst.operands.ref)};`);
            inst._promotedRaw = true;
          } else {
            const ref = varNames.get(inst.operands.ref);
            const exitIp = inst.operands.exitIp != null ? inst.operands.exitIp : this.trace.startIp;
            this._emitGuardExit(i, exitIp, `!(${ref} instanceof __MonkeyInteger)`);
            this.lines.push(`  const ${v} = ${ref};`);
          }
          break;
        }

        case IR.GUARD_BOOL: {
          const ref = varNames.get(inst.operands.ref);
          const exitIp = inst.operands.exitIp != null ? inst.operands.exitIp : this.trace.startIp;
          this._emitGuardExit(i, exitIp, `!(${ref} instanceof __MonkeyBoolean)`);
          this.lines.push(`  const ${v} = ${ref};`);
          break;
        }

        case IR.GUARD_STRING: {
          const ref = varNames.get(inst.operands.ref);
          const exitIp = inst.operands.exitIp != null ? inst.operands.exitIp : this.trace.startIp;
          this._emitGuardExit(i, exitIp, `!(${ref} instanceof __MonkeyString)`);
          this.lines.push(`  const ${v} = ${ref};`);
          break;
        }

        case IR.GUARD_TRUTHY: {
          const ref = varNames.get(inst.operands.ref);
          const exitIp = inst.operands.exitIp != null ? inst.operands.exitIp : this.trace.startIp;
          // Optimize: if ref is a CONST_BOOL wrapping a raw comparison, test the raw bool directly
          const refInst = ir[inst.operands.ref];
          let condition;
          if (refInst && refInst.op === IR.CONST_BOOL && refInst.operands.ref !== undefined) {
            const rawBoolVar = varNames.get(refInst.operands.ref);
            condition = `!${rawBoolVar}`;
          } else {
            condition = `typeof ${ref} === 'boolean' ? !${ref} : !__isTruthy(${ref})`;
          }
          this._emitGuardExit(i, exitIp, condition, 'guard_falsy');
          this.lines.push(`  const ${v} = true;`);
          break;
        }

        case IR.GUARD_FALSY: {
          const ref = varNames.get(inst.operands.ref);
          const exitIp = inst.operands.exitIp != null ? inst.operands.exitIp : this.trace.startIp;
          const refInst = ir[inst.operands.ref];
          let condition;
          if (refInst && refInst.op === IR.CONST_BOOL && refInst.operands.ref !== undefined) {
            const rawBoolVar = varNames.get(refInst.operands.ref);
            condition = `${rawBoolVar}`;
          } else {
            condition = `typeof ${ref} === 'boolean' ? ${ref} : __isTruthy(${ref})`;
          }
          this._emitGuardExit(i, exitIp, condition, 'guard_truthy');
          this.lines.push(`  const ${v} = true;`);
          break;
        }

        case IR.UNBOX_INT: {
          const refInst = ir[inst.operands.ref];
          if (refInst && refInst._promotedRaw) {
            // Already raw — just alias
            this.lines.push(`  const ${v} = ${varNames.get(inst.operands.ref)};`);
          } else {
            const ref = varNames.get(inst.operands.ref);
            this.lines.push(`  const ${v} = ${ref}.value;`);
          }
          break;
        }

        case IR.BOX_INT: {
          const ref = varNames.get(inst.operands.ref);
          // Check if this BOX_INT only feeds promoted stores — if so, skip it
          // Must verify no other instruction uses this value (e.g., UNBOX_INT, ADD)
          let usedByNonPromotedStore = false;
          let usedByOtherInst = false;
          for (let j = i + 1; j < ir.length; j++) {
            const user = ir[j];
            if (!user) continue;
            // Check if any operand of this instruction references our BOX_INT
            const ops = user.operands;
            for (const key of Object.keys(ops)) {
              if (ops[key] === i) {
                if ((user.op === IR.STORE_GLOBAL || user.op === IR.STORE_LOCAL) && key === 'value') {
                  const storeKey = user.op === IR.STORE_GLOBAL ? 'g:' + user.operands.index : 'l:' + user.operands.slot;
                  if (!promotedVarNames.has(storeKey)) usedByNonPromotedStore = true;
                } else {
                  usedByOtherInst = true;
                }
              }
            }
          }
          if (promotedVarNames.size > 0 && !usedByNonPromotedStore && !usedByOtherInst) {
            this.lines.push(`  const ${v} = undefined; /* dead box elided */`);
          } else {
            this.lines.push(`  const ${v} = __cachedInteger(${ref});`);
          }
          break;
        }

        case IR.ADD_INT: {
          const l = varNames.get(inst.operands.left);
          const r = varNames.get(inst.operands.right);
          this.lines.push(`  const ${v} = (${l} + ${r});`);
          break;
        }

        case IR.SUB_INT: {
          const l = varNames.get(inst.operands.left);
          const r = varNames.get(inst.operands.right);
          this.lines.push(`  const ${v} = (${l} - ${r});`);
          break;
        }

        case IR.MUL_INT: {
          const l = varNames.get(inst.operands.left);
          const r = varNames.get(inst.operands.right);
          this.lines.push(`  const ${v} = (${l} * ${r});`);
          break;
        }

        case IR.DIV_INT: {
          const l = varNames.get(inst.operands.left);
          const r = varNames.get(inst.operands.right);
          this.lines.push(`  const ${v} = Math.trunc(${l} / ${r});`);
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
          this.lines.push(`  ${this._emitReturn(`{ exit: "call", ip: ${this.trace.startIp} }`)}`);
          break;

        case IR.SELF_CALL: {
          // Recursive call to the traced function itself
          // Args are IR refs — we need to box them and call our compiled function
          const argRefs = inst.operands.args;
          const argVars = argRefs.map(ref => {
            const refInst = ir[ref];
            if (refInst && this._isRawInt(refInst)) {
              return `__cachedInteger(${varNames.get(ref)})`;
            }
            return varNames.get(ref);
          });
          // __self is the compiled function trace passed as a parameter
          // We call through __selfCall which handles setup
          this.lines.push(`  const ${v}_boxed = __selfCall(${argVars.join(', ')});`);
          // The result is a MonkeyObject — unbox if needed later
          this.lines.push(`  const ${v} = ${v}_boxed;`);
          break;
        }

        case IR.FUNC_RETURN: {
          // Return from function trace
          const ref = varNames.get(inst.operands.ref);
          const refInst = ir[inst.operands.ref];
          if (refInst && this._isRawInt(refInst)) {
            this.lines.push(`  return __cachedInteger(${ref});`);
          } else {
            this.lines.push(`  return ${ref};`);
          }
          break;
        }

        case IR.EXEC_TRACE: {
          // Trace stitching: call an inner compiled trace function
          // Write back promoted vars before calling (inner trace reads from stack/globals)
          for (const idx of promotable.globals) {
            const pv = promotedVarNames.get('g:' + idx);
            this.lines.push(`  __globals[${idx}] = __cachedInteger(${pv});`);
          }
          for (const slot of promotable.locals) {
            const pv = promotedVarNames.get('l:' + slot);
            this.lines.push(`  __stack[__bp + ${slot}] = __cachedInteger(${pv});`);
          }
          // Call the inner trace function
          this.lines.push(`  const ${v}_inner = __consts[${inst.operands.constIdx}];`);
          this.lines.push(`  let ${v} = ${v}_inner(__stack, __sp, __bp, __globals, __consts, __free, __MonkeyInteger, __MonkeyBoolean, __MonkeyString, __TRUE, __FALSE, __NULL, __cachedInteger, __isTruthy, __sideTraces);`);
          // After inner trace, reload promoted vars (inner trace may have modified them)
          for (const idx of promotable.globals) {
            const pv = promotedVarNames.get('g:' + idx);
            this.lines.push(`  ${pv} = __globals[${idx}].value;`);
          }
          for (const slot of promotable.locals) {
            const pv = promotedVarNames.get('l:' + slot);
            this.lines.push(`  ${pv} = __stack[__bp + ${slot}].value;`);
          }
          break;
        }

        default:
          this.lines.push(`  /* unknown IR: ${inst.op} */`);
      }
    }

    this.lines.push('}'); // end while loop

    const body = this.lines.join('\n');
    this.trace._compiledSource = body;

    try {
      const fn = new Function(
        '__stack', '__sp', '__bp', '__globals', '__consts', '__free',
        '__MonkeyInteger', '__MonkeyBoolean', '__MonkeyString',
        '__TRUE', '__FALSE', '__NULL',
        '__cachedInteger', '__isTruthy', '__sideTraces',
        body
      );
      return fn;
    } catch (e) {
      // Compilation failed — trace had issues
      return null;
    }
  }

  // Compile a function trace — straight-line code, takes args, returns value
  _compileFuncTrace(ir, varNames) {
    this.lines.push('"use strict";');

    for (let i = 0; i < ir.length; i++) {
      const inst = ir[i];
      if (!inst) continue;
      const v = this.freshVar();
      varNames.set(i, v);

      switch (inst.op) {
        case IR.LOAD_LOCAL: {
          // In function traces, locals are read from __stack[__bp + slot]
          this.lines.push(`  const ${v} = __stack[__bp + ${inst.operands.slot}];`);
          break;
        }

        case IR.LOAD_GLOBAL: {
          this.lines.push(`  const ${v} = __globals[${inst.operands.index}];`);
          break;
        }

        case IR.LOAD_FREE:
          this.lines.push(`  const ${v} = __free[${inst.operands.index}];`);
          break;

        case IR.LOAD_CONST:
          this.lines.push(`  const ${v} = __consts[${inst.operands.index}];`);
          break;

        case IR.CONST_INT:
          this.lines.push(`  const ${v} = ${inst.operands.value};`);
          break;

        case IR.CONST_BOOL:
          if (inst.operands.ref !== undefined) {
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
          this.lines.push(`  const ${v} = __consts[${inst.operands.constIdx}];`);
          break;

        case IR.STORE_LOCAL: {
          const valRef = varNames.get(inst.operands.value);
          const valInst = ir[inst.operands.value];
          if (valInst && this._isRawInt(valInst)) {
            this.lines.push(`  __stack[__bp + ${inst.operands.slot}] = __cachedInteger(${valRef});`);
          } else {
            this.lines.push(`  __stack[__bp + ${inst.operands.slot}] = ${valRef};`);
          }
          this.lines.push(`  const ${v} = undefined;`);
          break;
        }

        case IR.STORE_GLOBAL: {
          const valRef = varNames.get(inst.operands.value);
          const valInst = ir[inst.operands.value];
          if (valInst && this._isRawInt(valInst)) {
            this.lines.push(`  __globals[${inst.operands.index}] = __cachedInteger(${valRef});`);
          } else {
            this.lines.push(`  __globals[${inst.operands.index}] = ${valRef};`);
          }
          this.lines.push(`  const ${v} = undefined;`);
          break;
        }

        case IR.GUARD_INT: {
          const ref = varNames.get(inst.operands.ref);
          this.lines.push(`  if (!(${ref} instanceof __MonkeyInteger)) return { exit: "guard", ip: 0 };`);
          this.lines.push(`  const ${v} = ${ref};`);
          break;
        }

        case IR.GUARD_BOOL: {
          const ref = varNames.get(inst.operands.ref);
          this.lines.push(`  if (!(${ref} instanceof __MonkeyBoolean)) return { exit: "guard", ip: 0 };`);
          this.lines.push(`  const ${v} = ${ref};`);
          break;
        }

        case IR.GUARD_TRUTHY: {
          const ref = varNames.get(inst.operands.ref);
          const refInst = ir[inst.operands.ref];
          let condition;
          if (refInst && refInst.op === IR.CONST_BOOL && refInst.operands.ref !== undefined) {
            condition = `!${varNames.get(refInst.operands.ref)}`;
          } else {
            condition = `typeof ${ref} === 'boolean' ? !${ref} : !__isTruthy(${ref})`;
          }
          this.lines.push(`  if (${condition}) return { exit: "guard", ip: 0 };`);
          this.lines.push(`  const ${v} = true;`);
          break;
        }

        case IR.GUARD_FALSY: {
          const ref = varNames.get(inst.operands.ref);
          const refInst = ir[inst.operands.ref];
          let condition;
          if (refInst && refInst.op === IR.CONST_BOOL && refInst.operands.ref !== undefined) {
            condition = `${varNames.get(refInst.operands.ref)}`;
          } else {
            condition = `typeof ${ref} === 'boolean' ? ${ref} : __isTruthy(${ref})`;
          }
          this.lines.push(`  if (${condition}) return { exit: "guard", ip: 0 };`);
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
          this.lines.push(`  const ${v} = (${l} + ${r});`);
          break;
        }

        case IR.SUB_INT: {
          const l = varNames.get(inst.operands.left);
          const r = varNames.get(inst.operands.right);
          this.lines.push(`  const ${v} = (${l} - ${r});`);
          break;
        }

        case IR.MUL_INT: {
          const l = varNames.get(inst.operands.left);
          const r = varNames.get(inst.operands.right);
          this.lines.push(`  const ${v} = (${l} * ${r});`);
          break;
        }

        case IR.DIV_INT: {
          const l = varNames.get(inst.operands.left);
          const r = varNames.get(inst.operands.right);
          this.lines.push(`  const ${v} = Math.trunc(${l} / ${r});`);
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
          this.lines.push(`  const ${v} = (typeof ${ref} === 'boolean') ? !${ref} : !__isTruthy(${ref});`);
          break;
        }

        case IR.CONCAT: {
          const l = varNames.get(inst.operands.left);
          const r = varNames.get(inst.operands.right);
          this.lines.push(`  const ${v} = new __MonkeyString(${l}.value + ${r}.value);`);
          break;
        }

        case IR.SELF_CALL: {
          const argRefs = inst.operands.args;
          const argVars = argRefs.map(ref => {
            const refInst = ir[ref];
            if (refInst && this._isRawInt(refInst)) {
              return `__cachedInteger(${varNames.get(ref)})`;
            }
            return varNames.get(ref);
          });
          this.lines.push(`  const ${v} = __selfCall(${argVars.join(', ')});`);
          break;
        }

        case IR.FUNC_RETURN: {
          const ref = varNames.get(inst.operands.ref);
          const refInst = ir[inst.operands.ref];
          if (refInst && this._isRawInt(refInst)) {
            this.lines.push(`  return __cachedInteger(${ref});`);
          } else {
            this.lines.push(`  return ${ref};`);
          }
          break;
        }

        // Skip loop control IR in func traces
        case IR.LOOP_START:
        case IR.LOOP_END:
          break;

        default:
          this.lines.push(`  /* unknown IR: ${inst.op} */`);
      }
    }

    const body = this.lines.join('\n');
    this.trace._compiledSource = body;

    try {
      const fn = new Function(
        '__stack', '__sp', '__bp', '__globals', '__consts', '__free',
        '__MonkeyInteger', '__MonkeyBoolean', '__MonkeyString',
        '__TRUE', '__FALSE', '__NULL',
        '__cachedInteger', '__isTruthy', '__selfCall',
        body
      );
      return fn;
    } catch (e) {
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

  // --- Pass 0: Store-to-Load Forwarding ---
  // If we store a value to a global/local and later load from the same slot
  // (with no intervening store to that slot), replace the load with the stored value.
  // This eliminates the box→store→load→guard→unbox chain across loop iterations.

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
            case IR.ADD_INT: result = leftVal + rightVal; break;
            case IR.SUB_INT: result = leftVal - rightVal; break;
            case IR.MUL_INT: result = leftVal * rightVal; break;
            case IR.DIV_INT: result = Math.trunc(leftVal / rightVal); break;
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
          inst.op === IR.CALL || inst.op === IR.EXEC_TRACE ||
          inst.op === IR.SELF_CALL || inst.op === IR.FUNC_RETURN) {
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
          // Handle SELF_CALL args array
          if (key === 'args' && Array.isArray(ops[key])) {
            for (const argRef of ops[key]) {
              if (typeof argRef === 'number' && argRef >= 0 && argRef < ir.length && ir[argRef] && !live.has(argRef)) {
                live.add(argRef);
                changed = true;
              }
            }
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
        if (typeof ops[key] !== 'number') {
          // Handle args array (for SELF_CALL)
          if (key === 'args' && Array.isArray(ops[key])) {
            ops[key] = ops[key].map(ref => remap.has(ref) ? remap.get(ref) : ref);
          }
          continue;
        }
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

// --- Function Compiler ---
// Direct bytecode → JS compilation for hot recursive functions.
// Emits a flat JS function that interprets the bytecode without dispatch overhead.
// Each bytecode instruction becomes inline JS. Self-calls use the compiled function.

export class FunctionCompiler {
  constructor(fn, constants, vm) {
    this.fn = fn;
    this.constants = constants;
    this.vm = vm;
    this._compiledSource = null;
  }

  compile() {
    const ins = this.fn.instructions;
    const numLocals = this.fn.numLocals;

    // Build a set of jump targets (for label generation)
    const jumpTargets = new Set();
    let ip = 0;
    while (ip < ins.length) {
      const op = ins[ip];
      const def = lookup(op);
      const widths = def ? def.operandWidths : [];
      let offset = ip + 1;
      for (const w of widths) {
        if (w === 2) {
          const target = (ins[offset] << 8) | ins[offset + 1];
          if (op === Opcodes.OpJump || op === Opcodes.OpJumpNotTruthy) {
            jumpTargets.add(target);
          }
          offset += 2;
        } else {
          offset += 1;
        }
      }
      ip = offset;
    }

    const lines = [];
    lines.push('"use strict";');
    // Local variables (args are pre-loaded, rest are null)
    lines.push(`const __s = new Array(32);`); // operand stack
    lines.push(`let __sp = 0;`);
    for (let i = 0; i < numLocals; i++) {
      lines.push(`let __l${i} = __args[${i}] !== undefined ? __args[${i}] : __NULL;`);
    }

    // Walk bytecode and emit inline JS for each instruction
    ip = 0;
    while (ip < ins.length) {
      // Emit label if this is a jump target
      if (jumpTargets.has(ip)) {
        // We use a flat switch-based approach instead
      }

      const op = ins[ip];

      switch (op) {
        case Opcodes.OpConstant: {
          const constIdx = (ins[ip + 1] << 8) | ins[ip + 2];
          ip += 3;
          const constVal = this.constants[constIdx];
          if (constVal instanceof MonkeyInteger) {
            lines.push(`__s[__sp++] = __cachedInteger(${constVal.value});`);
          } else if (constVal instanceof MonkeyBoolean) {
            lines.push(`__s[__sp++] = ${constVal.value ? '__TRUE' : '__FALSE'};`);
          } else {
            lines.push(`__s[__sp++] = __consts[${constIdx}];`);
          }
          break;
        }

        case Opcodes.OpGetLocal: {
          const slot = ins[ip + 1];
          ip += 2;
          lines.push(`__s[__sp++] = __l${slot};`);
          break;
        }

        case Opcodes.OpSetLocal: {
          const slot = ins[ip + 1];
          ip += 2;
          lines.push(`__l${slot} = __s[--__sp];`);
          break;
        }

        case Opcodes.OpGetGlobal: {
          const idx = (ins[ip + 1] << 8) | ins[ip + 2];
          ip += 3;
          lines.push(`__s[__sp++] = __globals[${idx}];`);
          break;
        }

        case Opcodes.OpSetGlobal: {
          const idx = (ins[ip + 1] << 8) | ins[ip + 2];
          ip += 3;
          lines.push(`__globals[${idx}] = __s[--__sp];`);
          break;
        }

        case Opcodes.OpGetFree: {
          const idx = ins[ip + 1];
          ip += 2;
          lines.push(`__s[__sp++] = __free[${idx}];`);
          break;
        }

        case Opcodes.OpAdd:
          ip += 1;
          lines.push(`{ const r = __s[--__sp], l = __s[--__sp]; __s[__sp++] = __cachedInteger(l.value + r.value); }`);
          break;

        case Opcodes.OpSub:
          ip += 1;
          lines.push(`{ const r = __s[--__sp], l = __s[--__sp]; __s[__sp++] = __cachedInteger(l.value - r.value); }`);
          break;

        case Opcodes.OpMul:
          ip += 1;
          lines.push(`{ const r = __s[--__sp], l = __s[--__sp]; __s[__sp++] = __cachedInteger(l.value * r.value); }`);
          break;

        case Opcodes.OpDiv:
          ip += 1;
          lines.push(`{ const r = __s[--__sp], l = __s[--__sp]; __s[__sp++] = __cachedInteger(Math.trunc(l.value / r.value)); }`);
          break;

        case Opcodes.OpEqual:
          ip += 1;
          lines.push(`{ const r = __s[--__sp], l = __s[--__sp]; __s[__sp++] = l.value === r.value ? __TRUE : __FALSE; }`);
          break;

        case Opcodes.OpNotEqual:
          ip += 1;
          lines.push(`{ const r = __s[--__sp], l = __s[--__sp]; __s[__sp++] = l.value !== r.value ? __TRUE : __FALSE; }`);
          break;

        case Opcodes.OpGreaterThan:
          ip += 1;
          lines.push(`{ const r = __s[--__sp], l = __s[--__sp]; __s[__sp++] = l.value > r.value ? __TRUE : __FALSE; }`);
          break;

        case Opcodes.OpMinus:
          ip += 1;
          lines.push(`{ const v = __s[--__sp]; __s[__sp++] = __cachedInteger(-v.value); }`);
          break;

        case Opcodes.OpBang:
          ip += 1;
          lines.push(`{ const v = __s[--__sp]; __s[__sp++] = __isTruthy(v) ? __FALSE : __TRUE; }`);
          break;

        case Opcodes.OpTrue:
          ip += 1;
          lines.push(`__s[__sp++] = __TRUE;`);
          break;

        case Opcodes.OpFalse:
          ip += 1;
          lines.push(`__s[__sp++] = __FALSE;`);
          break;

        case Opcodes.OpNull:
          ip += 1;
          lines.push(`__s[__sp++] = __NULL;`);
          break;

        case Opcodes.OpPop:
          ip += 1;
          lines.push(`--__sp;`);
          break;

        case Opcodes.OpReturnValue:
          ip += 1;
          lines.push(`return __s[--__sp];`);
          break;

        case Opcodes.OpReturn:
          ip += 1;
          lines.push(`return __NULL;`);
          break;

        case Opcodes.OpCurrentClosure:
          ip += 1;
          // Push a sentinel — we'll handle this in OpCall
          lines.push(`__s[__sp++] = __SELF_MARKER;`);
          break;

        case Opcodes.OpCall: {
          const numArgs = ins[ip + 1];
          ip += 2;
          // Check if the callee is our self-marker (recursive call)
          const argExprs = [];
          for (let i = numArgs - 1; i >= 0; i--) {
            argExprs.unshift(`a${i}`);
          }
          lines.push(`{`);
          lines.push(`  const __callArgs = new Array(${numArgs});`);
          for (let i = numArgs - 1; i >= 0; i--) {
            lines.push(`  __callArgs[${i}] = __s[--__sp];`);
          }
          lines.push(`  const __callee = __s[--__sp];`);
          lines.push(`  if (__callee === __SELF_MARKER) {`);
          lines.push(`    __s[__sp++] = __self(__callArgs);`);
          lines.push(`  } else {`);
          // Non-self call — bail to indicate we can't handle this
          lines.push(`    return null; /* bail: non-self call */`);
          lines.push(`  }`);
          lines.push(`}`);
          break;
        }

        case Opcodes.OpJump: {
          const target = (ins[ip + 1] << 8) | ins[ip + 2];
          ip += 3;
          // For structured if/else, jumps go forward. We'll handle this
          // by noting it and continuing. The emitted code uses labels.
          // For now, emit a goto-like construct using a loop+switch pattern
          // Actually, for the common pattern (if/else), this jump skips the else.
          // We'll emit it as a block closing.
          lines.push(`/* jump to ${target} */`);
          break;
        }

        case Opcodes.OpJumpNotTruthy: {
          const target = (ins[ip + 1] << 8) | ins[ip + 2];
          ip += 3;
          lines.push(`if (!__isTruthy(__s[--__sp])) {`);
          lines.push(`  /* jump to ${target} — will be closed by jump/target */`);
          break;
        }

        // Superinstructions
        case Opcodes.OpGetLocalSubConst: {
          const slot = ins[ip + 1];
          const constIdx = (ins[ip + 2] << 8) | ins[ip + 3];
          ip += 4;
          const constVal = this.constants[constIdx];
          if (constVal instanceof MonkeyInteger) {
            lines.push(`__s[__sp++] = __cachedInteger(__l${slot}.value - ${constVal.value});`);
          } else {
            lines.push(`__s[__sp++] = __cachedInteger(__l${slot}.value - __consts[${constIdx}].value);`);
          }
          break;
        }

        default: {
          // Unknown op — bail
          ip += 1;
          const def = lookup(op);
          if (def && def.operandWidths) {
            for (const w of def.operandWidths) ip += w;
          }
          return null;
        }
      }
    }

    // This approach has a problem: the jump/branch structure is not properly
    // handled. We need to restructure the bytecode into structured control flow.
    // For the common if/else pattern in recursive functions, let me use a
    // different approach: a goto-simulation with a while+switch loop.

    return null; // The flat approach doesn't handle control flow well
  }

  // Compile using a while+switch interpreter (eliminates dispatch overhead via V8 JIT)
  // Uses raw JS numbers internally for integer-heavy functions (like fib)
  compileSwitch() {
    const ins = this.fn.instructions;
    const numLocals = this.fn.numLocals;

    // Analyze: can we use raw integers? Check if all arithmetic is integer-based
    // and there are no string ops or complex features that need boxed values.
    const canUseRawInts = this._canUseRawInts();

    if (canUseRawInts) {
      return this._compileSwitchRaw();
    }

    const lines = [];
    lines.push('"use strict";');
    lines.push(`const __s = [];`);
    lines.push(`let __sp = 0;`);
    for (let i = 0; i < numLocals; i++) {
      lines.push(`let __l${i} = ${i} < __args.length ? __args[${i}] : __NULL;`);
    }

    // Find all instruction boundaries
    const boundaries = new Set([0]);
    let ip = 0;
    while (ip < ins.length) {
      const op = ins[ip];
      const def = lookup(op);
      const widths = def ? def.operandWidths : [];
      let nextIp = ip + 1;
      for (const w of widths) nextIp += w;

      if (op === Opcodes.OpJump) {
        const target = (ins[ip + 1] << 8) | ins[ip + 2];
        boundaries.add(target);
        boundaries.add(nextIp);
      } else if (op === Opcodes.OpJumpNotTruthy) {
        const target = (ins[ip + 1] << 8) | ins[ip + 2];
        boundaries.add(target);
        boundaries.add(nextIp);
      } else if (op === Opcodes.OpReturnValue || op === Opcodes.OpReturn) {
        boundaries.add(nextIp);
      }
      ip = nextIp;
    }

    // Sort boundaries
    const blocks = [...boundaries].sort((a, b) => a - b);

    // Emit a switch-based interpreter
    lines.push(`let __pc = 0;`);
    lines.push(`while (true) {`);
    lines.push(`  switch (__pc) {`);

    for (let bi = 0; bi < blocks.length; bi++) {
      const blockStart = blocks[bi];
      const blockEnd = bi + 1 < blocks.length ? blocks[bi + 1] : ins.length;
      if (blockStart >= ins.length) continue;

      lines.push(`    case ${blockStart}: {`);

      ip = blockStart;
      while (ip < blockEnd && ip < ins.length) {
        const op = ins[ip];

        switch (op) {
          case Opcodes.OpConstant: {
            const constIdx = (ins[ip + 1] << 8) | ins[ip + 2];
            ip += 3;
            const constVal = this.constants[constIdx];
            if (constVal instanceof MonkeyInteger) {
              lines.push(`      __s[__sp++] = __cachedInteger(${constVal.value});`);
            } else if (constVal instanceof MonkeyBoolean) {
              lines.push(`      __s[__sp++] = ${constVal.value ? '__TRUE' : '__FALSE'};`);
            } else {
              lines.push(`      __s[__sp++] = __consts[${constIdx}];`);
            }
            break;
          }

          case Opcodes.OpGetLocal: {
            const slot = ins[ip + 1];
            ip += 2;
            lines.push(`      __s[__sp++] = __l${slot};`);
            break;
          }

          case Opcodes.OpSetLocal: {
            const slot = ins[ip + 1];
            ip += 2;
            lines.push(`      __l${slot} = __s[--__sp];`);
            break;
          }

          case Opcodes.OpGetGlobal: {
            const idx = (ins[ip + 1] << 8) | ins[ip + 2];
            ip += 3;
            lines.push(`      __s[__sp++] = __globals[${idx}];`);
            break;
          }

          case Opcodes.OpSetGlobal: {
            const idx = (ins[ip + 1] << 8) | ins[ip + 2];
            ip += 3;
            lines.push(`      __globals[${idx}] = __s[--__sp];`);
            break;
          }

          case Opcodes.OpGetFree: {
            const idx = ins[ip + 1];
            ip += 2;
            lines.push(`      __s[__sp++] = __free[${idx}];`);
            break;
          }

          case Opcodes.OpAdd: ip += 1;
            lines.push(`      { const r = __s[--__sp], l = __s[--__sp]; if (l instanceof __MonkeyString) __s[__sp++] = new __MonkeyString(l.value + r.value); else __s[__sp++] = __cachedInteger(l.value + r.value); }`);
            break;
          case Opcodes.OpSub: ip += 1;
            lines.push(`      { const r = __s[--__sp], l = __s[--__sp]; __s[__sp++] = __cachedInteger(l.value - r.value); }`);
            break;
          case Opcodes.OpMul: ip += 1;
            lines.push(`      { const r = __s[--__sp], l = __s[--__sp]; __s[__sp++] = __cachedInteger(l.value * r.value); }`);
            break;
          case Opcodes.OpDiv: ip += 1;
            lines.push(`      { const r = __s[--__sp], l = __s[--__sp]; __s[__sp++] = __cachedInteger(Math.trunc(l.value / r.value)); }`);
            break;

          case Opcodes.OpEqual: ip += 1;
            lines.push(`      { const r = __s[--__sp], l = __s[--__sp]; __s[__sp++] = (l === r || l.value === r.value) ? __TRUE : __FALSE; }`);
            break;
          case Opcodes.OpNotEqual: ip += 1;
            lines.push(`      { const r = __s[--__sp], l = __s[--__sp]; __s[__sp++] = (l !== r && l.value !== r.value) ? __TRUE : __FALSE; }`);
            break;
          case Opcodes.OpGreaterThan: ip += 1;
            lines.push(`      { const r = __s[--__sp], l = __s[--__sp]; __s[__sp++] = l.value > r.value ? __TRUE : __FALSE; }`);
            break;

          case Opcodes.OpMinus: ip += 1;
            lines.push(`      { const v = __s[--__sp]; __s[__sp++] = __cachedInteger(-v.value); }`);
            break;
          case Opcodes.OpBang: ip += 1;
            lines.push(`      { const v = __s[--__sp]; __s[__sp++] = __isTruthy(v) ? __FALSE : __TRUE; }`);
            break;

          case Opcodes.OpTrue: ip += 1;
            lines.push(`      __s[__sp++] = __TRUE;`); break;
          case Opcodes.OpFalse: ip += 1;
            lines.push(`      __s[__sp++] = __FALSE;`); break;
          case Opcodes.OpNull: ip += 1;
            lines.push(`      __s[__sp++] = __NULL;`); break;

          case Opcodes.OpPop: ip += 1;
            lines.push(`      --__sp;`); break;

          case Opcodes.OpReturnValue: ip += 1;
            lines.push(`      return __s[--__sp];`);
            break;

          case Opcodes.OpReturn: ip += 1;
            lines.push(`      return __NULL;`);
            break;

          case Opcodes.OpCurrentClosure: ip += 1;
            lines.push(`      __s[__sp++] = null; /* self marker */`);
            break;

          case Opcodes.OpCall: {
            const numArgs = ins[ip + 1];
            ip += 2;
            lines.push(`      {`);
            lines.push(`        const __callArgs = new Array(${numArgs});`);
            for (let i = numArgs - 1; i >= 0; i--) {
              lines.push(`        __callArgs[${i}] = __s[--__sp];`);
            }
            lines.push(`        --__sp; /* pop callee */`);
            lines.push(`        __s[__sp++] = __self(__callArgs);`);
            lines.push(`      }`);
            break;
          }

          case Opcodes.OpJump: {
            const target = (ins[ip + 1] << 8) | ins[ip + 2];
            ip += 3;
            lines.push(`      __pc = ${target}; continue;`);
            break;
          }

          case Opcodes.OpJumpNotTruthy: {
            const target = (ins[ip + 1] << 8) | ins[ip + 2];
            ip += 3;
            lines.push(`      if (!__isTruthy(__s[--__sp])) { __pc = ${target}; continue; }`);
            break;
          }

          case Opcodes.OpGetLocalSubConst: {
            const slot = ins[ip + 1];
            const constIdx = (ins[ip + 2] << 8) | ins[ip + 3];
            ip += 4;
            const constVal = this.constants[constIdx];
            if (constVal instanceof MonkeyInteger) {
              lines.push(`      __s[__sp++] = __cachedInteger(__l${slot}.value - ${constVal.value});`);
            } else {
              lines.push(`      __s[__sp++] = __cachedInteger(__l${slot}.value - __consts[${constIdx}].value);`);
            }
            break;
          }

          default: {
            // Unknown opcode — can't compile
            return null;
          }
        }
      }

      // Fall through to next block
      if (bi + 1 < blocks.length && blocks[bi + 1] < ins.length) {
        lines.push(`      __pc = ${blocks[bi + 1]}; continue;`);
      }
      lines.push(`    }`);
    }

    lines.push(`  }`); // end switch
    lines.push(`  break;`); // end while (shouldn't reach here)
    lines.push(`}`); // end while

    const body = lines.join('\n');
    this._compiledSource = body;

    try {
      const fn = new Function(
        '__args', '__globals', '__consts', '__free',
        '__MonkeyInteger', '__MonkeyBoolean', '__MonkeyString',
        '__TRUE', '__FALSE', '__NULL',
        '__cachedInteger', '__isTruthy', '__self',
        body
      );
      return fn;
    } catch (e) {
      return null;
    }
  }

  // Check if this function can be compiled with raw integer optimization
  _canUseRawInts() {
    const ins = this.fn.instructions;
    const referencedConsts = new Set();
    let ip = 0;
    while (ip < ins.length) {
      const op = ins[ip];
      const def = lookup(op);
      const widths = def ? def.operandWidths : [];
      let nextIp = ip + 1;

      // Track which constants this function actually references
      if (op === Opcodes.OpConstant) {
        const idx = (ins[ip + 1] << 8) | ins[ip + 2];
        referencedConsts.add(idx);
      }
      if (op === Opcodes.OpGetLocalSubConst) {
        const idx = (ins[ip + 2] << 8) | ins[ip + 3];
        referencedConsts.add(idx);
      }

      for (const w of widths) nextIp += w;

      switch (op) {
        case Opcodes.OpConstant:
        case Opcodes.OpGetLocal:
        case Opcodes.OpSetLocal:
        case Opcodes.OpAdd:
        case Opcodes.OpSub:
        case Opcodes.OpMul:
        case Opcodes.OpDiv:
        case Opcodes.OpEqual:
        case Opcodes.OpNotEqual:
        case Opcodes.OpGreaterThan:
        case Opcodes.OpMinus:
        case Opcodes.OpBang:
        case Opcodes.OpTrue:
        case Opcodes.OpFalse:
        case Opcodes.OpNull:
        case Opcodes.OpPop:
        case Opcodes.OpReturnValue:
        case Opcodes.OpReturn:
        case Opcodes.OpJump:
        case Opcodes.OpJumpNotTruthy:
        case Opcodes.OpCurrentClosure:
        case Opcodes.OpCall:
        case Opcodes.OpGetLocalSubConst:
        case Opcodes.OpGetGlobal:
        case Opcodes.OpSetGlobal:
        case Opcodes.OpGetFree:
          break;
        default:
          return false;
      }
      ip = nextIp;
    }
    // Only check constants actually referenced by this function
    for (const idx of referencedConsts) {
      const c = this.constants[idx];
      if (c instanceof MonkeyInteger || c instanceof MonkeyBoolean) continue;
      return false;
    }
    return true;
  }

  // Compile with raw JS numbers — no boxing for integer arithmetic
  // Generates TWO functions: inner (raw args/return) and outer (boxed wrapper)
  _compileSwitchRaw() {
    const ins = this.fn.instructions;
    const numLocals = this.fn.numLocals;
    const numParams = this.fn.numParameters;

    const lines = [];
    lines.push('"use strict";');
    // Inner raw function — takes raw numbers, returns raw number
    lines.push(`function __rawFib(__rawArgs) {`);
    for (let i = 0; i < numLocals; i++) {
      if (i < numParams) {
        lines.push(`  let __l${i} = __rawArgs[${i}];`);
      } else {
        lines.push(`  let __l${i} = 0;`);
      }
    }
    lines.push(`  const __s = [];`);
    lines.push(`  let __sp = 0;`);

    // Find all instruction boundaries
    const boundaries = new Set([0]);
    let ip = 0;
    while (ip < ins.length) {
      const op = ins[ip];
      const def = lookup(op);
      const widths = def ? def.operandWidths : [];
      let nextIp = ip + 1;
      for (const w of widths) nextIp += w;

      if (op === Opcodes.OpJump) {
        const target = (ins[ip + 1] << 8) | ins[ip + 2];
        boundaries.add(target);
        boundaries.add(nextIp);
      } else if (op === Opcodes.OpJumpNotTruthy) {
        const target = (ins[ip + 1] << 8) | ins[ip + 2];
        boundaries.add(target);
        boundaries.add(nextIp);
      } else if (op === Opcodes.OpReturnValue || op === Opcodes.OpReturn) {
        boundaries.add(nextIp);
      }
      ip = nextIp;
    }

    const blocks = [...boundaries].sort((a, b) => a - b);

    lines.push(`  let __pc = 0;`);
    lines.push(`  while (true) {`);
    lines.push(`    switch (__pc) {`);

    for (let bi = 0; bi < blocks.length; bi++) {
      const blockStart = blocks[bi];
      const blockEnd = bi + 1 < blocks.length ? blocks[bi + 1] : ins.length;
      if (blockStart >= ins.length) continue;

      lines.push(`      case ${blockStart}: {`);

      ip = blockStart;
      while (ip < blockEnd && ip < ins.length) {
        const op = ins[ip];

        switch (op) {
          case Opcodes.OpConstant: {
            const constIdx = (ins[ip + 1] << 8) | ins[ip + 2];
            ip += 3;
            const constVal = this.constants[constIdx];
            if (constVal instanceof MonkeyInteger) {
              lines.push(`        __s[__sp++] = ${constVal.value};`);
            } else if (constVal instanceof MonkeyBoolean) {
              lines.push(`        __s[__sp++] = ${constVal.value};`);
            } else {
              return null;
            }
            break;
          }

          case Opcodes.OpGetLocal: {
            const slot = ins[ip + 1]; ip += 2;
            lines.push(`        __s[__sp++] = __l${slot};`);
            break;
          }
          case Opcodes.OpSetLocal: {
            const slot = ins[ip + 1]; ip += 2;
            lines.push(`        __l${slot} = __s[--__sp];`);
            break;
          }

          case Opcodes.OpGetGlobal: {
            const idx = (ins[ip + 1] << 8) | ins[ip + 2]; ip += 3;
            lines.push(`        __s[__sp++] = __globals[${idx}].value;`);
            break;
          }
          case Opcodes.OpSetGlobal: {
            const idx = (ins[ip + 1] << 8) | ins[ip + 2]; ip += 3;
            lines.push(`        __globals[${idx}] = __cachedInteger(__s[--__sp]);`);
            break;
          }

          case Opcodes.OpGetFree: {
            const idx = ins[ip + 1]; ip += 2;
            lines.push(`        __s[__sp++] = __free[${idx}].value !== undefined ? __free[${idx}].value : __free[${idx}];`);
            break;
          }

          case Opcodes.OpAdd: ip += 1;
            lines.push(`        { const r = __s[--__sp]; __s[__sp - 1] += r; }`);
            break;
          case Opcodes.OpSub: ip += 1;
            lines.push(`        { const r = __s[--__sp]; __s[__sp - 1] -= r; }`);
            break;
          case Opcodes.OpMul: ip += 1;
            lines.push(`        { const r = __s[--__sp]; __s[__sp - 1] *= r; }`);
            break;
          case Opcodes.OpDiv: ip += 1;
            lines.push(`        { const r = __s[--__sp]; __s[__sp - 1] = Math.trunc(__s[__sp - 1] / r); }`);
            break;

          case Opcodes.OpEqual: ip += 1;
            lines.push(`        { const r = __s[--__sp]; __s[__sp - 1] = __s[__sp - 1] === r; }`);
            break;
          case Opcodes.OpNotEqual: ip += 1;
            lines.push(`        { const r = __s[--__sp]; __s[__sp - 1] = __s[__sp - 1] !== r; }`);
            break;
          case Opcodes.OpGreaterThan: ip += 1;
            lines.push(`        { const r = __s[--__sp]; __s[__sp - 1] = __s[__sp - 1] > r; }`);
            break;

          case Opcodes.OpMinus: ip += 1;
            lines.push(`        __s[__sp - 1] = -__s[__sp - 1];`);
            break;
          case Opcodes.OpBang: ip += 1;
            lines.push(`        __s[__sp - 1] = !__s[__sp - 1];`);
            break;

          case Opcodes.OpTrue: ip += 1;
            lines.push(`        __s[__sp++] = true;`); break;
          case Opcodes.OpFalse: ip += 1;
            lines.push(`        __s[__sp++] = false;`); break;
          case Opcodes.OpNull: ip += 1;
            lines.push(`        __s[__sp++] = 0;`); break;

          case Opcodes.OpPop: ip += 1;
            lines.push(`        --__sp;`); break;

          case Opcodes.OpReturnValue: ip += 1;
            // Return raw number
            lines.push(`        return __s[--__sp];`);
            break;

          case Opcodes.OpReturn: ip += 1;
            lines.push(`        return 0;`);
            break;

          case Opcodes.OpCurrentClosure: ip += 1;
            lines.push(`        __s[__sp++] = null;`);
            break;

          case Opcodes.OpCall: {
            const numArgs = ins[ip + 1]; ip += 2;
            // Self-call with raw numbers — direct recursion, no boxing
            lines.push(`        {`);
            lines.push(`          const __ca = new Array(${numArgs});`);
            for (let i = numArgs - 1; i >= 0; i--) {
              lines.push(`          __ca[${i}] = __s[--__sp];`);
            }
            lines.push(`          --__sp;`);
            lines.push(`          __s[__sp++] = __rawFib(__ca);`);
            lines.push(`        }`);
            break;
          }

          case Opcodes.OpJump: {
            const target = (ins[ip + 1] << 8) | ins[ip + 2]; ip += 3;
            lines.push(`        __pc = ${target}; continue;`);
            break;
          }

          case Opcodes.OpJumpNotTruthy: {
            const target = (ins[ip + 1] << 8) | ins[ip + 2]; ip += 3;
            lines.push(`        if (!__s[--__sp]) { __pc = ${target}; continue; }`);
            break;
          }

          case Opcodes.OpGetLocalSubConst: {
            const slot = ins[ip + 1];
            const constIdx = (ins[ip + 2] << 8) | ins[ip + 3]; ip += 4;
            const constVal = this.constants[constIdx];
            if (constVal instanceof MonkeyInteger) {
              lines.push(`        __s[__sp++] = __l${slot} - ${constVal.value};`);
            } else {
              return null;
            }
            break;
          }

          default:
            return null;
        }
      }

      if (bi + 1 < blocks.length && blocks[bi + 1] < ins.length) {
        lines.push(`        __pc = ${blocks[bi + 1]}; continue;`);
      }
      lines.push(`      }`);
    }

    lines.push(`    }`); // end switch
    lines.push(`    break;`);
    lines.push(`  }`); // end while
    lines.push(`}`); // end __rawFib

    // Outer wrapper: unboxes args, calls raw, boxes result
    lines.push(`const __ra = new Array(__args.length);`);
    lines.push(`for (let i = 0; i < __args.length; i++) __ra[i] = __args[i] && __args[i].value !== undefined ? __args[i].value : 0;`);
    lines.push(`return __cachedInteger(__rawFib(__ra));`);

    const body = lines.join('\n');
    this._compiledSource = body;
    this._isRaw = true;

    try {
      const fn = new Function(
        '__args', '__globals', '__consts', '__free',
        '__MonkeyInteger', '__MonkeyBoolean', '__MonkeyString',
        '__TRUE', '__FALSE', '__NULL',
        '__cachedInteger', '__isTruthy', '__self', '__selfRaw',
        body
      );
      return fn;
    } catch (e) {
      return null;
    }
  }
}
