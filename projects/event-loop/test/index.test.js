import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EventLoop } from '../src/index.js';

describe('EventLoop — macrotasks', () => {
  it('executes macrotasks in order', () => {
    const el = new EventLoop();
    const log = [];
    el.enqueueTask(() => log.push('A'), 'A');
    el.enqueueTask(() => log.push('B'), 'B');
    el.run();
    assert.deepEqual(log, ['A', 'B']);
  });
});

describe('EventLoop — microtasks', () => {
  it('microtasks drain before next macrotask', () => {
    const el = new EventLoop();
    const log = [];
    el.enqueueTask((loop) => {
      log.push('macro1');
      loop.enqueueMicrotask(() => log.push('micro1'));
      loop.enqueueMicrotask(() => log.push('micro2'));
    }, 'macro1');
    el.enqueueTask(() => log.push('macro2'), 'macro2');
    el.run();
    assert.deepEqual(log, ['macro1', 'micro1', 'micro2', 'macro2']);
  });

  it('microtasks can enqueue more microtasks', () => {
    const el = new EventLoop();
    const log = [];
    el.enqueueTask((loop) => {
      log.push('task');
      loop.enqueueMicrotask((loop2) => {
        log.push('micro1');
        loop2.enqueueMicrotask(() => log.push('micro2'));
      });
    });
    el.run();
    assert.deepEqual(log, ['task', 'micro1', 'micro2']);
  });
});

describe('EventLoop — timers', () => {
  it('executes timer after delay', () => {
    const el = new EventLoop();
    const log = [];
    el.setTimeout(() => log.push('timer'), 100);
    el.run();
    assert.deepEqual(log, ['timer']);
    assert.equal(el.currentTime, 100);
  });

  it('timers execute in order', () => {
    const el = new EventLoop();
    const log = [];
    el.setTimeout(() => log.push('slow'), 200);
    el.setTimeout(() => log.push('fast'), 100);
    el.run();
    assert.deepEqual(log, ['fast', 'slow']);
  });

  it('timer 0 still defers', () => {
    const el = new EventLoop();
    const log = [];
    el.enqueueTask(() => log.push('task'));
    el.setTimeout(() => log.push('timeout0'), 0);
    el.run();
    // Task should run first, then the timeout
    assert.equal(log[0], 'task');
  });
});

describe('EventLoop — mixed', () => {
  it('classic JS event loop puzzle', () => {
    const el = new EventLoop();
    const log = [];
    
    el.enqueueTask((loop) => {
      log.push('script start');
      
      loop.setTimeout(() => log.push('setTimeout'), 0);
      
      loop.enqueueMicrotask(() => {
        log.push('promise1');
      });
      loop.enqueueMicrotask(() => {
        log.push('promise2');
      });
      
      log.push('script end');
    }, 'script');
    
    el.run();
    
    assert.deepEqual(log, [
      'script start',
      'script end',
      'promise1',
      'promise2',
      'setTimeout',
    ]);
  });
});

describe('EventLoop — isEmpty', () => {
  it('empty initially', () => {
    assert.equal(new EventLoop().isEmpty, true);
  });

  it('not empty with tasks', () => {
    const el = new EventLoop();
    el.enqueueTask(() => {});
    assert.equal(el.isEmpty, false);
  });

  it('empty after run', () => {
    const el = new EventLoop();
    el.enqueueTask(() => {});
    el.run();
    assert.equal(el.isEmpty, true);
  });
});

describe('EventLoop — interval', () => {
  it('fires repeatedly', () => {
    const el = new EventLoop();
    let count = 0;
    el.setInterval(() => { count++; if (count >= 3) el.stop(); }, 100);
    el.run(20);
    assert.ok(count >= 3);
  });
});
