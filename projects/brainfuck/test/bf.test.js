import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { interpret, compile, minify } from '../src/index.js';

describe('interpret', () => {
  it('Hello World', () => {
    const hello = '++++++++[>++++[>++>+++>+++>+<<<<-]>+>+>->>+[<]<-]>>.>---.+++++++..+++.>>.<-.<.+++.------.--------.>>+.>++.';
    assert.equal(interpret(hello), 'Hello World!\n');
  });

  it('simple output', () => {
    // Output 'A' (65)
    assert.equal(interpret('+'.repeat(65) + '.'), 'A');
  });

  it('input echo', () => {
    assert.equal(interpret(',.', 'X'), 'X');
  });

  it('add two numbers', () => {
    // Add 3 + 2 and output (ASCII 5 = ENQ)
    const add = '+++>++<[->+<]>.';
    assert.equal(interpret(add).charCodeAt(0), 5);
  });

  it('wrapping (255 + 1 = 0)', () => {
    assert.equal(interpret('-.' ).charCodeAt(0), 255); // 0-1 wraps to 255
  });

  it('loop', () => {
    // Output cell until zero: +++ puts 3, [.-] outputs then decrements
    const code = '+++[.-]';
    const out = interpret(code);
    assert.equal(out.length, 3);
    assert.equal(out.charCodeAt(0), 3);
    assert.equal(out.charCodeAt(1), 2);
    assert.equal(out.charCodeAt(2), 1);
  });

  it('unmatched [ throws', () => {
    assert.throws(() => interpret('['), /Unmatched/);
  });

  it('unmatched ] throws', () => {
    assert.throws(() => interpret(']'), /Unmatched/);
  });
});

describe('compile', () => {
  it('same output as interpret', () => {
    const code = '+'.repeat(72) + '.>' + '+'.repeat(101) + '.>' + '+'.repeat(108) + '..';
    const fn = compile(code);
    assert.equal(fn(), interpret(code));
  });

  it('optimizes repeated ops', () => {
    const fn = compile('+'.repeat(65) + '.');
    assert.equal(fn(), 'A');
  });
});

describe('minify', () => {
  it('strips non-bf chars', () => {
    assert.equal(minify('+ + > . hello [ ] -'), '++>.[]-');
  });
});
