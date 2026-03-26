// Monkey Language Compiler
// Walks the AST and emits bytecode instructions

import { Opcodes, make, concatInstructions } from './code.js';
import { SymbolTable, SCOPE } from './symbol-table.js';
import { MonkeyInteger, MonkeyString, internString } from './object.js';
import * as ast from './ast.js';

// Compiled function object (different from interpreted MonkeyFunction)
let _cfId = 0;
export class CompiledFunction {
  constructor(instructions, numLocals = 0, numParameters = 0, hasRestParam = false) {
    this.id = _cfId++;
    this.instructions = instructions;
    this.numLocals = numLocals;
    this.numParameters = numParameters;
    this.hasRestParam = hasRestParam;
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
const BUILTINS = ['len', 'puts', 'first', 'last', 'rest', 'push', 'split', 'join', 'trim', 'str_contains', 'substr', 'replace', 'int', 'str', 'type', 'upper', 'lower', 'indexOf', 'startsWith', 'endsWith', 'char', 'ord', 'keys', 'values', 'abs', 'sort', 'reverse', 'contains', 'sum', 'max', 'min', 'range', 'flat', 'zip', 'enumerate', 'Ok', 'Err', 'is_ok', 'is_err', 'unwrap', 'unwrap_or'];

export class Compiler {
  constructor(symbolTable = null, constants = null) {
    this.constants = constants || [];
    this.symbolTable = symbolTable || new SymbolTable();
    this.scopes = [new CompilationScope()];
    this.scopeIndex = 0;
    this.loopStack = []; // Stack of { breakPatches: [], continueTarget: number }

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
          case '%': return right.value !== 0 ? new MonkeyInteger(left.value % right.value) : null;
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
      const sym = this.symbolTable.define(node.name.value, node.isConst);
      // Pass binding name to function literals for recursive self-reference
      if (node.value instanceof ast.FunctionLiteral) {
        node.value.name = node.name.value;
      }
      const err = this.compile(node.value);
      if (err) return err;
      const op = sym.scope === SCOPE.GLOBAL ? Opcodes.OpSetGlobal : Opcodes.OpSetLocal;
      this.emit(op, sym.index);
    } else if (node instanceof ast.DestructuringLet) {
      // let [a, b, c] = expr
      const err2 = this.compile(node.value);
      if (err2) return err2;
      const tempSym = this.symbolTable.define('__destruct_' + this.currentInstructions().length);
      this.emit(tempSym.scope === SCOPE.GLOBAL ? Opcodes.OpSetGlobal : Opcodes.OpSetLocal, tempSym.index);
      for (let i = 0; i < node.names.length; i++) {
        if (node.names[i] === null) continue;
        this.loadSymbol(tempSym);
        const idxConst = this.addConstant(new MonkeyInteger(i));
        this.emit(Opcodes.OpConstant, idxConst);
        this.emit(Opcodes.OpIndex);
        const dsym = this.symbolTable.define(node.names[i].value);
        this.emit(dsym.scope === SCOPE.GLOBAL ? Opcodes.OpSetGlobal : Opcodes.OpSetLocal, dsym.index);
      }
    } else if (node instanceof ast.HashDestructuringLet) {
      // let {x, y, z} = expr — extract hash keys by name
      const err2 = this.compile(node.value);
      if (err2) return err2;
      const tempSym = this.symbolTable.define('__hdestruct_' + this.currentInstructions().length);
      this.emit(tempSym.scope === SCOPE.GLOBAL ? Opcodes.OpSetGlobal : Opcodes.OpSetLocal, tempSym.index);
      for (const name of node.names) {
        this.loadSymbol(tempSym);
        const keyConst = this.addConstant(internString(name.value));
        this.emit(Opcodes.OpConstant, keyConst);
        this.emit(Opcodes.OpIndex);
        const dsym = this.symbolTable.define(name.value);
        this.emit(dsym.scope === SCOPE.GLOBAL ? Opcodes.OpSetGlobal : Opcodes.OpSetLocal, dsym.index);
      }
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
      if (['==', '!=', '>', '<', '<=', '>='].includes(node.operator)) {
        const left = this.tryFoldConstant(node.left);
        const right = this.tryFoldConstant(node.right);
        if (left instanceof MonkeyInteger && right instanceof MonkeyInteger) {
          let result;
          switch (node.operator) {
            case '==': result = left.value === right.value; break;
            case '!=': result = left.value !== right.value; break;
            case '>': result = left.value > right.value; break;
            case '<': result = left.value < right.value; break;
            case '<=': result = left.value <= right.value; break;
            case '>=': result = left.value >= right.value; break;
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

      // Handle '<=': compile as !(left > right)
      if (node.operator === '<=') {
        let err = this.compile(node.left);
        if (err) return err;
        err = this.compile(node.right);
        if (err) return err;
        this.emitCompareOrSpecialized(Opcodes.OpGreaterThan, Opcodes.OpGreaterThanInt);
        this.emit(Opcodes.OpBang);
        return null;
      }

      // Handle '>=': compile as !(right > left) i.e. !(left < right)
      if (node.operator === '>=') {
        let err = this.compile(node.right);
        if (err) return err;
        err = this.compile(node.left);
        if (err) return err;
        this.emitCompareOrSpecialized(Opcodes.OpGreaterThan, Opcodes.OpGreaterThanInt);
        this.emit(Opcodes.OpBang);
        return null;
      }

      // Handle '&&': short-circuit AND
      if (node.operator === '&&') {
        let err = this.compile(node.left);
        if (err) return err;
        // OpJumpNotTruthy pops the condition; if falsy, jump to push false
        const jumpFalsyPos = this.emit(Opcodes.OpJumpNotTruthy, 0xFFFF);
        // Left was truthy: evaluate right (its result becomes the && result)
        err = this.compile(node.right);
        if (err) return err;
        const jumpEndPos = this.emit(Opcodes.OpJump, 0xFFFF);
        // Left was falsy: push false
        this.changeOperand(jumpFalsyPos, this.currentInstructions().length);
        this.resetPeepholeState();
        this.emit(Opcodes.OpFalse);
        this.changeOperand(jumpEndPos, this.currentInstructions().length);
        this.resetPeepholeState();
        return null;
      }

      // Handle '||': short-circuit OR
      if (node.operator === '||') {
        let err = this.compile(node.left);
        if (err) return err;
        // OpJumpNotTruthy pops the condition; if falsy, jump to evaluate right
        const jumpFalsyPos = this.emit(Opcodes.OpJumpNotTruthy, 0xFFFF);
        // Left was truthy: push true
        this.emit(Opcodes.OpTrue);
        const jumpEndPos = this.emit(Opcodes.OpJump, 0xFFFF);
        // Left was falsy: evaluate right
        this.changeOperand(jumpFalsyPos, this.currentInstructions().length);
        err = this.compile(node.right);
        if (err) return err;
        this.changeOperand(jumpEndPos, this.currentInstructions().length);
        this.resetPeepholeState();
        return null;
      }

      // Handle '??': null coalescing (left ?? right)
      if (node.operator === '??') {
        let err = this.compile(node.left);
        if (err) return err;
        const sym = this.symbolTable.define('__nullish_' + this.currentInstructions().length);
        this.emit(sym.scope === 'GLOBAL' ? Opcodes.OpSetGlobal : Opcodes.OpSetLocal, sym.index);
        this.loadSymbol(sym);
        this.emit(Opcodes.OpNull);
        this.emit(Opcodes.OpEqual);
        const jumpNotNullPos = this.emit(Opcodes.OpJumpNotTruthy, 0xFFFF);
        err = this.compile(node.right);
        if (err) return err;
        const jumpEndPos2 = this.emit(Opcodes.OpJump, 0xFFFF);
        this.changeOperand(jumpNotNullPos, this.currentInstructions().length);
        this.resetPeepholeState();
        this.loadSymbol(sym);
        this.changeOperand(jumpEndPos2, this.currentInstructions().length);
        this.resetPeepholeState();
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
        case '%': this.emitArithOrConst(Opcodes.OpMod, Opcodes.OpModConst, null); break;
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
    } else if (node instanceof ast.NullLiteral) {
      this.emit(Opcodes.OpNull);
    } else if (node instanceof ast.TernaryExpression) {
      let err = this.compile(node.condition);
      if (err) return err;
      const jumpNotTruthyPos = this.emit(Opcodes.OpJumpNotTruthy, 9999);
      err = this.compile(node.consequence);
      if (err) return err;
      const jumpPos = this.emit(Opcodes.OpJump, 9999);
      // Reset peephole state at jump target — consequence's last instruction
      // must not influence alternative branch's peephole optimization
      this.changeOperand(jumpNotTruthyPos, this.currentInstructions().length);
      this.resetPeepholeState();
      err = this.compile(node.alternative);
      if (err) return err;
      this.changeOperand(jumpPos, this.currentInstructions().length);
      this.resetPeepholeState();
    } else if (node instanceof ast.MatchExpression) {
      return this.compileMatchExpression(node);
    } else if (node instanceof ast.RangeExpression) {
      // Desugar: 0..10 → range(0, 10)
      const rangeIdx = BUILTINS.indexOf('range');
      this.emit(Opcodes.OpGetBuiltin, rangeIdx);
      let err = this.compile(node.start);
      if (err) return err;
      err = this.compile(node.end);
      if (err) return err;
      this.emit(Opcodes.OpCall, 2);
    } else if (node instanceof ast.TemplateLiteral) {
      return this.compileTemplateLiteral(node);
    } else if (node instanceof ast.BooleanLiteral) {
      this.emit(node.value ? Opcodes.OpTrue : Opcodes.OpFalse);
    } else if (node instanceof ast.IfExpression) {
      return this.compileIfExpression(node);
    } else if (node instanceof ast.WhileExpression) {
      return this.compileWhileExpression(node);
    } else if (node instanceof ast.DoWhileExpression) {
      return this.compileDoWhileExpression(node);
    } else if (node instanceof ast.ForExpression) {
      return this.compileForExpression(node);
    } else if (node instanceof ast.ForInExpression) {
      return this.compileForInExpression(node);
    } else if (node instanceof ast.AssignExpression) {
      const sym = this.symbolTable.resolve(node.name.value);
      if (!sym) return `undefined variable: ${node.name.value}`;
      if (sym.isConst) return `cannot assign to const variable: ${node.name.value}`;
      const err = this.compile(node.value);
      if (err) return err;
      // Assignment expression: set and push the value back (like other expressions)
      if (sym.scope === 'GLOBAL') {
        this.emit(Opcodes.OpSetGlobal, sym.index);
        this.emit(Opcodes.OpGetGlobal, sym.index);
      } else if (sym.scope === 'LOCAL') {
        this.emit(Opcodes.OpSetLocal, sym.index);
        this.emit(Opcodes.OpGetLocal, sym.index);
      } else if (sym.scope === 'FREE') {
        this.emit(Opcodes.OpSetFree, sym.index);
        this.emit(Opcodes.OpGetFree, sym.index);
      } else {
        return `cannot assign to ${sym.scope} variable: ${node.name.value}`;
      }
    } else if (node instanceof ast.IndexAssignExpression) {
      // arr[i] = val → push arr, push i, push val, OpSetIndex
      let err = this.compile(node.left);
      if (err) return err;
      err = this.compile(node.index);
      if (err) return err;
      err = this.compile(node.value);
      if (err) return err;
      this.emit(Opcodes.OpSetIndex);
    } else if (node instanceof ast.SliceExpression) {
      // arr[start:end] → push arr, push start (or null), push end (or null), OpSlice
      let err = this.compile(node.left);
      if (err) return err;
      if (node.start) {
        err = this.compile(node.start);
        if (err) return err;
      } else {
        this.emit(Opcodes.OpNull);
      }
      if (node.end) {
        err = this.compile(node.end);
        if (err) return err;
      } else {
        this.emit(Opcodes.OpNull);
      }
      this.emit(Opcodes.OpSlice);
    } else if (node instanceof ast.BreakStatement) {
      if (this.loopStack.length === 0) return 'break outside of loop';
      this.emit(Opcodes.OpNull); // break produces null
      const breakPos = this.emit(Opcodes.OpJump, 0xFFFF);
      this.loopStack[this.loopStack.length - 1].breakPatches.push(breakPos);
    } else if (node instanceof ast.ContinueStatement) {
      if (this.loopStack.length === 0) return 'continue outside of loop';
      const loopCtx = this.loopStack[this.loopStack.length - 1];
      if (loopCtx.continueTarget >= 0) {
        this.emit(Opcodes.OpJump, loopCtx.continueTarget);
      } else {
        // Deferred — for-loops where update hasn't been compiled yet
        const contPos = this.emit(Opcodes.OpJump, 0xFFFF);
        loopCtx.continuePatches.push(contPos);
      }
    } else if (node instanceof ast.Identifier) {
      const sym = this.symbolTable.resolve(node.value);
      if (!sym) return `undefined variable: ${node.value}`;
      this.loadSymbol(sym);
    } else if (node instanceof ast.ArrayLiteral) {
      const hasSpread = node.elements.some(el => el instanceof ast.SpreadElement);
      if (!hasSpread) {
        for (const el of node.elements) {
          const err = this.compile(el);
          if (err) return err;
        }
        this.emit(Opcodes.OpArray, node.elements.length);
      } else {
        // Build array with spread: segment non-spreads into arrays, concat with spreads
        // Strategy: build segments, concat them all
        let segments = 0;
        let currentSegmentSize = 0;
        for (const el of node.elements) {
          if (el instanceof ast.SpreadElement) {
            // Flush current segment as array
            if (currentSegmentSize > 0) {
              this.emit(Opcodes.OpArray, currentSegmentSize);
              segments++;
              currentSegmentSize = 0;
            }
            // Compile spread expression (should produce an array)
            const err = this.compile(el.expression);
            if (err) return err;
            segments++;
          } else {
            const err = this.compile(el);
            if (err) return err;
            currentSegmentSize++;
          }
        }
        // Flush remaining segment
        if (currentSegmentSize > 0) {
          this.emit(Opcodes.OpArray, currentSegmentSize);
          segments++;
        }
        if (segments === 0) {
          this.emit(Opcodes.OpArray, 0);
        } else {
          // Concat all segments with OpAdd
          for (let i = 1; i < segments; i++) {
            this.emit(Opcodes.OpAdd);
          }
        }
      }
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
    } else if (node instanceof ast.OptionalChainExpression) {
      // x?.[key] → compile x, check null, if null push null, else index
      let err = this.compile(node.left);
      if (err) return err;
      // Store in hidden var to avoid double evaluation
      const sym = this.symbolTable.define('__optchain_' + this.currentInstructions().length);
      this.emit(sym.scope === 'GLOBAL' ? Opcodes.OpSetGlobal : Opcodes.OpSetLocal, sym.index);
      // Check if null
      this.loadSymbol(sym);
      this.emit(Opcodes.OpNull);
      this.emit(Opcodes.OpEqual);
      const jumpNotNullPos = this.emit(Opcodes.OpJumpNotTruthy, 0xFFFF);
      // IS null: push null
      this.emit(Opcodes.OpNull);
      const jumpEndPos = this.emit(Opcodes.OpJump, 0xFFFF);
      // NOT null: do index access
      this.changeOperand(jumpNotNullPos, this.currentInstructions().length);
      this.resetPeepholeState();
      this.loadSymbol(sym);
      err = this.compile(node.index);
      if (err) return err;
      this.emit(Opcodes.OpIndex);
      this.changeOperand(jumpEndPos, this.currentInstructions().length);
      this.resetPeepholeState();
    } else if (node instanceof ast.FunctionLiteral) {
      return this.compileFunctionLiteral(node);
    } else if (node instanceof ast.CallExpression) {
      // Check for method call desugaring: expr.method(args) → method(expr, args)
      if (node.function instanceof ast.IndexExpression && 
          node.function.index instanceof ast.StringLiteral) {
        const methodName = node.function.index.value;
        const builtinIdx = BUILTINS.indexOf(methodName);
        if (builtinIdx !== -1) {
          // Desugar: receiver.method(args) → builtin_method(receiver, args)
          this.emit(Opcodes.OpGetBuiltin, builtinIdx);
          const err = this.compile(node.function.left);
          if (err) return err;
          for (const arg of node.arguments) {
            const err2 = this.compile(arg);
            if (err2) return err2;
          }
          this.emit(Opcodes.OpCall, node.arguments.length + 1); // +1 for receiver
          this.resetIntStack();
        } else {
          // Not a known builtin — compile normally
          const err = this.compile(node.function);
          if (err) return err;
          for (const arg of node.arguments) {
            const err2 = this.compile(arg);
            if (err2) return err2;
          }
          this.emit(Opcodes.OpCall, node.arguments.length);
          this.resetIntStack();
        }
      } else {
        const err = this.compile(node.function);
        if (err) return err;
        for (const arg of node.arguments) {
          const err2 = this.compile(arg);
          if (err2) return err2;
        }
        this.emit(Opcodes.OpCall, node.arguments.length);
        this.resetIntStack(); // Return value type is unknown
      }
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
    this.resetPeepholeState();

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
    this.resetPeepholeState();

    // After if/else, result type is unknown
    this.resetIntStack();

    return null;
  }

  compileDoWhileExpression(node) {
    const loopStart = this.currentInstructions().length;
    this.loopStack.push({ breakPatches: [], continuePatches: [], continueTarget: loopStart });

    let err = this.compile(node.body);
    if (err) return err;
    if (this.lastInstructionIs(Opcodes.OpPop)) {} else { this.emit(Opcodes.OpPop); }

    // Condition
    err = this.compile(node.condition);
    if (err) return err;
    const jumpNotTruthyPos = this.emit(Opcodes.OpJumpNotTruthy, 9999);
    this.emit(Opcodes.OpJump, loopStart);

    const afterLoop = this.currentInstructions().length;
    this.changeOperand(jumpNotTruthyPos, afterLoop);

    const loopCtx = this.loopStack.pop();
    for (const bp of loopCtx.breakPatches) this.changeOperand(bp, afterLoop);

    this.emit(Opcodes.OpNull);
    this.resetIntStack();
    return null;
  }

  compileWhileExpression(node) {
    const loopStart = this.currentInstructions().length;

    // Push loop context
    this.loopStack.push({ breakPatches: [], continuePatches: [], continueTarget: loopStart });

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
      // Already has a pop
    } else {
      this.emit(Opcodes.OpPop);
    }

    // Jump back to loop start
    this.emit(Opcodes.OpJump, loopStart);

    // Patch conditional jump to here
    const afterLoop = this.currentInstructions().length;
    this.changeOperand(jumpNotTruthyPos, afterLoop);

    // Patch break jumps
    const loopCtx = this.loopStack.pop();
    for (const breakPos of loopCtx.breakPatches) {
      this.changeOperand(breakPos, afterLoop);
    }

    // While evaluates to null
    this.emit(Opcodes.OpNull);

    this.resetIntStack();

    return null;
  }

  compileForExpression(node) {
    // for (init; condition; update) { body }

    let err = this.compile(node.init);
    if (err) return err;

    const loopStart = this.currentInstructions().length;

    err = this.compile(node.condition);
    if (err) return err;

    const jumpNotTruthyPos = this.emit(Opcodes.OpJumpNotTruthy, 9999);

    // Push loop context — continue target will be patched to update section
    this.loopStack.push({ breakPatches: [], continuePatches: [], continueTarget: -1 });

    err = this.compile(node.body);
    if (err) return err;

    if (this.lastInstructionIs(Opcodes.OpPop)) {
    } else {
      this.emit(Opcodes.OpPop);
    }

    // Update section — patch continue jumps to here
    const updatePos = this.currentInstructions().length;
    const loopCtx = this.loopStack[this.loopStack.length - 1];
    for (const contPos of loopCtx.continuePatches) {
      this.changeOperand(contPos, updatePos);
    }

    err = this.compile(node.update);
    if (err) return err;
    this.emit(Opcodes.OpPop);

    this.emit(Opcodes.OpJump, loopStart);

    const afterLoop = this.currentInstructions().length;
    this.changeOperand(jumpNotTruthyPos, afterLoop);

    this.loopStack.pop();
    for (const breakPos of loopCtx.breakPatches) {
      this.changeOperand(breakPos, afterLoop);
    }

    this.emit(Opcodes.OpNull);
    this.resetIntStack();

    return null;
  }

  compileForInExpression(node) {
    // for (x in iterable) { body }
    // Compiles to:
    //   let __arr = iterable
    //   let __len = len(__arr)
    //   let __i = 0
    //   while (__i < __len) {
    //     let x = __arr[__i]
    //     body
    //     __i = __i + 1
    //   }

    // Compile and store the iterable
    let err = this.compile(node.iterable);
    if (err) return err;
    const arrSym = this.symbolTable.define('__forin_arr_' + this.currentInstructions().length);
    this.emit(arrSym.scope === 'GLOBAL' ? Opcodes.OpSetGlobal : Opcodes.OpSetLocal, arrSym.index);

    // len(__arr)
    this.emit(Opcodes.OpGetBuiltin, 0); // len
    this.loadSymbol(arrSym);
    this.emit(Opcodes.OpCall, 1);
    const lenSym = this.symbolTable.define('__forin_len_' + this.currentInstructions().length);
    this.emit(lenSym.scope === 'GLOBAL' ? Opcodes.OpSetGlobal : Opcodes.OpSetLocal, lenSym.index);

    // let __i = 0
    const zeroIdx = this.addConstant(new MonkeyInteger(0));
    this.emit(Opcodes.OpConstant, zeroIdx);
    const iSym = this.symbolTable.define('__forin_i_' + this.currentInstructions().length);
    this.emit(iSym.scope === 'GLOBAL' ? Opcodes.OpSetGlobal : Opcodes.OpSetLocal, iSym.index);

    const loopStart = this.currentInstructions().length;

    // condition: __i < __len
    this.loadSymbol(iSym);
    this.loadSymbol(lenSym);
    this.emit(Opcodes.OpLessThanInt);

    const jumpNotTruthyPos = this.emit(Opcodes.OpJumpNotTruthy, 9999);

    // Push loop context — continue will jump to increment
    this.loopStack.push({ breakPatches: [], continuePatches: [], continueTarget: -1 });

    // let x = __arr[__i]
    this.loadSymbol(arrSym);
    this.loadSymbol(iSym);
    this.emit(Opcodes.OpIndex);
    const varSym = this.symbolTable.define(node.variable);
    this.emit(varSym.scope === 'GLOBAL' ? Opcodes.OpSetGlobal : Opcodes.OpSetLocal, varSym.index);

    // Compile body
    err = this.compile(node.body);
    if (err) return err;

    if (this.lastInstructionIs(Opcodes.OpPop)) {
      // Already has a pop
    } else {
      this.emit(Opcodes.OpPop);
    }

    // Patch continue to here (increment section)
    const incrementPos = this.currentInstructions().length;
    const loopCtxIn = this.loopStack[this.loopStack.length - 1];
    for (const contPos of loopCtxIn.continuePatches) {
      this.changeOperand(contPos, incrementPos);
    }

    // __i = __i + 1
    this.loadSymbol(iSym);
    const oneIdx = this.addConstant(new MonkeyInteger(1));
    this.emit(Opcodes.OpConstant, oneIdx);
    this.emit(Opcodes.OpAdd);
    this.emit(iSym.scope === 'GLOBAL' ? Opcodes.OpSetGlobal : Opcodes.OpSetLocal, iSym.index);

    // Jump back
    this.emit(Opcodes.OpJump, loopStart);

    // Patch condition jump and breaks
    const afterLoop = this.currentInstructions().length;
    this.changeOperand(jumpNotTruthyPos, afterLoop);
    this.loopStack.pop();
    for (const breakPos of loopCtxIn.breakPatches) {
      this.changeOperand(breakPos, afterLoop);
    }

    this.emit(Opcodes.OpNull);
    this.resetIntStack();

    return null;
  }

  compileTemplateLiteral(node) {
    // Compile each part as a string, then concatenate all
    let err = this.compileTemplatePart(node.parts[0]);
    if (err) return err;

    for (let i = 1; i < node.parts.length; i++) {
      err = this.compileTemplatePart(node.parts[i]);
      if (err) return err;
      this.emit(Opcodes.OpAdd); // string concatenation
    }
    return null;
  }

  compileTemplatePart(part) {
    if (part instanceof ast.StringLiteral) {
      const idx = this.addConstant(internString(part.value));
      this.emit(Opcodes.OpConstant, idx);
      return null;
    }
    // Expression part — call str(expr) to ensure string output
    const strIdx = BUILTINS.indexOf('str');
    this.emit(Opcodes.OpGetBuiltin, strIdx); // push str function
    const err = this.compile(part);           // push argument
    if (err) return err;
    this.emit(Opcodes.OpCall, 1);             // call str(expr)
    return null;
  }

  compileMatchExpression(node) {
    // match (subject) { pattern1 => value1, pattern2 => value2, _ => default }
    // Compiles to: let __subject = subject; if (__subject == p1) v1 else if (__subject == p2) v2 else default

    // Compile subject and store in hidden variable
    let err = this.compile(node.subject);
    if (err) return err;
    const subjectSym = this.symbolTable.define('__match_' + this.currentInstructions().length);
    this.emit(subjectSym.scope === 'GLOBAL' ? Opcodes.OpSetGlobal : Opcodes.OpSetLocal, subjectSym.index);

    const endJumps = [];

    for (let i = 0; i < node.arms.length; i++) {
      const arm = node.arms[i];

      if (arm.pattern === null) {
        // Wildcard — always matches
        err = this.compile(arm.value);
        if (err) return err;
        break;
      }

      if (arm.pattern instanceof ast.TypePattern) {
        // Type pattern: check type, bind value if matches
        this.loadSymbol(subjectSym);
        const typeConst = this.addConstant(arm.pattern.typeName);
        this.emit(Opcodes.OpTypeIs, typeConst);
        const jumpNotTruthyPos = this.emit(Opcodes.OpJumpNotTruthy, 9999);

        // Match — bind appropriate value to pattern variable
        if (arm.pattern.typeName === 'Ok' || arm.pattern.typeName === 'Err') {
          // For Ok/Err: bind the inner value (like Rust's Ok(v) pattern)
          this.loadSymbol(subjectSym);
          this.emit(Opcodes.OpResultValue);
        } else {
          this.loadSymbol(subjectSym);
        }
        const bindSym = this.symbolTable.define(arm.pattern.binding.value);
        this.emit(bindSym.scope === 'GLOBAL' ? Opcodes.OpSetGlobal : Opcodes.OpSetLocal, bindSym.index);
        err = this.compile(arm.value);
        if (err) return err;
        endJumps.push(this.emit(Opcodes.OpJump, 9999));

        this.changeOperand(jumpNotTruthyPos, this.currentInstructions().length);
        this.resetPeepholeState();
        continue;
      }

      // Compare subject == pattern
      this.loadSymbol(subjectSym);
      err = this.compile(arm.pattern);
      if (err) return err;
      this.emit(Opcodes.OpEqual);

      const jumpNotTruthyPos = this.emit(Opcodes.OpJumpNotTruthy, 9999);

      // Match — compile value
      err = this.compile(arm.value);
      if (err) return err;
      endJumps.push(this.emit(Opcodes.OpJump, 9999));

      // No match — continue to next arm
      this.changeOperand(jumpNotTruthyPos, this.currentInstructions().length);
      this.resetPeepholeState();
    }

    // If no arm matched and no wildcard, push null
    const lastArm = node.arms[node.arms.length - 1];
    if (lastArm.pattern !== null) {
      this.emit(Opcodes.OpNull);
    }

    // Patch all end jumps to here
    const end = this.currentInstructions().length;
    for (const pos of endJumps) {
      this.changeOperand(pos, end);
    }
    this.resetPeepholeState();

    return null;
  }

  compileFunctionLiteral(node) {
    this.enterScope();

    if (node.name) {
      this.symbolTable.defineFunctionName(node.name);
    }

    for (const param of node.parameters) {
      this.symbolTable.define(param.value);
    }

    // Define rest param if present
    const hasRestParam = !!node.restParam;
    if (hasRestParam) {
      this.symbolTable.define(node.restParam.value);
    }

    // Emit default parameter fill-in code (BEFORE type checks)
    if (node.defaults) {
      for (let i = 0; i < node.defaults.length; i++) {
        if (node.defaults[i] !== null) {
          const sym = this.symbolTable.resolve(node.parameters[i].value);
          // if (param == null) { param = default }
          this.loadSymbol(sym);
          this.emit(Opcodes.OpNull);
          this.emit(Opcodes.OpEqual);
          const jumpPos = this.emit(Opcodes.OpJumpNotTruthy, 0xFFFF);
          const err = this.compile(node.defaults[i]);
          if (err) return err;
          this.emit(sym.scope === 'LOCAL' ? Opcodes.OpSetLocal : Opcodes.OpSetGlobal, sym.index);
          this.changeOperand(jumpPos, this.currentInstructions().length);
        }
      }
    }

    // Emit type checks for annotated parameters (AFTER defaults applied)
    if (node.paramTypes) {
      for (let i = 0; i < node.paramTypes.length; i++) {
        if (node.paramTypes[i]) {
          const sym = this.symbolTable.resolve(node.parameters[i].value);
          const typeIdx = this.addConstant(node.paramTypes[i]); // store type name as string constant
          this.emit(Opcodes.OpTypeCheck, sym.index, typeIdx);
        }
      }
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

    const fn = new CompiledFunction(instructions, numLocals, node.parameters.length, hasRestParam);
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

  resetPeepholeState() {
    const scope = this.currentScope();
    scope.lastInstruction = new EmittedInstruction(undefined, 0);
    scope.previousInstruction = new EmittedInstruction(undefined, 0);
    scope.intStackDepth = 0;
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
