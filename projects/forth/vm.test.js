'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { OP, BytecodeCompiler, BytecodeVM } = require('./vm.js');

// Helper: manually build bytecode
function bytes(...args) {
  const buf = [];
  for (const a of args) {
    if (typeof a === 'number') buf.push(a);
    else if (a === 'i32') {
      // next arg is the i32 value
    }
  }
  return new Uint8Array(buf);
}

function pushI32(val) {
  return [OP.PUSH, (val >> 24) & 0xFF, (val >> 16) & 0xFF, (val >> 8) & 0xFF, val & 0xFF];
}

function u16(val) { return [(val >> 8) & 0xFF, val & 0xFF]; }

// === VM direct bytecode tests ===
test('VM: push and add', () => {
  const vm = new BytecodeVM();
  const code = new Uint8Array([...pushI32(3), ...pushI32(4), OP.ADD, OP.RET]);
  vm.execute(code);
  assert.deepEqual(vm.getStack(), [7]);
});

test('VM: arithmetic', () => {
  const vm = new BytecodeVM();
  const code = new Uint8Array([...pushI32(10), ...pushI32(3), OP.SUB, OP.RET]);
  vm.execute(code);
  assert.deepEqual(vm.getStack(), [7]);
});

test('VM: multiply', () => {
  const vm = new BytecodeVM();
  const code = new Uint8Array([...pushI32(6), ...pushI32(7), OP.MUL, OP.RET]);
  vm.execute(code);
  assert.deepEqual(vm.getStack(), [42]);
});

test('VM: DUP', () => {
  const vm = new BytecodeVM();
  const code = new Uint8Array([...pushI32(5), OP.DUP, OP.RET]);
  vm.execute(code);
  assert.deepEqual(vm.getStack(), [5, 5]);
});

test('VM: SWAP', () => {
  const vm = new BytecodeVM();
  const code = new Uint8Array([...pushI32(3), ...pushI32(5), OP.SWAP, OP.RET]);
  vm.execute(code);
  assert.deepEqual(vm.getStack(), [5, 3]);
});

test('VM: comparison EQ', () => {
  const vm = new BytecodeVM();
  const code = new Uint8Array([...pushI32(5), ...pushI32(5), OP.EQ, OP.RET]);
  vm.execute(code);
  assert.deepEqual(vm.getStack(), [-1]);
});

test('VM: comparison LT', () => {
  const vm = new BytecodeVM();
  const code = new Uint8Array([...pushI32(3), ...pushI32(5), OP.LT, OP.RET]);
  vm.execute(code);
  assert.deepEqual(vm.getStack(), [-1]);
});

test('VM: branch0 (taken)', () => {
  const vm = new BytecodeVM();
  // push 0, branch0 to skip, push 99, ret
  // If taken, skip push 99 -> empty stack + ret
  const code = new Uint8Array([
    ...pushI32(0),          // 0-4
    OP.BRANCH0, 0, 13,     // 5-7: if 0, jump to 13
    ...pushI32(99),         // 8-12
    OP.RET                  // 13
  ]);
  vm.execute(code);
  assert.deepEqual(vm.getStack(), []);
});

test('VM: branch0 (not taken)', () => {
  const vm = new BytecodeVM();
  const code = new Uint8Array([
    ...pushI32(1),          // 0-4
    OP.BRANCH0, 0, 13,     // 5-7: if 0, jump to 13
    ...pushI32(99),         // 8-12
    OP.RET                  // 13
  ]);
  vm.execute(code);
  assert.deepEqual(vm.getStack(), [99]);
});

test('VM: DO LOOP', () => {
  const vm = new BytecodeVM();
  // 5 0 DO I LOOP -> push 0,1,2,3,4
  const code = new Uint8Array([
    ...pushI32(5),        // 0-4
    ...pushI32(0),        // 5-9
    OP.DO,                // 10
    OP.I,                 // 11
    OP.LOOP, 0, 11,      // 12-14: loop back to 11
    OP.RET                // 15
  ]);
  vm.execute(code);
  assert.deepEqual(vm.getStack(), [0, 1, 2, 3, 4]);
});

test('VM: memory store/fetch', () => {
  const vm = new BytecodeVM();
  const code = new Uint8Array([
    ...pushI32(42),       // value
    ...pushI32(100),      // address
    OP.STORE,             // store 42 at addr 100
    ...pushI32(100),      // address
    OP.FETCH,             // fetch from addr 100
    OP.RET
  ]);
  vm.execute(code);
  assert.deepEqual(vm.getStack(), [42]);
});

test('VM: output DOT', () => {
  const vm = new BytecodeVM();
  const code = new Uint8Array([...pushI32(42), OP.DOT, OP.RET]);
  vm.run(code);
  assert.equal(vm.output, '42 ');
});

test('VM: output CR', () => {
  const vm = new BytecodeVM();
  const code = new Uint8Array([OP.CR, OP.RET]);
  vm.run(code);
  assert.equal(vm.output, '\n');
});

test('VM: EMIT', () => {
  const vm = new BytecodeVM();
  const code = new Uint8Array([...pushI32(65), OP.EMIT, OP.RET]);
  vm.run(code);
  assert.equal(vm.output, 'A');
});

test('VM: return stack', () => {
  const vm = new BytecodeVM();
  const code = new Uint8Array([
    ...pushI32(5), OP.TOR,
    ...pushI32(10),
    OP.RFROM,
    OP.RET
  ]);
  vm.execute(code);
  assert.deepEqual(vm.getStack(), [10, 5]);
});

test('VM: OVER', () => {
  const vm = new BytecodeVM();
  const code = new Uint8Array([...pushI32(3), ...pushI32(5), OP.OVER, OP.RET]);
  vm.execute(code);
  assert.deepEqual(vm.getStack(), [3, 5, 3]);
});

test('VM: ROT', () => {
  const vm = new BytecodeVM();
  const code = new Uint8Array([...pushI32(1), ...pushI32(2), ...pushI32(3), OP.ROT, OP.RET]);
  vm.execute(code);
  assert.deepEqual(vm.getStack(), [2, 3, 1]);
});

test('VM: NEGATE', () => {
  const vm = new BytecodeVM();
  const code = new Uint8Array([...pushI32(5), OP.NEGATE, OP.RET]);
  vm.execute(code);
  assert.deepEqual(vm.getStack(), [-5]);
});

test('VM: INC DEC', () => {
  const vm = new BytecodeVM();
  const code = new Uint8Array([...pushI32(5), OP.INC, ...pushI32(5), OP.DEC, OP.RET]);
  vm.execute(code);
  assert.deepEqual(vm.getStack(), [6, 4]);
});

test('VM: CALL word', () => {
  const vm = new BytecodeVM();
  // Define word 0: DOUBLE = DUP +
  const doubleCode = new Uint8Array([OP.DUP, OP.ADD, OP.RET]);
  vm.words[0] = doubleCode;
  // Main: push 5, call DOUBLE
  const code = new Uint8Array([...pushI32(5), OP.CALL, 0, 0, OP.RET]);
  vm.execute(code);
  assert.deepEqual(vm.getStack(), [10]);
});

test('VM: recursive CALL (factorial)', () => {
  const vm = new BytecodeVM();
  // Word 0: FACT = DUP 1 > IF DUP 1- FACT * THEN
  // Bytecode:
  // 0: DUP
  // 1: PUSH 1
  // 6: GT
  // 7: BRANCH0 -> 18 (after MUL)
  // 10: DUP
  // 11: DEC
  // 12: CALL 0
  // 15: MUL
  // 16: BRANCH -> 18
  // 18: RET (well, just fall through to RET)
  const factCode = new Uint8Array([
    OP.DUP,                   // 0
    ...pushI32(1),            // 1-5
    OP.GT,                    // 6
    OP.BRANCH0, 0, 16,       // 7-9: if not >, skip
    OP.DUP,                   // 10
    OP.DEC,                   // 11
    OP.CALL, 0, 0,           // 12-14: call self
    OP.MUL,                   // 15
    OP.RET                    // 16
  ]);
  vm.words[0] = factCode;
  
  const code = new Uint8Array([...pushI32(5), OP.CALL, 0, 0, OP.RET]);
  vm.execute(code);
  assert.deepEqual(vm.getStack(), [120]);
});

// === Compiler tests ===
test('Compiler: disassemble', () => {
  const compiler = new BytecodeCompiler();
  const code = new Uint8Array([...pushI32(42), OP.DUP, OP.ADD, OP.RET]);
  const dis = compiler.disassemble(code);
  assert.ok(dis.includes('PUSH 42'));
  assert.ok(dis.includes('DUP'));
  assert.ok(dis.includes('ADD'));
  assert.ok(dis.includes('RET'));
});

// === Compiler + VM integration ===
test('Compiler: compile DOUBLE and execute', () => {
  const compiler = new BytecodeCompiler();
  // Simulate compileBuffer from Forth interpreter
  const instructions = [
    { type: 'call', word: { name: 'DUP' } },
    { type: 'call', word: { name: '+' } },
  ];
  const compiled = compiler.compileWord('DOUBLE', instructions);
  
  const vm = new BytecodeVM();
  vm.loadWord(compiled);
  
  // Main program: push 5, call DOUBLE
  const main = new Uint8Array([...pushI32(5), OP.CALL, 0, 0, OP.RET]);
  vm.execute(main);
  assert.deepEqual(vm.getStack(), [10]);
});

test('Compiler: compile with IF/THEN', () => {
  const compiler = new BytecodeCompiler();
  // : MYABS DUP 0< IF NEGATE THEN ;
  const instructions = [
    { type: 'call', word: { name: 'DUP' } },
    { type: 'call', word: { name: '0<' } },
    { type: 'branch0', target: 4 },
    { type: 'call', word: { name: 'NEGATE' } },
    // end (target 4)
  ];
  const compiled = compiler.compileWord('MYABS', instructions);
  
  const vm = new BytecodeVM();
  vm.loadWord(compiled);
  
  // Test with -5
  const main1 = new Uint8Array([...pushI32(-5), OP.CALL, 0, 0, OP.RET]);
  vm.execute(main1);
  assert.deepEqual(vm.getStack(), [5]);
  
  // Test with 3
  vm.sp = 0;
  const main2 = new Uint8Array([...pushI32(3), OP.CALL, 0, 0, OP.RET]);
  vm.execute(main2);
  assert.deepEqual(vm.getStack(), [3]);
});

test('Compiler: compile with DO LOOP', () => {
  const compiler = new BytecodeCompiler();
  // : SUM5 0 5 0 DO I + LOOP ;
  const instructions = [
    { type: 'literal', value: 0 },     // 0: accumulator
    { type: 'literal', value: 5 },     // 1: limit
    { type: 'literal', value: 0 },     // 2: start
    { type: 'do' },                     // 3
    { type: 'i' },                      // 4: loop body start
    { type: 'call', word: { name: '+' } }, // 5
    { type: 'loop', target: 4 },       // 6: loop back
  ];
  const compiled = compiler.compileWord('SUM5', instructions);
  
  const vm = new BytecodeVM();
  vm.loadWord(compiled);
  
  const main = new Uint8Array([OP.CALL, 0, 0, OP.RET]);
  vm.execute(main);
  assert.deepEqual(vm.getStack(), [10]); // 0+1+2+3+4 = 10
});

test('Compiler: compile literals', () => {
  const compiler = new BytecodeCompiler();
  const instructions = [
    { type: 'literal', value: 42 },
    { type: 'literal', value: 10 },
    { type: 'call', word: { name: '+' } },
  ];
  const compiled = compiler.compileWord('ADD42', instructions);
  
  const vm = new BytecodeVM();
  vm.loadWord(compiled);
  
  const main = new Uint8Array([OP.CALL, 0, 0, OP.RET]);
  vm.execute(main);
  assert.deepEqual(vm.getStack(), [52]);
});

// === Benchmark: VM vs interpreter ===
test('Benchmark: Fibonacci(20) on VM', () => {
  const vm = new BytecodeVM();
  // FIB: DUP 1 <= IF DROP 1 ELSE DUP 1- RECURSE SWAP 2 - RECURSE + THEN
  const fibCode = new Uint8Array([
    OP.DUP,                   // 0
    ...pushI32(1),            // 1-5
    OP.LE,                    // 6
    OP.BRANCH0, 0, 14,       // 7-9: if not <=, go to ELSE
    OP.DROP,                  // 10
    ...pushI32(1),            // 11-15: wait, this makes offset wrong. Let me recalculate.
  ]);
  
  // Recompute with correct offsets:
  // 0: DUP
  // 1-5: PUSH 1
  // 6: LE
  // 7-9: BRANCH0 -> 16
  // 10: DROP
  // 11-15: PUSH 1
  // 16: RET (base case)
  // ELSE branch:
  // 16: DUP
  // 17: DEC
  // 18-20: CALL 0
  // 21: SWAP
  // 22-26: PUSH 2
  // 27: SUB
  // 28-30: CALL 0
  // 31: ADD
  // 32: RET
  
  // Actually a conditional return is tricky. Let me use branch-around pattern:
  // DUP, PUSH 1, GT, BRANCH0 skip, DUP, DEC, CALL self, SWAP, PUSH 2, SUB, CALL self, ADD, BRANCH end, skip: DROP, PUSH 1, end: RET
  const fib = new Uint8Array([
    OP.DUP,                   // 0
    ...pushI32(1),            // 1-5
    OP.GT,                    // 6
    OP.BRANCH0, 0, 24,       // 7-9: if not >, jump to base case at 24
    OP.DUP,                   // 10
    OP.DEC,                   // 11
    OP.CALL, 0, 0,           // 12-14: fib(n-1)
    OP.SWAP,                  // 15
    ...pushI32(2),            // 16-20
    OP.SUB,                   // 21
    OP.CALL, 0, 0,           // 22-24: wait, 22-24 overlaps with jump target
  ]);
  
  // Let me be more careful:
  const fibCode2 = [];
  const emit = (b) => fibCode2.push(b);
  const emitAll = (arr) => arr.forEach(b => fibCode2.push(b));
  
  emit(OP.DUP);              // 0
  emitAll(pushI32(1));        // 1-5
  emit(OP.GT);                // 6
  emit(OP.BRANCH0);          // 7
  emit(0); emit(26);         // 8-9: jump to 26 (base case)
  emit(OP.DUP);              // 10
  emit(OP.DEC);              // 11
  emit(OP.CALL); emit(0); emit(0); // 12-14: fib(n-1)
  emit(OP.SWAP);              // 15
  emitAll(pushI32(2));        // 16-20
  emit(OP.SUB);               // 21
  emit(OP.CALL); emit(0); emit(0); // 22-24: fib(n-2)
  emit(OP.ADD);               // 25
  emit(OP.RET);               // 26 — also serves as target for base case after conditional  
  // Wait: if base case jumps to 26, we need DROP and PUSH 1 before RET
  // Let me fix:
  
  const fib2 = [];
  const e = (b) => fib2.push(b);
  const ea = (arr) => arr.forEach(b => fib2.push(b));
  
  e(OP.DUP);              // 0
  ea(pushI32(1));          // 1-5
  e(OP.GT);                // 6
  e(OP.BRANCH0); e(0); e(28); // 7-9: jump to base case at 28
  e(OP.DUP);               // 10
  e(OP.DEC);               // 11
  e(OP.CALL); e(0); e(0); // 12-14: fib(n-1)
  e(OP.SWAP);              // 15
  ea(pushI32(2));          // 16-20
  e(OP.SUB);               // 21
  e(OP.CALL); e(0); e(0); // 22-24: fib(n-2)
  e(OP.ADD);               // 25
  e(OP.BRANCH); e(0); e(32); // 26-28: jump past base to RET at 32
  // Base case at 28:
  e(OP.DROP);              // 28 — WAIT, this is where we jump. But 28 is the branch target byte, not instruction
  
  // I messed up the offsets. Let me build it properly:
  const fb = [];
  function pos() { return fb.length; }
  
  fb.push(OP.DUP);                // 0
  fb.push(...pushI32(1));          // 1-5
  fb.push(OP.GT);                  // 6
  const branch0Pos = pos();
  fb.push(OP.BRANCH0, 0, 0);      // 7-9: placeholder
  fb.push(OP.DUP);                 // 10
  fb.push(OP.DEC);                 // 11
  fb.push(OP.CALL, 0, 0);         // 12-14
  fb.push(OP.SWAP);                // 15
  fb.push(...pushI32(2));          // 16-20
  fb.push(OP.SUB);                 // 21
  fb.push(OP.CALL, 0, 0);         // 22-24
  fb.push(OP.ADD);                 // 25
  const branchEndPos = pos();
  fb.push(OP.BRANCH, 0, 0);       // 26-28: jump to end
  const baseCasePos = pos();       // 29
  fb.push(OP.DROP);                // 29
  fb.push(...pushI32(1));          // 30-34
  const endPos = pos();            // 35
  fb.push(OP.RET);                 // 35
  
  // Patch
  fb[branch0Pos + 1] = (baseCasePos >> 8) & 0xFF;
  fb[branch0Pos + 2] = baseCasePos & 0xFF;
  fb[branchEndPos + 1] = (endPos >> 8) & 0xFF;
  fb[branchEndPos + 2] = endPos & 0xFF;
  
  vm.words[0] = new Uint8Array(fb);
  
  const main = new Uint8Array([...pushI32(20), OP.CALL, 0, 0, OP.RET]);
  
  const start = performance.now();
  vm.execute(main);
  const elapsed = performance.now() - start;
  
  assert.equal(vm.getStack()[0], 10946); // fib(20) with base fib(0)=fib(1)=1
  // Actually fib(20) with base case DUP 1 > ... DROP 1 gives fib(0)=1 fib(1)=1 fib(2)=2 ... fib(20)=10946
  // Wait: fib(20) with this definition (n<=1 -> 1) = fib(20) = 10946? Let me check.
  // fib(0)=1, fib(1)=1, fib(2)=2, fib(3)=3, fib(4)=5, fib(5)=8, ..., fib(20)=10946
  // Actually this is shifted fibonacci. The test expects the result matches.
  
  // Let me just verify the result is correct and log timing
  const result = vm.getStack()[0];
  assert.ok(result > 0, `fib(20) = ${result}, took ${elapsed.toFixed(1)}ms`);
});

test('VM: bitwise ops', () => {
  const vm = new BytecodeVM();
  const code = new Uint8Array([...pushI32(0xFF), ...pushI32(0x0F), OP.AND, OP.RET]);
  vm.execute(code);
  assert.deepEqual(vm.getStack(), [15]);
});

test('VM: +LOOP', () => {
  const vm = new BytecodeVM();
  // 10 0 DO I +LOOP(2) -> 0 2 4 6 8
  const code = new Uint8Array([
    ...pushI32(10),       // 0-4
    ...pushI32(0),        // 5-9
    OP.DO,                // 10
    OP.I,                 // 11
    ...pushI32(2),        // 12-16
    OP.PLUSLOOP, 0, 11,   // 17-19
    OP.RET                // 20
  ]);
  vm.execute(code);
  assert.deepEqual(vm.getStack(), [0, 2, 4, 6, 8]);
});
