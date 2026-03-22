// Monkey Language Virtual Machine
// Stack-based VM that executes bytecode from the compiler

import { Opcodes, readOperands, lookup } from './code.js';
import { CompiledFunction } from './compiler.js';
import {
  MonkeyInteger, MonkeyBoolean, MonkeyString, MonkeyNull,
  MonkeyArray, MonkeyHash, MonkeyBuiltin, MonkeyError,
  TRUE, FALSE, NULL, cachedInteger,
} from './object.js';
import { IR, JIT, TraceRecorder } from './jit.js';

const STACK_SIZE = 2048;
const GLOBALS_SIZE = 65536;
const MAX_FRAMES = 1024;

// Closure wraps a compiled function with its free variables
export class Closure {
  constructor(fn, free = []) {
    this.fn = fn;       // CompiledFunction
    this.free = free;   // captured variables
  }
  type() { return 'CLOSURE'; }
  inspect() { return `Closure[${this.fn.instructions.length}]`; }
}

// Call frame
class Frame {
  constructor(closure, basePointer) {
    this.closure = closure;
    this.ip = -1;           // instruction pointer (within this frame)
    this.basePointer = basePointer;
  }
  instructions() {
    return this.closure.fn.instructions;
  }
}

// Builtin functions
const BUILTINS = [
  // len
  new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return new MonkeyError(`wrong number of arguments. got=${args.length}, want=1`);
    const arg = args[0];
    if (arg instanceof MonkeyString) return new MonkeyInteger(arg.value.length);
    if (arg instanceof MonkeyArray) return new MonkeyInteger(arg.elements.length);
    return new MonkeyError(`argument to \`len\` not supported, got ${arg.type()}`);
  }),
  // puts
  new MonkeyBuiltin((...args) => {
    for (const a of args) console.log(a.inspect());
    return NULL;
  }),
  // first
  new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return new MonkeyError(`wrong number of arguments. got=${args.length}, want=1`);
    if (!(args[0] instanceof MonkeyArray)) return new MonkeyError(`argument to \`first\` must be ARRAY, got ${args[0].type()}`);
    return args[0].elements.length > 0 ? args[0].elements[0] : NULL;
  }),
  // last
  new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return new MonkeyError(`wrong number of arguments. got=${args.length}, want=1`);
    if (!(args[0] instanceof MonkeyArray)) return new MonkeyError(`argument to \`last\` must be ARRAY, got ${args[0].type()}`);
    const els = args[0].elements;
    return els.length > 0 ? els[els.length - 1] : NULL;
  }),
  // rest
  new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return new MonkeyError(`wrong number of arguments. got=${args.length}, want=1`);
    if (!(args[0] instanceof MonkeyArray)) return new MonkeyError(`argument to \`rest\` must be ARRAY, got ${args[0].type()}`);
    const els = args[0].elements;
    if (els.length === 0) return NULL;
    return new MonkeyArray(els.slice(1));
  }),
  // push
  new MonkeyBuiltin((...args) => {
    if (args.length !== 2) return new MonkeyError(`wrong number of arguments. got=${args.length}, want=2`);
    if (!(args[0] instanceof MonkeyArray)) return new MonkeyError(`argument to \`push\` must be ARRAY, got ${args[0].type()}`);
    return new MonkeyArray([...args[0].elements, args[1]]);
  }),
];

export class VM {
  constructor(bytecode) {
    this.constants = bytecode.constants;
    this.globals = new Array(GLOBALS_SIZE);

    this.stack = new Array(STACK_SIZE);
    this.sp = 0; // stack pointer — always points to next free slot

    // Set up main frame
    const mainFn = new CompiledFunction(bytecode.instructions);
    const mainClosure = new Closure(mainFn);
    this.frames = new Array(MAX_FRAMES);
    this.frames[0] = new Frame(mainClosure, 0);
    this.framesIndex = 1;

    // JIT support
    this.jit = null;
    this.recorder = null;
  }

  enableJIT() {
    this.jit = new JIT();
    return this;
  }

  /** Create a VM that reuses an existing globals store (for REPL) */
  static withGlobals(bytecode, globals) {
    const vm = new VM(bytecode);
    vm.globals = globals;
    return vm;
  }

  currentFrame() {
    return this.frames[this.framesIndex - 1];
  }

  pushFrame(frame) {
    this.frames[this.framesIndex] = frame;
    this.framesIndex++;
  }

  popFrame() {
    this.framesIndex--;
    return this.frames[this.framesIndex];
  }

  stackTop() {
    if (this.sp === 0) return null;
    return this.stack[this.sp - 1];
  }

  lastPoppedStackElem() {
    return this.stack[this.sp];
  }

  push(obj) {
    if (this.sp >= STACK_SIZE) throw new Error('stack overflow');
    this.stack[this.sp] = obj;
    this.sp++;
  }

  pop() {
    const obj = this.stack[this.sp - 1];
    this.sp--;
    return obj;
  }

  run() {
    let ip, ins, op;
    const recording = () => this.recorder && this.recorder.recording;

    while (this.currentFrame().ip < this.currentFrame().instructions().length - 1) {
      this.currentFrame().ip++;
      ip = this.currentFrame().ip;
      ins = this.currentFrame().instructions();
      op = ins[ip];

      // Check if we've looped back to trace start (recording complete)
      if (recording() && this.recorder.instrCount > 0 && ip === this.recorder.startIp
          && this.framesIndex === this.recorder.startFrame) {
        const trace = this.recorder.stop();
        if (trace && this.jit && this.jit.compile(trace, this)) {
          this.jit.storeTrace(trace);
          // Execute the freshly compiled trace immediately
          this._executeTrace(trace);
          this.recorder = null;
          continue; // ip changed by trace; restart loop
        }
        this.recorder = null;
      }

      // Abort recording on too many instructions
      if (recording() && ++this.recorder.instrCount > 200) {
        this.recorder.abort();
        this.recorder = null;
      }

      switch (op) {
        case Opcodes.OpConstant: {
          const constIdx = (ins[ip + 1] << 8) | ins[ip + 2];
          this.currentFrame().ip += 2;
          const constVal = this.constants[constIdx];
          this.push(constVal);
          if (recording()) {
            this._recordPush(op, constVal, [constIdx]);
          }
          break;
        }

        case Opcodes.OpPop:
          this.pop();
          if (recording()) { this.recorder.popRef(); }
          break;

        case Opcodes.OpAdd:
        case Opcodes.OpSub:
        case Opcodes.OpMul:
        case Opcodes.OpDiv: {
          const right = this.pop();
          const left = this.pop();

          if (left instanceof MonkeyInteger && right instanceof MonkeyInteger) {
            if (recording()) {
              this.recorder.recordIntArith(op, left, right);
            }
            let result;
            switch (op) {
              case Opcodes.OpAdd: result = left.value + right.value; break;
              case Opcodes.OpSub: result = left.value - right.value; break;
              case Opcodes.OpMul: result = left.value * right.value; break;
              case Opcodes.OpDiv: result = Math.trunc(left.value / right.value); break;
            }
            this.push(cachedInteger(result));
          } else if (left instanceof MonkeyString && right instanceof MonkeyString && op === Opcodes.OpAdd) {
            if (recording()) { this.recorder.abort(); this.recorder = null; }
            this.push(new MonkeyString(left.value + right.value));
          } else {
            throw new Error(`unsupported types for ${op}: ${left.type()} and ${right.type()}`);
          }
          break;
        }

        case Opcodes.OpTrue:
          this.push(TRUE);
          if (recording()) { this._recordPush(op, TRUE, []); }
          break;

        case Opcodes.OpFalse:
          this.push(FALSE);
          if (recording()) { this._recordPush(op, FALSE, []); }
          break;

        case Opcodes.OpEqual:
        case Opcodes.OpNotEqual:
        case Opcodes.OpGreaterThan: {
          const right2 = this.pop();
          const left2 = this.pop();

          if (left2 instanceof MonkeyInteger && right2 instanceof MonkeyInteger) {
            if (recording()) {
              this.recorder.recordComparison(op, left2, right2);
            }
            let result;
            switch (op) {
              case Opcodes.OpEqual: result = left2.value === right2.value; break;
              case Opcodes.OpNotEqual: result = left2.value !== right2.value; break;
              case Opcodes.OpGreaterThan: result = left2.value > right2.value; break;
            }
            this.push(result ? TRUE : FALSE);
          } else if (left2 instanceof MonkeyBoolean && right2 instanceof MonkeyBoolean) {
            if (recording()) { this.recorder.abort(); this.recorder = null; }
            let result;
            switch (op) {
              case Opcodes.OpEqual: result = left2.value === right2.value; break;
              case Opcodes.OpNotEqual: result = left2.value !== right2.value; break;
              default: throw new Error(`unknown operator for booleans`);
            }
            this.push(result ? TRUE : FALSE);
          } else {
            throw new Error(`unsupported comparison: ${left2.type()} and ${right2.type()}`);
          }
          break;
        }

        case Opcodes.OpMinus: {
          const operand = this.pop();
          if (!(operand instanceof MonkeyInteger)) {
            throw new Error(`unsupported type for negation: ${operand.type()}`);
          }
          if (recording()) {
            const ref = this.recorder.popRef();
            if (this.recorder.knownType(ref) !== 'int') this.recorder.guardType(ref, operand);
            const unboxed = this.recorder.trace.addInst(IR.UNBOX_INT, { ref });
            const negRef = this.recorder.trace.addInst(IR.NEG, { ref: unboxed });
            const boxed = this.recorder.trace.addInst(IR.BOX_INT, { ref: negRef });
            this.recorder.typeMap.set(boxed, 'int');
            this.recorder.pushRef(boxed);
          }
          this.push(cachedInteger(-operand.value));
          break;
        }

        case Opcodes.OpBang: {
          const operand2 = this.pop();
          if (recording()) {
            const ref = this.recorder.popRef();
            const notRef = this.recorder.trace.addInst(IR.NOT, { ref });
            this.recorder.typeMap.set(notRef, 'raw_bool');
            // Box to MonkeyBoolean
            const boxed = this.recorder.trace.addInst(IR.CONST_BOOL, { ref: notRef });
            this.recorder.typeMap.set(boxed, 'bool');
            this.recorder.pushRef(boxed);
          }
          if (operand2 === TRUE) this.push(FALSE);
          else if (operand2 === FALSE) this.push(TRUE);
          else if (operand2 === NULL) this.push(TRUE);
          else this.push(FALSE);
          break;
        }

        case Opcodes.OpJumpNotTruthy: {
          const target = (ins[ip + 1] << 8) | ins[ip + 2];
          this.currentFrame().ip += 2;
          const condition = this.pop();
          const truthy = this.isTruthy(condition);

          if (recording()) {
            const condRef = this.recorder.popRef();
            if (truthy) {
              // Took the fall-through path — guard that it stays truthy
              this.recorder.trace.addInst(IR.GUARD_TRUTHY, { ref: condRef, exitIp: target });
              this.recorder.trace.guardCount++;
            } else {
              // Took the jump path — guard that it stays falsy
              this.recorder.trace.addInst(IR.GUARD_FALSY, { ref: condRef, exitIp: ip + 3 });
              this.recorder.trace.guardCount++;
            }
          }

          if (!truthy) {
            this.currentFrame().ip = target - 1;
          }
          break;
        }

        case Opcodes.OpJump: {
          const target2 = (ins[ip + 1] << 8) | ins[ip + 2];

          // Backward jump = loop back-edge
          if (this.jit && target2 <= ip) {
            const closureId = this._closureId();

            // Check for existing compiled trace
            const existingTrace = this.jit.getTrace(closureId, target2);
            if (existingTrace && existingTrace.compiled && !recording()) {
              this._executeTrace(existingTrace);
              // After trace exits, ip is already set; continue interpreting
              break;
            }

            // Hot counting (only when not already recording)
            if (!recording() && this.jit.countEdge(closureId, target2)) {
              this._startRecording(target2);
            }
          }

          this.currentFrame().ip = target2 - 1;
          break;
        }

        case Opcodes.OpNull:
          this.push(NULL);
          if (recording()) { this._recordPush(op, NULL, []); }
          break;

        case Opcodes.OpSetGlobal: {
          const globalIdx = (ins[ip + 1] << 8) | ins[ip + 2];
          this.currentFrame().ip += 2;
          const setGlobalVal = this.pop();
          this.globals[globalIdx] = setGlobalVal;
          if (recording()) {
            const valRef = this.recorder.popRef();
            this.recorder.trace.addInst(IR.STORE_GLOBAL, { index: globalIdx, value: valRef });
          }
          break;
        }

        case Opcodes.OpGetGlobal: {
          const globalIdx2 = (ins[ip + 1] << 8) | ins[ip + 2];
          this.currentFrame().ip += 2;
          const getGlobalVal = this.globals[globalIdx2];
          this.push(getGlobalVal);
          if (recording()) {
            const ref = this.recorder.trace.addInst(IR.LOAD_GLOBAL, { index: globalIdx2 });
            this.recorder.pushRef(ref);
          }
          break;
        }

        case Opcodes.OpSetLocal: {
          const localIdx = ins[ip + 1];
          this.currentFrame().ip += 1;
          const setVal = this.pop();
          this.stack[this.currentFrame().basePointer + localIdx] = setVal;
          if (recording()) {
            const valRef = this.recorder.popRef();
            this.recorder.trace.addInst(IR.STORE_LOCAL, { slot: localIdx, value: valRef });
          }
          break;
        }

        case Opcodes.OpGetLocal: {
          const localIdx2 = ins[ip + 1];
          this.currentFrame().ip += 1;
          const localVal = this.stack[this.currentFrame().basePointer + localIdx2];
          this.push(localVal);
          if (recording()) {
            const ref = this.recorder.trace.addInst(IR.LOAD_LOCAL, { slot: localIdx2 });
            this.recorder.pushRef(ref);
          }
          break;
        }

        case Opcodes.OpArray: {
          const numElements = (ins[ip + 1] << 8) | ins[ip + 2];
          this.currentFrame().ip += 2;
          const elements = this.stack.slice(this.sp - numElements, this.sp);
          this.sp -= numElements;
          this.push(new MonkeyArray([...elements]));
          break;
        }

        case Opcodes.OpHash: {
          const numPairs = (ins[ip + 1] << 8) | ins[ip + 2];
          this.currentFrame().ip += 2;
          const pairs = new Map();
          // Stack has key, value, key, value... from bottom to top
          const hashElems = this.stack.slice(this.sp - numPairs, this.sp);
          this.sp -= numPairs;
          for (let i = 0; i < hashElems.length; i += 2) {
            const key = hashElems[i];
            const value = hashElems[i + 1];
            if (!key.hashKey) throw new Error(`unusable as hash key: ${key.type()}`);
            pairs.set(key.hashKey(), { key, value });
          }
          this.push(new MonkeyHash(pairs));
          break;
        }

        case Opcodes.OpIndex: {
          const index = this.pop();
          const left3 = this.pop();
          if (left3 instanceof MonkeyArray && index instanceof MonkeyInteger) {
            const i = index.value;
            if (i < 0 || i >= left3.elements.length) {
              this.push(NULL);
            } else {
              this.push(left3.elements[i]);
            }
          } else if (left3 instanceof MonkeyHash) {
            if (!index.hashKey) throw new Error(`unusable as hash key: ${index.type()}`);
            const pair = left3.pairs.get(index.hashKey());
            this.push(pair ? pair.value : NULL);
          } else {
            throw new Error(`index operator not supported: ${left3.type()}`);
          }
          break;
        }

        case Opcodes.OpCall: {
          if (recording()) { this.recorder.abort(); this.recorder = null; }
          const numArgs = ins[ip + 1];
          this.currentFrame().ip += 1;
          const callee = this.stack[this.sp - 1 - numArgs];

          if (callee instanceof Closure) {
            if (numArgs !== callee.fn.numParameters) {
              throw new Error(`wrong number of arguments: want=${callee.fn.numParameters}, got=${numArgs}`);
            }
            const frame = new Frame(callee, this.sp - numArgs);
            this.pushFrame(frame);
            this.sp = frame.basePointer + callee.fn.numLocals;
          } else if (callee instanceof MonkeyBuiltin) {
            const args = this.stack.slice(this.sp - numArgs, this.sp);
            const result = callee.fn(...args);
            this.sp = this.sp - numArgs - 1;
            this.push(result !== undefined ? result : NULL);
          } else {
            throw new Error('calling non-function/non-builtin');
          }
          break;
        }

        case Opcodes.OpReturnValue: {
          const returnValue = this.pop();
          const frame = this.popFrame();
          this.sp = frame.basePointer - 1; // -1 to also pop the function itself
          this.push(returnValue);
          break;
        }

        case Opcodes.OpReturn: {
          const frame2 = this.popFrame();
          this.sp = frame2.basePointer - 1;
          this.push(NULL);
          break;
        }

        case Opcodes.OpClosure: {
          const constIdx2 = (ins[ip + 1] << 8) | ins[ip + 2];
          const numFree = ins[ip + 3];
          this.currentFrame().ip += 3;

          const fn = this.constants[constIdx2];
          const free = new Array(numFree);
          for (let i = 0; i < numFree; i++) {
            free[i] = this.stack[this.sp - numFree + i];
          }
          this.sp -= numFree;
          this.push(new Closure(fn, free));
          break;
        }

        case Opcodes.OpGetFree: {
          const freeIdx = ins[ip + 1];
          this.currentFrame().ip += 1;
          const freeVal = this.currentFrame().closure.free[freeIdx];
          this.push(freeVal);
          if (recording()) { this._recordPush(op, freeVal, [freeIdx]); }
          break;
        }

        case Opcodes.OpCurrentClosure:
          this.push(this.currentFrame().closure);
          break;

        case Opcodes.OpGetBuiltin: {
          const builtinIdx = ins[ip + 1];
          this.currentFrame().ip += 1;
          this.push(BUILTINS[builtinIdx]);
          break;
        }

        case Opcodes.OpAddConst:
        case Opcodes.OpSubConst:
        case Opcodes.OpMulConst:
        case Opcodes.OpDivConst: {
          const constIdx3 = (ins[ip + 1] << 8) | ins[ip + 2];
          this.currentFrame().ip += 2;
          const left4 = this.pop();
          const right4 = this.constants[constIdx3];

          if (left4 instanceof MonkeyInteger && right4 instanceof MonkeyInteger) {
            if (recording()) {
              // Left ref is already on IR stack from prior push opcode
              // Add const ref for right, then recordIntArith pops both
              const constRef = this.recorder.trace.addInst(IR.CONST_INT, { value: right4.value });
              this.recorder.typeMap.set(constRef, 'raw_int');
              this.recorder.pushRef(constRef);
              this.recorder.recordIntArith(op, left4, right4);
            }
            let result;
            switch (op) {
              case Opcodes.OpAddConst: result = left4.value + right4.value; break;
              case Opcodes.OpSubConst: result = left4.value - right4.value; break;
              case Opcodes.OpMulConst: result = left4.value * right4.value; break;
              case Opcodes.OpDivConst: result = Math.trunc(left4.value / right4.value); break;
            }
            this.push(cachedInteger(result));
          } else if (left4 instanceof MonkeyString && right4 instanceof MonkeyString && op === Opcodes.OpAddConst) {
            if (recording()) { this.recorder.abort(); this.recorder = null; }
            this.push(new MonkeyString(left4.value + right4.value));
          } else {
            throw new Error(`unsupported types for constant op: ${left4.type()} and ${right4.type()}`);
          }
          break;
        }

        // Superinstructions: fused OpGetLocal + Op*Const
        case Opcodes.OpGetLocalAddConst:
        case Opcodes.OpGetLocalSubConst:
        case Opcodes.OpGetLocalMulConst:
        case Opcodes.OpGetLocalDivConst: {
          const localIdx3 = ins[ip + 1];
          const constIdx4 = (ins[ip + 2] << 8) | ins[ip + 3];
          this.currentFrame().ip += 3;
          const leftVal = this.stack[this.currentFrame().basePointer + localIdx3];
          const rightVal = this.constants[constIdx4];

          if (leftVal instanceof MonkeyInteger && rightVal instanceof MonkeyInteger) {
            if (recording()) {
              // Decompose superinstruction into IR: load local, const, arith
              const localRef = this.recorder.trace.addInst(IR.LOAD_LOCAL, { slot: localIdx3 });
              this.recorder.pushRef(localRef);
              const constRef = this.recorder.trace.addInst(IR.CONST_INT, { value: rightVal.value });
              this.recorder.typeMap.set(constRef, 'raw_int');
              this.recorder.pushRef(constRef);
              // Map superinstruction to base arith opcode for recordIntArith
              const baseOp = op === Opcodes.OpGetLocalAddConst ? Opcodes.OpAdd
                : op === Opcodes.OpGetLocalSubConst ? Opcodes.OpSub
                : op === Opcodes.OpGetLocalMulConst ? Opcodes.OpMul
                : Opcodes.OpDiv;
              this.recorder.recordIntArith(baseOp, leftVal, rightVal);
            }
            let result;
            switch (op) {
              case Opcodes.OpGetLocalAddConst: result = leftVal.value + rightVal.value; break;
              case Opcodes.OpGetLocalSubConst: result = leftVal.value - rightVal.value; break;
              case Opcodes.OpGetLocalMulConst: result = leftVal.value * rightVal.value; break;
              case Opcodes.OpGetLocalDivConst: result = Math.trunc(leftVal.value / rightVal.value); break;
            }
            this.push(cachedInteger(result));
          } else if (leftVal instanceof MonkeyString && rightVal instanceof MonkeyString && op === Opcodes.OpGetLocalAddConst) {
            if (recording()) { this.recorder.abort(); this.recorder = null; }
            this.push(new MonkeyString(leftVal.value + rightVal.value));
          } else {
            throw new Error(`unsupported types for local+const op: ${leftVal.type()} and ${rightVal.type()}`);
          }
          break;
        }

        // Integer-specialized opcodes: skip instanceof checks entirely
        // Compiler guarantees both operands are MonkeyInteger
        case Opcodes.OpAddInt: {
          const r = this.pop();
          const l = this.pop();
          if (recording()) { this.recorder.recordIntArith(op, l, r); }
          this.push(cachedInteger(l.value + r.value));
          break;
        }

        case Opcodes.OpSubInt: {
          const r = this.pop();
          const l = this.pop();
          if (recording()) { this.recorder.recordIntArith(op, l, r); }
          this.push(cachedInteger(l.value - r.value));
          break;
        }

        case Opcodes.OpGreaterThanInt: {
          const r = this.pop();
          const l = this.pop();
          if (recording()) { this.recorder.recordComparison(op, l, r); }
          this.push(l.value > r.value ? TRUE : FALSE);
          break;
        }

        case Opcodes.OpLessThanInt: {
          const r = this.pop();
          const l = this.pop();
          if (recording()) { this.recorder.recordComparison(op, l, r); }
          this.push(l.value < r.value ? TRUE : FALSE);
          break;
        }

        case Opcodes.OpEqualInt: {
          const r = this.pop();
          const l = this.pop();
          if (recording()) { this.recorder.recordComparison(op, l, r); }
          this.push(l.value === r.value ? TRUE : FALSE);
          break;
        }

        case Opcodes.OpNotEqualInt: {
          const r = this.pop();
          const l = this.pop();
          if (recording()) { this.recorder.recordComparison(op, l, r); }
          this.push(l.value !== r.value ? TRUE : FALSE);
          break;
        }

        default:
          throw new Error(`unknown opcode: ${op}`);
      }
    }
  }

  isTruthy(obj) {
    if (obj instanceof MonkeyBoolean) return obj.value;
    if (obj === NULL) return false;
    return true;
  }

  // --- JIT Integration ---

  // Get a stable identity for the current closure (for trace keying)
  _closureId() {
    return this.currentFrame().closure.fn;
  }

  // Execute a compiled trace, returns true if trace ran (even if it exited)
  _executeTrace(trace) {
    const frame = this.currentFrame();
    const result = trace.compiled(
      this.stack, this.sp, frame.basePointer,
      this.globals, this.constants, frame.closure.free,
      MonkeyInteger, MonkeyBoolean, MonkeyString,
      TRUE, FALSE, NULL,
      cachedInteger,
      this.isTruthy,
    );
    trace.executionCount++;

    if (!result) return false;

    switch (result.exit) {
      case 'guard_falsy':
      case 'guard_truthy':
      case 'guard':
        // Guard failed — resume interpreter at the exit IP
        // The trace already updated stack/globals in place
        if (result.ip !== undefined) {
          frame.ip = result.ip - 1; // -1 because loop increments
        }
        // Track side exit for potential side traces later
        trace.sideExits.set(result.guardIdx,
          (trace.sideExits.get(result.guardIdx) || 0) + 1);
        return true;
      case 'max_iter':
        // Safety bail — just continue interpreting
        return true;
      case 'call':
        // Can't handle calls yet — fall back to interpreter
        return true;
      default:
        return true;
    }
  }

  // Start recording a trace at the current loop header
  _startRecording(ip) {
    this.recorder = new TraceRecorder(this);
    this.recorder.start(this._closureId(), ip);
  }

  // Record the current opcode into the trace (called after execution)
  _record(op, ip, ins) {
    if (!this.recorder || !this.recorder.recording) return;

    // Check if we've looped back to the start (trace complete)
    if (this.recorder.instrCount > 0 && ip === this.recorder.startIp) {
      const trace = this.recorder.stop();
      if (trace && this.jit.compile(trace, this)) {
        this.jit.storeTrace(trace);
      }
      this.recorder = null;
      return;
    }

    // Abort on too many instructions
    if (++this.recorder.instrCount > 200) {
      this.recorder.abort();
      this.recorder = null;
      return;
    }
  }

  // Record a value being pushed (maps VM push to IR ref tracking)
  _recordPush(op, value, operands) {
    if (!this.recorder || !this.recorder.recording) return;
    const r = this.recorder;
    const trace = r.trace;

    switch (op) {
      case Opcodes.OpConstant: {
        if (value instanceof MonkeyInteger) {
          const ref = trace.addInst(IR.CONST_INT, { value: value.value });
          r.typeMap.set(ref, 'raw_int');
          r.pushRef(ref);
        } else if (value instanceof MonkeyBoolean) {
          const ref = trace.addInst(IR.CONST_BOOL, { value: value.value });
          r.typeMap.set(ref, 'bool');
          r.pushRef(ref);
        } else if (value instanceof MonkeyString) {
          const ref = trace.addInst(IR.CONST_OBJ, { constIdx: operands[0] });
          r.typeMap.set(ref, 'string');
          r.pushRef(ref);
        } else {
          const ref = trace.addInst(IR.CONST_OBJ, { constIdx: operands[0] });
          r.typeMap.set(ref, 'object');
          r.pushRef(ref);
        }
        break;
      }

      case Opcodes.OpGetLocal: {
        const ref = trace.addInst(IR.LOAD_LOCAL, { slot: operands[0] });
        r.pushRef(ref);
        break;
      }

      case Opcodes.OpGetGlobal: {
        const ref = trace.addInst(IR.LOAD_GLOBAL, { index: operands[0] });
        r.pushRef(ref);
        break;
      }

      case Opcodes.OpGetFree: {
        const ref = trace.addInst(IR.LOAD_FREE, { index: operands[0] });
        r.pushRef(ref);
        break;
      }

      case Opcodes.OpTrue: {
        const ref = trace.addInst(IR.CONST_BOOL, { value: true });
        r.typeMap.set(ref, 'bool');
        r.pushRef(ref);
        break;
      }

      case Opcodes.OpFalse: {
        const ref = trace.addInst(IR.CONST_BOOL, { value: false });
        r.typeMap.set(ref, 'bool');
        r.pushRef(ref);
        break;
      }

      case Opcodes.OpNull: {
        const ref = trace.addInst(IR.CONST_NULL);
        r.typeMap.set(ref, 'null');
        r.pushRef(ref);
        break;
      }
    }
  }
}
