// WASM Compiler for Monkey Language
// Walks the AST and emits WebAssembly bytecode via the binary encoder.
// Supports: integers, floats, booleans, arithmetic, comparisons, let bindings,
// if/else, while/for loops, functions, return, break/continue.

import { WasmModuleBuilder, FuncBodyBuilder, Op, ValType, ExportKind } from './wasm.js';
import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import * as ast from './ast.js';

// Compilation environment — tracks variable bindings per scope
class Scope {
  constructor(parent = null) {
    this.parent = parent;
    this.vars = new Map(); // name → { index, type }
    this.nextLocal = parent ? 0 : 0; // set by compiler
  }

  define(name, index, type = ValType.i32) {
    this.vars.set(name, { index, type });
  }

  resolve(name) {
    if (this.vars.has(name)) return this.vars.get(name);
    if (this.parent) return this.parent.resolve(name);
    return null;
  }
}

// WASM Compiler
export class WasmCompiler {
  constructor() {
    this.builder = new WasmModuleBuilder();
    this.functions = []; // [{name, index, params, scope}]
    this.globalScope = new Scope();
    this.currentFunc = null;
    this.currentBody = null;
    this.currentScope = null;
    this.nextParamIndex = 0;
    this.nextLocalIndex = 0;
    this.loopStack = []; // for break/continue: [{breakLabel, continueLabel}]
    this.errors = [];

    // Add 1 page of memory for strings/arrays (future use)
    this.builder.addMemory(1);
    this.builder.addExport('memory', ExportKind.Memory, 0);

    // Heap pointer global (for future string/array allocation)
    this.heapPtr = this.builder.addGlobal(ValType.i32, true, 1024); // start heap at 1024
  }

  compile(input) {
    const lexer = new Lexer(input);
    const parser = new Parser(lexer);
    const program = parser.parseProgram();

    if (parser.errors.length > 0) {
      this.errors = parser.errors;
      return null;
    }

    return this.compileProgram(program);
  }

  compileProgram(program) {
    // First pass: collect top-level function definitions
    for (const stmt of program.statements) {
      if (stmt instanceof ast.LetStatement &&
          stmt.value instanceof ast.FunctionLiteral) {
        this._declareFunction(stmt.name.value, stmt.value);
      }
    }

    // Create a "main" function for top-level code
    const mainType = this.builder.addType([], [ValType.i32]);
    const { index: mainIdx, body: mainBody } = this.builder.addFunction([], [ValType.i32]);
    this.builder.addExport('main', ExportKind.Func, mainIdx);

    this.currentFunc = { name: 'main', index: mainIdx };
    this.currentBody = mainBody;
    this.currentScope = new Scope(this.globalScope);
    this.nextParamIndex = 0;
    this.nextLocalIndex = 0;

    let lastIsExpr = false;
    for (let i = 0; i < program.statements.length; i++) {
      const stmt = program.statements[i];
      lastIsExpr = false;

      if (stmt instanceof ast.LetStatement &&
          stmt.value instanceof ast.FunctionLiteral) {
        // Already handled in first pass
        continue;
      }

      if (stmt instanceof ast.ExpressionStatement) {
        this.compileNode(stmt.expression);
        if (i < program.statements.length - 1) {
          // Drop intermediate expression results
          mainBody.drop();
        } else {
          lastIsExpr = true;
        }
      } else if (stmt instanceof ast.ReturnStatement) {
        this.compileNode(stmt.returnValue);
        mainBody.return_();
        lastIsExpr = true;
      } else {
        this.compileStatement(stmt);
      }
    }

    if (!lastIsExpr) {
      // Default return 0 if no expression result
      mainBody.i32Const(0);
    }

    // Now compile all collected functions
    this._compileFunctions();

    return this.builder;
  }

  _declareFunction(name, funcLit) {
    const params = funcLit.parameters.map(() => ValType.i32);
    const results = [ValType.i32]; // all functions return i32 for now

    const { index, body } = this.builder.addFunction(params, results);
    this.builder.addExport(name, ExportKind.Func, index);

    this.functions.push({
      name, index, body, funcLit, params,
    });

    // Register in global scope so calls can find it
    this.globalScope.define(name, index, 'func');
  }

  _compileFunctions() {
    for (const func of this.functions) {
      const prevBody = this.currentBody;
      const prevScope = this.currentScope;
      const prevFunc = this.currentFunc;
      const prevLocalIdx = this.nextLocalIndex;
      const prevParamIdx = this.nextParamIndex;

      this.currentBody = func.body;
      this.currentFunc = func;
      this.currentScope = new Scope(this.globalScope);
      this.nextParamIndex = 0;
      this.nextLocalIndex = func.params.length;

      // Bind parameters
      for (const param of func.funcLit.parameters) {
        const name = param.value || param.token?.literal;
        this.currentScope.define(name, this.nextParamIndex, ValType.i32);
        this.nextParamIndex++;
      }

      // Compile function body
      const body = func.funcLit.body;
      this._compileBlockReturning(body);

      this.currentBody = prevBody;
      this.currentScope = prevScope;
      this.currentFunc = prevFunc;
      this.nextLocalIndex = prevLocalIdx;
      this.nextParamIndex = prevParamIdx;
    }
  }

  _compileBlockReturning(block) {
    const stmts = block.statements;
    if (stmts.length === 0) {
      this.currentBody.i32Const(0);
      return;
    }

    for (let i = 0; i < stmts.length; i++) {
      const stmt = stmts[i];
      const isLast = i === stmts.length - 1;

      if (stmt instanceof ast.ReturnStatement) {
        this.compileNode(stmt.returnValue);
        this.currentBody.return_();
        if (!isLast) continue;
        return;
      }

      if (stmt instanceof ast.ExpressionStatement) {
        this.compileNode(stmt.expression);
        if (!isLast) {
          this.currentBody.drop();
        }
        // Last expression: leave on stack as return value
      } else {
        this.compileStatement(stmt);
        if (isLast) {
          this.currentBody.i32Const(0); // statements don't produce values
        }
      }
    }
  }

  compileStatement(stmt) {
    if (stmt instanceof ast.LetStatement) {
      this.compileLetStatement(stmt);
    } else if (stmt instanceof ast.ReturnStatement) {
      this.compileNode(stmt.returnValue);
      this.currentBody.return_();
    } else if (stmt instanceof ast.ExpressionStatement) {
      this.compileNode(stmt.expression);
      this.currentBody.drop();
    } else if (stmt instanceof ast.BreakStatement) {
      // break jumps to the block wrapping the loop
      if (this.loopStack.length > 0) {
        const loop = this.loopStack[this.loopStack.length - 1];
        this.currentBody.br(loop.breakLabel);
      }
    } else if (stmt instanceof ast.ContinueStatement) {
      if (this.loopStack.length > 0) {
        const loop = this.loopStack[this.loopStack.length - 1];
        this.currentBody.br(loop.continueLabel);
      }
    }
  }

  compileLetStatement(stmt) {
    const name = stmt.name.value;
    // Allocate a local
    const localIdx = this.nextLocalIndex++;
    this.currentBody.addLocal(ValType.i32);
    this.currentScope.define(name, localIdx, ValType.i32);

    if (stmt.value) {
      this.compileNode(stmt.value);
      this.currentBody.localSet(localIdx);
    }
  }

  compileNode(node) {
    if (node instanceof ast.IntegerLiteral) {
      this.currentBody.i32Const(node.value);
    } else if (node instanceof ast.FloatLiteral) {
      // For now, truncate floats to i32
      this.currentBody.i32Const(Math.trunc(node.value));
    } else if (node instanceof ast.BooleanLiteral) {
      this.currentBody.i32Const(node.value ? 1 : 0);
    } else if (node instanceof ast.NullLiteral) {
      this.currentBody.i32Const(0);
    } else if (node instanceof ast.Identifier) {
      this.compileIdentifier(node);
    } else if (node instanceof ast.PrefixExpression) {
      this.compilePrefixExpression(node);
    } else if (node instanceof ast.InfixExpression) {
      this.compileInfixExpression(node);
    } else if (node instanceof ast.IfExpression) {
      this.compileIfExpression(node);
    } else if (node instanceof ast.CallExpression) {
      this.compileCallExpression(node);
    } else if (node instanceof ast.FunctionLiteral) {
      // Anonymous function — not supported as value in WASM yet, push 0
      this.currentBody.i32Const(0);
    } else if (node instanceof ast.WhileExpression) {
      this.compileWhileExpression(node);
    } else if (node instanceof ast.ForExpression) {
      this.compileForExpression(node);
    } else if (node instanceof ast.AssignExpression) {
      this.compileAssignExpression(node);
    } else if (node instanceof ast.BlockStatement) {
      this._compileBlockReturning(node);
    } else if (node instanceof ast.TernaryExpression) {
      // condition ? consequence : alternative
      this.compileNode(node.condition);
      this.currentBody.if_(ValType.i32);
      this.compileNode(node.consequence);
      this.currentBody.else_();
      this.compileNode(node.alternative);
      this.currentBody.end();
    } else if (node instanceof ast.StringLiteral) {
      // Strings not yet supported in WASM — push 0
      this.currentBody.i32Const(0);
    } else if (node instanceof ast.ArrayLiteral) {
      // Arrays not yet supported — push 0
      this.currentBody.i32Const(0);
    } else if (node instanceof ast.HashLiteral) {
      this.currentBody.i32Const(0);
    } else {
      // Unknown node type — push 0
      this.currentBody.i32Const(0);
    }
  }

  compileIdentifier(node) {
    const name = node.value;
    const binding = this.currentScope.resolve(name);
    if (binding) {
      if (binding.type === 'func') {
        // Can't use function as value in WASM (no funcref yet)
        this.currentBody.i32Const(0);
      } else {
        this.currentBody.localGet(binding.index);
      }
    } else {
      // Undefined variable
      this.errors.push(`undefined variable: ${name}`);
      this.currentBody.i32Const(0);
    }
  }

  compilePrefixExpression(node) {
    this.compileNode(node.right);
    switch (node.operator) {
      case '-':
        // negate: 0 - value
        this.currentBody.i32Const(0);
        // Swap: we need 0 on the bottom, value on top
        // WASM doesn't have swap, so use a local
        // Actually, emit 0 first then subtract
        // Fix: emit 0 first, then the value, then sub
        break;
      case '!':
        this.currentBody.emit(Op.i32_eqz);
        break;
      default:
        // Unknown prefix
        break;
    }
  }

  compileInfixExpression(node) {
    // Special case: short-circuit && and ||
    if (node.operator === '&&') {
      this.compileNode(node.left);
      this.currentBody.if_(ValType.i32);
      this.compileNode(node.right);
      this.currentBody.else_();
      this.currentBody.i32Const(0);
      this.currentBody.end();
      return;
    }
    if (node.operator === '||') {
      this.compileNode(node.left);
      this.currentBody.localTee(this._getTempLocal());
      this.currentBody.if_(ValType.i32);
      this.currentBody.localGet(this._getTempLocal());
      this.currentBody.else_();
      this.compileNode(node.right);
      this.currentBody.end();
      return;
    }

    this.compileNode(node.left);
    this.compileNode(node.right);

    switch (node.operator) {
      case '+':  this.currentBody.emit(Op.i32_add); break;
      case '-':  this.currentBody.emit(Op.i32_sub); break;
      case '*':  this.currentBody.emit(Op.i32_mul); break;
      case '/':  this.currentBody.emit(Op.i32_div_s); break;
      case '%':  this.currentBody.emit(Op.i32_rem_s); break;
      case '==': this.currentBody.emit(Op.i32_eq); break;
      case '!=': this.currentBody.emit(Op.i32_ne); break;
      case '<':  this.currentBody.emit(Op.i32_lt_s); break;
      case '>':  this.currentBody.emit(Op.i32_gt_s); break;
      case '<=': this.currentBody.emit(Op.i32_le_s); break;
      case '>=': this.currentBody.emit(Op.i32_ge_s); break;
      case '&':  this.currentBody.emit(Op.i32_and); break;
      case '|':  this.currentBody.emit(Op.i32_or); break;
      case '^':  this.currentBody.emit(Op.i32_xor); break;
      case '<<': this.currentBody.emit(Op.i32_shl); break;
      case '>>': this.currentBody.emit(Op.i32_shr_s); break;
      default:
        this.errors.push(`unsupported operator: ${node.operator}`);
        break;
    }
  }

  compileIfExpression(node) {
    this.compileNode(node.condition);

    if (node.alternative) {
      this.currentBody.if_(ValType.i32);
      this._compileBlockReturning(node.consequence);
      this.currentBody.else_();
      this._compileBlockReturning(node.alternative);
      this.currentBody.end();
    } else {
      this.currentBody.if_(ValType.i32);
      this._compileBlockReturning(node.consequence);
      this.currentBody.else_();
      this.currentBody.i32Const(0);
      this.currentBody.end();
    }
  }

  compileCallExpression(node) {
    // Compile arguments
    for (const arg of node.arguments) {
      this.compileNode(arg);
    }

    // Find function
    if (node.function instanceof ast.Identifier) {
      const name = node.function.value;
      const binding = this.currentScope.resolve(name);
      if (binding && binding.type === 'func') {
        this.currentBody.call(binding.index);
      } else {
        this.errors.push(`unknown function: ${name}`);
        // Clean up args from stack and push 0
        for (let i = 0; i < node.arguments.length; i++) {
          this.currentBody.drop();
        }
        this.currentBody.i32Const(0);
      }
    } else {
      // Indirect call not supported yet
      for (let i = 0; i < node.arguments.length; i++) {
        this.currentBody.drop();
      }
      this.currentBody.i32Const(0);
    }
  }

  compileWhileExpression(node) {
    // block $break
    //   loop $continue
    //     condition
    //     br_if (not condition) $break
    //     body
    //     br $continue
    //   end
    // end
    // push 0 (while returns null/0)

    this.currentBody.block(); // $break (label 1 from inside loop)
    this.currentBody.loop();  // $continue (label 0 from inside loop)

    this.loopStack.push({ breakLabel: 1, continueLabel: 0 });

    this.compileNode(node.condition);
    this.currentBody.emit(Op.i32_eqz);
    this.currentBody.brIf(1); // break if condition is false

    // Compile body, drop result
    this._compileBlockStatements(node.body);

    this.currentBody.br(0); // continue

    this.loopStack.pop();

    this.currentBody.end(); // end loop
    this.currentBody.end(); // end block

    this.currentBody.i32Const(0); // while produces 0
  }

  compileForExpression(node) {
    // Compile init
    if (node.init) {
      if (node.init instanceof ast.LetStatement) {
        this.compileLetStatement(node.init);
      } else {
        this.compileNode(node.init);
        this.currentBody.drop();
      }
    }

    this.currentBody.block(); // $break
    this.currentBody.loop();  // $continue

    this.loopStack.push({ breakLabel: 1, continueLabel: 0 });

    // Condition
    if (node.condition) {
      this.compileNode(node.condition);
      this.currentBody.emit(Op.i32_eqz);
      this.currentBody.brIf(1);
    }

    // Body
    this._compileBlockStatements(node.body);

    // Update
    if (node.update) {
      this.compileNode(node.update);
      this.currentBody.drop();
    }

    this.currentBody.br(0);

    this.loopStack.pop();

    this.currentBody.end();
    this.currentBody.end();

    this.currentBody.i32Const(0);
  }

  compileAssignExpression(node) {
    const name = node.name.value || node.name;
    const binding = this.currentScope.resolve(name);
    if (binding) {
      this.compileNode(node.value);
      this.currentBody.localTee(binding.index); // assign and leave value on stack
    } else {
      this.errors.push(`undefined variable for assignment: ${name}`);
      this.currentBody.i32Const(0);
    }
  }

  _compileBlockStatements(block) {
    for (const stmt of block.statements) {
      if (stmt instanceof ast.ExpressionStatement) {
        this.compileNode(stmt.expression);
        this.currentBody.drop();
      } else if (stmt instanceof ast.ReturnStatement) {
        this.compileNode(stmt.returnValue);
        this.currentBody.return_();
      } else {
        this.compileStatement(stmt);
      }
    }
  }

  // Temp local for || operator
  _tempLocal = null;
  _getTempLocal() {
    if (this._tempLocal === null) {
      this._tempLocal = this.nextLocalIndex++;
      this.currentBody.addLocal(ValType.i32);
    }
    return this._tempLocal;
  }
}

// === Prefix negation fix ===
// Override compilePrefixExpression to handle negation correctly
const origPrefix = WasmCompiler.prototype.compilePrefixExpression;
WasmCompiler.prototype.compilePrefixExpression = function(node) {
  if (node.operator === '-') {
    this.currentBody.i32Const(0);
    this.compileNode(node.right);
    this.currentBody.emit(Op.i32_sub);
    return;
  }
  if (node.operator === '!') {
    this.compileNode(node.right);
    this.currentBody.emit(Op.i32_eqz);
    return;
  }
  this.compileNode(node.right);
};

// === High-level API ===

export async function compileAndRun(input) {
  const compiler = new WasmCompiler();
  const builder = compiler.compile(input);

  if (!builder || compiler.errors.length > 0) {
    throw new Error(`Compilation errors: ${compiler.errors.join(', ')}`);
  }

  const binary = builder.build();
  const module = await WebAssembly.compile(binary);
  const instance = await WebAssembly.instantiate(module);
  return instance.exports.main();
}

export async function compileToInstance(input) {
  const compiler = new WasmCompiler();
  const builder = compiler.compile(input);

  if (!builder || compiler.errors.length > 0) {
    throw new Error(`Compilation errors: ${compiler.errors.join(', ')}`);
  }

  const binary = builder.build();
  const module = await WebAssembly.compile(binary);
  return WebAssembly.instantiate(module);
}
