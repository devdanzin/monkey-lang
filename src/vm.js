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

// Integer cache for common values (-1 to 256)
const INT_CACHE_MIN = -1;
const INT_CACHE_MAX = 256;
const intCache = new Array(INT_CACHE_MAX - INT_CACHE_MIN + 1);
for (let i = INT_CACHE_MIN; i <= INT_CACHE_MAX; i++) {
  intCache[i - INT_CACHE_MIN] = new MonkeyInteger(i);
}

function cachedInteger(value) {
  if (value >= INT_CACHE_MIN && value <= INT_CACHE_MAX && Number.isInteger(value)) {
    return intCache[value - INT_CACHE_MIN];
  }
  return new MonkeyInteger(value);
}

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
    if (arg instanceof MonkeyString) return cachedInteger(arg.value.length);
    if (arg instanceof MonkeyArray) return cachedInteger(arg.elements.length);
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
  // type
  new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return new MonkeyError(`wrong number of arguments. got=${args.length}, want=1`);
    return new MonkeyString(args[0].type());
  }),
  // str (convert to string)
  new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return new MonkeyError(`wrong number of arguments. got=${args.length}, want=1`);
    return new MonkeyString(args[0].inspect());
  }),
  // int (convert to integer)
  new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return new MonkeyError(`wrong number of arguments. got=${args.length}, want=1`);
    const arg = args[0];
    if (arg instanceof MonkeyInteger) return arg;
    if (arg instanceof MonkeyString) {
      const n = parseInt(arg.value, 10);
      return isNaN(n) ? NULL : cachedInteger(n);
    }
    return NULL;
  }),
  // format (string formatting)
  new MonkeyBuiltin((...args) => {
    if (args.length < 1) return new MonkeyError(`format requires at least 1 argument`);
    if (!(args[0] instanceof MonkeyString)) return new MonkeyError(`first argument to format must be a string`);
    let template = args[0].value;
    let argIdx = 1;
    let result = '';
    for (let i = 0; i < template.length; i++) {
      if (template[i] === '%' && i + 1 < template.length) {
        const spec = template[i + 1];
        if (spec === '%') { result += '%'; i++; continue; }
        if (argIdx >= args.length) { result += '%' + spec; i++; continue; }
        const arg = args[argIdx++];
        switch (spec) {
          case 's': result += arg.inspect(); break;
          case 'd': result += arg instanceof MonkeyInteger ? String(arg.value) : arg.inspect(); break;
          default: result += '%' + spec;
        }
        i++;
      } else {
        result += template[i];
      }
    }
    return new MonkeyString(result);
  }),
  // range
  new MonkeyBuiltin((...args) => {
    if (args.length < 1 || args.length > 3) return new MonkeyError(`wrong number of arguments to range. got=${args.length}`);
    let start, end, step;
    if (args.length === 1) {
      start = 0; end = args[0].value; step = 1;
    } else if (args.length === 2) {
      start = args[0].value; end = args[1].value; step = 1;
    } else {
      start = args[0].value; end = args[1].value; step = args[2].value;
    }
    if (step === 0) return new MonkeyError('range step cannot be zero');
    const elements = [];
    if (step > 0) {
      for (let i = start; i < end; i += step) elements.push(cachedInteger(i));
    } else {
      for (let i = start; i > end; i += step) elements.push(cachedInteger(i));
    }
    return new MonkeyArray(elements);
  }),
  // split
  new MonkeyBuiltin((...args) => {
    if (args.length < 1 || args.length > 2) return new MonkeyError(`wrong number of arguments to split. got=${args.length}`);
    if (!(args[0] instanceof MonkeyString)) return new MonkeyError(`argument to split must be STRING, got ${args[0].type()}`);
    const sep = args.length === 2 && args[1] instanceof MonkeyString ? args[1].value : '';
    const parts = sep === '' ? [...args[0].value] : args[0].value.split(sep);
    return new MonkeyArray(parts.map(s => new MonkeyString(s)));
  }),
  // join
  new MonkeyBuiltin((...args) => {
    if (args.length < 1 || args.length > 2) return new MonkeyError(`wrong number of arguments to join. got=${args.length}`);
    if (!(args[0] instanceof MonkeyArray)) return new MonkeyError(`first argument to join must be ARRAY, got ${args[0].type()}`);
    const sep = args.length === 2 && args[1] instanceof MonkeyString ? args[1].value : '';
    const strs = args[0].elements.map(e => e.inspect ? e.inspect() : String(e));
    return new MonkeyString(strs.join(sep));
  }),
  // trim
  new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return new MonkeyError(`wrong number of arguments to trim. got=${args.length}, want=1`);
    if (!(args[0] instanceof MonkeyString)) return new MonkeyError(`argument to trim must be STRING, got ${args[0].type()}`);
    return new MonkeyString(args[0].value.trim());
  }),
  // upper
  new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return new MonkeyError(`wrong number of arguments to upper. got=${args.length}, want=1`);
    if (!(args[0] instanceof MonkeyString)) return new MonkeyError(`argument to upper must be STRING, got ${args[0].type()}`);
    return new MonkeyString(args[0].value.toUpperCase());
  }),
  // lower
  new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return new MonkeyError(`wrong number of arguments to lower. got=${args.length}, want=1`);
    if (!(args[0] instanceof MonkeyString)) return new MonkeyError(`argument to lower must be STRING, got ${args[0].type()}`);
    return new MonkeyString(args[0].value.toLowerCase());
  }),
  // contains
  new MonkeyBuiltin((...args) => {
    if (args.length !== 2) return new MonkeyError(`wrong number of arguments to contains`);
    if (args[0] instanceof MonkeyString && args[1] instanceof MonkeyString) {
      return args[0].value.includes(args[1].value) ? TRUE : FALSE;
    }
    if (args[0] instanceof MonkeyArray) {
      for (const el of args[0].elements) {
        if (el.value !== undefined && args[1].value !== undefined && el.value === args[1].value) return TRUE;
      }
      return FALSE;
    }
    return new MonkeyError(`contains: unsupported types`);
  }),
  // indexOf
  new MonkeyBuiltin((...args) => {
    if (args.length !== 2) return new MonkeyError(`wrong number of arguments to indexOf`);
    if (args[0] instanceof MonkeyString && args[1] instanceof MonkeyString) {
      return new MonkeyInteger(args[0].value.indexOf(args[1].value));
    }
    if (args[0] instanceof MonkeyArray) {
      for (let i = 0; i < args[0].elements.length; i++) {
        if (args[0].elements[i].value !== undefined && args[1].value !== undefined && args[0].elements[i].value === args[1].value) return new MonkeyInteger(i);
      }
      return new MonkeyInteger(-1);
    }
    return new MonkeyError(`indexOf: unsupported types`);
  }),
  // replace
  new MonkeyBuiltin((...args) => {
    if (args.length !== 3) return new MonkeyError('wrong number of arguments to replace');
    if (!(args[0] instanceof MonkeyString) || !(args[1] instanceof MonkeyString) || !(args[2] instanceof MonkeyString))
      return new MonkeyError('replace: all arguments must be STRING');
    return new MonkeyString(args[0].value.split(args[1].value).join(args[2].value));
  }),
  // reverse
  new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return new MonkeyError('wrong number of arguments to reverse');
    if (args[0] instanceof MonkeyArray) return new MonkeyArray([...args[0].elements].reverse());
    if (args[0] instanceof MonkeyString) return new MonkeyString([...args[0].value].reverse().join(''));
    return new MonkeyError(`reverse: unsupported type ${args[0].type()}`);
  }),
  // abs
  new MonkeyBuiltin((...args) => {
    if (args.length !== 1 || !(args[0] instanceof MonkeyInteger)) return new MonkeyError('abs: expected 1 integer');
    return new MonkeyInteger(Math.abs(args[0].value));
  }),
  // min
  new MonkeyBuiltin((...args) => {
    if (args.length < 2) return new MonkeyError('min: expected at least 2 arguments');
    let result = args[0].value;
    for (let i = 1; i < args.length; i++) result = Math.min(result, args[i].value);
    return new MonkeyInteger(result);
  }),
  // max
  new MonkeyBuiltin((...args) => {
    if (args.length < 2) return new MonkeyError('max: expected at least 2 arguments');
    let result = args[0].value;
    for (let i = 1; i < args.length; i++) result = Math.max(result, args[i].value);
    return new MonkeyInteger(result);
  }),
  // startsWith
  new MonkeyBuiltin((...args) => {
    if (args.length !== 2 || !(args[0] instanceof MonkeyString) || !(args[1] instanceof MonkeyString))
      return new MonkeyError('startsWith: expected 2 string arguments');
    return args[0].value.startsWith(args[1].value) ? TRUE : FALSE;
  }),
  // endsWith
  new MonkeyBuiltin((...args) => {
    if (args.length !== 2 || !(args[0] instanceof MonkeyString) || !(args[1] instanceof MonkeyString))
      return new MonkeyError('endsWith: expected 2 string arguments');
    return args[0].value.endsWith(args[1].value) ? TRUE : FALSE;
  }),
  // keys (VM hash format: Map<key, value>)
  new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return new MonkeyError(`wrong number of arguments to keys. got=${args.length}, want=1`);
    if (!(args[0] instanceof MonkeyHash)) return new MonkeyError(`argument to keys must be HASH, got ${args[0].type()}`);
    const ks = [];
    for (const [k] of args[0].pairs) ks.push(k);
    return new MonkeyArray(ks);
  }),
  // values (VM hash format: Map<key, value>)
  new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return new MonkeyError(`wrong number of arguments to values. got=${args.length}, want=1`);
    if (!(args[0] instanceof MonkeyHash)) return new MonkeyError(`argument to values must be HASH, got ${args[0].type()}`);
    const vs = [];
    for (const [, v] of args[0].pairs) vs.push(v);
    return new MonkeyArray(vs);
  }),
  // sort (default, no comparator in VM)
  new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return new MonkeyError(`wrong number of arguments to sort. got=${args.length} (VM sort only supports default sort)`);
    if (!(args[0] instanceof MonkeyArray)) return new MonkeyError(`argument to sort must be ARRAY, got ${args[0].type()}`);
    const sorted = [...args[0].elements];
    sorted.sort((a, b) => {
      if (a.value < b.value) return -1;
      if (a.value > b.value) return 1;
      return 0;
    });
    return new MonkeyArray(sorted);
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
        case Opcodes.OpDiv:
        case Opcodes.OpMod: {
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
          this.push(cachedInteger(-operand.value));
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

        case Opcodes.OpTailCall: {
          const numArgs = instructions[ip + 1];
          this.currentFrame().ip += 1;
          const callee = this.stack[this.sp - 1 - numArgs];

          if (callee instanceof Closure) {
            if (numArgs !== callee.fn.numParameters) {
              throw new Error(`wrong number of arguments: want=${callee.fn.numParameters}, got=${numArgs}`);
            }
            // Tail call optimization: reuse current frame
            const frame = this.currentFrame();
            // Move arguments to current frame's base position
            const argStart = this.sp - numArgs;
            for (let i = 0; i < numArgs; i++) {
              this.stack[frame.basePointer + i] = this.stack[argStart + i];
            }
            // Reset stack pointer to base + numLocals
            this.sp = frame.basePointer + callee.fn.numLocals;
            // Update frame to point to new closure
            frame.closure = callee;
            frame.ip = -1; // Will be incremented to 0 by main loop
          } else if (callee instanceof MonkeyBuiltin) {
            // Builtins can't be tail-call optimized, fall through to normal call
            this.callBuiltin(callee, numArgs);
          } else {
            throw new Error(`calling non-function: ${callee?.type?.() || typeof callee}`);
          }
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
    } else if (left instanceof MonkeyString && right instanceof MonkeyInteger && op === Opcodes.OpMul) {
      this.push(new MonkeyString(left.value.repeat(Math.max(0, right.value))));
    } else if (left instanceof MonkeyInteger && right instanceof MonkeyString && op === Opcodes.OpMul) {
      this.push(new MonkeyString(right.value.repeat(Math.max(0, left.value))));
    } else if (left instanceof MonkeyArray && right instanceof MonkeyArray && op === Opcodes.OpAdd) {
      this.push(new MonkeyArray([...left.elements, ...right.elements]));
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
      case Opcodes.OpMod: result = left.value % right.value; break;
      default: throw new Error(`unknown integer operator: ${op}`);
    }
    this.push(cachedInteger(result));
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
    } else if (left instanceof MonkeyString && right instanceof MonkeyString) {
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
      let idx = index.value;
      if (idx < 0) idx = left.elements.length + idx; // negative indexing
      if (idx < 0 || idx >= left.elements.length) {
        this.push(NULL);
      } else {
        this.push(left.elements[idx]);
      }
    } else if (left instanceof MonkeyString && index instanceof MonkeyInteger) {
      let idx = index.value;
      if (idx < 0) idx = left.value.length + idx; // negative indexing
      if (idx < 0 || idx >= left.value.length) {
        this.push(NULL);
      } else {
        this.push(new MonkeyString(left.value[idx]));
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
