// Browser-compatible bundle entry point for Monkey playground
export { Lexer } from './lexer.js';
export { Parser } from './parser.js';
export { Compiler } from './compiler.js';
export { VM } from './vm.js';
export { IR } from './jit.js';
export { monkeyEval } from './evaluator.js';
export { Environment, NULL } from './object.js';
export { STDLIB_SOURCE, withStdlib } from './stdlib.js';
export { Transpiler } from './transpiler.js';
export { WasmCompiler, compileAndRun as wasmCompileAndRun, compileToInstance as wasmCompileToInstance, formatWasmValue } from './wasm-compiler.js';
export { WasmModuleBuilder, FuncBodyBuilder, Op, ValType, ExportKind } from './wasm.js';
export { disassemble as wasmDisassemble } from './wasm-dis.js';
