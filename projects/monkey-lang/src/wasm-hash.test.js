import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { compileAndRun } from './wasm-compiler.js';

describe('WASM Native Hash Map', () => {
  it('creates hash with integer keys', async () => {
    const result = await compileAndRun('let h = {1: 10, 2: 20, 3: 30}; h[2]');
    assert.equal(result, 20);
  });

  it('hash mutation with integer keys', async () => {
    const result = await compileAndRun(`
      let h = {1: 100, 2: 200};
      h[3] = 300;
      h[3]
    `);
    assert.equal(result, 300);
  });

  it('hash overwrite with integer keys', async () => {
    const result = await compileAndRun(`
      let h = {1: 10};
      h[1] = 99;
      h[1]
    `);
    assert.equal(result, 99);
  });

  it('hash missing key returns 0', async () => {
    const result = await compileAndRun(`
      let h = {1: 10, 2: 20};
      h[5]
    `);
    assert.equal(result, 0);
  });

  it('hash with computed integer keys', async () => {
    const result = await compileAndRun(`
      let h = {};
      for (let i = 0; i < 5; i = i + 1) {
        h[i] = i * i;
      }
      h[3]
    `);
    assert.equal(result, 9);
  });

  it('hash survives multiple insertions', async () => {
    const result = await compileAndRun(`
      let h = {};
      h[10] = 1;
      h[20] = 2;
      h[30] = 3;
      h[40] = 4;
      h[50] = 5;
      h[10] + h[20] + h[30] + h[40] + h[50]
    `);
    assert.equal(result, 15);
  });

  it('hash with negative keys', async () => {
    const result = await compileAndRun(`
      let h = {};
      h[0 - 1] = 42;
      h[0 - 1]
    `);
    assert.equal(result, 42);
  });

  it('hash in function', async () => {
    const result = await compileAndRun(`
      let make = fn() {
        let h = {1: 100, 2: 200};
        h
      };
      let m = make();
      m[1] + m[2]
    `);
    assert.equal(result, 300);
  });

  it('hash with string keys falls back to JS', async () => {
    const result = await compileAndRun(`
      let h = {"name": 42};
      h["name"]
    `);
    assert.equal(result, 42);
  });

  it('hash iteration pattern', async () => {
    const result = await compileAndRun(`
      let counts = {};
      let data = [1, 2, 1, 3, 2, 1];
      for (let i = 0; i < len(data); i = i + 1) {
        let key = data[i];
        counts[key] = counts[key] + 1;
      }
      counts[1]
    `);
    assert.equal(result, 3);
  });

  it('match with hash', async () => {
    const result = await compileAndRun(`
      let h = {1: 10, 2: 20};
      let v = h[1];
      match (v) {
        10 => 1
        20 => 2
        _ => 0
      }
    `);
    assert.equal(result, 1);
  });
});
