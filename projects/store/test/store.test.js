import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, select } from '../src/index.js';

describe('createStore', () => {
  it('initializes state', () => {
    const store = createStore({ count: 0 });
    assert.equal(store.getState().count, 0);
  });
  it('setState with object', () => {
    const store = createStore({ count: 0 });
    store.setState({ count: 5 });
    assert.equal(store.getState().count, 5);
  });
  it('setState with function', () => {
    const store = createStore({ count: 0 });
    store.setState(s => ({ count: s.count + 1 }));
    assert.equal(store.getState().count, 1);
  });
  it('merges state', () => {
    const store = createStore({ a: 1, b: 2 });
    store.setState({ b: 3 });
    assert.equal(store.getState().a, 1);
    assert.equal(store.getState().b, 3);
  });
});

describe('subscribe', () => {
  it('notifies on change', () => {
    const store = createStore({ count: 0 });
    const states = [];
    store.subscribe(s => states.push(s.count));
    store.setState({ count: 1 });
    store.setState({ count: 2 });
    assert.deepEqual(states, [1, 2]);
  });
  it('unsubscribe', () => {
    const store = createStore({ count: 0 });
    let calls = 0;
    const unsub = store.subscribe(() => calls++);
    store.setState({ count: 1 });
    unsub();
    store.setState({ count: 2 });
    assert.equal(calls, 1);
  });
});

describe('actions', () => {
  it('bound actions', () => {
    const store = createStore({ count: 0 }, (set) => ({
      increment: () => set(s => ({ count: s.count + 1 })),
      decrement: () => set(s => ({ count: s.count - 1 })),
    }));
    store.increment();
    store.increment();
    store.decrement();
    assert.equal(store.getState().count, 1);
  });
});

describe('select', () => {
  it('subscribes to slice', () => {
    const store = createStore({ a: 1, b: 2 });
    const aSlice = select(store, s => s.a);
    const changes = [];
    aSlice.subscribe(v => changes.push(v));
    store.setState({ a: 10 });
    store.setState({ b: 20 }); // Should not trigger
    assert.deepEqual(changes, [10]);
  });
});

describe('destroy', () => {
  it('clears listeners', () => {
    const store = createStore({ x: 1 });
    let called = false;
    store.subscribe(() => { called = true; });
    store.destroy();
    store.setState({ x: 2 });
    assert.equal(called, false);
  });
});
