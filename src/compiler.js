// compiler.js — Monkey Bytecode Compiler
// Walks the AST and emits bytecode instructions.

import { Opcodes, make } from './code.js';
import * as AST from './ast.js';
import { MonkeyInteger, MonkeyString } from './object.js';

/**
 * Bytecode: the output of the compiler.
 * - instructions: Uint8Array of bytecodes
 * - constants: Array of constant values (MonkeyObject instances)
 */
export class Bytecode {
  constructor(instructions, constants) {
    this.instructions = instructions;
    this.constants = constants;
  }
}

/**
 * CompilationScope: tracks instructions and scoping for nested compilation
 * (e.g., function bodies).
 */
class CompilationScope {
  constructor() {
    this.instructions = new Uint8Array(0);
    this.lastInstruction = { opcode: -1, position: -1 };
    this.previousInstruction = { opcode: -1, position: -1 };
  }
}

/**
 * SymbolScope constants
 */
export const SymbolScopes = {
  GLOBAL: 'GLOBAL',
  LOCAL: 'LOCAL',
  BUILTIN: 'BUILTIN',
  FREE: 'FREE',
  FUNCTION: 'FUNCTION',
};

/**
 * Symbol: represents a named binding.
 */
export class Symbol {
  constructor(name, scope, index) {
    this.name = name;
    this.scope = scope;
    this.index = index;
  }
}

/**
 * SymbolTable: maps identifier names to symbols.
 */
export class SymbolTable {
  constructor(outer = null) {
    this.outer = outer;
    this.store = new Map();
    this.numDefinitions = 0;
    this.freeSymbols = [];
  }

  define(name) {
    const scope = this.outer ? SymbolScopes.LOCAL : SymbolScopes.GLOBAL;
    const sym = new Symbol(name, scope, this.numDefinitions);
    this.store.set(name, sym);
    this.numDefinitions++;
    return sym;
  }

  defineBuiltin(index, name) {
    const sym = new Symbol(name, SymbolScopes.BUILTIN, index);
    this.store.set(name, sym);
    return sym;
  }

  defineFunctionName(name) {
    const sym = new Symbol(name, SymbolScopes.FUNCTION, 0);
    this.store.set(name, sym);
    return sym;
  }

  defineFree(original) {
    this.freeSymbols.push(original);
    const sym = new Symbol(original.name, SymbolScopes.FREE, this.freeSymbols.length - 1);
    this.store.set(original.name, sym);
    return sym;
  }

  resolve(name) {
    let sym = this.store.get(name);
    if (sym) return sym;

    if (this.outer) {
      sym = this.outer.resolve(name);
      if (!sym) return null;

      // Builtins and globals are accessible from any scope
      if (sym.scope === SymbolScopes.GLOBAL || sym.scope === SymbolScopes.BUILTIN) {
        return sym;
      }

      // Local from outer scope → free variable
      return this.defineFree(sym);
    }

    return null;
  }
}

// Builtin function names (must match evaluator's builtin order)
const builtinNames = ['len', 'first', 'last', 'rest', 'push', 'puts', 'type', 'str', 'int', 'format', 'range', 'split', 'join', 'trim', 'upper', 'lower', 'contains', 'indexOf', 'replace', 'reverse', 'abs', 'min', 'max', 'keys', 'values', 'sort'];

/**
 * Compiler: walks the AST and produces Bytecode.
 */
export class Compiler {
  constructor() {
    this.constants = [];
    this.symbolTable = new SymbolTable();
    this.scopes = [new CompilationScope()];
    this.scopeIndex = 0;
    this.inFunction = false; // Track if we're compiling inside a function body

    // Register builtins
    for (let i = 0; i < builtinNames.length; i++) {
      this.symbolTable.defineBuiltin(i, builtinNames[i]);
    }
  }

  /**
   * Compile an AST node. Returns void; use bytecode() to get result.
   */
  compile(node) {
    if (node instanceof AST.Program) {
      for (const stmt of node.statements) {
        this.compile(stmt);
      }
    } else if (node instanceof AST.ExpressionStatement) {
      this.compile(node.expression);
      this.emit(Opcodes.OpPop);
    } else if (node instanceof AST.InfixExpression) {
      // Constant folding: evaluate constant expressions at compile time
      const folded = this.tryConstantFold(node);
      if (folded !== null) {
        this.emit(Opcodes.OpConstant, this.addConstant(folded));
        return;
      }
      // Special handling for '<': compile as '>' with swapped operands
      if (node.operator === '<') {
        this.compile(node.right);
        this.compile(node.left);
        this.emit(Opcodes.OpGreaterThan);
        return;
      }
      // >= is NOT (right > left), i.e., NOT (a < b)
      if (node.operator === '>=') {
        this.compile(node.right);
        this.compile(node.left);
        this.emit(Opcodes.OpGreaterThan);
        this.emit(Opcodes.OpBang);
        return;
      }
      // && (logical AND with short-circuit)
      if (node.operator === '&&') {
        this.compile(node.left);
        const jumpPos = this.emit(Opcodes.OpJumpNotTruthy, 9999);
        this.emit(Opcodes.OpPop);
        this.compile(node.right);
        const endPos = this.emit(Opcodes.OpJump, 9999);
        this.changeOperand(jumpPos, this.currentInstructions().length);
        this.emit(Opcodes.OpFalse);
        this.changeOperand(endPos, this.currentInstructions().length);
        return;
      }
      // || (logical OR with short-circuit)
      if (node.operator === '||') {
        this.compile(node.left);
        const jumpNotPos = this.emit(Opcodes.OpJumpNotTruthy, 9999);
        this.emit(Opcodes.OpPop);
        this.emit(Opcodes.OpTrue);
        const jumpEnd = this.emit(Opcodes.OpJump, 9999);
        this.changeOperand(jumpNotPos, this.currentInstructions().length);
        this.emit(Opcodes.OpPop);
        this.compile(node.right);
        this.changeOperand(jumpEnd, this.currentInstructions().length);
        return;
      }
      // <= is NOT (left > right)
      if (node.operator === '<=') {
        this.compile(node.left);
        this.compile(node.right);
        this.emit(Opcodes.OpGreaterThan);
        this.emit(Opcodes.OpBang);
        return;
      }
      this.compile(node.left);
      this.compile(node.right);
      switch (node.operator) {
        case '+': this.emit(Opcodes.OpAdd); break;
        case '-': this.emit(Opcodes.OpSub); break;
        case '*': this.emit(Opcodes.OpMul); break;
        case '/': this.emit(Opcodes.OpDiv); break;
        case '%': this.emit(Opcodes.OpMod); break;
        case '>': this.emit(Opcodes.OpGreaterThan); break;
        case '==': this.emit(Opcodes.OpEqual); break;
        case '!=': this.emit(Opcodes.OpNotEqual); break;
        default: throw new Error(`unknown operator: ${node.operator}`);
      }
    } else if (node instanceof AST.PrefixExpression) {
      // Constant folding for prefix
      const folded = this.tryConstantFoldPrefix(node);
      if (folded !== null) {
        this.emit(Opcodes.OpConstant, this.addConstant(folded));
        return;
      }
      this.compile(node.right);
      switch (node.operator) {
        case '-': this.emit(Opcodes.OpMinus); break;
        case '!': this.emit(Opcodes.OpBang); break;
        default: throw new Error(`unknown prefix operator: ${node.operator}`);
      }
    } else if (node instanceof AST.IntegerLiteral) {
      const integer = new MonkeyInteger(node.value);
      this.emit(Opcodes.OpConstant, this.addConstant(integer));
    } else if (node instanceof AST.BooleanLiteral) {
      this.emit(node.value ? Opcodes.OpTrue : Opcodes.OpFalse);
    } else if (node instanceof AST.StringLiteral) {
      const str = new MonkeyString(node.value);
      this.emit(Opcodes.OpConstant, this.addConstant(str));
    } else if (node instanceof AST.IfExpression) {
      this.compile(node.condition);
      // Emit jump-not-truthy with placeholder offset
      const jumpNotTruthyPos = this.emit(Opcodes.OpJumpNotTruthy, 9999);
      this.compile(node.consequence);
      if (this.lastInstructionIs(Opcodes.OpPop)) {
        this.removeLastPop();
      }
      // Emit jump to skip alternative
      const jumpPos = this.emit(Opcodes.OpJump, 9999);
      // Patch the jump-not-truthy
      this.changeOperand(jumpNotTruthyPos, this.currentInstructions().length);
      if (node.alternative) {
        this.compile(node.alternative);
        if (this.lastInstructionIs(Opcodes.OpPop)) {
          this.removeLastPop();
        }
      } else {
        this.emit(Opcodes.OpNull);
      }
      // Patch the jump
      this.changeOperand(jumpPos, this.currentInstructions().length);
    } else if (node instanceof AST.BlockStatement) {
      for (const stmt of node.statements) {
        this.compile(stmt);
        // Dead code elimination: stop after return
        if (this.lastInstructionIs(Opcodes.OpReturnValue) || this.lastInstructionIs(Opcodes.OpReturn)) {
          break;
        }
      }
    } else if (node instanceof AST.WhileExpression) {
      const loopStart = this.currentInstructions().length;
      this.compile(node.condition);
      const exitJump = this.emit(Opcodes.OpJumpNotTruthy, 9999);
      this.compile(node.body);
      if (this.lastInstructionIs(Opcodes.OpPop)) {
        this.removeLastPop();
      }
      // Jump back to loop start
      this.emit(Opcodes.OpJump, loopStart);
      // Patch exit jump
      this.changeOperand(exitJump, this.currentInstructions().length);
      // While loop evaluates to null when condition is false
      this.emit(Opcodes.OpNull);
    } else if (node instanceof AST.DoWhileExpression) {
      const loopStart = this.currentInstructions().length;
      this.compile(node.body);
      if (this.lastInstructionIs(Opcodes.OpPop)) {
        this.removeLastPop();
      }
      // Condition at end
      this.compile(node.condition);
      // If truthy, jump back to start
      this.emit(Opcodes.OpJumpNotTruthy, this.currentInstructions().length + 4);
      this.emit(Opcodes.OpJump, loopStart);
      // Evaluate to null
      this.emit(Opcodes.OpNull);
    } else if (node instanceof AST.ForExpression) {
      // Compile init
      this.compile(node.init);
      const loopStart = this.currentInstructions().length;
      // Compile condition
      this.compile(node.condition);
      const exitJump = this.emit(Opcodes.OpJumpNotTruthy, 9999);
      // Compile body
      this.compile(node.body);
      if (this.lastInstructionIs(Opcodes.OpPop)) {
        this.removeLastPop();
      }
      // Compile update
      this.compile(node.update);
      // Jump back to condition
      this.emit(Opcodes.OpJump, loopStart);
      // Patch exit
      this.changeOperand(exitJump, this.currentInstructions().length);
      this.emit(Opcodes.OpNull);
    } else if (node instanceof AST.LetStatement) {
      // Compile value BEFORE defining symbol, so RHS references resolve
      // to outer scope (not the new binding being created).
      // Exception: if RHS is a function literal, set its name for self-reference
      // (enables recursion: let fib = fn(x) { fib(x-1) })
      if (node.value instanceof AST.FunctionLiteral && !node.value.name) {
        node.value.name = node.name.value;
      }
      this.compile(node.value);
      const sym = this.symbolTable.define(node.name.value);
      if (sym.scope === SymbolScopes.GLOBAL) {
        this.emit(Opcodes.OpSetGlobal, sym.index);
      } else {
        this.emit(Opcodes.OpSetLocal, sym.index);
      }
    } else if (node instanceof AST.SetStatement) {
      // Set mutates an existing variable
      const sym = this.symbolTable.resolve(node.name.value);
      if (!sym) throw new Error(`undefined variable: ${node.name.value}`);
      this.compile(node.value);
      if (sym.scope === SymbolScopes.GLOBAL) {
        this.emit(Opcodes.OpSetGlobal, sym.index);
      } else if (sym.scope === SymbolScopes.LOCAL) {
        this.emit(Opcodes.OpSetLocal, sym.index);
      } else {
        throw new Error(`cannot set ${sym.scope} variable: ${node.name.value}`);
      }
    } else if (node instanceof AST.Identifier) {
      const sym = this.symbolTable.resolve(node.value);
      if (!sym) throw new Error(`undefined variable: ${node.value}`);
      this.loadSymbol(sym);
    } else if (node instanceof AST.ArrayLiteral) {
      for (const el of node.elements) {
        this.compile(el);
      }
      this.emit(Opcodes.OpArray, node.elements.length);
    } else if (node instanceof AST.HashLiteral) {
      // Sort keys for deterministic ordering
      const pairs = [...node.pairs];
      for (const [key, value] of pairs) {
        this.compile(key);
        this.compile(value);
      }
      this.emit(Opcodes.OpHash, pairs.length * 2);
    } else if (node instanceof AST.IndexExpression) {
      this.compile(node.left);
      this.compile(node.index);
      this.emit(Opcodes.OpIndex);
    } else if (node instanceof AST.FunctionLiteral) {
      this.enterScope();
      if (node.name) {
        this.symbolTable.defineFunctionName(node.name);
      }
      for (const param of node.parameters) {
        this.symbolTable.define(param.value);
      }
      this.compile(node.body);
      if (this.lastInstructionIs(Opcodes.OpPop)) {
        this.replaceLastPopWithReturn();
      }
      if (!this.lastInstructionIs(Opcodes.OpReturnValue)) {
        this.emit(Opcodes.OpReturn);
      }
      const freeSymbols = this.symbolTable.freeSymbols;
      const numLocals = this.symbolTable.numDefinitions;
      const instructions = this.leaveScope();

      // Peephole optimization: replace OpCall + OpReturnValue with OpTailCall + OpReturnValue
      this.optimizeTailCalls(instructions);

      for (const sym of freeSymbols) {
        this.loadSymbol(sym);
      }

      const compiledFn = new CompiledFunction(instructions, numLocals, node.parameters.length);
      this.emit(Opcodes.OpClosure, this.addConstant(compiledFn), freeSymbols.length);
    } else if (node instanceof AST.ReturnStatement) {
      this.compile(node.returnValue);
      this.emit(Opcodes.OpReturnValue);
    } else if (node instanceof AST.CallExpression) {
      this.compile(node.function);
      for (const arg of node.arguments) {
        this.compile(arg);
      }
      this.emit(Opcodes.OpCall, node.arguments.length);
    }
  }

  /**
   * Get the compiled bytecode.
   */
  bytecode() {
    return new Bytecode(this.currentInstructions(), this.constants);
  }

  // --- Internal helpers ---

  addConstant(obj) {
    this.constants.push(obj);
    return this.constants.length - 1;
  }

  emit(op, ...operands) {
    const ins = make(op, ...operands);
    const pos = this.addInstruction(ins);
    this.setLastInstruction(op, pos);
    return pos;
  }

  addInstruction(ins) {
    const scope = this.scopes[this.scopeIndex];
    const pos = scope.instructions.length;
    const newIns = new Uint8Array(pos + ins.length);
    newIns.set(scope.instructions);
    newIns.set(ins, pos);
    scope.instructions = newIns;
    return pos;
  }

  setLastInstruction(op, pos) {
    const scope = this.scopes[this.scopeIndex];
    scope.previousInstruction = { ...scope.lastInstruction };
    scope.lastInstruction = { opcode: op, position: pos };
  }

  lastInstructionIs(op) {
    return this.scopes[this.scopeIndex].lastInstruction.opcode === op;
  }

  removeLastPop() {
    const scope = this.scopes[this.scopeIndex];
    scope.instructions = scope.instructions.slice(0, scope.lastInstruction.position);
    scope.lastInstruction = { ...scope.previousInstruction };
  }

  replaceLastPopWithReturn() {
    const scope = this.scopes[this.scopeIndex];
    const pos = scope.lastInstruction.position;
    scope.instructions[pos] = Opcodes.OpReturnValue;
    scope.lastInstruction.opcode = Opcodes.OpReturnValue;
  }

  changeOperand(pos, operand) {
    const scope = this.scopes[this.scopeIndex];
    const op = scope.instructions[pos];
    const newInstruction = make(op, operand);
    for (let i = 0; i < newInstruction.length; i++) {
      scope.instructions[pos + i] = newInstruction[i];
    }
  }

  currentInstructions() {
    return this.scopes[this.scopeIndex].instructions;
  }

  enterScope() {
    this.scopes.push(new CompilationScope());
    this.scopeIndex++;
    this.symbolTable = new SymbolTable(this.symbolTable);
  }

  leaveScope() {
    const instructions = this.currentInstructions();
    this.scopes.pop();
    this.scopeIndex--;
    this.symbolTable = this.symbolTable.outer;
    return instructions;
  }

  /**
   * Peephole optimization: replace OpCall + OpReturnValue with OpTailCall + OpReturnValue.
   * This enables the VM to reuse the current frame instead of pushing a new one.
   */
  optimizeTailCalls(instructions) {
    for (let i = 0; i < instructions.length - 2; i++) {
      if (instructions[i] === Opcodes.OpCall && instructions[i + 2] === Opcodes.OpReturnValue) {
        instructions[i] = Opcodes.OpTailCall;
      }
    }
  }

  loadSymbol(sym) {
    switch (sym.scope) {
      case SymbolScopes.GLOBAL: this.emit(Opcodes.OpGetGlobal, sym.index); break;
      case SymbolScopes.LOCAL: this.emit(Opcodes.OpGetLocal, sym.index); break;
      case SymbolScopes.BUILTIN: this.emit(Opcodes.OpGetBuiltin, sym.index); break;
      case SymbolScopes.FREE: this.emit(Opcodes.OpGetFree, sym.index); break;
      case SymbolScopes.FUNCTION: this.emit(Opcodes.OpCurrentClosure); break;
    }
  }

  /**
   * Try to constant-fold an infix expression. Returns a MonkeyObject or null.
   */
  tryConstantFold(node) {
    // Only fold if both sides are literals
    const left = this.getConstantValue(node.left);
    const right = this.getConstantValue(node.right);
    if (left === null || right === null) return null;
    
    // Integer arithmetic
    if (typeof left === 'number' && typeof right === 'number') {
      let result;
      switch (node.operator) {
        case '+': result = left + right; break;
        case '-': result = left - right; break;
        case '*': result = left * right; break;
        case '/': result = right !== 0 ? Math.trunc(left / right) : null; break;
        case '%': result = right !== 0 ? left % right : null; break;
        default: return null;
      }
      return result !== null ? new MonkeyInteger(result) : null;
    }
    
    // String concatenation
    if (typeof left === 'string' && typeof right === 'string') {
      if (node.operator === '+') return new MonkeyString(left + right);
    }
    
    return null;
  }

  /**
   * Try to constant-fold a prefix expression.
   */
  tryConstantFoldPrefix(node) {
    const val = this.getConstantValue(node.right);
    if (val === null) return null;
    if (node.operator === '-' && typeof val === 'number') return new MonkeyInteger(-val);
    return null;
  }

  /**
   * Get the constant value of a simple literal expression, or null.
   */
  getConstantValue(node) {
    if (node instanceof AST.IntegerLiteral) return node.value;
    if (node instanceof AST.StringLiteral) return node.value;
    // Recursively fold nested constant expressions
    if (node instanceof AST.InfixExpression) {
      const folded = this.tryConstantFold(node);
      if (folded instanceof MonkeyInteger) return folded.value;
      if (folded instanceof MonkeyString) return folded.value;
    }
    if (node instanceof AST.PrefixExpression) {
      const folded = this.tryConstantFoldPrefix(node);
      if (folded instanceof MonkeyInteger) return folded.value;
    }
    return null;
  }
}

/**
 * CompiledFunction: a compiled function body (used as a constant).
 */
export class CompiledFunction {
  constructor(instructions, numLocals = 0, numParameters = 0) {
    this.instructions = instructions;
    this.numLocals = numLocals;
    this.numParameters = numParameters;
  }

  type() { return 'COMPILED_FUNCTION'; }
  inspect() { return `CompiledFunction[${this.instructions.length}]`; }
}

/**
 * Closure: wraps a CompiledFunction with its free variables.
 */
export class Closure {
  constructor(fn, free = []) {
    this.fn = fn;
    this.free = free;
  }

  type() { return 'CLOSURE'; }
  inspect() { return `Closure[${this.fn.inspect()}]`; }
}
