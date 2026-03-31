import { describe, it } from 'node:test'; import assert from 'node:assert/strict';
import { EventBus } from '../src/index.js';
describe('EventBus', () => {
  it('on/emit', () => { const bus = new EventBus(); let v; bus.on('x', (x) => v = x); bus.emit('x', 42); assert.equal(v, 42); });
  it('off', () => { const bus = new EventBus(); let n = 0; const h = () => n++; bus.on('x', h); bus.emit('x'); bus.off('x', h); bus.emit('x'); assert.equal(n, 1); });
  it('once', () => { const bus = new EventBus(); let n = 0; bus.once('x', () => n++); bus.emit('x'); bus.emit('x'); assert.equal(n, 1); });
  it('wildcard', () => { const bus = new EventBus(); const events = []; bus.on('*', (e) => events.push(e)); bus.emit('a'); bus.emit('b'); assert.deepEqual(events, ['a', 'b']); });
  it('unsubscribe return', () => { const bus = new EventBus(); let n = 0; const unsub = bus.on('x', () => n++); bus.emit('x'); unsub(); bus.emit('x'); assert.equal(n, 1); });
  it('clear', () => { const bus = new EventBus(); bus.on('x', () => {}); bus.clear(); assert.equal(bus.listenerCount, 0); });
});
