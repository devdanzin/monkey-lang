// Monkey Language Compiler
// Walks the AST and emits bytecode instructions

import { Opcodes, make, concatInstructions } from './code.js';
import { SymbolTable, SCOPE } from './symbol-table.js';
import { MonkeyInteger, MonkeyString } from './object.js';
import * as ast from './ast.js';

// Compiled function object (different from interpreted MonkeyFunction)
export class CompiledFunction {
  constructor(instructions, numLocals = 0, numParameters = 0) {
    this.instructions = instructions;
    this.numLocals = numLocals;
    this.numParameters = numParameters;
  }
  type() { return 'COMPILED_FUNCTION'; }
  inspect() { return `CompiledFunction[${this.instructions.length}]`; }
}

// Bytecode output
export class Bytecode {
  constructor(instructions, constants) {
    this.instructions = instructions;
    this.constants = constants;
  }
}

// Emitted instruction tracking
class EmittedInstruction {
  constructor(opcode, position) {
    this.opcode = opcode;
    this.position = position;
  }
}

// Compilation scope (for functions)
class CompilationScope {
  constructor() {
    this.instructions = new Uint8Array(0);
    this.lastInstruction = new EmittedInstruction(undefined, 0);
    this.previousInstruction = new EmittedInstruction(undefined, 0);
  }
}

// Builtin function names (order matters — matches VM builtins array)
const BUILTINS = ['len', 'puts', 'first', 'last', 'rest', 'push'];

export class Compiler {
  constructor(symbolTable = null, constants = null) {
    this.constants = constants || [];
    this.symbolTable = symbolTable || new SymbolTable();
    this.scopes = [new CompilationScope()];
    this.scopeIndex = 0;

    // Register builtins (only if fresh symbol table)
    if (!symbolTable) {
      for (let i = 0; i < BUILTINS.length; i++) {
        this.symbolTable.defineBuiltin(i, BUILTINS[i]);
      }
    }
  }

  /** Create a new compiler that reuses state from a previous one (for REPL) */
  static withState(symbolTable, constants) {
    return new Compiler(symbolTable, constants);
  }

  currentScope() {
    return this.scopes[this.scopeIndex];
  }

  currentInstructions() {
    return this.currentScope().instructions;
  }

  compile(node) {
    if (node instanceof ast.Program) {
      for (const stmt of node.statements) {
        const err = this.compile(stmt);
        if (err) return err;
      }
    } else if (node instanceof ast.ExpressionStatement) {
      const err = this.compile(node.expression);
      if (err) return err;
      this.emit(Opcodes.OpPop);
    } else if (node instanceof ast.BlockStatement) {
      for (const stmt of node.statements) {
        const err = this.compile(stmt);
        if (err) return err;
      }
    } else if (node instanceof ast.LetStatement) {
      const sym = this.symbolTable.define(node.name.value);
      const err = this.compile(node.value);
      if (err) return err;
      const op = sym.scope === SCOPE.GLOBAL ? Opcodes.OpSetGlobal : Opcodes.OpSetLocal;
      this.emit(op, sym.index);
    } else if (node instanceof ast.ReturnStatement) {
      const err = this.compile(node.returnValue);
      if (err) return err;
      this.emit(Opcodes.OpReturnValue);
    } else if (node instanceof ast.InfixExpression) {
      // Handle '<' by reordering to '>'
      if (node.operator === '<') {
        let err = this.compile(node.right);
        if (err) return err;
        err = this.compile(node.left);
        if (err) return err;
        this.emit(Opcodes.OpGreaterThan);
        return null;
      }

      let err = this.compile(node.left);
      if (err) return err;
      err = this.compile(node.right);
      if (err) return err;

      switch (node.operator) {
        case '+': this.emit(Opcodes.OpAdd); break;
        case '-': this.emit(Opcodes.OpSub); break;
        case '*': this.emit(Opcodes.OpMul); break;
        case '/': this.emit(Opcodes.OpDiv); break;
        case '==': this.emit(Opcodes.OpEqual); break;
        case '!=': this.emit(Opcodes.OpNotEqual); break;
        case '>': this.emit(Opcodes.OpGreaterThan); break;
        default: return `unknown operator: ${node.operator}`;
      }
    } else if (node instanceof ast.PrefixExpression) {
      const err = this.compile(node.right);
      if (err) return err;
      switch (node.operator) {
        case '-': this.emit(Opcodes.OpMinus); break;
        case '!': this.emit(Opcodes.OpBang); break;
        default: return `unknown prefix operator: ${node.operator}`;
      }
    } else if (node instanceof ast.IntegerLiteral) {
      const idx = this.addConstant(new MonkeyInteger(node.value));
      this.emit(Opcodes.OpConstant, idx);
    } else if (node instanceof ast.StringLiteral) {
      const idx = this.addConstant(new MonkeyString(node.value));
      this.emit(Opcodes.OpConstant, idx);
    } else if (node instanceof ast.BooleanLiteral) {
      this.emit(node.value ? Opcodes.OpTrue : Opcodes.OpFalse);
    } else if (node instanceof ast.IfExpression) {
      return this.compileIfExpression(node);
    } else if (node instanceof ast.Identifier) {
      const sym = this.symbolTable.resolve(node.value);
      if (!sym) return `undefined variable: ${node.value}`;
      this.loadSymbol(sym);
    } else if (node instanceof ast.ArrayLiteral) {
      for (const el of node.elements) {
        const err = this.compile(el);
        if (err) return err;
      }
      this.emit(Opcodes.OpArray, node.elements.length);
    } else if (node instanceof ast.HashLiteral) {
      // Sort keys for deterministic compilation
      const pairs = [...node.pairs.entries()];
      pairs.sort((a, b) => a[0].toString().localeCompare(b[0].toString()));
      for (const [key, value] of pairs) {
        let err = this.compile(key);
        if (err) return err;
        err = this.compile(value);
        if (err) return err;
      }
      this.emit(Opcodes.OpHash, pairs.length * 2);
    } else if (node instanceof ast.IndexExpression) {
      let err = this.compile(node.left);
      if (err) return err;
      err = this.compile(node.index);
      if (err) return err;
      this.emit(Opcodes.OpIndex);
    } else if (node instanceof ast.FunctionLiteral) {
      return this.compileFunctionLiteral(node);
    } else if (node instanceof ast.CallExpression) {
      const err = this.compile(node.function);
      if (err) return err;
      for (const arg of node.arguments) {
        const err2 = this.compile(arg);
        if (err2) return err2;
      }
      this.emit(Opcodes.OpCall, node.arguments.length);
    }

    return null;
  }

  compileIfExpression(node) {
    let err = this.compile(node.condition);
    if (err) return err;

    // Emit jump-not-truthy with placeholder
    const jumpNotTruthyPos = this.emit(Opcodes.OpJumpNotTruthy, 9999);

    err = this.compile(node.consequence);
    if (err) return err;

    if (this.lastInstructionIs(Opcodes.OpPop)) {
      this.removeLastPop();
    }

    // Emit jump with placeholder (to skip alternative)
    const jumpPos = this.emit(Opcodes.OpJump, 9999);

    // Patch jump-not-truthy to here
    const afterConsequence = this.currentInstructions().length;
    this.changeOperand(jumpNotTruthyPos, afterConsequence);

    if (!node.alternative) {
      this.emit(Opcodes.OpNull);
    } else {
      err = this.compile(node.alternative);
      if (err) return err;

      if (this.lastInstructionIs(Opcodes.OpPop)) {
        this.removeLastPop();
      }
    }

    // Patch jump to here
    const afterAlternative = this.currentInstructions().length;
    this.changeOperand(jumpPos, afterAlternative);

    return null;
  }

  compileFunctionLiteral(node) {
    this.enterScope();

    // Define function name for recursion if it has one
    if (node.name) {
      this.symbolTable.defineFunctionName(node.name);
    }

    for (const param of node.parameters) {
      this.symbolTable.define(param.value);
    }

    const err = this.compile(node.body);
    if (err) return err;

    if (this.lastInstructionIs(Opcodes.OpPop)) {
      this.replaceLastPopWithReturn();
    }
    if (!this.lastInstructionIs(Opcodes.OpReturnValue)) {
      this.emit(Opcodes.OpReturn);
    }

    const freeSymbols = this.symbolTable.freeSymbols;
    const numLocals = this.symbolTable.numDefinitions;
    const instructions = this.leaveScope();

    for (const sym of freeSymbols) {
      this.loadSymbol(sym);
    }

    const fn = new CompiledFunction(instructions, numLocals, node.parameters.length);
    const idx = this.addConstant(fn);
    this.emit(Opcodes.OpClosure, idx, freeSymbols.length);

    return null;
  }

  loadSymbol(sym) {
    switch (sym.scope) {
      case SCOPE.GLOBAL: this.emit(Opcodes.OpGetGlobal, sym.index); break;
      case SCOPE.LOCAL: this.emit(Opcodes.OpGetLocal, sym.index); break;
      case SCOPE.BUILTIN: this.emit(Opcodes.OpGetBuiltin, sym.index); break;
      case SCOPE.FREE: this.emit(Opcodes.OpGetFree, sym.index); break;
      case SCOPE.FUNCTION: this.emit(Opcodes.OpCurrentClosure); break;
    }
  }

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
    const pos = this.currentInstructions().length;
    this.currentScope().instructions = concatInstructions(this.currentInstructions(), ins);
    return pos;
  }

  setLastInstruction(op, pos) {
    const scope = this.currentScope();
    scope.previousInstruction = scope.lastInstruction;
    scope.lastInstruction = new EmittedInstruction(op, pos);
  }

  lastInstructionIs(op) {
    return this.currentScope().lastInstruction.opcode === op;
  }

  removeLastPop() {
    const scope = this.currentScope();
    scope.instructions = scope.instructions.slice(0, scope.lastInstruction.position);
    scope.lastInstruction = scope.previousInstruction;
  }

  replaceLastPopWithReturn() {
    const scope = this.currentScope();
    const pos = scope.lastInstruction.position;
    scope.instructions[pos] = Opcodes.OpReturnValue;
    scope.lastInstruction.opcode = Opcodes.OpReturnValue;
  }

  changeOperand(pos, operand) {
    const op = this.currentInstructions()[pos];
    const ins = make(op, operand);
    this.replaceInstruction(pos, ins);
  }

  replaceInstruction(pos, ins) {
    const instructions = this.currentInstructions();
    for (let i = 0; i < ins.length; i++) {
      instructions[pos + i] = ins[i];
    }
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

  bytecode() {
    return new Bytecode(this.currentInstructions(), this.constants);
  }
}
