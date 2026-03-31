import { describe, it } from 'node:test'; import assert from 'node:assert/strict';
import { Stack, MinStack } from '../src/index.js';
describe('Stack', () => {
  it('push/pop', () => { const s = new Stack(); s.push(1); s.push(2); assert.equal(s.pop(), 2); assert.equal(s.pop(), 1); });
  it('peek', () => { const s = new Stack(); s.push(42); assert.equal(s.peek(), 42); assert.equal(s.size, 1); });
  it('underflow', () => assert.throws(() => new Stack().pop(), /underflow/));
  it('isEmpty', () => { const s = new Stack(); assert.ok(s.isEmpty); s.push(1); assert.ok(!s.isEmpty); });
  it('iterator (LIFO)', () => assert.deepEqual([...new Stack([1, 2, 3])], [3, 2, 1]));
  it('contains', () => assert.ok(new Stack([1, 2, 3]).contains(2)));
  it('clone', () => { const a = new Stack([1, 2]); const b = a.clone(); b.push(3); assert.equal(a.size, 2); });
});
describe('MinStack', () => {
  it('getMin', () => { const s = new MinStack(); s.push(3); s.push(1); s.push(2); assert.equal(s.getMin(), 1); });
  it('min after pop', () => { const s = new MinStack(); s.push(3); s.push(1); s.pop(); assert.equal(s.getMin(), 3); });
});
