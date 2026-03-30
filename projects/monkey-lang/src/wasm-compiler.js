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
const TAG_CLOSURE = 3;

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

    // Closure support
    this.closureFuncs = []; // [{funcLit, captures, tableIndex, wasmFuncIndex}]
    this.nextTableSlot = 0;

    // Compilation statistics
    this.stats = {
      constantsFolded: 0,
      functionsCompiled: 0,
      closuresCreated: 0,
      stringsAllocated: 0,
      arraysAllocated: 0,
    };

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

    // First pass: collect top-level function names to know what's global
    const topLevelFuncNames = new Set();
    for (const stmt of program.statements) {
      if (stmt instanceof ast.LetStatement &&
          stmt.value instanceof ast.FunctionLiteral) {
        topLevelFuncNames.add(stmt.name.value);
      }
    }

    // Second pass: register non-capturing functions
    for (const stmt of program.statements) {
      if (stmt instanceof ast.LetStatement &&
          stmt.value instanceof ast.FunctionLiteral) {
        const params = new Set(stmt.value.parameters.map(p => p.value || p.token?.literal));
        const hasFreeVars = this._hasFreeVariables(stmt.value, params, topLevelFuncNames);
        if (!hasFreeVars) {
          this._declareFunction(stmt.name.value, stmt.value);
        }
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
        // Check if already handled as a named (non-capturing) function
        const binding = this.currentScope.resolve(stmt.name.value);
        if (binding && binding.type === 'func') {
          continue; // Already handled in first pass
        }
        // Otherwise, compile as a let with a closure value
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

    // Finalize closure table
    if (this.closureFuncs.length > 0) {
      const tableSize = this.closureFuncs.length;
      this.builder.addTable(ValType.funcref, tableSize, tableSize);
      const funcIndices = this.closureFuncs.map(cf => cf.wasmFuncIndex);
      this.builder.addElement(0, 0, funcIndices);
    }

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
      this.compileFunctionLiteral(node);
    } else if (node instanceof ast.WhileExpression) {
      this.compileWhileExpression(node);
    } else if (node instanceof ast.ForExpression) {
      this.compileForExpression(node);
    } else if (node instanceof ast.ForInExpression) {
      this.compileForInExpression(node);
    } else if (node instanceof ast.RangeExpression) {
      this.compileRangeExpression(node);
    } else if (node instanceof ast.DoWhileExpression) {
      this.compileDoWhileExpression(node);
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
    } else if (node instanceof ast.TemplateLiteral) {
      this.compileTemplateLiteral(node);
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
        // Wrap named function as a closure value
        this._wrapFunctionAsClosure(name, binding.index);
      } else {
        this.currentBody.localGet(binding.index);
      }
    } else {
      // Undefined variable
      this.errors.push(`undefined variable: ${name}`);
      this.currentBody.i32Const(0);
    }
  }

  // Create a closure wrapper for a named WASM function so it can be used as a value
  _wrapFunctionAsClosure(name, funcIndex) {
    // Find the function's type signature
    const funcEntry = this.functions.find(f => f.name === name);
    if (!funcEntry) {
      // Runtime function or unknown — just push 0
      this.currentBody.i32Const(0);
      return;
    }

    // Create a wrapper function that takes (env_ptr, ...params) and calls the real function
    const origParams = funcEntry.funcLit.parameters;
    const wrapperParams = [ValType.i32, ...origParams.map(() => ValType.i32)]; // env_ptr + params
    const { index: wrapperIdx, body: wrapperBody } = this.builder.addFunction(wrapperParams, [ValType.i32]);

    // Forward actual params (skip env_ptr at local[0])
    for (let i = 0; i < origParams.length; i++) {
      wrapperBody.localGet(i + 1);
    }
    wrapperBody.call(funcIndex);

    const tableSlot = this.nextTableSlot++;
    this.closureFuncs.push({
      funcLit: funcEntry.funcLit,
      captures: [],
      tableIndex: tableSlot,
      wasmFuncIndex: wrapperIdx,
    });

    // Allocate a minimal closure: [TAG_CLOSURE][table_index][env_ptr=0]
    this.currentBody.i32Const(12);
    this.currentBody.call(this._runtimeFuncs.alloc);
    const closureLocal = this.nextLocalIndex++;
    this.currentBody.addLocal(ValType.i32);
    this.currentBody.localSet(closureLocal);

    this.currentBody.localGet(closureLocal);
    this.currentBody.i32Const(TAG_CLOSURE);
    this.currentBody.i32Store();

    this.currentBody.localGet(closureLocal);
    this.currentBody.i32Const(4);
    this.currentBody.emit(Op.i32_add);
    this.currentBody.i32Const(tableSlot);
    this.currentBody.i32Store();

    this.currentBody.localGet(closureLocal);
    this.currentBody.i32Const(8);
    this.currentBody.emit(Op.i32_add);
    this.currentBody.i32Const(0); // no env
    this.currentBody.i32Store();

    this.currentBody.localGet(closureLocal);
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
    // Constant folding: evaluate at compile time if both operands are constants
    const folded = this._tryConstantFold(node);
    if (folded !== null) {
      this.currentBody.i32Const(folded);
      this.stats.constantsFolded++;
      return;
    }

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

    // Find function
    if (node.function instanceof ast.Identifier) {
      const name = node.function.value;
      const binding = this.currentScope.resolve(name);
      if (binding && binding.type === 'func') {
        // Direct function call
        // Compile arguments
        for (const arg of node.arguments) {
          this.compileNode(arg);
        }
        this.currentBody.call(binding.index);
      } else if (binding) {
        // Variable holding a closure — indirect call
        this._emitClosureCall(node, () => this.currentBody.localGet(binding.index));
      } else {
        this.errors.push(`unknown function: ${name}`);
        this.currentBody.i32Const(0);
      }
    } else {
      // Expression-based call (e.g., immediate function call)
      this._emitClosureCall(node, () => this.compileNode(node.function));
    }
  }

  // Emit a closure call via call_indirect
  _emitClosureCall(node, emitClosure) {
    // Evaluate the closure to get its pointer
    emitClosure();
    const closurePtrLocal = this.nextLocalIndex++;
    this.currentBody.addLocal(ValType.i32);
    this.currentBody.localSet(closurePtrLocal);

    // Load env_ptr from closure (offset 8)
    this.currentBody.localGet(closurePtrLocal);
    this.currentBody.i32Const(8);
    this.currentBody.emit(Op.i32_add);
    this.currentBody.i32Load(); // env_ptr is first arg

    // Compile actual arguments
    for (const arg of node.arguments) {
      this.compileNode(arg);
    }

    // Load table_index from closure (offset 4)
    this.currentBody.localGet(closurePtrLocal);
    this.currentBody.i32Const(4);
    this.currentBody.emit(Op.i32_add);
    this.currentBody.i32Load(); // table index on top

    // call_indirect with type signature: (env_ptr, arg0, arg1, ...) -> i32
    const numParams = node.arguments.length + 1; // +1 for env_ptr
    const paramTypes = Array(numParams).fill(ValType.i32);
    const typeIdx = this.builder.addType(paramTypes, [ValType.i32]);
    this.currentBody.callIndirect(typeIdx);
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

  compileForInExpression(node) {
    // for (x in iterable) { body }
    // Compiles to:
    //   let arr = iterable
    //   let __len = len(arr)
    //   let __i = 0
    //   while (__i < __len) {
    //     let x = arr[__i]
    //     body
    //     __i = __i + 1
    //   }

    // Compile iterable
    this.compileNode(node.iterable);
    const arrLocal = this.nextLocalIndex++;
    this.currentBody.addLocal(ValType.i32);
    this.currentBody.localSet(arrLocal);

    // len = __len(arr)
    this.currentBody.localGet(arrLocal);
    this.currentBody.call(this._runtimeFuncs.len);
    const lenLocal = this.nextLocalIndex++;
    this.currentBody.addLocal(ValType.i32);
    this.currentBody.localSet(lenLocal);

    // i = 0
    const iLocal = this.nextLocalIndex++;
    this.currentBody.addLocal(ValType.i32);
    this.currentBody.i32Const(0);
    this.currentBody.localSet(iLocal);

    // Bind loop variable
    const varLocal = this.nextLocalIndex++;
    this.currentBody.addLocal(ValType.i32);
    this.currentScope.define(node.variable, varLocal, ValType.i32);

    // block $break
    this.currentBody.block();
    this.currentBody.loop(); // $continue

    this.loopStack.push({ breakLabel: 1, continueLabel: 0 });

    // if i >= len, break
    this.currentBody.localGet(iLocal);
    this.currentBody.localGet(lenLocal);
    this.currentBody.emit(Op.i32_ge_s);
    this.currentBody.brIf(1);

    // x = arr[i]
    this.currentBody.localGet(arrLocal);
    this.currentBody.localGet(iLocal);
    this.currentBody.call(this._runtimeFuncs.arrayGet);
    this.currentBody.localSet(varLocal);

    // body
    this._compileBlockStatements(node.body);

    // i++
    this.currentBody.localGet(iLocal);
    this.currentBody.i32Const(1);
    this.currentBody.emit(Op.i32_add);
    this.currentBody.localSet(iLocal);

    this.currentBody.br(0); // continue

    this.loopStack.pop();

    this.currentBody.end(); // end loop
    this.currentBody.end(); // end block

    this.currentBody.i32Const(0); // for-in produces 0
  }

  compileRangeExpression(node) {
    // start..end → array [start, start+1, ..., end-1]
    // Allocate array with (end - start) elements
    this.compileNode(node.start);
    const startLocal = this.nextLocalIndex++;
    this.currentBody.addLocal(ValType.i32);
    this.currentBody.localSet(startLocal);

    this.compileNode(node.end);
    const endLocal = this.nextLocalIndex++;
    this.currentBody.addLocal(ValType.i32);
    this.currentBody.localSet(endLocal);

    // len = end - start
    this.currentBody.localGet(endLocal);
    this.currentBody.localGet(startLocal);
    this.currentBody.emit(Op.i32_sub);
    const lenLocal = this.nextLocalIndex++;
    this.currentBody.addLocal(ValType.i32);
    this.currentBody.localTee(lenLocal);

    // arr = make_array(len)
    this.currentBody.call(this._runtimeFuncs.makeArray);
    const arrLocal = this.nextLocalIndex++;
    this.currentBody.addLocal(ValType.i32);
    this.currentBody.localSet(arrLocal);

    // Fill: for i=0; i<len; i++ → arr[i] = start + i
    const iLocal = this.nextLocalIndex++;
    this.currentBody.addLocal(ValType.i32);
    this.currentBody.i32Const(0);
    this.currentBody.localSet(iLocal);

    this.currentBody.block().loop();
      this.currentBody.localGet(iLocal);
      this.currentBody.localGet(lenLocal);
      this.currentBody.emit(Op.i32_ge_s);
      this.currentBody.brIf(1);

      this.currentBody.localGet(arrLocal);
      this.currentBody.localGet(iLocal);
      this.currentBody.localGet(startLocal);
      this.currentBody.localGet(iLocal);
      this.currentBody.emit(Op.i32_add);
      this.currentBody.call(this._runtimeFuncs.arraySet);

      this.currentBody.localGet(iLocal);
      this.currentBody.i32Const(1);
      this.currentBody.emit(Op.i32_add);
      this.currentBody.localSet(iLocal);
      this.currentBody.br(0);
    this.currentBody.end().end();

    this.currentBody.localGet(arrLocal);
  }

  compileDoWhileExpression(node) {
    // do { body } while (condition)
    this.currentBody.block(); // $break
    this.currentBody.loop();  // $continue

    this.loopStack.push({ breakLabel: 1, continueLabel: 0 });

    // body (always executes at least once)
    this._compileBlockStatements(node.body);

    // condition
    this.compileNode(node.condition);
    this.currentBody.brIf(0); // continue if true

    this.loopStack.pop();

    this.currentBody.end(); // end loop
    this.currentBody.end(); // end block

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

  // Template literal → concatenation of parts
  compileTemplateLiteral(node) {
    if (node.parts.length === 0) {
      // Empty template → empty string
      this.compileStringLiteral({ value: '' });
      return;
    }

    // Compile first part
    const firstPart = node.parts[0];
    if (firstPart instanceof ast.StringLiteral) {
      this.compileStringLiteral(firstPart);
    } else {
      // Expression part — convert to string via str()
      this.compileNode(firstPart);
      this.currentBody.call(this._runtimeFuncs.str);
    }

    // Concatenate remaining parts
    for (let i = 1; i < node.parts.length; i++) {
      const part = node.parts[i];
      if (part instanceof ast.StringLiteral) {
        this.compileStringLiteral(part);
      } else {
        this.compileNode(part);
        this.currentBody.call(this._runtimeFuncs.str);
      }
      this.currentBody.call(this._runtimeFuncs.strConcat);
    }
  }

  // Function literal → closure object on heap
  compileFunctionLiteral(node) {
    // 1. Analyze free variables (captures from current scope)
    const captures = this._findCaptures(node);

    // 2. Create the WASM function with extra env_ptr as first param
    const params = [ValType.i32, ...node.parameters.map(() => ValType.i32)]; // env_ptr + params
    const results = [ValType.i32]; // all functions return i32

    const { index: wasmFuncIdx, body: funcBody } = this.builder.addFunction(params, results);
    const tableSlot = this.nextTableSlot++;

    // 3. Compile the function body in a new scope
    const prevBody = this.currentBody;
    const prevScope = this.currentScope;
    const prevFunc = this.currentFunc;
    const prevLocalIdx = this.nextLocalIndex;
    const prevParamIdx = this.nextParamIndex;
    const prevTempLocal = this._tempLocal;

    this.currentBody = funcBody;
    this.currentFunc = { name: `closure_${tableSlot}`, index: wasmFuncIdx };
    this.currentScope = new Scope(this.globalScope);
    this.nextParamIndex = 0;
    this.nextLocalIndex = params.length;
    this._tempLocal = null;

    // Bind env_ptr as local 0
    const envPtrLocal = 0;

    // Bind actual parameters (starting at local 1)
    for (let i = 0; i < node.parameters.length; i++) {
      const name = node.parameters[i].value || node.parameters[i].token?.literal;
      this.currentScope.define(name, i + 1, ValType.i32);
    }

    // Bind captured variables — read them from the environment
    for (let i = 0; i < captures.length; i++) {
      const localIdx = this.nextLocalIndex++;
      funcBody.addLocal(ValType.i32);
      // Load from env: env_ptr + 4 + i*4
      funcBody
        .localGet(envPtrLocal)
        .i32Const(4 + i * 4)
        .emit(Op.i32_add)
        .i32Load()
        .localSet(localIdx);
      this.currentScope.define(captures[i], localIdx, ValType.i32);
    }

    // Compile function body
    this._compileBlockReturning(node.body);

    // Restore state
    this.currentBody = prevBody;
    this.currentScope = prevScope;
    this.currentFunc = prevFunc;
    this.nextLocalIndex = prevLocalIdx;
    this.nextParamIndex = prevParamIdx;
    this._tempLocal = prevTempLocal;

    // 4. Record for table registration
    this.closureFuncs.push({
      funcLit: node,
      captures,
      tableIndex: tableSlot,
      wasmFuncIndex: wasmFuncIdx,
    });

    // 5. Emit code to create the closure object at runtime
    // Allocate environment: [num_captures:i32][cap0:i32][cap1:i32]...
    const envSize = 4 + captures.length * 4;
    this.currentBody.i32Const(envSize);
    this.currentBody.call(this._runtimeFuncs.alloc);

    const envLocal = this.nextLocalIndex++;
    this.currentBody.addLocal(ValType.i32);
    this.currentBody.localSet(envLocal);

    // Store num captures
    this.currentBody.localGet(envLocal);
    this.currentBody.i32Const(captures.length);
    this.currentBody.i32Store();

    // Store captured variables
    for (let i = 0; i < captures.length; i++) {
      const binding = this.currentScope.resolve(captures[i]);
      this.currentBody.localGet(envLocal);
      this.currentBody.i32Const(4 + i * 4);
      this.currentBody.emit(Op.i32_add);
      if (binding) {
        this.currentBody.localGet(binding.index);
      } else {
        this.currentBody.i32Const(0);
      }
      this.currentBody.i32Store();
    }

    // Allocate closure object: [TAG_CLOSURE:i32][table_index:i32][env_ptr:i32]
    this.currentBody.i32Const(12); // 3 * i32
    this.currentBody.call(this._runtimeFuncs.alloc);

    const closureLocal = this.nextLocalIndex++;
    this.currentBody.addLocal(ValType.i32);
    this.currentBody.localSet(closureLocal);

    // Store tag
    this.currentBody.localGet(closureLocal);
    this.currentBody.i32Const(TAG_CLOSURE);
    this.currentBody.i32Store();

    // Store table index
    this.currentBody.localGet(closureLocal);
    this.currentBody.i32Const(4);
    this.currentBody.emit(Op.i32_add);
    this.currentBody.i32Const(tableSlot);
    this.currentBody.i32Store();

    // Store env_ptr
    this.currentBody.localGet(closureLocal);
    this.currentBody.i32Const(8);
    this.currentBody.emit(Op.i32_add);
    this.currentBody.localGet(envLocal);
    this.currentBody.i32Store();

    // Leave closure pointer on stack
    this.currentBody.localGet(closureLocal);
  }

  // Check if a function literal has free variables (references to non-param, non-global names)
  _hasFreeVariables(funcLit, params, topLevelFuncNames = new Set()) {
    let hasFree = false;
    const walk = (node) => {
      if (!node || hasFree) return;
      if (node instanceof ast.FunctionLiteral) return; // Don't walk into nested functions
      if (node instanceof ast.Identifier) {
        const name = node.value;
        if (!params.has(name) && !topLevelFuncNames.has(name)) {
          const binding = this.globalScope.resolve(name);
          if (!binding) hasFree = true;
        }
      }
      if (node.left) walk(node.left);
      if (node.right) walk(node.right);
      if (node.condition) walk(node.condition);
      if (node.consequence) walk(node.consequence);
      if (node.alternative) walk(node.alternative);
      if (node.expression) walk(node.expression);
      if (node.value && !(node instanceof ast.LetStatement)) walk(node.value);
      if (node instanceof ast.LetStatement && node.value) walk(node.value);
      if (node.returnValue) walk(node.returnValue);
      if (node.index) walk(node.index);
      if (node.function) walk(node.function);
      if (node.body && node.body.statements) {
        for (const stmt of node.body.statements) walk(stmt);
      }
      if (node.statements) {
        for (const stmt of node.statements) walk(stmt);
      }
      if (node.arguments) {
        for (const arg of node.arguments) walk(arg);
      }
      if (node.elements) {
        for (const elem of node.elements) walk(elem);
      }
    };
    if (funcLit.body && funcLit.body.statements) {
      for (const stmt of funcLit.body.statements) walk(stmt);
    }
    return hasFree;
  }

  // Find free variables in a function literal
  _findCaptures(funcLit) {
    const params = new Set(funcLit.parameters.map(p => p.value || p.token?.literal));
    const captures = new Set();

    const walk = (node) => {
      if (!node) return;
      if (node instanceof ast.Identifier) {
        const name = node.value;
        if (!params.has(name) && this.currentScope.resolve(name) &&
            this.currentScope.resolve(name).type !== 'func') {
          captures.add(name);
        }
      }
      // Walk children
      if (node.left) walk(node.left);
      if (node.right) walk(node.right);
      if (node.condition) walk(node.condition);
      if (node.consequence) walk(node.consequence);
      if (node.alternative) walk(node.alternative);
      if (node.expression) walk(node.expression);
      if (node.value) walk(node.value);
      if (node.returnValue) walk(node.returnValue);
      if (node.index) walk(node.index);
      if (node.function) walk(node.function);
      if (node.body && node.body.statements) {
        for (const stmt of node.body.statements) walk(stmt);
      }
      if (node.statements) {
        for (const stmt of node.statements) walk(stmt);
      }
      if (node.arguments) {
        for (const arg of node.arguments) walk(arg);
      }
      if (node.elements) {
        for (const elem of node.elements) walk(elem);
      }
      if (node.parameters) {
        // Don't walk parameter identifiers — they're definitions not references
      }
    };

    if (funcLit.body && funcLit.body.statements) {
      for (const stmt of funcLit.body.statements) walk(stmt);
    }

    return [...captures];
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

  // Constant folding: try to evaluate an expression at compile time
  _tryConstantFold(node) {
    if (!(node instanceof ast.InfixExpression)) return null;

    const left = this._getConstValue(node.left);
    const right = this._getConstValue(node.right);
    if (left === null || right === null) return null;

    switch (node.operator) {
      case '+':  return (left + right) | 0;
      case '-':  return (left - right) | 0;
      case '*':  return Math.imul(left, right);
      case '/':  return right !== 0 ? (left / right) | 0 : null;
      case '%':  return right !== 0 ? (left % right) | 0 : null;
      case '==': return left === right ? 1 : 0;
      case '!=': return left !== right ? 1 : 0;
      case '<':  return left < right ? 1 : 0;
      case '>':  return left > right ? 1 : 0;
      case '<=': return left <= right ? 1 : 0;
      case '>=': return left >= right ? 1 : 0;
      case '&':  return left & right;
      case '|':  return left | right;
      case '^':  return left ^ right;
      case '<<': return left << right;
      case '>>': return left >> right;
      default: return null;
    }
  }

  _getConstValue(node) {
    if (node instanceof ast.IntegerLiteral) return node.value;
    if (node instanceof ast.BooleanLiteral) return node.value ? 1 : 0;
    if (node instanceof ast.InfixExpression) return this._tryConstantFold(node);
    if (node instanceof ast.PrefixExpression && node.operator === '-') {
      const val = this._getConstValue(node.right);
      return val !== null ? -val : null;
    }
    if (node instanceof ast.PrefixExpression && node.operator === '!') {
      const val = this._getConstValue(node.right);
      return val !== null ? (val === 0 ? 1 : 0) : null;
    }
    return null;
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
