// ===== Stack-Based Bytecode VM =====
//
// Opcodes:
//   CONST <idx>      - push constant from constant pool
//   ADD, SUB, MUL, DIV, MOD - arithmetic (pop 2, push 1)
//   EQ, NE, LT, GT, LE, GE - comparison (pop 2, push bool)
//   AND, OR, NOT     - logical
//   JUMP <addr>      - unconditional jump
//   JUMP_IF_FALSE <addr> - pop, jump if falsy
//   LOAD <idx>       - push local variable
//   STORE <idx>      - pop into local variable
//   CALL <nargs>     - call function (pop fn + nargs, push result frame)
//   RETURN           - return from function
//   CLOSURE <addr> <nfree> - create closure capturing free variables
//   GET_FREE <idx>   - get captured variable from closure
//   POP              - discard top of stack
//   PRINT            - pop and print
//   HALT             - stop execution

export const Op = {
  CONST: 0,
  ADD: 1, SUB: 2, MUL: 3, DIV: 4, MOD: 5,
  EQ: 6, NE: 7, LT: 8, GT: 9, LE: 10, GE: 11,
  AND: 12, OR: 13, NOT: 14,
  JUMP: 15, JUMP_IF_FALSE: 16,
  LOAD: 17, STORE: 18,
  CALL: 19, RETURN: 20,
  CLOSURE: 21, GET_FREE: 22,
  POP: 23, PRINT: 24, HALT: 25,
  NEGATE: 26,
  // New: Array and string ops
  ARRAY: 27,      // ARRAY <n> — pop n elements, push array
  INDEX: 28,      // INDEX — pop index, pop array/string, push element
  SET_INDEX: 29,  // SET_INDEX — pop value, pop index, pop array, push modified array
  LEN: 30,        // LEN — pop array/string, push length
  PUSH: 31,       // PUSH — pop value, pop array, push extended array
  CONCAT: 32,     // CONCAT — pop 2, push concatenated array/string
  SLICE: 33,      // SLICE — pop end, pop start, pop array, push slice
  LOAD_GLOBAL: 34, // LOAD_GLOBAL <idx> — push global variable
  STORE_GLOBAL: 35, // STORE_GLOBAL <idx> — pop into global
  DUP: 36,        // DUP — duplicate top of stack
};

const opNames = Object.fromEntries(Object.entries(Op).map(([k, v]) => [v, k]));

export class Chunk {
  constructor() {
    this.code = [];       // bytecode instructions
    this.constants = [];  // constant pool
  }
  
  emit(op, ...args) {
    const offset = this.code.length;
    this.code.push(op, ...args);
    return offset;
  }
  
  addConstant(value) {
    const idx = this.constants.length;
    this.constants.push(value);
    return idx;
  }
  
  // Patch a jump target
  patchJump(offset) {
    this.code[offset + 1] = this.code.length;
  }
  
  disassemble() {
    const lines = [];
    let i = 0;
    while (i < this.code.length) {
      const op = this.code[i];
      const name = opNames[op] || `UNKNOWN(${op})`;
      
      switch (op) {
        case Op.CONST:
        case Op.LOAD:
        case Op.STORE:
        case Op.CALL:
        case Op.GET_FREE:
        case Op.ARRAY:
        case Op.LOAD_GLOBAL:
        case Op.STORE_GLOBAL:
          lines.push(`${i.toString().padStart(4)}: ${name} ${this.code[i + 1]}`);
          i += 2;
          break;
        case Op.JUMP:
        case Op.JUMP_IF_FALSE:
          lines.push(`${i.toString().padStart(4)}: ${name} -> ${this.code[i + 1]}`);
          i += 2;
          break;
        case Op.CLOSURE:
          lines.push(`${i.toString().padStart(4)}: ${name} addr=${this.code[i + 1]} nfree=${this.code[i + 2]}`);
          i += 3;
          break;
        default:
          lines.push(`${i.toString().padStart(4)}: ${name}`);
          i += 1;
      }
    }
    return lines.join('\n');
  }
}

// ===== Closure value for the VM =====
class Closure {
  constructor(addr, freeVars) {
    this.addr = addr;
    this.freeVars = freeVars;
  }
}

// ===== Call Frame =====
class Frame {
  constructor(returnAddr, prevBP, fnStackPos, closure) {
    this.returnAddr = returnAddr;
    this.prevBP = prevBP;       // previous base pointer
    this.fnStackPos = fnStackPos; // position of fn on stack (for cleanup)
    this.closure = closure;
  }
}

// ===== Virtual Machine =====
export class VM {
  constructor(chunk) {
    this.chunk = chunk;
    this.stack = [];
    this.frames = [];
    this.ip = 0;
    this.bp = 0; // base pointer for local variables
    this.maxSteps = 100000;
    this.globals = {}; // global variables
  }
  
  push(value) { this.stack.push(value); }
  pop() { return this.stack.pop(); }
  peek() { return this.stack[this.stack.length - 1]; }
  
  run() {
    let steps = 0;
    
    while (this.ip < this.chunk.code.length && steps++ < this.maxSteps) {
      const op = this.chunk.code[this.ip++];
      
      switch (op) {
        case Op.CONST: {
          const idx = this.chunk.code[this.ip++];
          this.push(this.chunk.constants[idx]);
          break;
        }
        
        case Op.ADD: { const b = this.pop(), a = this.pop(); this.push(a + b); break; }
        case Op.SUB: { const b = this.pop(), a = this.pop(); this.push(a - b); break; }
        case Op.MUL: { const b = this.pop(), a = this.pop(); this.push(a * b); break; }
        case Op.DIV: { const b = this.pop(), a = this.pop(); this.push(Math.trunc(a / b)); break; }
        case Op.MOD: { const b = this.pop(), a = this.pop(); this.push(a % b); break; }
        case Op.NEGATE: { this.push(-this.pop()); break; }
        
        case Op.EQ: { const b = this.pop(), a = this.pop(); this.push(a === b); break; }
        case Op.NE: { const b = this.pop(), a = this.pop(); this.push(a !== b); break; }
        case Op.LT: { const b = this.pop(), a = this.pop(); this.push(a < b); break; }
        case Op.GT: { const b = this.pop(), a = this.pop(); this.push(a > b); break; }
        case Op.LE: { const b = this.pop(), a = this.pop(); this.push(a <= b); break; }
        case Op.GE: { const b = this.pop(), a = this.pop(); this.push(a >= b); break; }
        
        case Op.AND: { const b = this.pop(), a = this.pop(); this.push(a && b); break; }
        case Op.OR: { const b = this.pop(), a = this.pop(); this.push(a || b); break; }
        case Op.NOT: { this.push(!this.pop()); break; }
        
        case Op.JUMP: {
          this.ip = this.chunk.code[this.ip];
          break;
        }
        
        case Op.JUMP_IF_FALSE: {
          const target = this.chunk.code[this.ip++];
          if (!this.pop()) this.ip = target;
          break;
        }
        
        case Op.LOAD: {
          const idx = this.chunk.code[this.ip++];
          this.push(this.stack[this.bp + idx]);
          break;
        }
        
        case Op.STORE: {
          const idx = this.chunk.code[this.ip++];
          this.stack[this.bp + idx] = this.pop();
          break;
        }
        
        case Op.CLOSURE: {
          const addr = this.chunk.code[this.ip++];
          const nfree = this.chunk.code[this.ip++];
          const freeVars = [];
          for (let i = 0; i < nfree; i++) freeVars.push(this.pop());
          this.push(new Closure(addr, freeVars));
          break;
        }
        
        case Op.GET_FREE: {
          const idx = this.chunk.code[this.ip++];
          const frame = this.frames[this.frames.length - 1];
          this.push(frame.closure.freeVars[idx]);
          break;
        }
        
        case Op.CALL: {
          const nargs = this.chunk.code[this.ip++];
          const fnIdx = this.stack.length - 1 - nargs;
          const fn = this.stack[fnIdx];
          
          if (fn instanceof Closure) {
            this.frames.push(new Frame(this.ip, this.bp, fnIdx, fn));
            this.bp = fnIdx + 1;
            this.ip = fn.addr;
          } else if (typeof fn === 'function') {
            const args = [];
            for (let i = 0; i < nargs; i++) args.unshift(this.pop());
            this.pop(); // pop the function
            this.push(fn(...args));
          } else {
            throw new Error(`Cannot call non-function: ${fn}`);
          }
          break;
        }
        
        case Op.RETURN: {
          const result = this.pop();
          const frame = this.frames.pop();
          this.stack.length = frame.fnStackPos; // clean up fn + args
          this.push(result);
          this.ip = frame.returnAddr;
          this.bp = frame.prevBP;
          break;
        }
        
        case Op.POP: { this.pop(); break; }
        
        case Op.PRINT: {
          const val = this.pop();
          console.log(val);
          this.push(val);
          break;
        }
        
        case Op.HALT: return this.peek();
        
        // ===== Array and String Operations =====
        case Op.ARRAY: {
          const n = this.chunk.code[this.ip++];
          const arr = [];
          for (let i = 0; i < n; i++) arr.unshift(this.pop());
          this.push(arr);
          break;
        }
        
        case Op.INDEX: {
          const idx = this.pop();
          const obj = this.pop();
          if (typeof obj === 'string') {
            this.push(obj[idx] ?? null);
          } else if (Array.isArray(obj)) {
            this.push(obj[idx] ?? null);
          } else {
            throw new Error(`Cannot index into ${typeof obj}`);
          }
          break;
        }
        
        case Op.SET_INDEX: {
          const val = this.pop();
          const idx = this.pop();
          const arr = this.pop();
          if (!Array.isArray(arr)) throw new Error('SET_INDEX requires array');
          const newArr = [...arr];
          newArr[idx] = val;
          this.push(newArr);
          break;
        }
        
        case Op.LEN: {
          const obj = this.pop();
          if (typeof obj === 'string' || Array.isArray(obj)) {
            this.push(obj.length);
          } else {
            throw new Error(`Cannot get length of ${typeof obj}`);
          }
          break;
        }
        
        case Op.PUSH: {
          const val = this.pop();
          const arr = this.pop();
          if (!Array.isArray(arr)) throw new Error('PUSH requires array');
          this.push([...arr, val]);
          break;
        }
        
        case Op.CONCAT: {
          const b = this.pop(), a = this.pop();
          if (Array.isArray(a) && Array.isArray(b)) {
            this.push([...a, ...b]);
          } else if (typeof a === 'string' && typeof b === 'string') {
            this.push(a + b);
          } else {
            this.push(String(a) + String(b));
          }
          break;
        }
        
        case Op.SLICE: {
          const end = this.pop();
          const start = this.pop();
          const obj = this.pop();
          this.push(obj.slice(start, end));
          break;
        }
        
        case Op.LOAD_GLOBAL: {
          const idx = this.chunk.code[this.ip++];
          const name = this.chunk.constants[idx];
          if (this.globals && name in this.globals) {
            this.push(this.globals[name]);
          } else {
            throw new Error(`Undefined global: ${name}`);
          }
          break;
        }
        
        case Op.STORE_GLOBAL: {
          const idx = this.chunk.code[this.ip++];
          const name = this.chunk.constants[idx];
          if (!this.globals) this.globals = {};
          this.globals[name] = this.pop();
          break;
        }
        
        case Op.DUP: {
          this.push(this.peek());
          break;
        }
        
        default:
          throw new Error(`Unknown opcode: ${op} at ip=${this.ip - 1}`);
      }
    }
    
    if (steps >= this.maxSteps) throw new Error('Max steps exceeded');
    return this.peek();
  }
}

// ===== Simple Compiler =====
// Compiles a simple expression AST to bytecode

export class Compiler {
  constructor() {
    this.chunk = new Chunk();
    this.scopes = [new Map()]; // stack of variable scopes
    this.localCount = [0];
  }
  
  _currentScope() { return this.scopes[this.scopes.length - 1]; }
  
  _pushScope() {
    this.scopes.push(new Map());
    this.localCount.push(this.localCount[this.localCount.length - 1]);
  }
  
  _popScope() {
    this.scopes.pop();
    this.localCount.pop();
  }
  
  _defineLocal(name) {
    const idx = this.localCount[this.localCount.length - 1]++;
    this._currentScope().set(name, idx);
    return idx;
  }
  
  _resolveLocal(name) {
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      if (this.scopes[i].has(name)) return this.scopes[i].get(name);
    }
    return null;
  }
  
  compile(expr) {
    this._compileExpr(expr);
    this.chunk.emit(Op.HALT);
    return this.chunk;
  }
  
  _compileExpr(expr) {
    switch (expr.tag) {
      case 'lit': {
        const idx = this.chunk.addConstant(expr.value);
        this.chunk.emit(Op.CONST, idx);
        break;
      }
      
      case 'var': {
        const local = this._resolveLocal(expr.name);
        if (local !== null) {
          this.chunk.emit(Op.LOAD, local);
        } else {
          throw new Error(`Undefined variable: ${expr.name}`);
        }
        break;
      }
      
      case 'binop': {
        this._compileExpr(expr.left);
        this._compileExpr(expr.right);
        const opMap = {
          '+': Op.ADD, '-': Op.SUB, '*': Op.MUL, '/': Op.DIV, '%': Op.MOD,
          '==': Op.EQ, '!=': Op.NE, '<': Op.LT, '>': Op.GT, '<=': Op.LE, '>=': Op.GE,
          '&&': Op.AND, '||': Op.OR,
        };
        this.chunk.emit(opMap[expr.op]);
        break;
      }
      
      case 'if': {
        this._compileExpr(expr.cond);
        const jumpFalse = this.chunk.emit(Op.JUMP_IF_FALSE, 0);
        this._compileExpr(expr.then);
        const jumpEnd = this.chunk.emit(Op.JUMP, 0);
        this.chunk.patchJump(jumpFalse);
        this._compileExpr(expr.else);
        this.chunk.patchJump(jumpEnd);
        break;
      }
      
      case 'let': {
        this._compileExpr(expr.value);
        const idx = this._defineLocal(expr.name);
        this.chunk.emit(Op.STORE, idx);
        this._compileExpr(expr.body);
        break;
      }
      
      case 'lam': {
        // Compile function body to a separate section
        const jumpOver = this.chunk.emit(Op.JUMP, 0);
        const fnAddr = this.chunk.code.length;
        
        this._pushScope();
        this._defineLocal(expr.param);
        this._compileExpr(expr.body);
        this.chunk.emit(Op.RETURN);
        this._popScope();
        
        this.chunk.patchJump(jumpOver);
        
        // Create closure
        this.chunk.emit(Op.CLOSURE, fnAddr, 0); // 0 free vars for now
        break;
      }
      
      case 'app': {
        this._compileExpr(expr.fn);
        this._compileExpr(expr.arg);
        this.chunk.emit(Op.CALL, 1);
        break;
      }
      
      case 'arr': {
        for (const el of expr.elements) {
          this._compileExpr(el);
        }
        this.chunk.emit(Op.ARRAY, expr.elements.length);
        break;
      }
      
      case 'idx': {
        this._compileExpr(expr.obj);
        this._compileExpr(expr.index);
        this.chunk.emit(Op.INDEX);
        break;
      }
      
      case 'len': {
        this._compileExpr(expr.obj);
        this.chunk.emit(Op.LEN);
        break;
      }
      
      case 'push': {
        this._compileExpr(expr.arr);
        this._compileExpr(expr.value);
        this.chunk.emit(Op.PUSH);
        break;
      }
      
      case 'concat': {
        this._compileExpr(expr.left);
        this._compileExpr(expr.right);
        this.chunk.emit(Op.CONCAT);
        break;
      }
      
      case 'slice': {
        this._compileExpr(expr.obj);
        this._compileExpr(expr.start);
        this._compileExpr(expr.end);
        this.chunk.emit(Op.SLICE);
        break;
      }
      
      default:
        throw new Error(`Cannot compile expression: ${expr.tag}`);
    }
  }
}

// Convenience: compile and run
export function evaluate(expr) {
  const compiler = new Compiler();
  const chunk = compiler.compile(expr);
  const vm = new VM(chunk);
  return vm.run();
}
