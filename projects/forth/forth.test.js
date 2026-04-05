'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Forth, ForthError } = require('./forth.js');

function run(input) {
  const f = new Forth();
  f.run(input);
  return { stack: f.getStack(), output: f.output, forth: f };
}

function stack(input) { return run(input).stack; }
function output(input) { return run(input).output; }

// === Arithmetic ===
test('addition', () => assert.deepEqual(stack('3 4 +'), [7]));
test('subtraction', () => assert.deepEqual(stack('10 3 -'), [7]));
test('multiplication', () => assert.deepEqual(stack('6 7 *'), [42]));
test('division', () => assert.deepEqual(stack('20 4 /'), [5]));
test('mod', () => assert.deepEqual(stack('17 5 MOD'), [2]));
test('/mod', () => assert.deepEqual(stack('17 5 /MOD'), [2, 3]));
test('negate', () => assert.deepEqual(stack('5 NEGATE'), [-5]));
test('abs', () => assert.deepEqual(stack('-7 ABS'), [7]));
test('min max', () => assert.deepEqual(stack('3 7 MIN 3 7 MAX'), [3, 7]));
test('1+ 1-', () => assert.deepEqual(stack('5 1+ 5 1-'), [6, 4]));
test('2* 2/', () => assert.deepEqual(stack('7 2* 7 2/'), [14, 3]));
test('division by zero', () => assert.throws(() => stack('5 0 /'), ForthError));
test('complex arithmetic', () => assert.deepEqual(stack('2 3 + 4 *'), [20]));

// === Bitwise ===
test('AND', () => assert.deepEqual(stack('255 15 AND'), [15]));
test('OR', () => assert.deepEqual(stack('240 15 OR'), [255]));
test('XOR', () => assert.deepEqual(stack('255 15 XOR'), [240]));
test('INVERT', () => assert.deepEqual(stack('0 INVERT'), [-1]));
test('LSHIFT RSHIFT', () => assert.deepEqual(stack('1 4 LSHIFT 16 4 RSHIFT'), [16, 1]));

// === Comparison ===
test('= true', () => assert.deepEqual(stack('5 5 ='), [-1]));
test('= false', () => assert.deepEqual(stack('3 5 ='), [0]));
test('<> true', () => assert.deepEqual(stack('3 5 <>'), [-1]));
test('< true', () => assert.deepEqual(stack('3 5 <'), [-1]));
test('< false', () => assert.deepEqual(stack('5 3 <'), [0]));
test('> true', () => assert.deepEqual(stack('5 3 >'), [-1]));
test('0=', () => assert.deepEqual(stack('0 0= 5 0='), [-1, 0]));
test('0<', () => assert.deepEqual(stack('-3 0<'), [-1]));

// === Stack manipulation ===
test('DUP', () => assert.deepEqual(stack('5 DUP'), [5, 5]));
test('DROP', () => assert.deepEqual(stack('3 5 DROP'), [3]));
test('SWAP', () => assert.deepEqual(stack('3 5 SWAP'), [5, 3]));
test('OVER', () => assert.deepEqual(stack('3 5 OVER'), [3, 5, 3]));
test('ROT', () => assert.deepEqual(stack('1 2 3 ROT'), [2, 3, 1]));
test('-ROT', () => assert.deepEqual(stack('1 2 3 -ROT'), [3, 1, 2]));
test('NIP', () => assert.deepEqual(stack('1 2 3 NIP'), [1, 3]));
test('TUCK', () => assert.deepEqual(stack('1 2 TUCK'), [2, 1, 2]));
test('2DUP', () => assert.deepEqual(stack('3 5 2DUP'), [3, 5, 3, 5]));
test('2DROP', () => assert.deepEqual(stack('1 2 3 4 2DROP'), [1, 2]));
test('2SWAP', () => assert.deepEqual(stack('1 2 3 4 2SWAP'), [3, 4, 1, 2]));
test('2OVER', () => assert.deepEqual(stack('1 2 3 4 2OVER'), [1, 2, 3, 4, 1, 2]));
test('?DUP nonzero', () => assert.deepEqual(stack('5 ?DUP'), [5, 5]));
test('?DUP zero', () => assert.deepEqual(stack('0 ?DUP'), [0]));
test('DEPTH', () => assert.deepEqual(stack('1 2 3 DEPTH'), [1, 2, 3, 3]));
test('PICK', () => assert.deepEqual(stack('10 20 30 2 PICK'), [10, 20, 30, 10]));
test('stack underflow', () => assert.throws(() => stack('DROP'), ForthError));

// === Return stack ===
test('>R R>', () => assert.deepEqual(stack('5 >R 10 R>'), [10, 5]));
test('R@', () => assert.deepEqual(stack('5 >R R@ R>'), [5, 5]));

// === I/O ===
test('. prints number', () => assert.equal(output('42 .'), '42 '));
test('.S prints stack', () => assert.equal(output('1 2 3 .S'), '<3> 1 2 3 '));
test('CR', () => assert.equal(output('CR'), '\n'));
test('SPACE', () => assert.equal(output('SPACE'), ' '));
test('SPACES', () => assert.equal(output('5 SPACES'), '     '));
test('EMIT', () => assert.equal(output('65 EMIT'), 'A'));
test('.R right-aligned', () => assert.equal(output('42 5 .R'), '   42'));
test('." string', () => assert.equal(output('." Hello World"'), 'Hello World'));

// === Colon definitions ===
test('simple definition', () => {
  assert.deepEqual(stack(': DOUBLE DUP + ; 5 DOUBLE'), [10]);
});
test('nested definitions', () => {
  assert.deepEqual(stack(': DOUBLE DUP + ; : QUAD DOUBLE DOUBLE ; 3 QUAD'), [12]);
});
test('definition with literals', () => {
  assert.deepEqual(stack(': ADD5 5 + ; 10 ADD5'), [15]);
});

// === IF/ELSE/THEN ===
test('IF THEN true', () => {
  assert.equal(output(': TEST 1 IF ." yes" THEN ; TEST'), 'yes');
});
test('IF THEN false', () => {
  assert.equal(output(': TEST 0 IF ." yes" THEN ; TEST'), '');
});
test('IF ELSE THEN true', () => {
  assert.equal(output(': TEST 1 IF ." yes" ELSE ." no" THEN ; TEST'), 'yes');
});
test('IF ELSE THEN false', () => {
  assert.equal(output(': TEST 0 IF ." yes" ELSE ." no" THEN ; TEST'), 'no');
});
test('nested IF', () => {
  assert.equal(output(': TEST 1 IF 1 IF ." both" THEN THEN ; TEST'), 'both');
});

// === DO LOOP ===
test('simple DO LOOP', () => {
  assert.equal(output(': TEST 5 0 DO I . LOOP ; TEST'), '0 1 2 3 4 ');
});
test('DO LOOP with step', () => {
  assert.equal(output(': TEST 10 0 DO I . 2 +LOOP ; TEST'), '0 2 4 6 8 ');
});
test('nested DO LOOP', () => {
  assert.equal(output(': TEST 3 0 DO 3 0 DO I . LOOP CR LOOP ; TEST'), '0 1 2 \n0 1 2 \n0 1 2 \n');
});

// === BEGIN UNTIL / WHILE REPEAT ===
test('BEGIN UNTIL', () => {
  assert.equal(output(': TEST 5 BEGIN DUP . 1- DUP 0= UNTIL DROP ; TEST'), '5 4 3 2 1 ');
});
test('BEGIN WHILE REPEAT', () => {
  assert.equal(output(': TEST 5 BEGIN DUP WHILE DUP . 1- REPEAT DROP ; TEST'), '5 4 3 2 1 ');
});

// === VARIABLE / CONSTANT ===
test('VARIABLE store/fetch', () => {
  assert.deepEqual(stack('VARIABLE X 42 X ! X @'), [42]);
});
test('VARIABLE +!', () => {
  assert.deepEqual(stack('VARIABLE X 10 X ! 5 X +! X @'), [15]);
});
test('CONSTANT', () => {
  assert.deepEqual(stack('42 CONSTANT ANSWER ANSWER'), [42]);
});

// === VALUE / TO ===
test('VALUE and TO', () => {
  assert.deepEqual(stack('10 VALUE X X 20 TO X X'), [10, 20]);
});

// === Memory ===
test('HERE ALLOT ,', () => {
  const { forth } = run('HERE 42 , 99 ,');
  const addr = forth.getStack()[0];
  assert.equal(forth.fetch(addr), 42);
  assert.equal(forth.fetch(addr + 1), 99);
});

// === Comments ===
test('( comment )', () => assert.deepEqual(stack('5 ( this is a comment ) 3 +'), [8]));
test('\\ comment', () => assert.deepEqual(stack('5 \\ the rest is a comment'), [5]));

// === Boolean ===
test('TRUE FALSE', () => assert.deepEqual(stack('TRUE FALSE'), [-1, 0]));
test('NOT', () => assert.deepEqual(stack('TRUE NOT FALSE NOT'), [0, -1]));

// === String operations ===
test('S" TYPE', () => {
  assert.equal(output('S" Hello" TYPE'), 'Hello');
});

// === RECURSE ===
test('RECURSE factorial', () => {
  assert.deepEqual(stack(': FACT DUP 1 > IF DUP 1- RECURSE * THEN ; 5 FACT'), [120]);
});

// === Tick and EXECUTE ===
test("' EXECUTE", () => {
  assert.deepEqual(stack(": DOUBLE DUP + ; 5 ' DOUBLE EXECUTE"), [10]);
});

// === IMMEDIATE ===
test('IMMEDIATE word', () => {
  const f = new Forth();
  f.run(': GREET ." Hello" ; IMMEDIATE');
  const word = f.findWord('GREET');
  assert.equal(word.immediate, true);
});

// === WORDS ===
test('WORDS lists words', () => {
  const o = output('WORDS');
  assert.ok(o.includes('DUP'));
  assert.ok(o.includes('DROP'));
  assert.ok(o.includes('+'));
});

// === Complex programs ===
test('Fibonacci', () => {
  assert.deepEqual(stack(`
    : FIB
      DUP 1 <= IF DROP 1
      ELSE DUP 1- RECURSE SWAP 2 - RECURSE +
      THEN ;
    10 FIB
  `), [89]);
});

test('GCD', () => {
  assert.deepEqual(stack(`
    : GCD BEGIN DUP WHILE TUCK MOD REPEAT DROP ;
    48 18 GCD
  `), [6]);
});

test('Collatz sequence', () => {
  assert.equal(output(`
    : COLLATZ
      BEGIN
        DUP .
        DUP 1 > WHILE
        DUP 2 MOD 0= IF 2/ ELSE 3 * 1+ THEN
      REPEAT DROP ;
    6 COLLATZ
  `).trim(), '6 3 10 5 16 8 4 2 1');
});

test('multiplication table', () => {
  const result = output(`
    : STAR 42 EMIT ;
    : STARS 0 DO STAR LOOP ;
    3 STARS
  `);
  assert.equal(result, '***');
});

test('ABS using IF', () => {
  assert.deepEqual(stack(`
    : MYABS DUP 0< IF NEGATE THEN ;
    -5 MYABS 3 MYABS
  `), [5, 3]);
});

test('array operations', () => {
  assert.deepEqual(stack(`
    CREATE ARR 10 , 20 , 30 ,
    ARR @
    ARR 1 + @
    ARR 2 + @
  `), [10, 20, 30]);
});

test('multiple definitions interact', () => {
  assert.equal(output(`
    : SQUARE DUP * ;
    : SUM-SQUARES SQUARE SWAP SQUARE + ;
    : .RESULT ." Result: " . ;
    3 4 SUM-SQUARES .RESULT
  `), 'Result: 25 ');
});

// === BASE ===
test('HEX and DECIMAL', () => {
  assert.deepEqual(stack('HEX FF DECIMAL'), [255]);
});

// === Stress: FizzBuzz ===
test('FizzBuzz', () => {
  const result = output(`
    : FIZZBUZZ
      16 1 DO
        I 15 MOD 0= IF ." FizzBuzz " ELSE
        I 3 MOD 0= IF ." Fizz " ELSE
        I 5 MOD 0= IF ." Buzz " ELSE
        I . THEN THEN THEN
      LOOP ;
    FIZZBUZZ
  `);
  assert.ok(result.includes('1 2 Fizz 4 Buzz Fizz'));
  assert.ok(result.includes('FizzBuzz'));
});
