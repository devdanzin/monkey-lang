// WASM Compiler for Monkey Language
// Walks the AST and emits WebAssembly bytecode via the binary encoder.
// Supports: integers, floats, booleans, arithmetic, comparisons, let bindings,
// if/else, while/for loops, functions, return, break/continue, strings, arrays.
//
// Memory layout:
//   0-1023: reserved (data segment for string constants)
//   1024+: bump-allocated heap (strings, arrays)
//
// Value representation (all i32):
//   Integers/booleans: raw i32 values
//   Strings: pointer to heap object [TAG_STRING:i32][length:i32][bytes...]
//   Arrays: pointer to heap object [TAG_ARRAY:i32][length:i32][elem0:i32][elem1:i32]...
//   Null: 0
//
// Heap object tags:
const TAG_STRING = 1;
const TAG_ARRAY = 2;

import { WasmModuleBuilder, FuncBodyBuilder, Op, ValType, ExportKind, encodeULEB128 } from './wasm.js';
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
    this.stringConstants = []; // [{offset, length, value}] — data segment entries
    this.nextDataOffset = 16; // start at 16, skip first bytes as reserved

    // Add 1 page of memory for strings/arrays
    this.builder.addMemory(1);
    this.builder.addExport('memory', ExportKind.Memory, 0);

    // Heap pointer global — starts after data segment (set after compilation)
    this.heapPtr = this.builder.addGlobal(ValType.i32, true, 4096); // default, updated later

    // Runtime function indices (added during compileProgram)
    this._runtimeFuncs = {};
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
    // Add runtime helper functions first
    this._addRuntimeFunctions();

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

    // Add string constant data segments
    for (const sc of this.stringConstants) {
      const encoder = new TextEncoder();
      const strBytes = encoder.encode(sc.value);
      // Layout: [TAG_STRING:i32][length:i32][bytes...]
      const data = new Uint8Array(8 + strBytes.length);
      const view = new DataView(data.buffer);
      view.setInt32(0, TAG_STRING, true);
      view.setInt32(4, strBytes.length, true);
      data.set(strBytes, 8);
      this.builder.addDataSegment(sc.offset, [...data]);
    }

    // Update heap pointer to start after all data segments
    // (We can't change the global init value after creation, so we set it high enough initially)

    return this.builder;
  }

  _addRuntimeFunctions() {
    // Import puts from JS host: env.puts(value: i32) → void
    const putsIdx = this.builder.addImport('env', 'puts', [ValType.i32], []);
    this._runtimeFuncs.puts = putsIdx;
    this.globalScope.define('puts', putsIdx, 'func');

    // Import str from JS host: env.str(value: i32) → i32 (returns string pointer)
    const strIdx = this.builder.addImport('env', 'str', [ValType.i32], [ValType.i32]);
    this._runtimeFuncs.str = strIdx;
    this.globalScope.define('str', strIdx, 'func');

    // Import __str_concat from JS host: env.__str_concat(ptr1: i32, ptr2: i32) → i32
    const strConcatIdx = this.builder.addImport('env', '__str_concat', [ValType.i32, ValType.i32], [ValType.i32]);
    this._runtimeFuncs.strConcat = strConcatIdx;

    // Import __str_eq from JS host: env.__str_eq(ptr1: i32, ptr2: i32) → i32
    const strEqIdx = this.builder.addImport('env', '__str_eq', [ValType.i32, ValType.i32], [ValType.i32]);
    this._runtimeFuncs.strEq = strEqIdx;

    // __alloc(size) → pointer — bump allocator
    const { index: allocIdx, body: allocBody } = this.builder.addFunction(
      [ValType.i32], [ValType.i32]
    );
    allocBody.addLocal(ValType.i32); // local[1] = ptr
    allocBody
      .globalGet(this.heapPtr) // ptr = heap_ptr
      .localTee(1)
      .localGet(0)             // size
      .emit(Op.i32_add)        // heap_ptr + size
      .globalSet(this.heapPtr); // heap_ptr = heap_ptr + size
    allocBody.localGet(1);      // return old heap_ptr
    this._runtimeFuncs.alloc = allocIdx;

    // __len(ptr) → i32 — get length of string or array
    const { index: lenIdx, body: lenBody } = this.builder.addFunction(
      [ValType.i32], [ValType.i32]
    );
    lenBody
      .localGet(0)
      .i32Const(4)
      .emit(Op.i32_add)       // ptr + 4 (skip tag)
      .i32Load();             // load length
    this._runtimeFuncs.len = lenIdx;

    // __array_get(arr_ptr, index) → i32 — array element access
    const { index: arrGetIdx, body: arrGetBody } = this.builder.addFunction(
      [ValType.i32, ValType.i32], [ValType.i32]
    );
    arrGetBody
      .localGet(0)           // arr_ptr
      .i32Const(8)
      .emit(Op.i32_add)      // skip tag + length
      .localGet(1)           // index
      .i32Const(4)
      .emit(Op.i32_mul)      // index * 4
      .emit(Op.i32_add)      // arr_ptr + 8 + index*4
      .i32Load();            // load element
    this._runtimeFuncs.arrayGet = arrGetIdx;

    // __array_set(arr_ptr, index, value) → void
    const { index: arrSetIdx, body: arrSetBody } = this.builder.addFunction(
      [ValType.i32, ValType.i32, ValType.i32], []
    );
    arrSetBody
      .localGet(0)           // arr_ptr
      .i32Const(8)
      .emit(Op.i32_add)
      .localGet(1)           // index
      .i32Const(4)
      .emit(Op.i32_mul)
      .emit(Op.i32_add)      // addr = arr_ptr + 8 + index*4
      .localGet(2)           // value
      .i32Store();           // store value
    this._runtimeFuncs.arraySet = arrSetIdx;

    // __make_array(length) → ptr — allocate an array with given length, zero-initialized
    const { index: makeArrIdx, body: makeArrBody } = this.builder.addFunction(
      [ValType.i32], [ValType.i32]
    );
    makeArrBody.addLocal(ValType.i32); // local[1] = ptr
    makeArrBody
      // Allocate: 8 + length*4 bytes
      .localGet(0).i32Const(4).emit(Op.i32_mul).i32Const(8).emit(Op.i32_add)
      .call(allocIdx)
      .localTee(1)
      // Store tag
      .i32Const(TAG_ARRAY)
      .i32Store()
      // Store length
      .localGet(1).i32Const(4).emit(Op.i32_add)
      .localGet(0)
      .i32Store();
    makeArrBody.localGet(1); // return ptr
    this._runtimeFuncs.makeArray = makeArrIdx;

    // __push(arr_ptr, value) → new_arr_ptr — append element to array (creates new array)
    const { index: pushIdx, body: pushBody } = this.builder.addFunction(
      [ValType.i32, ValType.i32], [ValType.i32]
    );
    pushBody.addLocal(ValType.i32); // local[2] = old_len
    pushBody.addLocal(ValType.i32); // local[3] = new_arr
    pushBody.addLocal(ValType.i32); // local[4] = i
    pushBody
      // old_len = len(arr)
      .localGet(0).call(lenIdx).localSet(2)
      // new_arr = make_array(old_len + 1)
      .localGet(2).i32Const(1).emit(Op.i32_add).call(makeArrIdx).localSet(3)
      // Copy elements
      .i32Const(0).localSet(4)
      .block().loop()
        .localGet(4).localGet(2).emit(Op.i32_ge_s).brIf(1)
        .localGet(3).localGet(4)
        .localGet(0).localGet(4).call(arrGetIdx)
        .call(arrSetIdx)
        .localGet(4).i32Const(1).emit(Op.i32_add).localSet(4)
        .br(0)
      .end().end()
      // Set new element
      .localGet(3).localGet(2).localGet(1).call(arrSetIdx);
    pushBody.localGet(3); // return new array
    this._runtimeFuncs.push = pushIdx;

    // Register builtins in global scope
    this.globalScope.define('__alloc', allocIdx, 'func');
    this.globalScope.define('__len', lenIdx, 'func');
    this.globalScope.define('__array_get', arrGetIdx, 'func');
    this.globalScope.define('__array_set', arrSetIdx, 'func');
    this.globalScope.define('__make_array', makeArrIdx, 'func');
    this.globalScope.define('__push', pushIdx, 'func');
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
      this.compileStringLiteral(node);
    } else if (node instanceof ast.ArrayLiteral) {
      this.compileArrayLiteral(node);
    } else if (node instanceof ast.IndexExpression) {
      this.compileIndexExpression(node);
    } else if (node instanceof ast.HashLiteral) {
      this.currentBody.i32Const(0);
    } else if (node instanceof ast.IndexAssignExpression) {
      this.compileNode(node.left);
      this.compileNode(node.index);
      this.compileNode(node.value);
      // array_set(arr, index, value) — returns void, so we need the value on stack
      // Use a temp local to save the value
      const tmpLocal = this.nextLocalIndex++;
      this.currentBody.addLocal(ValType.i32);
      this.currentBody.localSet(tmpLocal); // save value
      // Now stack: [arr, index], value in local
      // But wait — array_set needs arr, index, value as args
      // We saved value, need to push it back
      const tmpIdx = this.nextLocalIndex++;
      this.currentBody.addLocal(ValType.i32);
      this.currentBody.localSet(tmpIdx); // save index
      const tmpArr = this.nextLocalIndex++;
      this.currentBody.addLocal(ValType.i32);
      this.currentBody.localSet(tmpArr); // save arr

      this.currentBody.localGet(tmpArr);
      this.currentBody.localGet(tmpIdx);
      this.currentBody.localGet(tmpLocal);
      this.currentBody.call(this._runtimeFuncs.arraySet);
      this.currentBody.localGet(tmpLocal); // return the assigned value
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

    // Check if this is string concatenation
    if (node.operator === '+' && this._isStringExpression(node.left, node.right)) {
      this.compileNode(node.left);
      this.compileNode(node.right);
      this.currentBody.call(this._runtimeFuncs.strConcat);
      return;
    }

    // Check if this is string comparison
    if ((node.operator === '==' || node.operator === '!=') &&
        this._isStringExpression(node.left, node.right)) {
      this.compileNode(node.left);
      this.compileNode(node.right);
      this.currentBody.call(this._runtimeFuncs.strEq);
      if (node.operator === '!=') {
        this.currentBody.emit(Op.i32_eqz);
      }
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
    // Check for builtin functions first
    if (node.function instanceof ast.Identifier) {
      const name = node.function.value;

      // Built-in: len(x)
      if (name === 'len' && node.arguments.length === 1) {
        this.compileNode(node.arguments[0]);
        this.currentBody.call(this._runtimeFuncs.len);
        return;
      }

      // Built-in: push(arr, val)
      if (name === 'push' && node.arguments.length === 2) {
        this.compileNode(node.arguments[0]);
        this.compileNode(node.arguments[1]);
        this.currentBody.call(this._runtimeFuncs.push);
        return;
      }

      // Built-in: puts(val) — prints and returns null (0)
      if (name === 'puts' && node.arguments.length >= 1) {
        for (const arg of node.arguments) {
          this.compileNode(arg);
          this.currentBody.call(this._runtimeFuncs.puts);
        }
        this.currentBody.i32Const(0); // puts returns null
        return;
      }

      // Built-in: str(val) — converts to string
      if (name === 'str' && node.arguments.length === 1) {
        this.compileNode(node.arguments[0]);
        this.currentBody.call(this._runtimeFuncs.str);
        return;
      }
    }

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

  // String literal → data segment constant
  compileStringLiteral(node) {
    const str = node.value;
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);

    // Allocate in data segment
    const offset = this.nextDataOffset;
    this.nextDataOffset += 8 + bytes.length; // tag + length + bytes
    // Align to 4 bytes
    this.nextDataOffset = (this.nextDataOffset + 3) & ~3;

    this.stringConstants.push({ offset, length: bytes.length, value: str });

    // Push pointer to the string constant
    this.currentBody.i32Const(offset);
  }

  // Array literal → heap-allocated array
  compileArrayLiteral(node) {
    const elements = node.elements.filter(e => !(e instanceof ast.SpreadElement));
    const len = elements.length;

    // Allocate array: make_array(len)
    this.currentBody.i32Const(len);
    this.currentBody.call(this._runtimeFuncs.makeArray);

    // Store each element
    const arrLocal = this.nextLocalIndex++;
    this.currentBody.addLocal(ValType.i32);
    this.currentBody.localSet(arrLocal);

    for (let i = 0; i < len; i++) {
      this.currentBody.localGet(arrLocal);
      this.currentBody.i32Const(i);
      this.compileNode(elements[i]);
      this.currentBody.call(this._runtimeFuncs.arraySet);
    }

    this.currentBody.localGet(arrLocal); // leave pointer on stack
  }

  // Index expression: arr[idx]
  compileIndexExpression(node) {
    this.compileNode(node.left);
    this.compileNode(node.index);
    this.currentBody.call(this._runtimeFuncs.arrayGet);
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

  // Simple type inference: check if an expression produces a string
  _isStringExpression(...nodes) {
    return nodes.some(n => this._nodeIsString(n));
  }

  _nodeIsString(node) {
    if (node instanceof ast.StringLiteral) return true;
    // str() call returns a string
    if (node instanceof ast.CallExpression &&
        node.function instanceof ast.Identifier &&
        node.function.value === 'str') return true;
    // String concatenation (recursive)
    if (node instanceof ast.InfixExpression &&
        node.operator === '+' &&
        this._isStringExpression(node.left, node.right)) return true;
    return false;
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

// Create default JS host imports for WASM modules
function createWasmImports(outputLines = [], memoryRef = { memory: null }) {
  // Helper to read string from WASM memory
  function readString(ptr) {
    const mem = memoryRef.memory;
    if (!mem || ptr <= 0) return '';
    const view = new DataView(mem.buffer);
    const tag = view.getInt32(ptr, true);
    if (tag !== TAG_STRING) return String(ptr);
    const len = view.getInt32(ptr + 4, true);
    const bytes = new Uint8Array(mem.buffer, ptr + 8, len);
    return new TextDecoder().decode(bytes);
  }

  // Helper to write string into WASM memory (bump allocator via global[0])
  function writeString(str) {
    const mem = memoryRef.memory;
    if (!mem) return 0;
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    const view = new DataView(mem.buffer);

    // Read heap pointer from global — we need to bump-allocate
    // The heap pointer is stored as a WASM global, but we can't read it from JS.
    // Instead, we'll track our own allocation offset.
    if (!memoryRef.jsHeapPtr) memoryRef.jsHeapPtr = 60000; // start high to avoid collisions
    const ptr = memoryRef.jsHeapPtr;
    memoryRef.jsHeapPtr += 8 + bytes.length;
    // Align to 4 bytes
    memoryRef.jsHeapPtr = (memoryRef.jsHeapPtr + 3) & ~3;

    // Write: [TAG_STRING:i32][length:i32][bytes...]
    view.setInt32(ptr, TAG_STRING, true);
    view.setInt32(ptr + 4, bytes.length, true);
    new Uint8Array(mem.buffer).set(bytes, ptr + 8);

    return ptr;
  }

  return {
    env: {
      puts(value) {
        const mem = memoryRef.memory;
        if (mem) {
          const view = new DataView(mem.buffer);
          const formatted = formatWasmValue(value, view);
          outputLines.push(formatted);
        } else {
          outputLines.push(String(value));
        }
      },
      str(value) {
        // Convert value to string representation and store in WASM memory
        const mem = memoryRef.memory;
        if (!mem) return value;
        const view = new DataView(mem.buffer);
        const formatted = formatWasmValue(value, view);
        return writeString(formatted);
      },
      __str_concat(ptr1, ptr2) {
        const s1 = readString(ptr1);
        const s2 = readString(ptr2);
        return writeString(s1 + s2);
      },
      __str_eq(ptr1, ptr2) {
        const s1 = readString(ptr1);
        const s2 = readString(ptr2);
        return s1 === s2 ? 1 : 0;
      },
    },
  };
}

// Format a WASM i32 value as a human-readable string
export function formatWasmValue(value, dataView) {
  // Check if it's a pointer to a heap object
  if (value > 0 && dataView && value + 8 <= dataView.byteLength) {
    try {
      const tag = dataView.getInt32(value, true);
      if (tag === TAG_STRING) {
        const len = dataView.getInt32(value + 4, true);
        if (len >= 0 && len < 100000 && value + 8 + len <= dataView.byteLength) {
          const bytes = new Uint8Array(dataView.buffer, value + 8, len);
          return new TextDecoder().decode(bytes);
        }
      }
      if (tag === TAG_ARRAY) {
        const len = dataView.getInt32(value + 4, true);
        if (len >= 0 && len < 100000) {
          const elems = [];
          for (let i = 0; i < len; i++) {
            const elem = dataView.getInt32(value + 8 + i * 4, true);
            elems.push(formatWasmValue(elem, dataView));
          }
          return '[' + elems.join(', ') + ']';
        }
      }
    } catch (e) {
      // Not a valid pointer, treat as integer
    }
  }
  return String(value);
}

export async function compileAndRun(input, options = {}) {
  const compiler = new WasmCompiler();
  const builder = compiler.compile(input);

  if (!builder || compiler.errors.length > 0) {
    throw new Error(`Compilation errors: ${compiler.errors.join(', ')}`);
  }

  const binary = builder.build();
  const module = await WebAssembly.compile(binary);

  const outputLines = options.outputLines || [];
  const memoryRef = { memory: null };
  const imports = createWasmImports(outputLines, memoryRef);

  const instance = await WebAssembly.instantiate(module, imports);
  memoryRef.memory = instance.exports.memory;

  const result = instance.exports.main();
  return result;
}

export async function compileToInstance(input, options = {}) {
  const compiler = new WasmCompiler();
  const builder = compiler.compile(input);

  if (!builder || compiler.errors.length > 0) {
    throw new Error(`Compilation errors: ${compiler.errors.join(', ')}`);
  }

  const binary = builder.build();
  const module = await WebAssembly.compile(binary);

  const outputLines = options.outputLines || [];
  const memoryRef = { memory: null };
  const imports = createWasmImports(outputLines, memoryRef);

  const instance = await WebAssembly.instantiate(module, imports);
  memoryRef.memory = instance.exports.memory;

  return instance;
}
