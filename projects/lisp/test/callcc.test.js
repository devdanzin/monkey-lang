import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { run, NIL, LispList, LispContinuation } from '../src/lisp.js';

function evalExpr(code) {
  return run(code);
}

describe('call/cc (call-with-current-continuation)', () => {
  it('basic escape: returns the value passed to the continuation', () => {
    const result = evalExpr('(call/cc (lambda (k) (k 42)))');
    assert.equal(result, 42);
  });

  it('returns normal value when continuation is not invoked', () => {
    const result = evalExpr('(call/cc (lambda (k) 99))');
    assert.equal(result, 99);
  });

  it('escapes from nested computation', () => {
    const result = evalExpr(`
      (call/cc (lambda (k)
        (+ 1 (+ 2 (k 10)))))
    `);
    assert.equal(result, 10); // k(10) escapes, + never happens
  });

  it('continuation as early return from function', () => {
    const result = evalExpr(`
      (define (find-first lst pred)
        (call/cc (lambda (return)
          (define (loop items)
            (if (null? items) nil
              (if (pred (car items))
                (return (car items))
                (loop (cdr items)))))
          (loop lst))))
      (find-first (list 1 2 3 4 5) (lambda (x) (> x 3)))
    `);
    assert.equal(result, 4);
  });

  it('continuation can return a string', () => {
    const result = evalExpr('(call/cc (lambda (k) (k "hello")))');
    assert.equal(result, 'hello');
  });

  it('continuation can return a list', () => {
    const result = evalExpr('(call/cc (lambda (k) (k (list 1 2 3))))');
    assert.ok(result instanceof LispList);
    assert.equal(result.length, 3);
  });

  it('continuation can return boolean', () => {
    const result = evalExpr('(call/cc (lambda (k) (k #t)))');
    assert.equal(result, true);
  });

  it('nested call/cc', () => {
    const result = evalExpr(`
      (call/cc (lambda (outer)
        (call/cc (lambda (inner)
          (inner 42)))
        (outer 99)))
    `);
    // inner(42) returns 42 from the inner call/cc
    // Then outer(99) is called, escaping with 99
    assert.equal(result, 99);
  });

  it('call/cc with define accumulates state', () => {
    const result = evalExpr(`
      (define saved nil)
      (define val (call/cc (lambda (k)
        (set! saved k)
        0)))
      val
    `);
    // First time through, val = 0
    assert.equal(result, 0);
  });

  it('works with long form call-with-current-continuation', () => {
    const result = evalExpr('(call-with-current-continuation (lambda (k) (k 77)))');
    assert.equal(result, 77);
  });

  it('implements try/catch pattern', () => {
    const result = evalExpr(`
      (define (try thunk handler)
        (call/cc (lambda (escape)
          (define (throw err) (escape (handler err)))
          (thunk throw))))
      
      (try
        (lambda (throw)
          (throw "error!")
          42)
        (lambda (err)
          (string-append "caught: " err)))
    `);
    assert.equal(result, 'caught: error!');
  });

  it('implements break from loop', () => {
    const result = evalExpr(`
      (define sum 0)
      (call/cc (lambda (break)
        (define (loop n)
          (if (> n 100) (break sum)
            (begin
              (set! sum (+ sum n))
              (loop (+ n 1)))))
        (loop 1)))
    `);
    assert.equal(result, 5050); // sum 1..100
  });
});

describe('values', () => {
  it('returns multiple values as a list', () => {
    const result = evalExpr('(values 1 2 3)');
    assert.ok(result instanceof LispList);
    assert.equal(result.length, 3);
  });
});
