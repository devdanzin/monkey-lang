import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { run, NIL, LispList, LispMacro, lispToString } from '../src/lisp.js';

function evalExpr(code) {
  return run(code);
}

describe('Macros (defmacro)', () => {
  it('basic defmacro and expansion', () => {
    const result = evalExpr(`
      (defmacro my-if (cond then else)
        (list 'if cond then else))
      (my-if #t 1 2)
    `);
    assert.equal(result, 1);
  });

  it('macroexpand shows expanded form', () => {
    const result = evalExpr(`
      (defmacro my-if (cond then else)
        (list 'if cond then else))
      (macroexpand (my-if #t 1 2))
    `);
    // Should be (if #t 1 2) as a list
    assert.ok(result instanceof LispList);
  });

  it('macro can implement when (one-branch if)', () => {
    const result = evalExpr(`
      (defmacro when (cond . body)
        (list 'if cond (cons 'begin body) nil))
      (define x 0)
      (when #t (set! x 42))
      x
    `);
    assert.equal(result, 42);
  });

  it('macro can implement unless', () => {
    const result = evalExpr(`
      (defmacro unless (cond . body)
        (list 'if cond nil (cons 'begin body)))
      (define x 0)
      (unless #f (set! x 99))
      x
    `);
    assert.equal(result, 99);
  });

  it('unless does not execute body when condition is true', () => {
    const result = evalExpr(`
      (defmacro unless (cond . body)
        (list 'if cond nil (cons 'begin body)))
      (define x 0)
      (unless #t (set! x 99))
      x
    `);
    assert.equal(result, 0);
  });

  it('macro can implement swap!', () => {
    const result = evalExpr(`
      (defmacro swap! (a b)
        (list 'let (list (list 'tmp a))
          (list 'set! a b)
          (list 'set! b 'tmp)))
      (define x 1)
      (define y 2)
      (swap! x y)
      (list x y)
    `);
    assert.ok(result instanceof LispList);
    assert.equal(result.get(0), 2);
    assert.equal(result.get(1), 1);
  });

  it('macro with arithmetic', () => {
    const result = evalExpr(`
      (defmacro square (x)
        (list '* x x))
      (square 5)
    `);
    assert.equal(result, 25);
  });

  it('nested macro calls', () => {
    const result = evalExpr(`
      (defmacro inc (x)
        (list '+ x 1))
      (defmacro double-inc (x)
        (list 'inc (list 'inc x)))
      (double-inc 10)
    `);
    assert.equal(result, 12);
  });
});

describe('Quasiquote', () => {
  it('basic quasiquote returns quoted form', () => {
    const result = evalExpr('(quasiquote (1 2 3))');
    assert.ok(result instanceof LispList);
    assert.equal(result.length, 3);
  });

  it('unquote evaluates within quasiquote', () => {
    const result = evalExpr(`
      (define x 42)
      (quasiquote (a (unquote x) c))
    `);
    assert.ok(result instanceof LispList);
    assert.equal(result.get(1), 42);
  });

  it('reader macro ` and , work', () => {
    const result = evalExpr(`
      (define x 42)
      \`(a ,x c)
    `);
    assert.ok(result instanceof LispList);
    assert.equal(result.get(1), 42);
  });

  it('unquote-splicing splices list', () => {
    const result = evalExpr(`
      (define xs (list 2 3 4))
      \`(1 ,@xs 5)
    `);
    assert.ok(result instanceof LispList);
    assert.equal(result.length, 5);
    assert.equal(result.get(0), 1);
    assert.equal(result.get(1), 2);
    assert.equal(result.get(4), 5);
  });

  it('quasiquote with defmacro for nicer macros', () => {
    const result = evalExpr(`
      (defmacro my-when (cond . body)
        \`(if ,cond (begin ,@body) nil))
      (define x 0)
      (my-when #t (set! x 1) (set! x (+ x 1)))
      x
    `);
    assert.equal(result, 2);
  });

  it('nested quasiquote: inner quasiquote remains quoted', () => {
    const result = evalExpr(`
      (define x 1)
      \`(a ,x (b c))
    `);
    assert.ok(result instanceof LispList);
    assert.equal(result.get(1), 1);
    // (b c) should remain as a list
    assert.ok(result.get(2) instanceof LispList);
  });
});
