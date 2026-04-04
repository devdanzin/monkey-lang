import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { read, evaluate, run, standardEnv, LispList, LispSymbol, NIL, lispToString } from '../src/index.js';

describe('Lisp — reader', () => {
  it('reads integer', () => assert.equal(read('42'), 42));
  it('reads negative', () => assert.equal(read('-7'), -7));
  it('reads float', () => assert.equal(read('3.14'), 3.14));
  it('reads string', () => assert.equal(read('"hello"'), 'hello'));
  it('reads symbol', () => assert.ok(read('foo') instanceof LispSymbol));
  it('reads boolean', () => { assert.equal(read('#t'), true); assert.equal(read('#f'), false); });
  it('reads list', () => { const r = read('(1 2 3)'); assert.ok(r instanceof LispList); assert.equal(r.length, 3); });
  it('reads nested list', () => { const r = read('(+ (* 2 3) 4)'); assert.equal(r.length, 3); });
  it('reads quote', () => { const r = read("'x"); assert.equal(r.get(0).name, 'quote'); });
  it('reads empty list', () => { const r = read('()'); assert.equal(r.length, 0); });
});

describe('Lisp — arithmetic', () => {
  it('addition', () => assert.equal(run('(+ 1 2 3)'), 6));
  it('subtraction', () => assert.equal(run('(- 10 3)'), 7));
  it('negation', () => assert.equal(run('(- 5)'), -5));
  it('multiplication', () => assert.equal(run('(* 6 7)'), 42));
  it('division', () => assert.equal(run('(/ 10 3)'), 3));
  it('modulo', () => assert.equal(run('(% 10 3)'), 1));
  it('nested', () => assert.equal(run('(+ (* 2 3) (* 4 5))'), 26));
});

describe('Lisp — comparison', () => {
  it('equal', () => assert.equal(run('(= 42 42)'), true));
  it('not equal', () => assert.equal(run('(= 1 2)'), false));
  it('less than', () => assert.equal(run('(< 1 2)'), true));
  it('greater than', () => assert.equal(run('(> 2 1)'), true));
});

describe('Lisp — special forms', () => {
  it('quote', () => { const r = run("'(1 2 3)"); assert.ok(r instanceof LispList); });
  it('if true', () => assert.equal(run('(if #t 1 2)'), 1));
  it('if false', () => assert.equal(run('(if #f 1 2)'), 2));
  it('if without else', () => assert.equal(run('(if #f 1)'), NIL));
  
  it('cond', () => {
    assert.equal(run('(cond (#f 1) (#t 2) (else 3))'), 2);
  });
  
  it('and', () => {
    assert.equal(run('(and #t #t)'), true);
    assert.equal(run('(and #t #f)'), false);
    assert.equal(run('(and 1 2 3)'), 3);
  });
  
  it('or', () => {
    assert.equal(run('(or #f #t)'), true);
    assert.equal(run('(or #f #f)'), false);
    assert.equal(run('(or #f 42)'), 42);
  });
  
  it('begin', () => assert.equal(run('(begin 1 2 3)'), 3));
});

describe('Lisp — define and lambda', () => {
  it('define variable', () => assert.equal(run('(begin (define x 42) x)'), 42));
  it('define function (sugar)', () => assert.equal(run('(begin (define (double x) (* x 2)) (double 21))'), 42));
  it('lambda', () => assert.equal(run('((lambda (x) (* x 2)) 21)'), 42));
  it('closure', () => assert.equal(run('(begin (define (adder n) (lambda (x) (+ n x))) ((adder 10) 32))'), 42));
  
  it('let binding', () => assert.equal(run('(let ((x 10) (y 20)) (+ x y))'), 30));
  it('nested let', () => assert.equal(run('(let ((x 5)) (let ((y (* x 2))) (+ x y)))'), 15));
  
  it('set!', () => assert.equal(run('(begin (define x 1) (set! x 42) x)'), 42));
});

describe('Lisp — recursion', () => {
  it('factorial', () => {
    assert.equal(run(`
      (begin
        (define (fact n)
          (if (= n 0) 1 (* n (fact (- n 1)))))
        (fact 10))
    `), 3628800);
  });
  
  it('fibonacci', () => {
    assert.equal(run(`
      (begin
        (define (fib n)
          (if (< n 2) n (+ (fib (- n 1)) (fib (- n 2)))))
        (fib 10))
    `), 55);
  });
  
  it('tail-recursive sum', () => {
    assert.equal(run(`
      (begin
        (define (sum n acc)
          (if (= n 0) acc (sum (- n 1) (+ acc n))))
        (sum 1000 0))
    `), 500500);
  });
});

describe('Lisp — list operations', () => {
  it('cons', () => {
    const r = run("(cons 1 '(2 3))");
    assert.equal(lispToString(r), '(1 2 3)');
  });
  
  it('car', () => assert.equal(run("(car '(1 2 3))"), 1));
  it('cdr', () => assert.equal(lispToString(run("(cdr '(1 2 3))")), '(2 3)'));
  it('list', () => assert.equal(lispToString(run('(list 1 2 3)')), '(1 2 3)'));
  it('length', () => assert.equal(run("(length '(1 2 3))"), 3));
  
  it('append', () => {
    assert.equal(lispToString(run("(append '(1 2) '(3 4))")), '(1 2 3 4)');
  });
  
  it('map', () => {
    assert.equal(lispToString(run(`
      (begin
        (define (double x) (* x 2))
        (map double '(1 2 3)))
    `)), '(2 4 6)');
  });
  
  it('filter', () => {
    assert.equal(lispToString(run(`
      (begin
        (define (even? x) (= (% x 2) 0))
        (filter even? '(1 2 3 4 5 6)))
    `)), '(2 4 6)');
  });
  
  it('reduce', () => {
    assert.equal(run("(reduce + 0 '(1 2 3 4 5))"), 15);
  });
});

describe('Lisp — predicates', () => {
  it('number?', () => { assert.equal(run('(number? 42)'), true); assert.equal(run('(number? "hi")'), false); });
  it('string?', () => assert.equal(run('(string? "hello")'), true));
  it('zero?', () => { assert.equal(run('(zero? 0)'), true); assert.equal(run('(zero? 1)'), false); });
  it('even?', () => { assert.equal(run('(even? 4)'), true); assert.equal(run('(even? 3)'), false); });
  it('null?', () => assert.equal(run("(null? '())"), true));
  it('not', () => { assert.equal(run('(not #f)'), true); assert.equal(run('(not #t)'), false); });
});

describe('Lisp — higher-order', () => {
  it('compose', () => {
    assert.equal(run(`
      (begin
        (define (compose f g)
          (lambda (x) (f (g x))))
        (define (add1 x) (+ x 1))
        (define (double x) (* x 2))
        ((compose add1 double) 10))
    `), 21);
  });

  it('Y combinator (if supported)', () => {
    // This tests deep closure and recursion
    assert.equal(run(`
      (begin
        (define (make-counter)
          (let ((count 0))
            (lambda ()
              (set! count (+ count 1))
              count)))
        (define counter (make-counter))
        (counter)
        (counter)
        (counter))
    `), 3);
  });
});
