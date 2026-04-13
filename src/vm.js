// vm.js — Monkey Stack Virtual Machine
// Executes bytecode produced by the compiler.

import { Opcodes, lookup, readOperands } from './code.js';
import { CompiledFunction, Closure } from './compiler.js';
import {
  MonkeyInteger, MonkeyString, MonkeyBoolean, MonkeyArray, MonkeyHash,
  MonkeyNull, MonkeyError, MonkeyBuiltin,
  TRUE, FALSE, NULL, OBJ,
} from './object.js';

const STACK_SIZE = 8192;
const GLOBALS_SIZE = 65536;
const MAX_FRAMES = 1024;

/**
 * Frame: a call frame tracking instruction pointer and base pointer.
 */
class Frame {
  constructor(closure, basePointer) {
    this.closure = closure; // Closure wrapping CompiledFunction
    this.ip = -1;          // instruction pointer (into closure.fn.instructions)
    this.basePointer = basePointer; // stack index where locals start
  }

  instructions() {
    return this.closure.fn.instructions;
  }
}

// Builtins (must match compiler order)
const builtins = [
  // len
  new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return new MonkeyError(`wrong number of arguments. got=${args.length}, want=1`);
    const arg = args[0];
    if (arg instanceof MonkeyString) return new MonkeyInteger(arg.value.length);
    if (arg instanceof MonkeyArray) return new MonkeyInteger(arg.elements.length);
    return new MonkeyError(`argument to \`len\` not supported, got ${arg.type()}`);
  }),
  // first
  new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return new MonkeyError(`wrong number of arguments. got=${args.length}, want=1`);
    if (args[0].type() !== OBJ.ARRAY) return new MonkeyError(`argument to \`first\` must be ARRAY, got ${args[0].type()}`);
    return args[0].elements.length > 0 ? args[0].elements[0] : NULL;
  }),
  // last
  new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return new MonkeyError(`wrong number of arguments. got=${args.length}, want=1`);
    if (args[0].type() !== OBJ.ARRAY) return new MonkeyError(`argument to \`last\` must be ARRAY, got ${args[0].type()}`);
    const els = args[0].elements;
    return els.length > 0 ? els[els.length - 1] : NULL;
  }),
  // rest
  new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return new MonkeyError(`wrong number of arguments. got=${args.length}, want=1`);
    if (args[0].type() !== OBJ.ARRAY) return new MonkeyError(`argument to \`rest\` must be ARRAY, got ${args[0].type()}`);
    const els = args[0].elements;
    return els.length > 0 ? new MonkeyArray(els.slice(1)) : NULL;
  }),
  // push
  new MonkeyBuiltin((...args) => {
    if (args.length !== 2) return new MonkeyError(`wrong number of arguments. got=${args.length}, want=2`);
    if (args[0].type() !== OBJ.ARRAY) return new MonkeyError(`argument to \`push\` must be ARRAY, got ${args[0].type()}`);
    return new MonkeyArray([...args[0].elements, args[1]]);
  }),
  // puts
  new MonkeyBuiltin((...args) => {
    for (const arg of args) console.log(arg.inspect());
    return NULL;
  }),
];

/**
 * VM: the Monkey stack virtual machine.
 */
export class VM {
  constructor(bytecode) {
    this.constants = bytecode.constants;

    // Main program is wrapped in a closure/frame
    const mainFn = new CompiledFunction(bytecode.instructions);
    const mainClosure = new Closure(mainFn);
    const mainFrame = new Frame(mainClosure, 0);

    this.frames = new Array(MAX_FRAMES);
    this.frames[0] = mainFrame;
    this.framesIndex = 1;

    this.stack = new Array(STACK_SIZE);
    this.sp = 0; // stack pointer (points to next free slot)

    this.globals = new Array(GLOBALS_SIZE);
  }

  /**
   * Get the last popped element from the stack.
   */
  lastPoppedStackElem() {
    return this.stack[this.sp];
  }

  /**
   * Run the VM until completion.
   */
  run() {
    while (this.currentFrame().ip < this.currentFrame().instructions().length - 1) {
      this.currentFrame().ip++;
      const ip = this.currentFrame().ip;
      const instructions = this.currentFrame().instructions();
      const op = instructions[ip];

      switch (op) {
        case Opcodes.OpConstant: {
          const constIndex = (instructions[ip + 1] << 8) | instructions[ip + 2];
          this.currentFrame().ip += 2;
          this.push(this.constants[constIndex]);
          break;
        }

        case Opcodes.OpAdd:
        case Opcodes.OpSub:
        case Opcodes.OpMul:
        case Opcodes.OpDiv: {
          this.executeBinaryOperation(op);
          break;
        }

        case Opcodes.OpPop:
          this.pop();
          break;

        case Opcodes.OpTrue:
          this.push(TRUE);
          break;

        case Opcodes.OpFalse:
          this.push(FALSE);
          break;

        case Opcodes.OpNull:
          this.push(NULL);
          break;

        case Opcodes.OpEqual:
        case Opcodes.OpNotEqual:
        case Opcodes.OpGreaterThan: {
          this.executeComparison(op);
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
          const operand = this.pop();
          if (operand === TRUE) this.push(FALSE);
          else if (operand === FALSE) this.push(TRUE);
          else if (operand === NULL) this.push(TRUE);
          else this.push(FALSE);
          break;
        }

        case Opcodes.OpJump: {
          const pos = (instructions[ip + 1] << 8) | instructions[ip + 2];
          this.currentFrame().ip = pos - 1; // -1 because loop will increment
          break;
        }

        case Opcodes.OpJumpNotTruthy: {
          const pos = (instructions[ip + 1] << 8) | instructions[ip + 2];
          this.currentFrame().ip += 2;
          const condition = this.pop();
          if (!this.isTruthy(condition)) {
            this.currentFrame().ip = pos - 1;
          }
          break;
        }

        case Opcodes.OpSetGlobal: {
          const globalIndex = (instructions[ip + 1] << 8) | instructions[ip + 2];
          this.currentFrame().ip += 2;
          this.globals[globalIndex] = this.pop();
          break;
        }

        case Opcodes.OpGetGlobal: {
          const globalIndex = (instructions[ip + 1] << 8) | instructions[ip + 2];
          this.currentFrame().ip += 2;
          this.push(this.globals[globalIndex]);
          break;
        }

        case Opcodes.OpArray: {
          const numElements = (instructions[ip + 1] << 8) | instructions[ip + 2];
          this.currentFrame().ip += 2;
          const elements = [];
          for (let i = this.sp - numElements; i < this.sp; i++) {
            elements.push(this.stack[i]);
          }
          this.sp -= numElements;
          this.push(new MonkeyArray(elements));
          break;
        }

        case Opcodes.OpHash: {
          const numElements = (instructions[ip + 1] << 8) | instructions[ip + 2];
          this.currentFrame().ip += 2;
          const pairs = new Map();
          for (let i = this.sp - numElements; i < this.sp; i += 2) {
            const key = this.stack[i];
            const value = this.stack[i + 1];
            pairs.set(key, value);
          }
          this.sp -= numElements;
          this.push(new MonkeyHash(pairs));
          break;
        }

        case Opcodes.OpIndex: {
          const index = this.pop();
          const left = this.pop();
          this.executeIndexExpression(left, index);
          break;
        }

        case Opcodes.OpCall: {
          const numArgs = instructions[ip + 1];
          this.currentFrame().ip += 1;
          this.executeCall(numArgs);
          break;
        }

        case Opcodes.OpReturnValue: {
          const returnValue = this.pop();
          if (this.framesIndex <= 1) {
            // Top-level return — halt the VM
            // Place value where lastPoppedStackElem can find it
            this.stack[this.sp] = returnValue;
            return;
          }
          const frame = this.popFrame();
          this.sp = frame.basePointer - 1; // -1 to also pop the function
          this.push(returnValue);
          break;
        }

        case Opcodes.OpReturn: {
          if (this.framesIndex <= 1) {
            this.stack[this.sp] = NULL;
            return;
          }
          const frame = this.popFrame();
          this.sp = frame.basePointer - 1;
          this.push(NULL);
          break;
        }

        case Opcodes.OpSetLocal: {
          const localIndex = instructions[ip + 1];
          this.currentFrame().ip += 1;
          this.stack[this.currentFrame().basePointer + localIndex] = this.pop();
          break;
        }

        case Opcodes.OpGetLocal: {
          const localIndex = instructions[ip + 1];
          this.currentFrame().ip += 1;
          this.push(this.stack[this.currentFrame().basePointer + localIndex]);
          break;
        }

        case Opcodes.OpGetBuiltin: {
          const builtinIndex = instructions[ip + 1];
          this.currentFrame().ip += 1;
          this.push(builtins[builtinIndex]);
          break;
        }

        case Opcodes.OpClosure: {
          const constIndex = (instructions[ip + 1] << 8) | instructions[ip + 2];
          const numFree = instructions[ip + 3];
          this.currentFrame().ip += 3;
          const fn = this.constants[constIndex];
          const free = [];
          for (let i = this.sp - numFree; i < this.sp; i++) {
            free.push(this.stack[i]);
          }
          this.sp -= numFree;
          this.push(new Closure(fn, free));
          break;
        }

        case Opcodes.OpGetFree: {
          const freeIndex = instructions[ip + 1];
          this.currentFrame().ip += 1;
          this.push(this.currentFrame().closure.free[freeIndex]);
          break;
        }

        case Opcodes.OpCurrentClosure: {
          this.push(this.currentFrame().closure);
          break;
        }

        default:
          throw new Error(`unknown opcode: ${op}`);
      }
    }
  }

  // --- Internal helpers ---

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

  executeBinaryOperation(op) {
    const right = this.pop();
    const left = this.pop();

    if (left instanceof MonkeyInteger && right instanceof MonkeyInteger) {
      this.executeBinaryIntegerOperation(op, left, right);
    } else if (left instanceof MonkeyString && right instanceof MonkeyString) {
      if (op === Opcodes.OpAdd) {
        this.push(new MonkeyString(left.value + right.value));
      } else {
        throw new Error(`unknown string operator: ${op}`);
      }
    } else {
      throw new Error(`unsupported types for binary operation: ${left.type()} ${right.type()}`);
    }
  }

  executeBinaryIntegerOperation(op, left, right) {
    let result;
    switch (op) {
      case Opcodes.OpAdd: result = left.value + right.value; break;
      case Opcodes.OpSub: result = left.value - right.value; break;
      case Opcodes.OpMul: result = left.value * right.value; break;
      case Opcodes.OpDiv: result = Math.trunc(left.value / right.value); break;
      default: throw new Error(`unknown integer operator: ${op}`);
    }
    this.push(new MonkeyInteger(result));
  }

  executeComparison(op) {
    const right = this.pop();
    const left = this.pop();

    if (left instanceof MonkeyInteger && right instanceof MonkeyInteger) {
      switch (op) {
        case Opcodes.OpEqual: this.push(left.value === right.value ? TRUE : FALSE); break;
        case Opcodes.OpNotEqual: this.push(left.value !== right.value ? TRUE : FALSE); break;
        case Opcodes.OpGreaterThan: this.push(left.value > right.value ? TRUE : FALSE); break;
      }
    } else {
      switch (op) {
        case Opcodes.OpEqual: this.push(left === right ? TRUE : FALSE); break;
        case Opcodes.OpNotEqual: this.push(left !== right ? TRUE : FALSE); break;
        default: throw new Error(`unknown operator: ${op} (${left.type()} ${right.type()})`);
      }
    }
  }

  executeIndexExpression(left, index) {
    if (left instanceof MonkeyArray && index instanceof MonkeyInteger) {
      const idx = index.value;
      if (idx < 0 || idx >= left.elements.length) {
        this.push(NULL);
      } else {
        this.push(left.elements[idx]);
      }
    } else if (left instanceof MonkeyHash) {
      const key = left.pairs.get(index) || 
                  // MonkeyHash uses reference keys — need value-based lookup
                  this.hashLookup(left, index);
      this.push(key || NULL);
    } else {
      throw new Error(`index operator not supported: ${left.type()}`);
    }
  }

  hashLookup(hash, key) {
    for (const [k, v] of hash.pairs) {
      if (k instanceof MonkeyInteger && key instanceof MonkeyInteger && k.value === key.value) return v;
      if (k instanceof MonkeyString && key instanceof MonkeyString && k.value === key.value) return v;
      if (k instanceof MonkeyBoolean && key instanceof MonkeyBoolean && k.value === key.value) return v;
      if (k === key) return v;
    }
    return null;
  }

  executeCall(numArgs) {
    const callee = this.stack[this.sp - 1 - numArgs];

    if (callee instanceof Closure) {
      this.callClosure(callee, numArgs);
    } else if (callee instanceof MonkeyBuiltin) {
      this.callBuiltin(callee, numArgs);
    } else {
      throw new Error(`calling non-function: ${callee?.type?.() || typeof callee}`);
    }
  }

  callClosure(closure, numArgs) {
    if (numArgs !== closure.fn.numParameters) {
      throw new Error(`wrong number of arguments: want=${closure.fn.numParameters}, got=${numArgs}`);
    }

    const frame = new Frame(closure, this.sp - numArgs);
    this.pushFrame(frame);
    // Allocate space for locals
    this.sp = frame.basePointer + closure.fn.numLocals;
  }

  callBuiltin(builtin, numArgs) {
    const args = [];
    for (let i = this.sp - numArgs; i < this.sp; i++) {
      args.push(this.stack[i]);
    }
    this.sp -= numArgs + 1; // pop args + function

    const result = builtin.fn(...args);
    this.push(result != null ? result : NULL);
  }

  isTruthy(obj) {
    if (obj instanceof MonkeyBoolean) return obj.value;
    if (obj === NULL) return false;
    return true; // integers are truthy
  }
}
