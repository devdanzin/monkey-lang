const { test } = require('node:test');
const assert = require('node:assert/strict');
const { run, print } = require('../src/index.js');

const ev = (src) => run(src).print;
const out = (src) => run(src).output.join('');

// ==================== Basics ====================

test('numbers', () => {
  assert.equal(ev('42'), '42');
  assert.equal(ev('-3.14'), '-3.14');
});

test('strings', () => {
  assert.equal(ev('"hello"'), '"hello"');
});

test('booleans', () => {
  assert.equal(ev('#t'), '#t');
  assert.equal(ev('#f'), '#f');
});

test('nil', () => {
  assert.equal(ev('nil'), 'nil');
});

// ==================== Arithmetic ====================

test('arithmetic', () => {
  assert.equal(ev('(+ 2 3)'), '5');
  assert.equal(ev('(- 10 4)'), '6');
  assert.equal(ev('(* 3 7)'), '21');
  assert.equal(ev('(/ 10 2)'), '5');
  assert.equal(ev('(modulo 10 3)'), '1');
});

test('nested arithmetic', () => {
  assert.equal(ev('(+ (* 3 4) (- 10 5))'), '17');
});

test('variadic arithmetic', () => {
  assert.equal(ev('(+ 1 2 3 4 5)'), '15');
  assert.equal(ev('(* 2 3 4)'), '24');
});

// ==================== Comparison ====================

test('comparisons', () => {
  assert.equal(ev('(= 1 1)'), '#t');
  assert.equal(ev('(= 1 2)'), '#f');
  assert.equal(ev('(< 1 2)'), '#t');
  assert.equal(ev('(> 3 1)'), '#t');
  assert.equal(ev('(<= 1 1)'), '#t');
  assert.equal(ev('(>= 2 3)'), '#f');
});

test('not', () => {
  assert.equal(ev('(not #t)'), '#f');
  assert.equal(ev('(not #f)'), '#t');
});

// ==================== Variables ====================

test('define and use', () => {
  assert.equal(ev('(define x 10) x'), '10');
});

test('set!', () => {
  assert.equal(ev('(define x 1) (set! x 42) x'), '42');
});

// ==================== Functions ====================

test('lambda', () => {
  assert.equal(ev('((lambda (x) (* x x)) 5)'), '25');
});

test('define function shorthand', () => {
  assert.equal(ev('(define (square x) (* x x)) (square 7)'), '49');
});

test('closures', () => {
  assert.equal(ev(`
    (define (make-adder n) (lambda (x) (+ n x)))
    (define add5 (make-adder 5))
    (add5 10)
  `), '15');
});

test('recursion — factorial', () => {
  assert.equal(ev(`
    (define (fact n)
      (if (<= n 1) 1 (* n (fact (- n 1)))))
    (fact 10)
  `), '3628800');
});

test('mutual recursion', () => {
  assert.equal(ev(`
    (define (even? n) (if (= n 0) #t (odd? (- n 1))))
    (define (odd? n) (if (= n 0) #f (even? (- n 1))))
    (even? 10)
  `), '#t');
});

// ==================== Tail Call Optimization ====================

test('tail-recursive loop does not overflow', () => {
  assert.equal(ev(`
    (define (loop n acc)
      (if (= n 0) acc (loop (- n 1) (+ acc 1))))
    (loop 10000 0)
  `), '10000');
});

// ==================== List Operations ====================

test('cons, car, cdr', () => {
  assert.equal(ev("(car '(1 2 3))"), '1');
  assert.equal(ev("(cdr '(1 2 3))"), '(2 3)');
  assert.equal(ev("(cons 0 '(1 2))"), '(0 1 2)');
});

test('list creation', () => {
  assert.equal(ev('(list 1 2 3)'), '(1 2 3)');
});

test('length', () => {
  assert.equal(ev("(length '(a b c))"), '3');
  assert.equal(ev("(length '())"), '0');
});

test('append', () => {
  assert.equal(ev("(append '(1 2) '(3 4))"), '(1 2 3 4)');
});

test('null?', () => {
  assert.equal(ev("(null? '())"), '#t');
  assert.equal(ev("(null? '(1))"), '#f');
  assert.equal(ev('(null? nil)'), '#t');
});

// ==================== Control Flow ====================

test('if', () => {
  assert.equal(ev('(if #t 1 2)'), '1');
  assert.equal(ev('(if #f 1 2)'), '2');
});

test('cond', () => {
  assert.equal(ev(`
    (cond
      ((= 1 2) "no")
      ((= 1 1) "yes")
      (else "maybe"))
  `), '"yes"');
});

test('and / or', () => {
  assert.equal(ev('(and #t #t)'), '#t');
  assert.equal(ev('(and #t #f)'), '#f');
  assert.equal(ev('(or #f #t)'), '#t');
  assert.equal(ev('(or #f #f)'), '#f');
});

test('begin', () => {
  assert.equal(ev('(begin 1 2 3)'), '3');
});

test('let', () => {
  assert.equal(ev('(let ((x 10) (y 20)) (+ x y))'), '30');
});

// ==================== Macros ====================

test('defmacro — when macro', () => {
  assert.equal(ev(`
    (defmacro when (condition body)
      \`(if ,condition ,body nil))
    (when #t 42)
  `), '42');
  assert.equal(ev(`
    (defmacro when (condition body)
      \`(if ,condition ,body nil))
    (when #f 42)
  `), 'nil');
});

test('defmacro — unless', () => {
  assert.equal(ev(`
    (defmacro unless (condition body)
      \`(if ,condition nil ,body))
    (unless #f 99)
  `), '99');
});

// ==================== Quasiquote ====================

test('quasiquote with unquote', () => {
  assert.equal(ev('(define x 42) `(a ,x c)'), '(a 42 c)');
});

test('quasiquote with unquote-splicing', () => {
  assert.equal(ev("(define xs '(1 2 3)) `(a ,@xs b)"), '(a 1 2 3 b)');
});

// ==================== Higher-Order Functions ====================

test('map', () => {
  assert.equal(ev(`
    (define (double x) (* x 2))
    (map double '(1 2 3 4))
  `), '(2 4 6 8)');
});

test('filter', () => {
  assert.equal(ev(`
    (define (positive? x) (> x 0))
    (filter positive? '(-1 2 -3 4 5))
  `), '(2 4 5)');
});

test('reduce', () => {
  assert.equal(ev(`(reduce + 0 '(1 2 3 4 5))`), '15');
});

// ==================== Type Checks ====================

test('type predicates', () => {
  assert.equal(ev('(number? 42)'), '#t');
  assert.equal(ev('(string? "hi")'), '#t');
  assert.equal(ev("(symbol? 'foo)"), '#t');
  assert.equal(ev('(boolean? #t)'), '#t');
  assert.equal(ev("(list? '(1 2))"), '#t');
  assert.equal(ev('(null? nil)'), '#t');
});

// ==================== Display / I/O ====================

test('display', () => {
  assert.equal(out('(display "hello") (display " ") (display 42)'), 'hello 42');
});

// ==================== Math ====================

test('math builtins', () => {
  assert.equal(ev('(abs -5)'), '5');
  assert.equal(ev('(max 1 5 3)'), '5');
  assert.equal(ev('(min 1 5 3)'), '1');
  assert.equal(ev('(floor 3.7)'), '3');
  assert.equal(ev('(sqrt 9)'), '3');
  assert.equal(ev('(expt 2 10)'), '1024');
});

// ==================== String ====================

test('string operations', () => {
  assert.equal(ev('(string-append "hello" " " "world")'), '"hello world"');
  assert.equal(ev('(number->string 42)'), '"42"');
  assert.equal(ev('(string->number "3.14")'), '3.14');
});

// ==================== Integration ====================

test('fibonacci', () => {
  assert.equal(ev(`
    (define (fib n)
      (if (< n 2) n (+ (fib (- n 1)) (fib (- n 2)))))
    (fib 10)
  `), '55');
});

test('quicksort', () => {
  assert.equal(ev(`
    (define (qs lst)
      (if (null? lst) '()
        (let ((pivot (car lst))
              (rest (cdr lst)))
          (append
            (qs (filter (lambda (x) (< x pivot)) rest))
            (list pivot)
            (qs (filter (lambda (x) (>= x pivot)) rest))))))
    (qs '(3 1 4 1 5 9 2 6))
  `), '(1 1 2 3 4 5 6 9)');
});

test('church numerals', () => {
  assert.equal(ev(`
    (define zero (lambda (f) (lambda (x) x)))
    (define succ (lambda (n) (lambda (f) (lambda (x) (f ((n f) x))))))
    (define church->int (lambda (n) ((n (lambda (x) (+ x 1))) 0)))
    (define one (succ zero))
    (define two (succ one))
    (define three (succ two))
    (church->int three)
  `), '3');
});

test('comments are ignored', () => {
  assert.equal(ev(`
    ; This is a comment
    (+ 1 2) ; inline comment
  `), '3');
});

test('apply', () => {
  assert.equal(ev("(apply + '(1 2 3 4))"), '10');
});
