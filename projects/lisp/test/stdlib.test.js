import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { run, NIL, LispList } from '../src/lisp.js';

describe('Standard Library Extensions', () => {
  it('fold-left accumulates left to right', () => {
    const result = run('(fold-left + 0 (list 1 2 3 4 5))');
    assert.equal(result, 15);
  });

  it('fold-left with lambda', () => {
    const result = run('(fold-left (lambda (acc x) (+ acc (* x x))) 0 (list 1 2 3))');
    assert.equal(result, 14); // 1 + 4 + 9
  });

  it('fold-right accumulates right to left', () => {
    const result = run('(fold-right cons (list) (list 1 2 3))');
    assert.ok(result instanceof LispList);
    assert.equal(result.length, 3);
    assert.equal(result.get(0), 1);
  });

  it('for-each applies side effects', () => {
    const result = run(`
      (define sum 0)
      (for-each (lambda (x) (set! sum (+ sum x))) (list 1 2 3))
      sum
    `);
    assert.equal(result, 6);
  });

  it('for-each returns nil', () => {
    const result = run('(for-each (lambda (x) x) (list 1 2 3))');
    assert.equal(result, NIL);
  });

  it('zip combines two lists', () => {
    const result = run('(zip (list 1 2 3) (list 4 5 6))');
    assert.ok(result instanceof LispList);
    assert.equal(result.length, 3);
    assert.ok(result.get(0) instanceof LispList);
    assert.equal(result.get(0).get(0), 1);
    assert.equal(result.get(0).get(1), 4);
  });

  it('zip truncates to shorter list', () => {
    const result = run('(zip (list 1 2) (list 3 4 5 6))');
    assert.equal(result.length, 2);
  });

  it('range generates number sequence', () => {
    const result = run('(range 0 5)');
    assert.ok(result instanceof LispList);
    assert.equal(result.length, 5);
    assert.equal(result.get(0), 0);
    assert.equal(result.get(4), 4);
  });

  it('range with step', () => {
    const result = run('(range 0 10 2)');
    assert.equal(result.length, 5);
    assert.equal(result.get(2), 4);
  });

  it('take returns first n elements', () => {
    const result = run('(take 3 (list 1 2 3 4 5))');
    assert.equal(result.length, 3);
    assert.equal(result.get(2), 3);
  });

  it('drop skips first n elements', () => {
    const result = run('(drop 2 (list 1 2 3 4 5))');
    assert.equal(result.length, 3);
    assert.equal(result.get(0), 3);
  });

  it('any? returns true when predicate matches', () => {
    assert.equal(run('(any? (lambda (x) (> x 3)) (list 1 2 3 4 5))'), true);
  });

  it('any? returns false when no match', () => {
    assert.equal(run('(any? (lambda (x) (> x 10)) (list 1 2 3))'), false);
  });

  it('every? returns true when all match', () => {
    assert.equal(run('(every? (lambda (x) (> x 0)) (list 1 2 3))'), true);
  });

  it('every? returns false when one fails', () => {
    assert.equal(run('(every? (lambda (x) (> x 2)) (list 1 2 3))'), false);
  });

  it('compose creates function pipeline', () => {
    const result = run(`
      (define add1 (lambda (x) (+ x 1)))
      (define double (lambda (x) (* x 2)))
      (define add1-then-double (compose double add1))
      (add1-then-double 5)
    `);
    assert.equal(result, 12); // (5 + 1) * 2
  });

  it('combined: map + filter + fold', () => {
    const result = run(`
      (fold-left + 0
        (filter (lambda (x) (> x 5))
          (map (lambda (x) (* x x)) (list 1 2 3 4 5))))
    `);
    // squares: 1 4 9 16 25
    // filter > 5: 9 16 25
    // sum: 50
    assert.equal(result, 50);
  });
});
