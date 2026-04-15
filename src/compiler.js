// compiler.js — Monkey Bytecode Compiler
// Walks the AST and emits bytecode instructions.

import { Opcodes, make } from './code.js';
import * as AST from './ast.js';
import { MonkeyInteger, MonkeyFloat, MonkeyString } from './object.js';

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
  constructor(name, scope, index, isConst = false) {
    this.name = name;
    this.scope = scope;
    this.index = index;
    this.isConst = isConst;
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

  define(name, isConst = false) {
    const scope = this.outer ? SymbolScopes.LOCAL : SymbolScopes.GLOBAL;
    const sym = new Symbol(name, scope, this.numDefinitions, isConst);
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
const builtinNames = ['len', 'first', 'last', 'rest', 'push', 'puts', 'print', 'type', 'str', 'int', 'bool', 'format', 'range', 'split', 'join', 'trim', 'upper', 'lower', 'contains', 'indexOf', 'replace', 'reverse', 'abs', 'min', 'max', 'startsWith', 'endsWith', 'char', 'ord', 'repeat', 'enumerate', 'zip', 'slice', 'sum', 'count', 'compact', 'unique', 'isEmpty', 'flatten', 'keys', 'values', 'sort'];

/**
 * Compiler: walks the AST and produces Bytecode.
 */
export class Compiler {
  // Pre-scan: find locals that are captured by nested functions AND modified via set
  // Returns a Set of variable names that need Cell wrapping
  static _findMutableCaptures(body, params = []) {
    const locals = new Set(params);  // Track locally-defined names
    const captured = new Set();       // Names captured by nested functions
    const mutatedInNested = new Set(); // Names set inside nested functions
    
    // Walk the body to find let bindings and nested functions
    const walkStmts = (stmts, isNested) => {
      if (!stmts) return;
      for (const stmt of stmts) {
        walkNode(stmt, isNested);
      }
    };
    
    const walkNode = (node, isNested) => {
      if (!node) return;
      
      // Track let bindings at the current (non-nested) level
      if (node instanceof AST.LetStatement && !isNested) {
        locals.add(node.name.value);
        walkNode(node.value, isNested);
        return;
      }
      
      // Track set statements
      if (node instanceof AST.SetStatement) {
        if (isNested && locals.has(node.name.value)) {
          mutatedInNested.add(node.name.value);
        }
        walkNode(node.value, isNested);
        return;
      }
      
      // Nested function: walk its body as nested
      if (node instanceof AST.FunctionLiteral) {
        // Find identifiers referenced in this nested function
        const walkForCaptures = (n) => {
          if (!n) return;
          if (n instanceof AST.Identifier) {
            if (locals.has(n.value)) {
              captured.add(n.value);
            }
          }
          if (n instanceof AST.SetStatement) {
            if (locals.has(n.name.value)) {
              mutatedInNested.add(n.name.value);
            }
            walkForCaptures(n.value);
            return;
          }
          if (n instanceof AST.FunctionLiteral) {
            // Walk into nested-nested functions too
            walkForCaptures(n.body);
            return;
          }
          // Walk children
          for (const key of Object.keys(n)) {
            if (key === 'token') continue;
            const child = n[key];
            if (child && typeof child === 'object') {
              if (Array.isArray(child)) child.forEach(c => walkForCaptures(c));
              else if (child.constructor?.name !== 'Token') walkForCaptures(child);
            }
          }
        };
        walkForCaptures(node.body);
        return;
      }
      
      // Walk children
      for (const key of Object.keys(node)) {
        if (key === 'token') continue;
        const child = node[key];
        if (child && typeof child === 'object') {
          if (Array.isArray(child)) child.forEach(c => walkNode(c, isNested));
          else if (child.constructor?.name !== 'Token') walkNode(child, isNested);
        }
      }
    };
    
    walkStmts(body.statements, false);
    
    // Return locals that are both captured AND mutated in nested functions
    const result = new Set();
    for (const name of mutatedInNested) {
      if (captured.has(name) || mutatedInNested.has(name)) {
        result.add(name);
      }
    }
    return result;
  }
  
  // Constant folding: evaluate constant expressions at compile time
  static foldConstants(node) {
    if (!node) return node;
    
    if (node instanceof AST.InfixExpression) {
      node.left = Compiler.foldConstants(node.left);
      node.right = Compiler.foldConstants(node.right);
      
      if (node.left instanceof AST.IntegerLiteral && node.right instanceof AST.IntegerLiteral) {
        const l = node.left.value, r = node.right.value;
        let result;
        switch (node.operator) {
          case '+': result = l + r; break;
          case '-': result = l - r; break;
          case '*': result = l * r; break;
          case '/': result = r !== 0 ? Math.trunc(l / r) : null; break;
          case '%': result = r !== 0 ? l % r : null; break;
        }
        if (result !== null && result !== undefined) {
          return new AST.IntegerLiteral(node.token, result);
        }
        let boolResult;
        switch (node.operator) {
          case '<': boolResult = l < r; break;
          case '>': boolResult = l > r; break;
          case '==': boolResult = l === r; break;
          case '!=': boolResult = l !== r; break;
          case '<=': boolResult = l <= r; break;
          case '>=': boolResult = l >= r; break;
        }
        if (boolResult !== undefined) {
          return new AST.BooleanLiteral(node.token, boolResult);
        }
      }
      
      if (node.left instanceof AST.StringLiteral && node.right instanceof AST.StringLiteral) {
        if (node.operator === '+') {
          return new AST.StringLiteral(node.token, node.left.value + node.right.value);
        }
      }
      return node;
    }
    
    if (node instanceof AST.PrefixExpression) {
      node.right = Compiler.foldConstants(node.right);
      if (node.right instanceof AST.IntegerLiteral && node.operator === '-') {
        return new AST.IntegerLiteral(node.token, -node.right.value);
      }
      if (node.right instanceof AST.BooleanLiteral && node.operator === '!') {
        return new AST.BooleanLiteral(node.token, !node.right.value);
      }
      return node;
    }
    
    // Recursively fold child nodes
    if (node instanceof AST.Program) { node.statements = node.statements.map(s => Compiler.foldConstants(s)); return node; }
    if (node instanceof AST.ExpressionStatement) { node.expression = Compiler.foldConstants(node.expression); return node; }
    if (node instanceof AST.LetStatement) { node.value = Compiler.foldConstants(node.value); return node; }
    if (node instanceof AST.SetStatement) { node.value = Compiler.foldConstants(node.value); return node; }
    if (node instanceof AST.ReturnStatement) { node.returnValue = Compiler.foldConstants(node.returnValue); return node; }
    if (node instanceof AST.BlockStatement) { node.statements = node.statements.map(s => Compiler.foldConstants(s)); return node; }
    if (node instanceof AST.IfExpression) {
      node.condition = Compiler.foldConstants(node.condition);
      node.consequence = Compiler.foldConstants(node.consequence);
      if (node.alternative) node.alternative = Compiler.foldConstants(node.alternative);
      return node;
    }
    if (node instanceof AST.FunctionLiteral) { node.body = Compiler.foldConstants(node.body); return node; }
    if (node instanceof AST.CallExpression) { if (node.arguments) node.arguments = node.arguments.map(a => Compiler.foldConstants(a)); return node; }
    if (node instanceof AST.ArrayLiteral) { node.elements = node.elements.map(e => Compiler.foldConstants(e)); return node; }
    if (node instanceof AST.IndexExpression) { node.left = Compiler.foldConstants(node.left); node.index = Compiler.foldConstants(node.index); return node; }
    if (node instanceof AST.ForExpression) { node.init = Compiler.foldConstants(node.init); node.condition = Compiler.foldConstants(node.condition); node.update = Compiler.foldConstants(node.update); node.body = Compiler.foldConstants(node.body); return node; }
    if (node instanceof AST.WhileExpression) { node.condition = Compiler.foldConstants(node.condition); node.body = Compiler.foldConstants(node.body); return node; }
    if (node instanceof AST.SwitchExpression) { node.value = Compiler.foldConstants(node.value); node.cases = node.cases.map(c => ({ ...c, value: Compiler.foldConstants(c.value), body: Compiler.foldConstants(c.body) })); if (node.defaultCase) node.defaultCase = Compiler.foldConstants(node.defaultCase); return node; }
    
    return node;
  }

  constructor() {
    this.constants = [];
    this.symbolTable = new SymbolTable();
    this.scopes = [new CompilationScope()];
    this.scopeIndex = 0;
    this.inFunction = false; // Track if we're compiling inside a function body
    this.loopStack = []; // Stack of { breakJumps: [], continueTarget: number }

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
      // Apply constant folding optimization
      Compiler.foldConstants(node);
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
    } else if (node instanceof AST.FloatLiteral) {
      const float = new MonkeyFloat(node.value);
      this.emit(Opcodes.OpConstant, this.addConstant(float));
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
      } else if (!this.lastInstructionIs(Opcodes.OpReturnValue) && !this.lastInstructionIs(Opcodes.OpReturn)) {
        // Consequence didn't leave a value (e.g., set statement) — push null
        this.emit(Opcodes.OpNull);
      }
      // Emit jump to skip alternative
      const jumpPos = this.emit(Opcodes.OpJump, 9999);
      // Patch the jump-not-truthy
      this.changeOperand(jumpNotTruthyPos, this.currentInstructions().length);
      if (node.alternative) {
        this.compile(node.alternative);
        if (this.lastInstructionIs(Opcodes.OpPop)) {
          this.removeLastPop();
        } else if (!this.lastInstructionIs(Opcodes.OpReturnValue) && !this.lastInstructionIs(Opcodes.OpReturn)) {
          // Alternative didn't leave a value — push null
          this.emit(Opcodes.OpNull);
        }
      } else {
        this.emit(Opcodes.OpNull);
      }
      // Patch the jump
      this.changeOperand(jumpPos, this.currentInstructions().length);
    } else if (node instanceof AST.BlockStatement) {
      for (const stmt of node.statements) {
        this.compile(stmt);
        // Dead code elimination: stop after return/break/continue
        if (this.lastInstructionIs(Opcodes.OpReturnValue) || this.lastInstructionIs(Opcodes.OpReturn)) {
          break;
        }
        // Break/continue emit OpJump; after them, remaining block statements are dead
        if ((stmt instanceof AST.ExpressionStatement && stmt.expression instanceof AST.BreakStatement) ||
            (stmt instanceof AST.ExpressionStatement && stmt.expression instanceof AST.ContinueStatement) ||
            stmt instanceof AST.BreakStatement || stmt instanceof AST.ContinueStatement) {
          break;
        }
      }
    } else if (node instanceof AST.WhileExpression) {
      // Init loop result to null
      this.emit(Opcodes.OpNull);
      const resultSym = this.symbolTable.define('__loop_result__');
      if (resultSym.scope === SymbolScopes.GLOBAL) {
        this.emit(Opcodes.OpSetGlobal, resultSym.index);
      } else {
        this.emit(Opcodes.OpSetLocal, resultSym.index);
      }
      
      const loopStart = this.currentInstructions().length;
      const loopCtx = { breakJumps: [], continueTarget: loopStart };
      this.loopStack.push(loopCtx);
      this.compile(node.condition);
      const exitJump = this.emit(Opcodes.OpJumpNotTruthy, 9999);
      this.compile(node.body);
      if (this.lastInstructionIs(Opcodes.OpPop)) {
        this.removeLastPop();
        // Body left a value — store in accumulator
        if (resultSym.scope === SymbolScopes.GLOBAL) {
          this.emit(Opcodes.OpSetGlobal, resultSym.index);
        } else {
          this.emit(Opcodes.OpSetLocal, resultSym.index);
        }
      }
      // If body's last stmt was set/let, no value on stack — skip store
      // Jump back to loop start
      this.emit(Opcodes.OpJump, loopStart);
      // Patch exit jump
      this.changeOperand(exitJump, this.currentInstructions().length);
      // Push accumulated result
      if (resultSym.scope === SymbolScopes.GLOBAL) {
        this.emit(Opcodes.OpGetGlobal, resultSym.index);
      } else {
        this.emit(Opcodes.OpGetLocal, resultSym.index);
      }
      // Patch break jumps to after the result push
      for (const bj of loopCtx.breakJumps) {
        this.changeOperand(bj, this.currentInstructions().length);
      }
      this.loopStack.pop();
    } else if (node instanceof AST.DoWhileExpression) {
      // Init loop result to null
      this.emit(Opcodes.OpNull);
      const resultSym = this.symbolTable.define('__dowhile_result__');
      if (resultSym.scope === SymbolScopes.GLOBAL) {
        this.emit(Opcodes.OpSetGlobal, resultSym.index);
      } else {
        this.emit(Opcodes.OpSetLocal, resultSym.index);
      }
      
      const loopStart = this.currentInstructions().length;
      const loopCtx = { breakJumps: [], continueTarget: -1 };
      this.loopStack.push(loopCtx);
      this.compile(node.body);
      if (this.lastInstructionIs(Opcodes.OpPop)) {
        this.removeLastPop();
        // Body left a value — store in accumulator
        if (resultSym.scope === SymbolScopes.GLOBAL) {
          this.emit(Opcodes.OpSetGlobal, resultSym.index);
        } else {
          this.emit(Opcodes.OpSetLocal, resultSym.index);
        }
      }
      // Continue target is the condition check
      loopCtx.continueTarget = this.currentInstructions().length;
      // Patch any deferred continue jumps
      if (loopCtx.continueJumps) {
        for (const cj of loopCtx.continueJumps) {
          this.changeOperand(cj, loopCtx.continueTarget);
        }
      }
      // Condition at end
      this.compile(node.condition);
      // If truthy, jump back to start
      this.emit(Opcodes.OpJumpNotTruthy, this.currentInstructions().length + 4);
      this.emit(Opcodes.OpJump, loopStart);
      // Push accumulated result
      if (resultSym.scope === SymbolScopes.GLOBAL) {
        this.emit(Opcodes.OpGetGlobal, resultSym.index);
      } else {
        this.emit(Opcodes.OpGetLocal, resultSym.index);
      }
      // Patch break jumps
      for (const bj of loopCtx.breakJumps) {
        this.changeOperand(bj, this.currentInstructions().length);
      }
      this.loopStack.pop();
    } else if (node instanceof AST.ForExpression) {
      // Compile init
      this.compile(node.init);
      
      // Init loop result to null
      this.emit(Opcodes.OpNull);
      const resultSym = this.symbolTable.define('__for_result__');
      if (resultSym.scope === SymbolScopes.GLOBAL) {
        this.emit(Opcodes.OpSetGlobal, resultSym.index);
      } else {
        this.emit(Opcodes.OpSetLocal, resultSym.index);
      }
      
      const loopStart = this.currentInstructions().length;
      // Compile condition
      this.compile(node.condition);
      const exitJump = this.emit(Opcodes.OpJumpNotTruthy, 9999);
      // Continue target is the update, which we'll set after body
      const loopCtx = { breakJumps: [], continueTarget: -1, continueJumps: [] };
      this.loopStack.push(loopCtx);
      // Compile body
      this.compile(node.body);
      if (this.lastInstructionIs(Opcodes.OpPop)) {
        this.removeLastPop();
        // Body left a value — store in accumulator
        if (resultSym.scope === SymbolScopes.GLOBAL) {
          this.emit(Opcodes.OpSetGlobal, resultSym.index);
        } else {
          this.emit(Opcodes.OpSetLocal, resultSym.index);
        }
      }
      // Continue jumps here (to update)
      loopCtx.continueTarget = this.currentInstructions().length;
      // Patch any deferred continue jumps from body
      for (const cj of (loopCtx.continueJumps || [])) {
        this.changeOperand(cj, loopCtx.continueTarget);
      }
      // Compile update
      this.compile(node.update);
      // Jump back to condition
      this.emit(Opcodes.OpJump, loopStart);
      // Patch exit
      this.changeOperand(exitJump, this.currentInstructions().length);
      // Push accumulated result
      if (resultSym.scope === SymbolScopes.GLOBAL) {
        this.emit(Opcodes.OpGetGlobal, resultSym.index);
      } else {
        this.emit(Opcodes.OpGetLocal, resultSym.index);
      }
      // Patch break jumps
      for (const bj of loopCtx.breakJumps) {
        this.changeOperand(bj, this.currentInstructions().length);
      }
      this.loopStack.pop();
    } else if (node instanceof AST.ForInExpression) {
      // Compile for-in as a counter-based loop
      // for (x in iter) { body } =>
      //   __iter = iter; __idx = 0;
      //   while (__idx < len(__iter)) { x = __iter[__idx]; body; __idx++ }
      
      // 1. Store iterable in hidden local
      this.compile(node.iterable);
      const iterSym = this.symbolTable.define('__forin_iter__');
      if (iterSym.scope === SymbolScopes.GLOBAL) {
        this.emit(Opcodes.OpSetGlobal, iterSym.index);
      } else {
        this.emit(Opcodes.OpSetLocal, iterSym.index);
      }
      
      // 2. Init counter to 0
      this.emit(Opcodes.OpConstant, this.addConstant(new MonkeyInteger(0)));
      const idxSym = this.symbolTable.define('__forin_idx__');
      if (idxSym.scope === SymbolScopes.GLOBAL) {
        this.emit(Opcodes.OpSetGlobal, idxSym.index);
      } else {
        this.emit(Opcodes.OpSetLocal, idxSym.index);
      }
      
      // 3. Init loop result to null
      this.emit(Opcodes.OpNull);
      const forinResultSym = this.symbolTable.define('__forin_result__');
      if (forinResultSym.scope === SymbolScopes.GLOBAL) {
        this.emit(Opcodes.OpSetGlobal, forinResultSym.index);
      } else {
        this.emit(Opcodes.OpSetLocal, forinResultSym.index);
      }
      
      // 4. Define iteration variable
      const varName = typeof node.variable === 'string' ? node.variable : node.variable.value;
      this.emit(Opcodes.OpNull); // placeholder value
      const varSym = this.symbolTable.define(varName);
      if (varSym.scope === SymbolScopes.GLOBAL) {
        this.emit(Opcodes.OpSetGlobal, varSym.index);
      } else {
        this.emit(Opcodes.OpSetLocal, varSym.index);
      }
      
      // 4. Loop start
      const loopStart = this.currentInstructions().length;
      const loopCtx = { breakJumps: [], continueTarget: -1, continueJumps: [] };
      this.loopStack.push(loopCtx);
      
      // 5. Condition: idx < len(iter) → compile as len(iter), idx, OpGreaterThan
      // Push len(iter) first (will be "left" = second-popped)
      this.emit(Opcodes.OpGetBuiltin, builtinNames.indexOf('len'));
      if (iterSym.scope === SymbolScopes.GLOBAL) {
        this.emit(Opcodes.OpGetGlobal, iterSym.index);
      } else {
        this.emit(Opcodes.OpGetLocal, iterSym.index);
      }
      this.emit(Opcodes.OpCall, 1); // len(iter) on stack
      // Push idx (will be "right" = first-popped)
      if (idxSym.scope === SymbolScopes.GLOBAL) {
        this.emit(Opcodes.OpGetGlobal, idxSym.index);
      } else {
        this.emit(Opcodes.OpGetLocal, idxSym.index);
      }
      this.emit(Opcodes.OpGreaterThan); // len(iter) > idx = idx < len(iter)
      const exitJump = this.emit(Opcodes.OpJumpNotTruthy, 9999);
      
      // 6. Set x = iter[idx]
      if (iterSym.scope === SymbolScopes.GLOBAL) {
        this.emit(Opcodes.OpGetGlobal, iterSym.index);
      } else {
        this.emit(Opcodes.OpGetLocal, iterSym.index);
      }
      if (idxSym.scope === SymbolScopes.GLOBAL) {
        this.emit(Opcodes.OpGetGlobal, idxSym.index);
      } else {
        this.emit(Opcodes.OpGetLocal, idxSym.index);
      }
      this.emit(Opcodes.OpIndex); // iter[idx]
      if (varSym.scope === SymbolScopes.GLOBAL) {
        this.emit(Opcodes.OpSetGlobal, varSym.index);
      } else {
        this.emit(Opcodes.OpSetLocal, varSym.index);
      }
      
      // 7. Compile body
      this.compile(node.body);
      if (this.lastInstructionIs(Opcodes.OpPop)) {
        this.removeLastPop();
        // Body left a value — store in accumulator
        if (forinResultSym.scope === SymbolScopes.GLOBAL) {
          this.emit(Opcodes.OpSetGlobal, forinResultSym.index);
        } else {
          this.emit(Opcodes.OpSetLocal, forinResultSym.index);
        }
      }
      
      // 8. Continue target: increment idx
      loopCtx.continueTarget = this.currentInstructions().length;
      for (const cj of loopCtx.continueJumps) {
        this.changeOperand(cj, loopCtx.continueTarget);
      }
      
      // idx = idx + 1
      if (idxSym.scope === SymbolScopes.GLOBAL) {
        this.emit(Opcodes.OpGetGlobal, idxSym.index);
      } else {
        this.emit(Opcodes.OpGetLocal, idxSym.index);
      }
      this.emit(Opcodes.OpConstant, this.addConstant(new MonkeyInteger(1)));
      this.emit(Opcodes.OpAdd);
      if (idxSym.scope === SymbolScopes.GLOBAL) {
        this.emit(Opcodes.OpSetGlobal, idxSym.index);
      } else {
        this.emit(Opcodes.OpSetLocal, idxSym.index);
      }
      
      // 9. Jump back to condition
      this.emit(Opcodes.OpJump, loopStart);
      
      // 10. Exit: push accumulated result
      this.changeOperand(exitJump, this.currentInstructions().length);
      if (forinResultSym.scope === SymbolScopes.GLOBAL) {
        this.emit(Opcodes.OpGetGlobal, forinResultSym.index);
      } else {
        this.emit(Opcodes.OpGetLocal, forinResultSym.index);
      }
      
      // Patch break jumps
      for (const bj of loopCtx.breakJumps) {
        this.changeOperand(bj, this.currentInstructions().length);
      }
      this.loopStack.pop();
    } else if (node instanceof AST.BreakStatement) {
      if (this.loopStack.length === 0) {
        throw new Error('break outside of loop');
      }
      const loopCtx = this.loopStack[this.loopStack.length - 1];
      // Push null as the loop's return value when breaking
      this.emit(Opcodes.OpNull);
      const breakPos = this.emit(Opcodes.OpJump, 9999);
      loopCtx.breakJumps.push(breakPos);
    } else if (node instanceof AST.ContinueStatement) {
      if (this.loopStack.length === 0) {
        throw new Error('continue outside of loop');
      }
      const loopCtx = this.loopStack[this.loopStack.length - 1];
      if (loopCtx.continueTarget >= 0) {
        this.emit(Opcodes.OpJump, loopCtx.continueTarget);
      } else {
        // For do-while where continue target isn't known yet, use a placeholder
        const contPos = this.emit(Opcodes.OpJump, 9999);
        if (!loopCtx.continueJumps) loopCtx.continueJumps = [];
        loopCtx.continueJumps.push(contPos);
      }
    } else if (node instanceof AST.DestructureLetStatement) {
      // let [a, b, c] = expr
      // Compile value, store in hidden local, then index into it for each name
      this.compile(node.value);
      const arrSym = this.symbolTable.define('__destructure_arr__');
      if (arrSym.scope === SymbolScopes.GLOBAL) {
        this.emit(Opcodes.OpSetGlobal, arrSym.index);
      } else {
        this.emit(Opcodes.OpSetLocal, arrSym.index);
      }
      for (let i = 0; i < node.names.length; i++) {
        // arr[i]
        if (arrSym.scope === SymbolScopes.GLOBAL) {
          this.emit(Opcodes.OpGetGlobal, arrSym.index);
        } else {
          this.emit(Opcodes.OpGetLocal, arrSym.index);
        }
        this.emit(Opcodes.OpConstant, this.addConstant(new MonkeyInteger(i)));
        this.emit(Opcodes.OpIndex);
        // Store in named local
        const nameSym = this.symbolTable.define(node.names[i].value);
        if (nameSym.scope === SymbolScopes.GLOBAL) {
          this.emit(Opcodes.OpSetGlobal, nameSym.index);
        } else {
          this.emit(Opcodes.OpSetLocal, nameSym.index);
        }
      }
    } else if (node instanceof AST.LetStatement) {
      // Compile value BEFORE defining symbol, so RHS references resolve
      // to outer scope (not the new binding being created).
      // Exception: if RHS is a function literal, set its name for self-reference
      // (enables recursion: let fib = fn(x) { fib(x-1) })
      if (node.value instanceof AST.FunctionLiteral && !node.value.name) {
        node.value.name = node.name.value;
      }
      this.compile(node.value);
      const sym = this.symbolTable.define(node.name.value, node.isConst || false);
      if (sym.scope === SymbolScopes.GLOBAL) {
        this.emit(Opcodes.OpSetGlobal, sym.index);
        // Wrap in Cell if this local needs mutable sharing across closures
        if (this._mutableCaptures?.has(node.name.value)) {
          this.emit(Opcodes.OpGetGlobal, sym.index);
          this.emit(Opcodes.OpMakeCell);
          this.emit(Opcodes.OpSetGlobal, sym.index);
        }
      } else {
        this.emit(Opcodes.OpSetLocal, sym.index);
        // Wrap in Cell if this local needs mutable sharing across closures
        if (this._mutableCaptures?.has(node.name.value)) {
          this.emit(Opcodes.OpGetLocal, sym.index);
          this.emit(Opcodes.OpMakeCell);
          this.emit(Opcodes.OpSetLocal, sym.index);
        }
      }
    } else if (node instanceof AST.SetStatement) {
      // Set mutates an existing variable
      const sym = this.symbolTable.resolve(node.name.value);
      if (!sym) throw new Error(`undefined variable: ${node.name.value}`);
      if (sym.isConst) throw new Error(`Cannot reassign const binding '${node.name.value}'`);
      this.compile(node.value);
      if (sym.scope === SymbolScopes.GLOBAL) {
        this.emit(Opcodes.OpSetGlobal, sym.index);
      } else if (sym.scope === SymbolScopes.LOCAL) {
        this.emit(Opcodes.OpSetLocal, sym.index);
      } else if (sym.scope === SymbolScopes.FREE) {
        this.emit(Opcodes.OpSetFree, sym.index);
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
      // Pre-scan for mutable captures (locals set from nested functions)
      const paramNames = node.parameters.map(p => p.value);
      const mutableCaptures = Compiler._findMutableCaptures(node.body, paramNames);
      
      const prevMutableCaptures = this._mutableCaptures;
      this._mutableCaptures = mutableCaptures;
      
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
      
      this._mutableCaptures = prevMutableCaptures;

      // Peephole optimization: replace OpCall + OpReturnValue with OpTailCall + OpReturnValue
      this.optimizeTailCalls(instructions);

      for (const sym of freeSymbols) {
        // Use raw load to preserve Cell references for shared mutable closures
        // Applies to LOCAL and FREE (Cell passed through intermediate scopes)
        const needsRaw = sym.scope === SymbolScopes.LOCAL || sym.scope === SymbolScopes.FREE;
        this.loadSymbol(sym, needsRaw);
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
    } else if (node instanceof AST.SwitchExpression) {
      const jumpToEndPositions = [];
      
      if (node.value) {
        // Value form: switch (expr) { case val: body ... }
        for (const c of node.cases) {
          this.compile(node.value);
          this.compile(c.value);
          this.emit(Opcodes.OpEqual);
          const jumpNotTruthyPos = this.emit(Opcodes.OpJumpNotTruthy, 9999);
          this._compileSwitchBody(c.body);
          jumpToEndPositions.push(this.emit(Opcodes.OpJump, 9999));
          this.changeOperand(jumpNotTruthyPos, this.currentInstructions().length);
        }
      } else {
        // Condition form: switch { case (cond): body ... }
        for (const c of node.cases) {
          this.compile(c.value);
          const jumpNotTruthyPos = this.emit(Opcodes.OpJumpNotTruthy, 9999);
          this._compileSwitchBody(c.body);
          jumpToEndPositions.push(this.emit(Opcodes.OpJump, 9999));
          this.changeOperand(jumpNotTruthyPos, this.currentInstructions().length);
        }
      }
      
      if (node.defaultCase) {
        this._compileSwitchBody(node.defaultCase);
      } else {
        this.emit(Opcodes.OpNull);
      }
      
      const endPos = this.currentInstructions().length;
      for (const pos of jumpToEndPositions) {
        this.changeOperand(pos, endPos);
      }
    }
  }

  /**
   * Compile a switch case body — handles both BlockStatement and raw expression.
   * Ensures exactly one value is left on the stack.
   */
  _compileSwitchBody(body) {
    if (body instanceof AST.BlockStatement) {
      this.compile(body);
      if (this.lastInstructionIs(Opcodes.OpPop)) {
        this.removeLastPop();
      } else if (!this.lastInstructionIs(Opcodes.OpReturnValue) && !this.lastInstructionIs(Opcodes.OpReturn)) {
        this.emit(Opcodes.OpNull);
      }
    } else {
      // Raw expression — always leaves a value on the stack
      this.compile(body);
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

  loadSymbol(sym, raw = false) {
    switch (sym.scope) {
      case SymbolScopes.GLOBAL: this.emit(Opcodes.OpGetGlobal, sym.index); break;
      case SymbolScopes.LOCAL: 
        if (raw) {
          this.emit(Opcodes.OpGetLocalRaw, sym.index);
        } else {
          this.emit(Opcodes.OpGetLocal, sym.index);
        }
        break;
      case SymbolScopes.BUILTIN: this.emit(Opcodes.OpGetBuiltin, sym.index); break;
      case SymbolScopes.FREE: 
        if (raw) {
          this.emit(Opcodes.OpGetFreeRaw, sym.index);
        } else {
          this.emit(Opcodes.OpGetFree, sym.index);
        }
        break;
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
export class Cell {
  constructor(value) { this.value = value; }
  type() { return 'CELL'; }
  inspect() { return `Cell(${this.value?.inspect?.() ?? String(this.value)})`; }
}

export class Closure {
  constructor(fn, free = []) {
    this.fn = fn;
    this.free = free;
  }

  type() { return 'CLOSURE'; }
  inspect() { return `Closure[${this.fn.inspect()}]`; }
}
