// Additional match expression tests for WASM compiler
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { compileAndRun } from './wasm-compiler.js';

describe('WASM Match Expression (extended)', () => {
  it('match with first arm matching', async () => {
    assert.strictEqual(await compileAndRun('match (1) { 1 => 100, 2 => 200, _ => 0 }'), 100);
  });

  it('match with middle arm matching', async () => {
    assert.strictEqual(await compileAndRun('match (2) { 1 => 100, 2 => 200, 3 => 300, _ => 0 }'), 200);
  });

  it('match with last non-wildcard arm', async () => {
    assert.strictEqual(await compileAndRun('match (3) { 1 => 100, 2 => 200, 3 => 300, _ => 0 }'), 300);
  });

  it('match falls through to wildcard', async () => {
    assert.strictEqual(await compileAndRun('match (42) { 1 => 100, 2 => 200, _ => 999 }'), 999);
  });

  it('match with single arm', async () => {
    assert.strictEqual(await compileAndRun('match (5) { _ => 42 }'), 42);
  });

  it('match with computed subject', async () => {
    assert.strictEqual(await compileAndRun('match (2 + 3) { 5 => 1, _ => 0 }'), 1);
  });

  it('match with arithmetic in arms', async () => {
    assert.strictEqual(await compileAndRun('match (1) { 1 => 10 + 20, _ => 0 }'), 30);
  });

  it('match with boolean patterns', async () => {
    assert.strictEqual(await compileAndRun('match (true) { true => 1, false => 0, _ => -1 }'), 1);
    assert.strictEqual(await compileAndRun('match (false) { true => 1, false => 0, _ => -1 }'), 0);
  });

  it('match result used in arithmetic', async () => {
    assert.strictEqual(
      await compileAndRun('let x = match (2) { 1 => 10, 2 => 20, _ => 0 }; x * 3'),
      60
    );
  });

  it('match with variable subject', async () => {
    assert.strictEqual(
      await compileAndRun('let n = 3; match (n) { 1 => 1, 2 => 4, 3 => 9, _ => 0 }'),
      9
    );
  });

  it('nested match expressions', async () => {
    assert.strictEqual(
      await compileAndRun('match (1) { 1 => match (2) { 2 => 42, _ => 0 }, _ => -1 }'),
      42
    );
  });

  it('match in function body', async () => {
    assert.strictEqual(
      await compileAndRun(`
        let grade = fn(score) {
          match (score) {
            4 => 100,
            3 => 75,
            2 => 50,
            1 => 25,
            _ => 0
          }
        };
        grade(3)
      `),
      75
    );
  });

  it('match with wildcard arm using _', async () => {
    assert.strictEqual(
      await compileAndRun('match (42) { 1 => 0, _ => 99 }'),
      99
    );
  });

  it('match with no matching arm returns 0', async () => {
    assert.strictEqual(await compileAndRun('match (5) { 1 => 10, 2 => 20 }'), 0);
  });

  it('match with negative patterns', async () => {
    assert.strictEqual(await compileAndRun('match (-1) { -1 => 1, 0 => 2, 1 => 3, _ => 0 }'), 1);
  });

  it('match used in if condition', async () => {
    assert.strictEqual(
      await compileAndRun('if (match (1) { 1 => true, _ => false }) { 42 } else { 0 }'),
      42
    );
  });

  it('multiple matches in sequence', async () => {
    assert.strictEqual(
      await compileAndRun(`
        let a = match (1) { 1 => 10, _ => 0 };
        let b = match (2) { 2 => 20, _ => 0 };
        a + b
      `),
      30
    );
  });
});
