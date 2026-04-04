import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parse, evaluate, standardEnv, run } from './lisp.js';

describe('Parser', () => {
  it('parses number', () => { assert.equal(parse('42'), 42); });
  it('parses string', () => { assert.equal(parse('"hello"'), 'hello'); });
  it('parses symbol', () => { assert.equal(parse('x'), Symbol.for('x')); });
  it('parses boolean', () => { assert.equal(parse('#t'), true); assert.equal(parse('#f'), false); });
  it('parses list', () => {
    const result = parse('(+ 1 2)');
    assert.ok(Array.isArray(result));
    assert.equal(result.length, 3);
  });
  it('parses nested', () => {
    const result = parse('(+ (* 2 3) 4)');
    assert.ok(Array.isArray(result));
    assert.ok(Array.isArray(result[1]));
  });
  it('parses quote shorthand', () => {
    const result = parse("'(1 2 3)");
    assert.equal(result[0], 'quote');
  });
});

describe('Arithmetic', () => {
  it('addition', () => { assert.equal(run('(+ 1 2 3)'), 6); });
  it('subtraction', () => { assert.equal(run('(- 10 3)'), 7); });
  it('multiplication', () => { assert.equal(run('(* 4 5)'), 20); });
  it('division', () => { assert.equal(run('(/ 15 3)'), 5); });
  it('negation', () => { assert.equal(run('(- 42)'), -42); });
  it('nested arithmetic', () => { assert.equal(run('(+ (* 2 3) (- 10 4))'), 12); });
});

describe('Comparison', () => {
  it('equal', () => { assert.equal(run('(= 5 5)'), true); });
  it('not equal', () => { assert.equal(run('(= 5 3)'), false); });
  it('less than', () => { assert.equal(run('(< 3 5)'), true); });
  it('greater than', () => { assert.equal(run('(> 5 3)'), true); });
});

describe('Conditionals', () => {
  it('if true', () => { assert.equal(run('(if #t 1 2)'), 1); });
  it('if false', () => { assert.equal(run('(if #f 1 2)'), 2); });
  it('if with expression', () => { assert.equal(run('(if (> 5 3) 10 20)'), 10); });
  it('cond', () => {
    assert.equal(run('(cond ((= 1 2) 10) ((= 1 1) 20) (else 30))'), 20);
  });
  it('and', () => {
    assert.equal(run('(and #t #t)'), true);
    assert.equal(run('(and #t #f)'), false);
  });
  it('or', () => {
    assert.equal(run('(or #f #t)'), true);
    assert.equal(run('(or #f #f)'), false);
  });
});

describe('Variables', () => {
  it('define and use', () => {
    assert.equal(run('(begin (define x 42) x)'), 42);
  });
  it('set!', () => {
    assert.equal(run('(begin (define x 1) (set! x 2) x)'), 2);
  });
  it('let binding', () => {
    assert.equal(run('(let ((x 10) (y 20)) (+ x y))'), 30);
  });
});

describe('Functions', () => {
  it('lambda', () => {
    assert.equal(run('((lambda (x) (* x x)) 5)'), 25);
  });
  it('define function', () => {
    assert.equal(run('(begin (define (square x) (* x x)) (square 7))'), 49);
  });
  it('closure', () => {
    assert.equal(run('(begin (define (make-adder n) (lambda (x) (+ n x))) ((make-adder 10) 5))'), 15);
  });
  it('recursive factorial', () => {
    assert.equal(run(`
      (begin
        (define (fact n) (if (= n 0) 1 (* n (fact (- n 1)))))
        (fact 10))
    `), 3628800);
  });
  it('higher-order functions', () => {
    assert.equal(run('(begin (define (twice f x) (f (f x))) (define (add1 x) (+ x 1)) (twice add1 5))'), 7);
  });
});

describe('Lists', () => {
  it('cons', () => {
    const result = run("(cons 1 '(2 3))");
    assert.deepStrictEqual(result, [1, 2, 3]);
  });
  it('car', () => { assert.equal(run("(car '(1 2 3))"), 1); });
  it('cdr', () => { assert.deepStrictEqual(run("(cdr '(1 2 3))"), [2, 3]); });
  it('list', () => { assert.deepStrictEqual(run('(list 1 2 3)'), [1, 2, 3]); });
  it('length', () => { assert.equal(run("(length '(a b c))"), 3); });
  it('null?', () => {
    assert.equal(run("(null? '())"), true);
    assert.equal(run("(null? '(1))"), false);
  });
  it('map', () => {
    assert.deepStrictEqual(run(`
      (begin
        (define (double x) (* x 2))
        (map double '(1 2 3)))
    `), [2, 4, 6]);
  });
  it('filter', () => {
    assert.deepStrictEqual(run(`
      (begin
        (define (even? x) (= (modulo x 2) 0))
        (filter even? '(1 2 3 4 5 6)))
    `), [2, 4, 6]);
  });
});

describe('Strings', () => {
  it('string-length', () => { assert.equal(run('(string-length "hello")'), 5); });
  it('string-append', () => { assert.equal(run('(string-append "hello" " " "world")'), 'hello world'); });
});

describe('Tail Call Optimization', () => {
  it('deep recursion does not stack overflow', () => {
    const result = run(`
      (begin
        (define (loop n acc) (if (= n 0) acc (loop (- n 1) (+ acc 1))))
        (loop 100000 0))
    `);
    assert.equal(result, 100000);
  });
});

describe('Quoting', () => {
  it('quote prevents evaluation', () => {
    const result = run("'(+ 1 2)");
    assert.ok(Array.isArray(result));
    assert.equal(result.length, 3);
  });
  it('quoted symbol', () => {
    assert.equal(run("'x"), Symbol.for('x'));
  });
});

describe('Complex programs', () => {
  it('fibonacci', () => {
    assert.equal(run(`
      (begin
        (define (fib n) (if (<= n 1) n (+ (fib (- n 1)) (fib (- n 2)))))
        (fib 10))
    `), 55);
  });

  it('reduce to sum', () => {
    assert.equal(run(`(reduce + 0 '(1 2 3 4 5))`), 15);
  });

  it('nested let', () => {
    assert.equal(run('(let ((x 1)) (let ((y 2)) (+ x y)))'), 3);
  });
});
