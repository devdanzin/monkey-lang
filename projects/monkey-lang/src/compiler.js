// Monkey Language Compiler
// Walks the AST and emits bytecode instructions

import { Opcodes, make, concatInstructions } from './code.js';
import { SymbolTable, SCOPE } from './symbol-table.js';
import { MonkeyInteger, MonkeyString, internString } from './object.js';
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
    // Type tracking: number of known-integer values on top of stack
    // Incremented when emitting integer constants, arithmetic results
    // Reset to 0 on unknown (jumps, calls, etc.)
    this.intStackDepth = 0;
  }
}

// Builtin function names (order matters — matches VM builtins array)
const BUILTINS = ['len', 'puts', 'first', 'last', 'rest', 'push', 'split', 'join', 'trim', 'str_contains', 'substr', 'replace', 'int', 'str', 'type'];

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

  /**
   * Constant folding: try to evaluate an expression at compile time.
   * Returns a MonkeyInteger/MonkeyString if fully constant, null otherwise.
   */
  tryFoldConstant(node) {
    if (node instanceof ast.IntegerLiteral) {
      return new MonkeyInteger(node.value);
    }
    if (node instanceof ast.PrefixExpression && node.operator === '-') {
      const right = this.tryFoldConstant(node.right);
      if (right instanceof MonkeyInteger) {
        return new MonkeyInteger(-right.value);
      }
    }
    if (node instanceof ast.InfixExpression) {
      const left = this.tryFoldConstant(node.left);
      const right = this.tryFoldConstant(node.right);
      if (left instanceof MonkeyInteger && right instanceof MonkeyInteger) {
        switch (node.operator) {
          case '+': return new MonkeyInteger(left.value + right.value);
          case '-': return new MonkeyInteger(left.value - right.value);
          case '*': return new MonkeyInteger(left.value * right.value);
          case '/': return right.value !== 0 ? new MonkeyInteger(Math.trunc(left.value / right.value)) : null;
        }
      }
      // String concatenation folding
      if (left instanceof MonkeyString && right instanceof MonkeyString && node.operator === '+') {
        return internString(left.value + right.value);
      }
    }
    if (node instanceof ast.StringLiteral) {
      return internString(node.value);
    }
    return null;
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
      this.consumeIntStack(1);
      this.emit(Opcodes.OpPop);
    } else if (node instanceof ast.BlockStatement) {
      for (const stmt of node.statements) {
        const err = this.compile(stmt);
        if (err) return err;
      }
    } else if (node instanceof ast.LetStatement) {
      const sym = this.symbolTable.define(node.name.value);
      // Pass binding name to function literals for recursive self-reference
      if (node.value instanceof ast.FunctionLiteral) {
        node.value.name = node.name.value;
      }
      const err = this.compile(node.value);
      if (err) return err;
      const op = sym.scope === SCOPE.GLOBAL ? Opcodes.OpSetGlobal : Opcodes.OpSetLocal;
      this.emit(op, sym.index);
    } else if (node instanceof ast.ReturnStatement) {
      const err = this.compile(node.returnValue);
      if (err) return err;
      this.emit(Opcodes.OpReturnValue);
    } else if (node instanceof ast.InfixExpression) {
      // Constant folding: try to evaluate at compile time
      if (['+', '-', '*', '/'].includes(node.operator)) {
        const folded = this.tryFoldConstant(node);
        if (folded) {
          const idx = this.addConstant(folded);
          if (folded instanceof MonkeyInteger) {
            this.emitInt(Opcodes.OpConstant, idx);
          } else {
            this.emit(Opcodes.OpConstant, idx);
          }
          return null;
        }
      }
      // Constant comparison folding
      if (['==', '!=', '>', '<'].includes(node.operator)) {
        const left = this.tryFoldConstant(node.left);
        const right = this.tryFoldConstant(node.right);
        if (left instanceof MonkeyInteger && right instanceof MonkeyInteger) {
          let result;
          switch (node.operator) {
            case '==': result = left.value === right.value; break;
            case '!=': result = left.value !== right.value; break;
            case '>': result = left.value > right.value; break;
            case '<': result = left.value < right.value; break;
          }
          this.emit(result ? Opcodes.OpTrue : Opcodes.OpFalse);
          return null;
        }
      }

      // Handle '<': use OpLessThanInt for integer operands, swap approach for others
      if (node.operator === '<') {
        if (this.isIntegerProducing(node.left) && this.isIntegerProducing(node.right)) {
          let err = this.compile(node.left);
          if (err) return err;
          err = this.compile(node.right);
          if (err) return err;
          this.consumeIntStack(2);
          this.emit(Opcodes.OpLessThanInt);
        } else {
          // Swap operands and use GreaterThan
          let err = this.compile(node.right);
          if (err) return err;
          err = this.compile(node.left);
          if (err) return err;
          this.emitCompareOrSpecialized(Opcodes.OpGreaterThan, Opcodes.OpGreaterThanInt);
        }
        return null;
      }

      let err = this.compile(node.left);
      if (err) return err;
      err = this.compile(node.right);
      if (err) return err;

      switch (node.operator) {
        case '+': this.emitArithOrConst(Opcodes.OpAdd, Opcodes.OpAddConst, Opcodes.OpAddInt); break;
        case '-': this.emitArithOrConst(Opcodes.OpSub, Opcodes.OpSubConst, Opcodes.OpSubInt); break;
        case '*': this.emitArithOrConst(Opcodes.OpMul, Opcodes.OpMulConst, null); break;
        case '/': this.emitArithOrConst(Opcodes.OpDiv, Opcodes.OpDivConst, null); break;
        case '==': this.emitCompareOrSpecialized(Opcodes.OpEqual, Opcodes.OpEqualInt); break;
        case '!=': this.emitCompareOrSpecialized(Opcodes.OpNotEqual, Opcodes.OpNotEqualInt); break;
        case '>': this.emitCompareOrSpecialized(Opcodes.OpGreaterThan, Opcodes.OpGreaterThanInt); break;
        default: return `unknown operator: ${node.operator}`;
      }
    } else if (node instanceof ast.PrefixExpression) {
      // Constant folding for prefix expressions
      if (node.operator === '-') {
        const folded = this.tryFoldConstant(node);
        if (folded) {
          const idx = this.addConstant(folded);
          this.emit(Opcodes.OpConstant, idx);
          return null;
        }
      }
      const err = this.compile(node.right);
      if (err) return err;
      switch (node.operator) {
        case '-':
          if (this.topNAreInt(1)) {
            this.consumeIntStack(1);
            this.emitInt(Opcodes.OpMinus);
          } else {
            this.emit(Opcodes.OpMinus);
          }
          break;
        case '!': this.consumeIntStack(1); this.emit(Opcodes.OpBang); break;
        default: return `unknown prefix operator: ${node.operator}`;
      }
    } else if (node instanceof ast.IntegerLiteral) {
      const idx = this.addConstant(new MonkeyInteger(node.value));
      this.emitInt(Opcodes.OpConstant, idx);
    } else if (node instanceof ast.StringLiteral) {
      const idx = this.addConstant(internString(node.value));
      this.emit(Opcodes.OpConstant, idx);
    } else if (node instanceof ast.BooleanLiteral) {
      this.emit(node.value ? Opcodes.OpTrue : Opcodes.OpFalse);
    } else if (node instanceof ast.IfExpression) {
      return this.compileIfExpression(node);
    } else if (node instanceof ast.WhileExpression) {
      return this.compileWhileExpression(node);
    } else if (node instanceof ast.AssignExpression) {
      const sym = this.symbolTable.resolve(node.name.value);
      if (!sym) return `undefined variable: ${node.name.value}`;
      const err = this.compile(node.value);
      if (err) return err;
      // Assignment expression: set and push the value back (like other expressions)
      if (sym.scope === 'GLOBAL') {
        this.emit(Opcodes.OpSetGlobal, sym.index);
        this.emit(Opcodes.OpGetGlobal, sym.index);
      } else if (sym.scope === 'LOCAL') {
        this.emit(Opcodes.OpSetLocal, sym.index);
        this.emit(Opcodes.OpGetLocal, sym.index);
      } else {
        return `cannot assign to ${sym.scope} variable: ${node.name.value}`;
      }
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
      this.resetIntStack(); // Return value type is unknown
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

    // After if/else, result type is unknown
    this.resetIntStack();

    return null;
  }

  compileWhileExpression(node) {
    // while (condition) { body }
    // Compiles to:
    //   loopStart:
    //     <condition>
    //     OpJumpNotTruthy afterLoop
    //     <body>
    //     OpPop (discard body result)
    //     OpJump loopStart        ← backward jump (JIT traces this!)
    //   afterLoop:
    //     OpNull                  ← while expression evaluates to null

    const loopStart = this.currentInstructions().length;

    // Compile condition
    let err = this.compile(node.condition);
    if (err) return err;

    // Jump past body if condition is false
    const jumpNotTruthyPos = this.emit(Opcodes.OpJumpNotTruthy, 9999);

    // Compile body
    err = this.compile(node.body);
    if (err) return err;

    // Pop body result
    if (this.lastInstructionIs(Opcodes.OpPop)) {
      // Already has a pop — good
    } else {
      this.emit(Opcodes.OpPop);
    }

    // Jump back to loop start (backward jump)
    this.emit(Opcodes.OpJump, loopStart);

    // Patch conditional jump to here
    const afterLoop = this.currentInstructions().length;
    this.changeOperand(jumpNotTruthyPos, afterLoop);

    // While evaluates to null
    this.emit(Opcodes.OpNull);

    this.resetIntStack();

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

  /**
   * Check if a node will produce a known integer value when compiled.
   * Conservative — only returns true for obvious cases.
   */
  isIntegerProducing(node) {
    if (node instanceof ast.IntegerLiteral) return true;
    if (node instanceof ast.PrefixExpression && node.operator === '-') {
      return this.isIntegerProducing(node.right);
    }
    if (node instanceof ast.InfixExpression && ['+', '-', '*', '/'].includes(node.operator)) {
      return this.isIntegerProducing(node.left) && this.isIntegerProducing(node.right);
    }
    // Identifiers: we can't know the type statically in general
    // But for local variables assigned from integer expressions, we could track...
    // Conservative: return false for now
    return false;
  }

  /**
   * Map from generic arithmetic op to its GetLocal*Const superinstruction.
   */
  static GET_LOCAL_CONST_OPS = {
    [Opcodes.OpAdd]: Opcodes.OpGetLocalAddConst,
    [Opcodes.OpSub]: Opcodes.OpGetLocalSubConst,
    [Opcodes.OpMul]: Opcodes.OpGetLocalMulConst,
    [Opcodes.OpDiv]: Opcodes.OpGetLocalDivConst,
  };

  /**
   * Peephole optimization: if the last instruction was OpConstant,
   * fuse it with the arithmetic op into a single constant-operand opcode.
   * If OpGetLocal preceded OpConstant, fuse all three into OpGetLocal*Const.
   * If both operands are known integers and intOp is provided, use it.
   */
  emitArithOrConst(genericOp, constOp, intOp = null) {
    const scope = this.currentScope();

    // Check for integer specialization first (before peephole)
    const bothInt = this.topNAreInt(2);

    if (scope.lastInstruction.opcode === Opcodes.OpConstant) {
      // Extract the constant index from the OpConstant instruction
      const constPos = scope.lastInstruction.position;
      const ins = scope.instructions;
      const constIdx = (ins[constPos + 1] << 8) | ins[constPos + 2];

      // Check if previous instruction was OpGetLocal — if so, triple-fuse
      const prevOp = scope.previousInstruction.opcode;
      const prevPos = scope.previousInstruction.position;
      const superOp = Compiler.GET_LOCAL_CONST_OPS[genericOp];

      if (prevOp === Opcodes.OpGetLocal && superOp !== undefined) {
        const localIdx = ins[prevPos + 1];

        // Remove both OpGetLocal and OpConstant
        scope.instructions = scope.instructions.slice(0, prevPos);
        scope.lastInstruction = new EmittedInstruction(undefined, 0);
        scope.previousInstruction = new EmittedInstruction(undefined, 0);

        // Consumed 2 int slots (if they were tracked), result is int
        this.consumeIntStack(2);
        this.emitInt(superOp, localIdx, constIdx);
      } else {
        // Remove the OpConstant instruction
        scope.instructions = scope.instructions.slice(0, constPos);
        scope.lastInstruction = scope.previousInstruction;

        // Consumed 2 int slots, result is int
        this.consumeIntStack(2);
        this.emitInt(constOp, constIdx);
      }
    } else if (bothInt && intOp) {
      // Both operands are known integers — use specialized opcode
      this.consumeIntStack(2);
      this.emitInt(intOp);
    } else {
      // Generic path — can't guarantee types, result type unknown
      this.consumeIntStack(2);
      this.emit(genericOp);
    }
  }

  /**
   * Emit a comparison opcode, using the integer-specialized variant
   * if both operands are known integers.
   */
  emitCompareOrSpecialized(genericOp, intOp) {
    if (this.topNAreInt(2)) {
      this.consumeIntStack(2);
      this.emit(intOp);
    } else {
      this.consumeIntStack(2);
      this.emit(genericOp);
    }
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

  /** Emit and mark that the result pushes a known integer onto the stack */
  emitInt(op, ...operands) {
    const pos = this.emit(op, ...operands);
    this.currentScope().intStackDepth++;
    return pos;
  }

  /** Consume N known-integer slots from the type tracker */
  consumeIntStack(n) {
    const scope = this.currentScope();
    scope.intStackDepth = Math.max(0, scope.intStackDepth - n);
  }

  /** Reset int stack tracking (after jumps, calls, unknown ops) */
  resetIntStack() {
    this.currentScope().intStackDepth = 0;
  }

  /** Check if top N stack values are known integers */
  topNAreInt(n) {
    return this.currentScope().intStackDepth >= n;
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
