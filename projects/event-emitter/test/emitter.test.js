import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter, mixin } from '../src/index.js';

describe('on/emit', () => {
  it('calls listener', () => {
    const ee = new EventEmitter();
    let called = false;
    ee.on('test', () => { called = true; });
    ee.emit('test');
    assert.equal(called, true);
  });

  it('passes arguments', () => {
    const ee = new EventEmitter();
    let args;
    ee.on('data', (a, b) => { args = [a, b]; });
    ee.emit('data', 1, 2);
    assert.deepEqual(args, [1, 2]);
  });

  it('multiple listeners', () => {
    const ee = new EventEmitter();
    const calls = [];
    ee.on('x', () => calls.push('a'));
    ee.on('x', () => calls.push('b'));
    ee.emit('x');
    assert.deepEqual(calls, ['a', 'b']);
  });

  it('returns false for no listeners', () => {
    const ee = new EventEmitter();
    assert.equal(ee.emit('nope'), false);
  });

  it('returns true for listeners', () => {
    const ee = new EventEmitter();
    ee.on('x', () => {});
    assert.equal(ee.emit('x'), true);
  });
});

describe('once', () => {
  it('fires only once', () => {
    const ee = new EventEmitter();
    let count = 0;
    ee.once('x', () => count++);
    ee.emit('x');
    ee.emit('x');
    assert.equal(count, 1);
  });
});

describe('off', () => {
  it('removes specific listener', () => {
    const ee = new EventEmitter();
    let count = 0;
    const fn = () => count++;
    ee.on('x', fn);
    ee.emit('x');
    ee.off('x', fn);
    ee.emit('x');
    assert.equal(count, 1);
  });
});

describe('removeAllListeners', () => {
  it('removes all for event', () => {
    const ee = new EventEmitter();
    ee.on('a', () => {});
    ee.on('a', () => {});
    ee.on('b', () => {});
    ee.removeAllListeners('a');
    assert.equal(ee.listenerCount('a'), 0);
    assert.equal(ee.listenerCount('b'), 1);
  });

  it('removes all', () => {
    const ee = new EventEmitter();
    ee.on('a', () => {});
    ee.on('b', () => {});
    ee.removeAllListeners();
    assert.deepEqual(ee.eventNames(), []);
  });
});

describe('listenerCount', () => {
  it('counts correctly', () => {
    const ee = new EventEmitter();
    assert.equal(ee.listenerCount('x'), 0);
    ee.on('x', () => {});
    assert.equal(ee.listenerCount('x'), 1);
    ee.on('x', () => {});
    assert.equal(ee.listenerCount('x'), 2);
  });
});

describe('eventNames', () => {
  it('lists events', () => {
    const ee = new EventEmitter();
    ee.on('a', () => {});
    ee.on('b', () => {});
    assert.deepEqual(ee.eventNames().sort(), ['a', 'b']);
  });
});

describe('listeners', () => {
  it('returns listener functions', () => {
    const ee = new EventEmitter();
    const fn1 = () => {}, fn2 = () => {};
    ee.on('x', fn1);
    ee.on('x', fn2);
    assert.deepEqual(ee.listeners('x'), [fn1, fn2]);
  });
});

describe('prependListener', () => {
  it('adds to front', () => {
    const ee = new EventEmitter();
    const order = [];
    ee.on('x', () => order.push('second'));
    ee.prependListener('x', () => order.push('first'));
    ee.emit('x');
    assert.deepEqual(order, ['first', 'second']);
  });
});

describe('chaining', () => {
  it('on returns this', () => {
    const ee = new EventEmitter();
    assert.equal(ee.on('x', () => {}), ee);
  });

  it('chain multiple', () => {
    const calls = [];
    new EventEmitter()
      .on('a', () => calls.push('a'))
      .on('b', () => calls.push('b'))
      .emit('a');
    assert.deepEqual(calls, ['a']);
  });
});

describe('waitFor', () => {
  it('resolves on event', async () => {
    const ee = new EventEmitter();
    setTimeout(() => ee.emit('done', 42), 1);
    const result = await ee.waitFor('done');
    assert.equal(result, 42);
  });

  it('times out', async () => {
    const ee = new EventEmitter();
    try {
      await ee.waitFor('nope', 10);
      assert.fail();
    } catch (e) {
      assert.ok(e.message.includes('Timeout'));
    }
  });
});

describe('mixin', () => {
  it('adds emitter methods to object', () => {
    const obj = mixin({});
    let called = false;
    obj.on('test', () => { called = true; });
    obj.emit('test');
    assert.equal(called, true);
  });
});

describe('maxListeners', () => {
  it('get/set', () => {
    const ee = new EventEmitter();
    assert.equal(ee.getMaxListeners(), 10);
    ee.setMaxListeners(20);
    assert.equal(ee.getMaxListeners(), 20);
  });
});
