import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from '../src/index.js';

describe('EventEmitter — on/emit', () => {
  it('basic emit', () => {
    const ee = new EventEmitter();
    let called = false;
    ee.on('test', () => { called = true; });
    ee.emit('test');
    assert.equal(called, true);
  });

  it('passes arguments', () => {
    const ee = new EventEmitter();
    let args;
    ee.on('data', (...a) => { args = a; });
    ee.emit('data', 1, 'two', { three: 3 });
    assert.deepEqual(args, [1, 'two', { three: 3 }]);
  });

  it('multiple listeners', () => {
    const ee = new EventEmitter();
    const log = [];
    ee.on('x', () => log.push(1));
    ee.on('x', () => log.push(2));
    ee.emit('x');
    assert.deepEqual(log, [1, 2]);
  });

  it('returns true if listeners exist', () => {
    const ee = new EventEmitter();
    ee.on('x', () => {});
    assert.equal(ee.emit('x'), true);
    assert.equal(ee.emit('y'), false);
  });

  it('chaining', () => {
    const ee = new EventEmitter();
    const result = ee.on('a', () => {}).on('b', () => {});
    assert.ok(result instanceof EventEmitter);
  });
});

describe('EventEmitter — once', () => {
  it('fires only once', () => {
    const ee = new EventEmitter();
    let count = 0;
    ee.once('x', () => count++);
    ee.emit('x'); ee.emit('x'); ee.emit('x');
    assert.equal(count, 1);
  });
});

describe('EventEmitter — off', () => {
  it('removes specific listener', () => {
    const ee = new EventEmitter();
    const fn = () => {};
    ee.on('x', fn);
    ee.off('x', fn);
    assert.equal(ee.listenerCount('x'), 0);
  });

  it('removes all listeners for event', () => {
    const ee = new EventEmitter();
    ee.on('x', () => {}); ee.on('x', () => {});
    ee.off('x');
    assert.equal(ee.listenerCount('x'), 0);
  });
});

describe('EventEmitter — wildcards', () => {
  it('* matches all events', () => {
    const ee = new EventEmitter();
    const events = [];
    ee.on('*', (name) => events.push(name));
    ee.emit('foo'); ee.emit('bar');
    assert.deepEqual(events, ['foo', 'bar']);
  });

  it('prefix wildcard', () => {
    const ee = new EventEmitter();
    const events = [];
    ee.on('user.*', (name) => events.push(name));
    ee.emit('user.login');
    ee.emit('user.logout');
    ee.emit('system.start');
    assert.deepEqual(events, ['user.login', 'user.logout']);
  });

  it('once wildcard', () => {
    const ee = new EventEmitter();
    let count = 0;
    ee.once('data.*', () => count++);
    ee.emit('data.ready');
    ee.emit('data.error');
    assert.equal(count, 1);
  });
});

describe('EventEmitter — utility', () => {
  it('listenerCount', () => {
    const ee = new EventEmitter();
    ee.on('x', () => {}); ee.on('x', () => {});
    assert.equal(ee.listenerCount('x'), 2);
  });

  it('eventNames', () => {
    const ee = new EventEmitter();
    ee.on('a', () => {}); ee.on('b', () => {});
    assert.deepEqual(ee.eventNames().sort(), ['a', 'b']);
  });

  it('removeAllListeners', () => {
    const ee = new EventEmitter();
    ee.on('a', () => {}); ee.on('b', () => {});
    ee.removeAllListeners();
    assert.equal(ee.eventNames().length, 0);
  });

  it('removeAllListeners for specific event', () => {
    const ee = new EventEmitter();
    ee.on('a', () => {}); ee.on('b', () => {});
    ee.removeAllListeners('a');
    assert.deepEqual(ee.eventNames(), ['b']);
  });
});

describe('EventEmitter — async', () => {
  it('emitAsync waits for handlers', async () => {
    const ee = new EventEmitter();
    let resolved = false;
    ee.on('x', async () => {
      await new Promise(r => setTimeout(r, 20));
      resolved = true;
    });
    await ee.emitAsync('x');
    assert.equal(resolved, true);
  });

  it('waitFor resolves on emit', async () => {
    const ee = new EventEmitter();
    setTimeout(() => ee.emit('ready', 42), 10);
    const value = await ee.waitFor('ready');
    assert.equal(value, 42);
  });

  it('waitFor rejects on timeout', async () => {
    const ee = new EventEmitter();
    await assert.rejects(
      () => ee.waitFor('never', { timeout: 30 }),
      { message: 'Timeout waiting for "never"' }
    );
  });
});

describe('EventEmitter — pipe', () => {
  it('pipes specific events', () => {
    const source = new EventEmitter();
    const target = new EventEmitter();
    const log = [];
    target.on('x', (v) => log.push(v));
    source.pipe(target, ['x']);
    source.emit('x', 42);
    assert.deepEqual(log, [42]);
  });
});
