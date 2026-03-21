// Monkey Language Virtual Machine
// Stack-based VM that executes bytecode from the compiler

import { Opcodes, readOperands, lookup } from './code.js';
import { CompiledFunction } from './compiler.js';
import {
  MonkeyInteger, MonkeyBoolean, MonkeyString, MonkeyNull,
  MonkeyArray, MonkeyHash, MonkeyBuiltin, MonkeyError,
  TRUE, FALSE, NULL,
} from './object.js';

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

    while (this.currentFrame().ip < this.currentFrame().instructions().length - 1) {
      this.currentFrame().ip++;
      ip = this.currentFrame().ip;
      ins = this.currentFrame().instructions();
      op = ins[ip];

      switch (op) {
        case Opcodes.OpConstant: {
          const constIdx = (ins[ip + 1] << 8) | ins[ip + 2];
          this.currentFrame().ip += 2;
          this.push(this.constants[constIdx]);
          break;
        }

        case Opcodes.OpPop:
          this.pop();
          break;

        case Opcodes.OpAdd:
        case Opcodes.OpSub:
        case Opcodes.OpMul:
        case Opcodes.OpDiv: {
          const right = this.pop();
          const left = this.pop();

          if (left instanceof MonkeyInteger && right instanceof MonkeyInteger) {
            let result;
            switch (op) {
              case Opcodes.OpAdd: result = left.value + right.value; break;
              case Opcodes.OpSub: result = left.value - right.value; break;
              case Opcodes.OpMul: result = left.value * right.value; break;
              case Opcodes.OpDiv: result = Math.trunc(left.value / right.value); break;
            }
            this.push(new MonkeyInteger(result));
          } else if (left instanceof MonkeyString && right instanceof MonkeyString && op === Opcodes.OpAdd) {
            this.push(new MonkeyString(left.value + right.value));
          } else {
            throw new Error(`unsupported types for ${op}: ${left.type()} and ${right.type()}`);
          }
          break;
        }

        case Opcodes.OpTrue:
          this.push(TRUE);
          break;

        case Opcodes.OpFalse:
          this.push(FALSE);
          break;

        case Opcodes.OpEqual:
        case Opcodes.OpNotEqual:
        case Opcodes.OpGreaterThan: {
          const right2 = this.pop();
          const left2 = this.pop();

          if (left2 instanceof MonkeyInteger && right2 instanceof MonkeyInteger) {
            let result;
            switch (op) {
              case Opcodes.OpEqual: result = left2.value === right2.value; break;
              case Opcodes.OpNotEqual: result = left2.value !== right2.value; break;
              case Opcodes.OpGreaterThan: result = left2.value > right2.value; break;
            }
            this.push(result ? TRUE : FALSE);
          } else if (left2 instanceof MonkeyBoolean && right2 instanceof MonkeyBoolean) {
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
          this.push(new MonkeyInteger(-operand.value));
          break;
        }

        case Opcodes.OpBang: {
          const operand2 = this.pop();
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
          if (!this.isTruthy(condition)) {
            this.currentFrame().ip = target - 1; // -1 because loop increments
          }
          break;
        }

        case Opcodes.OpJump: {
          const target2 = (ins[ip + 1] << 8) | ins[ip + 2];
          this.currentFrame().ip = target2 - 1;
          break;
        }

        case Opcodes.OpNull:
          this.push(NULL);
          break;

        case Opcodes.OpSetGlobal: {
          const globalIdx = (ins[ip + 1] << 8) | ins[ip + 2];
          this.currentFrame().ip += 2;
          this.globals[globalIdx] = this.pop();
          break;
        }

        case Opcodes.OpGetGlobal: {
          const globalIdx2 = (ins[ip + 1] << 8) | ins[ip + 2];
          this.currentFrame().ip += 2;
          this.push(this.globals[globalIdx2]);
          break;
        }

        case Opcodes.OpSetLocal: {
          const localIdx = ins[ip + 1];
          this.currentFrame().ip += 1;
          this.stack[this.currentFrame().basePointer + localIdx] = this.pop();
          break;
        }

        case Opcodes.OpGetLocal: {
          const localIdx2 = ins[ip + 1];
          this.currentFrame().ip += 1;
          this.push(this.stack[this.currentFrame().basePointer + localIdx2]);
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
          this.push(this.currentFrame().closure.free[freeIdx]);
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
            let result;
            switch (op) {
              case Opcodes.OpAddConst: result = left4.value + right4.value; break;
              case Opcodes.OpSubConst: result = left4.value - right4.value; break;
              case Opcodes.OpMulConst: result = left4.value * right4.value; break;
              case Opcodes.OpDivConst: result = Math.trunc(left4.value / right4.value); break;
            }
            this.push(new MonkeyInteger(result));
          } else if (left4 instanceof MonkeyString && right4 instanceof MonkeyString && op === Opcodes.OpAddConst) {
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
            let result;
            switch (op) {
              case Opcodes.OpGetLocalAddConst: result = leftVal.value + rightVal.value; break;
              case Opcodes.OpGetLocalSubConst: result = leftVal.value - rightVal.value; break;
              case Opcodes.OpGetLocalMulConst: result = leftVal.value * rightVal.value; break;
              case Opcodes.OpGetLocalDivConst: result = Math.trunc(leftVal.value / rightVal.value); break;
            }
            this.push(new MonkeyInteger(result));
          } else if (leftVal instanceof MonkeyString && rightVal instanceof MonkeyString && op === Opcodes.OpGetLocalAddConst) {
            this.push(new MonkeyString(leftVal.value + rightVal.value));
          } else {
            throw new Error(`unsupported types for local+const op: ${leftVal.type()} and ${rightVal.type()}`);
          }
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
}
