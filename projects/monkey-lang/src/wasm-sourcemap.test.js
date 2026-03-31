import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { WasmCompiler } from './wasm-compiler.js';

describe('WASM Source Maps', () => {
  it('generates source maps for functions', () => {
    const compiler = new WasmCompiler();
    const builder = compiler.compile(`
      let add = fn(a, b) { a + b };
      add(1, 2)
    `);
    const maps = builder.getSourceMaps();
    assert.ok(maps, 'Should have source maps');
    // Should have at least one function with source map entries
    const funcMaps = Object.values(maps);
    assert.ok(funcMaps.length >= 1, 'Should map at least one function');
  });

  it('maps contain offset and line info', () => {
    const compiler = new WasmCompiler();
    const builder = compiler.compile(`
      let f = fn(x) {
        let y = x + 1;
        y * 2
      };
      f(5)
    `);
    const maps = builder.getSourceMaps();
    const funcMaps = Object.values(maps);
    
    for (const entries of funcMaps) {
      if (entries.length > 0) {
        const entry = entries[0];
        assert.ok(typeof entry.offset === 'number', 'Should have offset');
        assert.ok(typeof entry.line === 'number', 'Should have line');
      }
    }
  });

  it('multiple functions have separate maps', () => {
    const compiler = new WasmCompiler();
    const builder = compiler.compile(`
      let add = fn(a, b) { a + b };
      let mul = fn(a, b) { a * b };
      add(1, 2) + mul(3, 4)
    `);
    const maps = builder.getSourceMaps();
    const funcCount = Object.keys(maps).length;
    assert.ok(funcCount >= 2, `Should have maps for at least 2 functions, got ${funcCount}`);
  });

  it('source map entries are ordered by offset', () => {
    const compiler = new WasmCompiler();
    const builder = compiler.compile(`
      let complex = fn(x) {
        let a = x + 1;
        let b = a * 2;
        if (b > 10) { b } else { a }
      };
      complex(5)
    `);
    const maps = builder.getSourceMaps();
    
    for (const entries of Object.values(maps)) {
      for (let i = 1; i < entries.length; i++) {
        assert.ok(entries[i].offset >= entries[i-1].offset,
          `Offsets should be ordered: ${entries[i-1].offset} <= ${entries[i].offset}`);
      }
    }
  });

  it('binary has WASM magic number', () => {
    const compiler = new WasmCompiler();
    compiler.compile('42');
    const binary = compiler.builder.build();
    
    // WASM magic: \0asm
    assert.equal(binary[0], 0x00);
    assert.equal(binary[1], 0x61); // 'a'
    assert.equal(binary[2], 0x73); // 's'
    assert.equal(binary[3], 0x6d); // 'm'
    // Version 1
    assert.equal(binary[4], 0x01);
    assert.equal(binary[5], 0x00);
    assert.equal(binary[6], 0x00);
    assert.equal(binary[7], 0x00);
  });
});
