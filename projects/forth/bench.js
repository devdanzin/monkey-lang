'use strict';
const { Forth } = require('./forth.js');
const { OP, BytecodeVM } = require('./vm.js');

function pushI32(val) {
  return [OP.PUSH, (val >> 24) & 0xFF, (val >> 16) & 0xFF, (val >> 8) & 0xFF, val & 0xFF];
}

// === Benchmark: Fibonacci ===
function benchInterpreter(n, iters) {
  const f = new Forth();
  f.run(': FIB DUP 1 > IF DUP 1- RECURSE SWAP 2 - RECURSE + THEN ;');
  
  const start = performance.now();
  for (let i = 0; i < iters; i++) {
    f.stack = [];
    f.run(`${n} FIB`);
  }
  return performance.now() - start;
}

function benchVM(n, iters) {
  const vm = new BytecodeVM();
  
  // Build FIB bytecode manually
  const fb = [];
  fb.push(OP.DUP);
  fb.push(...pushI32(1));
  fb.push(OP.GT);
  const branch0Pos = fb.length;
  fb.push(OP.BRANCH0, 0, 0);
  fb.push(OP.DUP);
  fb.push(OP.DEC);
  fb.push(OP.CALL, 0, 0);
  fb.push(OP.SWAP);
  fb.push(...pushI32(2));
  fb.push(OP.SUB);
  fb.push(OP.CALL, 0, 0);
  fb.push(OP.ADD);
  const branchEndPos = fb.length;
  fb.push(OP.BRANCH, 0, 0);
  const baseCasePos = fb.length;
  fb.push(OP.DROP);
  fb.push(...pushI32(1));
  const endPos = fb.length;
  fb.push(OP.RET);
  
  fb[branch0Pos + 1] = (baseCasePos >> 8) & 0xFF;
  fb[branch0Pos + 2] = baseCasePos & 0xFF;
  fb[branchEndPos + 1] = (endPos >> 8) & 0xFF;
  fb[branchEndPos + 2] = endPos & 0xFF;
  
  vm.words[0] = new Uint8Array(fb);
  const main = new Uint8Array([...pushI32(n), OP.CALL, 0, 0, OP.RET]);
  
  const start = performance.now();
  for (let i = 0; i < iters; i++) {
    vm.sp = 0;
    vm.rsp = 0;
    vm.execute(main);
  }
  return performance.now() - start;
}

// === Benchmark: Loop sum ===
function benchInterpreterLoop(n) {
  const f = new Forth();
  f.run(`: SUM 0 ${n} 0 DO I + LOOP ;`);
  
  const start = performance.now();
  for (let i = 0; i < 100; i++) {
    f.stack = [];
    f.run('SUM');
  }
  return performance.now() - start;
}

function benchVMLoop(n) {
  const vm = new BytecodeVM();
  
  const code = new Uint8Array([
    ...pushI32(0),
    ...pushI32(n),
    ...pushI32(0),
    OP.DO,
    OP.I,
    OP.ADD,
    OP.LOOP, 0, 16, // loop back to I at offset 16
    OP.RET
  ]);
  // Fix loop target: DO is at 15, I is at 16
  // Actually let me compute: push0=5, pushN=5, push0=5 = 15, DO=1 at 15, I at 16, ADD at 17
  // LOOP target should be 16 (I)
  vm.words[0] = code;
  
  const main = new Uint8Array([OP.CALL, 0, 0, OP.RET]);
  
  const start = performance.now();
  for (let i = 0; i < 100; i++) {
    vm.sp = 0;
    vm.rsp = 0;
    vm.execute(main);
  }
  return performance.now() - start;
}

console.log('=== Forth Interpreter vs Bytecode VM Benchmark ===\n');

// Fibonacci
for (const n of [15, 20, 25]) {
  const iters = n <= 15 ? 100 : n <= 20 ? 10 : 3;
  const interpTime = benchInterpreter(n, iters);
  const vmTime = benchVM(n, iters);
  const speedup = (interpTime / vmTime).toFixed(1);
  console.log(`fib(${n}) × ${iters}:`);
  console.log(`  Interpreter: ${interpTime.toFixed(1)}ms`);
  console.log(`  Bytecode VM: ${vmTime.toFixed(1)}ms`);
  console.log(`  Speedup: ${speedup}×\n`);
}

// Loop sum
for (const n of [1000, 10000]) {
  const interpTime = benchInterpreterLoop(n);
  const vmTime = benchVMLoop(n);
  const speedup = (interpTime / vmTime).toFixed(1);
  console.log(`sum(0..${n}) × 100:`);
  console.log(`  Interpreter: ${interpTime.toFixed(1)}ms`);
  console.log(`  Bytecode VM: ${vmTime.toFixed(1)}ms`);
  console.log(`  Speedup: ${speedup}×\n`);
}
