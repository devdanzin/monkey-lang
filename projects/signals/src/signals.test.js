import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createSignal, createEffect, createComputed, batch, untrack, createMemo, createStore } from './signals.js';

describe('Signal', () => {
  it('read and write', () => {
    const [count, setCount] = createSignal(0);
    assert.equal(count(), 0);
    setCount(5);
    assert.equal(count(), 5);
  });
  it('functional update', () => {
    const [count, setCount] = createSignal(0);
    setCount(c => c + 1);
    assert.equal(count(), 1);
  });
  it('peek does not track', () => {
    const [count, setCount] = createSignal(0);
    let effectRuns = 0;
    createEffect(() => { count.peek(); effectRuns++; });
    setCount(1);
    assert.equal(effectRuns, 1); // only initial run
  });
  it('no update on same value', () => {
    const [count, setCount] = createSignal(0);
    let effectRuns = 0;
    createEffect(() => { count(); effectRuns++; });
    setCount(0); // same value
    assert.equal(effectRuns, 1);
  });
});

describe('Effect', () => {
  it('runs immediately', () => {
    let ran = false;
    createEffect(() => { ran = true; });
    assert.ok(ran);
  });
  it('re-runs on signal change', () => {
    const [count, setCount] = createSignal(0);
    let effectValue;
    createEffect(() => { effectValue = count(); });
    assert.equal(effectValue, 0);
    setCount(42);
    assert.equal(effectValue, 42);
  });
  it('tracks multiple signals', () => {
    const [a, setA] = createSignal(1);
    const [b, setB] = createSignal(2);
    let sum;
    createEffect(() => { sum = a() + b(); });
    assert.equal(sum, 3);
    setA(10);
    assert.equal(sum, 12);
    setB(20);
    assert.equal(sum, 30);
  });
});

describe('Computed', () => {
  it('derives value', () => {
    const [count, setCount] = createSignal(2);
    const doubled = createComputed(() => count() * 2);
    assert.equal(doubled(), 4);
    setCount(5);
    assert.equal(doubled(), 10);
  });
  it('caches value', () => {
    let computeCount = 0;
    const [count, setCount] = createSignal(0);
    const computed = createComputed(() => { computeCount++; return count() * 2; });
    computed();
    computed();
    assert.equal(computeCount, 1); // only computed once
  });
  it('chains', () => {
    const [a, setA] = createSignal(1);
    const b = createComputed(() => a() * 2);
    const c = createComputed(() => b() + 10);
    assert.equal(c(), 12);
    setA(5);
    assert.equal(c(), 20);
  });
});

describe('Batch', () => {
  it('defers updates', () => {
    const [a, setA] = createSignal(0);
    const [b, setB] = createSignal(0);
    let runs = 0;
    createEffect(() => { a(); b(); runs++; });
    assert.equal(runs, 1);
    batch(() => { setA(1); setB(2); });
    assert.equal(runs, 2); // only one re-run for both updates
  });
});

describe('Untrack', () => {
  it('prevents tracking', () => {
    const [count, setCount] = createSignal(0);
    let runs = 0;
    createEffect(() => { untrack(() => count()); runs++; });
    setCount(1);
    assert.equal(runs, 1); // no re-run
  });
});

describe('Memo', () => {
  it('memoizes', () => {
    const [count, setCount] = createSignal(0);
    const memo = createMemo(() => count() > 5);
    assert.equal(memo(), false);
    setCount(3);
    assert.equal(memo(), false);
    setCount(10);
    assert.equal(memo(), true);
  });
});

describe('Store', () => {
  it('reactive properties', () => {
    const [store, setStore] = createStore({ name: 'Alice', age: 30 });
    assert.equal(store.name, 'Alice');
    assert.equal(store.age, 30);
  });
  it('set updates store', () => {
    const [store, setStore] = createStore({ x: 0 });
    setStore({ x: 42 });
    assert.equal(store.x, 42);
  });
  it('proxy assignment', () => {
    const [store, setStore] = createStore({ x: 0 });
    store.x = 10;
    assert.equal(store.x, 10);
  });
  it('reactive effect on store', () => {
    const [store, setStore] = createStore({ count: 0 });
    let tracked;
    createEffect(() => { tracked = store.count; });
    assert.equal(tracked, 0);
    setStore({ count: 5 });
    assert.equal(tracked, 5);
  });
});
