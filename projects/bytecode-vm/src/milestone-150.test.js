// milestone-150.test.js — Push to 150!

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { run } from './parser.js';

describe('🎯 Bytecode VM 150 Tests', () => {
  it('factorial via recursion-like unrolling', () => {
    assert.equal(run('let a = 1 in let b = a * 2 in let c = b * 3 in let d = c * 4 in let e = d * 5 in e'), 120);
  });

  it('boolean logic chain', () => {
    assert.equal(run('if true then if false then 0 else 1 else 2'), 1);
  });

  it('array index arithmetic', () => {
    assert.equal(run('let xs = [100, 200, 300] in xs[0] + xs[1] + xs[2]'), 600);
  });

  it('len of string in let', () => {
    assert.equal(run('let s = "hello" in len(s)'), 5);
  });

  it('nested let with computation', () => {
    assert.equal(run('let x = 2 in let y = x * x in let z = y * y in z'), 16);
  });
});
