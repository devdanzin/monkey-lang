import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GCounter, PNCounter, GSet, ORSet, LWWRegister } from '../src/index.js';

describe('GCounter', () => {
  it('increments locally', () => {
    const c = new GCounter('A');
    c.increment(); c.increment();
    assert.equal(c.value, 2);
  });

  it('merges concurrent increments', () => {
    const a = new GCounter('A');
    const b = new GCounter('B');
    a.increment(5);
    b.increment(3);
    const merged = a.merge(b);
    assert.equal(merged.value, 8);
  });

  it('merge is idempotent', () => {
    const a = new GCounter('A');
    a.increment(5);
    const merged = a.merge(a);
    assert.equal(merged.value, 5);
  });

  it('merge is commutative', () => {
    const a = new GCounter('A'); a.increment(3);
    const b = new GCounter('B'); b.increment(7);
    assert.equal(a.merge(b).value, b.merge(a).value);
  });
});

describe('PNCounter', () => {
  it('increments and decrements', () => {
    const c = new PNCounter('A');
    c.increment(5); c.decrement(2);
    assert.equal(c.value, 3);
  });

  it('merges correctly', () => {
    const a = new PNCounter('A');
    const b = new PNCounter('B');
    a.increment(10);
    b.decrement(3);
    const merged = a.merge(b);
    assert.equal(merged.value, 7);
  });

  it('can go negative', () => {
    const c = new PNCounter('A');
    c.decrement(5);
    assert.equal(c.value, -5);
  });
});

describe('GSet', () => {
  it('adds elements', () => {
    const s = new GSet();
    s.add('x'); s.add('y');
    assert.equal(s.has('x'), true);
    assert.equal(s.size, 2);
  });

  it('merges sets', () => {
    const a = new GSet(); a.add('a');
    const b = new GSet(); b.add('b');
    const merged = a.merge(b);
    assert.equal(merged.has('a'), true);
    assert.equal(merged.has('b'), true);
  });

  it('merge is idempotent', () => {
    const s = new GSet(); s.add('x');
    assert.equal(s.merge(s).size, 1);
  });
});

describe('ORSet', () => {
  it('add and has', () => {
    const s = new ORSet('A');
    s.add('x');
    assert.equal(s.has('x'), true);
  });

  it('add and remove', () => {
    const s = new ORSet('A');
    s.add('x');
    s.remove('x');
    assert.equal(s.has('x'), false);
  });

  it('add-remove-add', () => {
    const s = new ORSet('A');
    s.add('x'); s.remove('x'); s.add('x');
    assert.equal(s.has('x'), true);
  });

  it('concurrent add wins over remove', () => {
    const a = new ORSet('A');
    const b = new ORSet('B');
    a.add('x');
    // b doesn't see the add, so no tags to remove
    const merged = a.merge(b);
    assert.equal(merged.has('x'), true);
  });

  it('values returns current elements', () => {
    const s = new ORSet('A');
    s.add('a'); s.add('b'); s.add('c');
    s.remove('b');
    assert.deepEqual(s.values().sort(), ['a', 'c']);
  });
});

describe('LWWRegister', () => {
  it('set and get', () => {
    const r = new LWWRegister('A');
    r.set('hello', 1);
    assert.equal(r.get(), 'hello');
  });

  it('last write wins', () => {
    const r = new LWWRegister('A');
    r.set('first', 1);
    r.set('second', 2);
    assert.equal(r.get(), 'second');
  });

  it('ignores old writes', () => {
    const r = new LWWRegister('A');
    r.set('new', 10);
    r.set('old', 5);
    assert.equal(r.get(), 'new');
  });

  it('merge takes newer', () => {
    const a = new LWWRegister('A', 'alpha', 1);
    const b = new LWWRegister('B', 'beta', 2);
    const merged = a.merge(b);
    assert.equal(merged.get(), 'beta');
  });

  it('merge is commutative', () => {
    const a = new LWWRegister('A', 'x', 1);
    const b = new LWWRegister('B', 'y', 2);
    assert.equal(a.merge(b).get(), b.merge(a).get());
  });
});
