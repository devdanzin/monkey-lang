import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { VM, OP, assemble, disassemble } from '../src/index.js';

describe('VM basics', () => {
  it('push and print', () => {
    const code = assemble('push 42\nprint\nhalt');
    const vm = new VM(code);
    assert.deepEqual(vm.run(), [42]);
  });

  it('arithmetic', () => {
    const code = assemble('push 10\npush 3\nadd\nprint\nhalt');
    assert.deepEqual(new VM(code).run(), [13]);
  });

  it('subtract', () => {
    const code = assemble('push 10\npush 3\nsub\nprint\nhalt');
    assert.deepEqual(new VM(code).run(), [7]);
  });

  it('multiply', () => {
    const code = assemble('push 6\npush 7\nmul\nprint\nhalt');
    assert.deepEqual(new VM(code).run(), [42]);
  });
});

describe('control flow', () => {
  it('jump', () => {
    const code = assemble('push 1\njmp skip\npush 99\nprint\nhalt\nskip:\npush 2\nprint\nhalt');
    assert.deepEqual(new VM(code).run(), [2]);
  });

  it('conditional jump (jz)', () => {
    const code = assemble('push 0\njz zero\npush 1\nprint\nhalt\nzero:\npush 0\nprint\nhalt');
    assert.deepEqual(new VM(code).run(), [0]);
  });

  it('loop (sum 1 to 5)', () => {
    const src = `
      push 0     ; sum
      store 0
      push 1     ; i
      store 1
    loop:
      load 0     ; sum
      load 1     ; i
      add
      store 0    ; sum += i
      load 1
      push 1
      add
      dup
      store 1    ; i++
      push 6
      lt         ; i < 6?
      jnz loop
      load 0
      print
      halt
    `;
    assert.deepEqual(new VM(assemble(src)).run(), [15]);
  });
});

describe('call/ret', () => {
  it('function call', () => {
    const src = `
      push 5
      call double
      print
      halt
    double:
      push 2
      mul
      ret
    `;
    assert.deepEqual(new VM(assemble(src)).run(), [10]);
  });
});

describe('comparison', () => {
  it('eq true', () => { const c = assemble('push 5\npush 5\neq\nprint\nhalt'); assert.deepEqual(new VM(c).run(), [1]); });
  it('eq false', () => { const c = assemble('push 5\npush 3\neq\nprint\nhalt'); assert.deepEqual(new VM(c).run(), [0]); });
  it('lt', () => { const c = assemble('push 3\npush 5\nlt\nprint\nhalt'); assert.deepEqual(new VM(c).run(), [1]); });
});

describe('stack ops', () => {
  it('dup', () => { const c = assemble('push 7\ndup\nprint\nprint\nhalt'); assert.deepEqual(new VM(c).run(), [7, 7]); });
  it('swap', () => { const c = assemble('push 1\npush 2\nswap\nprint\nprint\nhalt'); assert.deepEqual(new VM(c).run(), [1, 2]); });
});

describe('assemble errors', () => {
  it('unknown mnemonic', () => assert.throws(() => assemble('foo'), /Unknown mnemonic/));
  it('undefined label', () => assert.throws(() => assemble('jmp nowhere\nhalt'), /Undefined label/));
});

describe('disassemble', () => {
  it('roundtrip', () => {
    const code = assemble('push 42\nprint\nhalt');
    const text = disassemble(code);
    assert.ok(text.includes('PUSH'));
    assert.ok(text.includes('42'));
    assert.ok(text.includes('PRINT'));
    assert.ok(text.includes('HALT'));
  });
});
