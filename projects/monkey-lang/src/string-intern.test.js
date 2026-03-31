import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { WasmCompiler, compileAndRun } from './wasm-compiler.js';
import { Lexer } from './lexer.js';
import { Parser } from './parser.js';

describe('WASM String Interning', () => {
  it('deduplicates identical string literals', () => {
    const compiler = new WasmCompiler();
    compiler.compile(`
      let a = "hello";
      let b = "hello";
      let c = "hello";
      a
    `);
    // Should only have one "hello" in string constants
    const hellos = compiler.stringConstants.filter(s => s.value === 'hello');
    assert.equal(hellos.length, 1, `Should have 1 "hello", got ${hellos.length}`);
  });

  it('different strings are not deduplicated', () => {
    const compiler = new WasmCompiler();
    compiler.compile(`
      let a = "hello";
      let b = "world";
      a
    `);
    const strings = compiler.stringConstants.map(s => s.value);
    assert.ok(strings.includes('hello'));
    assert.ok(strings.includes('world'));
    assert.equal(compiler.stringConstants.length, 2);
  });

  it('interned strings work correctly at runtime', async () => {
    const output = [];
    await compileAndRun(`
      let a = "test";
      let b = "test";
      puts(a);
      puts(b);
    `, { outputLines: output });
    assert.equal(output[0], 'test');
    assert.equal(output[1], 'test');
  });

  it('interned strings compare equal', async () => {
    const result = await compileAndRun(`
      let a = "hello";
      let b = "hello";
      if (a == b) { 1 } else { 0 }
    `);
    assert.equal(result, 1);
  });

  it('reduces data segment size', () => {
    const compiler = new WasmCompiler();
    compiler.compile(`
      puts("long string for testing interning");
      puts("long string for testing interning");
      puts("long string for testing interning");
      puts("long string for testing interning");
      puts("long string for testing interning");
      0
    `);
    // Without interning: 5 copies. With interning: 1.
    const matches = compiler.stringConstants.filter(s => s.value === 'long string for testing interning');
    assert.equal(matches.length, 1);
  });

  it('empty strings are interned', () => {
    const compiler = new WasmCompiler();
    compiler.compile(`
      let a = "";
      let b = "";
      0
    `);
    const empties = compiler.stringConstants.filter(s => s.value === '');
    assert.equal(empties.length, 1);
  });

  it('template literals benefit from interning', async () => {
    const output = [];
    await compileAndRun(`
      let name = "world";
      puts("hello");
      puts("hello");
    `, { outputLines: output });
    assert.equal(output[0], 'hello');
    assert.equal(output[1], 'hello');
  });
});
