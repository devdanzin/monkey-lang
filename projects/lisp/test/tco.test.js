import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { run, NIL, LispList } from '../src/lisp.js';

describe('Tail Call Optimization', () => {
  it('basic tail-recursive countdown does not overflow', () => {
    // Without TCO, this would blow the stack at ~10K calls
    const result = run(`
      (define (countdown n)
        (if (= n 0) 0
          (countdown (- n 1))))
      (countdown 100000)
    `);
    assert.equal(result, 0);
  });

  it('tail-recursive factorial', () => {
    const result = run(`
      (define (fact n acc)
        (if (= n 0) acc
          (fact (- n 1) (* n acc))))
      (fact 20 1)
    `);
    assert.equal(result, 2432902008176640000);
  });

  it('tail-recursive fibonacci', () => {
    const result = run(`
      (define (fib n a b)
        (if (= n 0) a
          (fib (- n 1) b (+ a b))))
      (fib 50 0 1)
    `);
    assert.equal(result, 12586269025);
  });

  it('mutual tail recursion', () => {
    const result = run(`
      (define (even? n)
        (if (= n 0) #t (odd? (- n 1))))
      (define (odd? n)
        (if (= n 0) #f (even? (- n 1))))
      (even? 10000)
    `);
    assert.equal(result, true);
  });

  it('tail call in begin', () => {
    const result = run(`
      (define count 0)
      (define (loop n)
        (begin
          (set! count (+ count 1))
          (if (= n 0) count
            (loop (- n 1)))))
      (loop 50000)
    `);
    assert.equal(result, 50001);
  });

  it('tail call in let', () => {
    const result = run(`
      (define (sum-to n acc)
        (let ((next (- n 1))
              (new-acc (+ n acc)))
          (if (= n 0) acc
            (sum-to next new-acc))))
      (sum-to 10000 0)
    `);
    assert.equal(result, 50005000);
  });

  it('tail call in cond', () => {
    const result = run(`
      (define (classify n)
        (cond
          ((> n 1000000) (quote big))
          ((> n 0) (classify (* n 2)))
          (#t (quote zero))))
      (classify 1)
    `);
    // 1 -> 2 -> 4 -> ... -> 1048576 -> 'big'
    const r = result;
    assert.equal(r.name || r, 'big');
  });

  it('large accumulator pattern', () => {
    const result = run(`
      (define (repeat n acc)
        (if (= n 0) acc
          (repeat (- n 1) (+ acc 1))))
      (repeat 200000 0)
    `);
    assert.equal(result, 200000);
  });
});
