import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createSignal, createEffect, createComputed, createMemo, batch, watch } from '../src/index.js';

describe('createSignal', () => {
  it('get returns initial value', () => {
    const [count] = createSignal(0);
    assert.equal(count(), 0);
  });
  it('set updates value', () => {
    const [count, setCount] = createSignal(0);
    setCount(5);
    assert.equal(count(), 5);
  });
  it('set with function', () => {
    const [count, setCount] = createSignal(10);
    setCount(prev => prev + 5);
    assert.equal(count(), 15);
  });
  it('no change if same value', () => {
    const [count, setCount] = createSignal(5);
    let effectRuns = 0;
    createEffect(() => { count(); effectRuns++; });
    effectRuns = 0; // Reset after initial effect
    setCount(5); // Same value
    assert.equal(effectRuns, 0);
  });
});

describe('createEffect', () => {
  it('runs immediately', () => {
    let ran = false;
    createEffect(() => { ran = true; });
    assert.equal(ran, true);
  });
  it('re-runs when dependency changes', () => {
    const [count, setCount] = createSignal(0);
    let observed = -1;
    createEffect(() => { observed = count(); });
    assert.equal(observed, 0);
    setCount(42);
    assert.equal(observed, 42);
  });
  it('tracks multiple dependencies', () => {
    const [a, setA] = createSignal(1);
    const [b, setB] = createSignal(2);
    let sum = 0;
    createEffect(() => { sum = a() + b(); });
    assert.equal(sum, 3);
    setA(10);
    assert.equal(sum, 12);
    setB(20);
    assert.equal(sum, 30);
  });
});

describe('createComputed', () => {
  it('derives from signals', () => {
    const [count, setCount] = createSignal(5);
    const doubled = createComputed(() => count() * 2);
    assert.equal(doubled(), 10);
    setCount(10);
    assert.equal(doubled(), 20);
  });
  it('chains computeds', () => {
    const [x, setX] = createSignal(2);
    const doubled = createComputed(() => x() * 2);
    const quadrupled = createComputed(() => doubled() * 2);
    assert.equal(quadrupled(), 8);
    setX(5);
    assert.equal(quadrupled(), 20);
  });
});

describe('batch', () => {
  it('batches multiple updates', () => {
    const [a, setA] = createSignal(1);
    const [b, setB] = createSignal(2);
    let runs = 0;
    createEffect(() => { a(); b(); runs++; });
    runs = 0;
    batch(() => { setA(10); setB(20); });
    assert.equal(runs, 1); // Only one re-run
  });
});

describe('watch', () => {
  it('calls handler on change', () => {
    const [count, setCount] = createSignal(0);
    const changes = [];
    watch(count, (val, old) => { if (old !== undefined) changes.push({ val, old }); });
    setCount(1);
    setCount(5);
    assert.equal(changes.length, 2);
    assert.equal(changes[0].val, 1);
    assert.equal(changes[1].val, 5);
  });
});

describe('createMemo', () => {
  it('memoizes computation', () => {
    const [count, setCount] = createSignal(5);
    let computeCount = 0;
    const doubled = createMemo(() => { computeCount++; return count() * 2; });
    assert.equal(doubled(), 10);
    setCount(5); // Same derived value
  });
});
