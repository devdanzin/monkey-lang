// promise.js — Promise/A+ implementation from scratch

const PENDING = 'pending';
const FULFILLED = 'fulfilled';
const REJECTED = 'rejected';

export class MyPromise {
  constructor(executor) {
    this._state = PENDING;
    this._value = undefined;
    this._reason = undefined;
    this._onFulfilled = [];
    this._onRejected = [];

    const resolve = (value) => {
      if (value instanceof MyPromise) {
        value.then(resolve, reject);
        return;
      }
      if (this._state !== PENDING) return;
      this._state = FULFILLED;
      this._value = value;
      this._onFulfilled.forEach(fn => queueMicrotask(() => fn(this._value)));
    };

    const reject = (reason) => {
      if (this._state !== PENDING) return;
      this._state = REJECTED;
      this._reason = reason;
      this._onRejected.forEach(fn => queueMicrotask(() => fn(this._reason)));
    };

    try {
      executor(resolve, reject);
    } catch (err) {
      reject(err);
    }
  }

  then(onFulfilled, onRejected) {
    onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : v => v;
    onRejected = typeof onRejected === 'function' ? onRejected : r => { throw r; };

    return new MyPromise((resolve, reject) => {
      const handleFulfilled = (value) => {
        try {
          const result = onFulfilled(value);
          resolvePromise(result, resolve, reject);
        } catch (err) {
          reject(err);
        }
      };

      const handleRejected = (reason) => {
        try {
          const result = onRejected(reason);
          resolvePromise(result, resolve, reject);
        } catch (err) {
          reject(err);
        }
      };

      if (this._state === FULFILLED) {
        queueMicrotask(() => handleFulfilled(this._value));
      } else if (this._state === REJECTED) {
        queueMicrotask(() => handleRejected(this._reason));
      } else {
        this._onFulfilled.push(handleFulfilled);
        this._onRejected.push(handleRejected);
      }
    });
  }

  catch(onRejected) {
    return this.then(null, onRejected);
  }

  finally(onFinally) {
    return this.then(
      value => MyPromise.resolve(onFinally()).then(() => value),
      reason => MyPromise.resolve(onFinally()).then(() => { throw reason; })
    );
  }

  // Static methods
  static resolve(value) {
    if (value instanceof MyPromise) return value;
    return new MyPromise(resolve => resolve(value));
  }

  static reject(reason) {
    return new MyPromise((_, reject) => reject(reason));
  }

  static all(promises) {
    return new MyPromise((resolve, reject) => {
      const results = new Array(promises.length);
      let remaining = promises.length;
      if (remaining === 0) { resolve(results); return; }

      promises.forEach((p, i) => {
        MyPromise.resolve(p).then(
          value => {
            results[i] = value;
            if (--remaining === 0) resolve(results);
          },
          reject
        );
      });
    });
  }

  static race(promises) {
    return new MyPromise((resolve, reject) => {
      promises.forEach(p => {
        MyPromise.resolve(p).then(resolve, reject);
      });
    });
  }

  static allSettled(promises) {
    return new MyPromise(resolve => {
      const results = new Array(promises.length);
      let remaining = promises.length;
      if (remaining === 0) { resolve(results); return; }

      promises.forEach((p, i) => {
        MyPromise.resolve(p).then(
          value => {
            results[i] = { status: 'fulfilled', value };
            if (--remaining === 0) resolve(results);
          },
          reason => {
            results[i] = { status: 'rejected', reason };
            if (--remaining === 0) resolve(results);
          }
        );
      });
    });
  }

  static any(promises) {
    return new MyPromise((resolve, reject) => {
      const errors = new Array(promises.length);
      let remaining = promises.length;
      if (remaining === 0) { reject(new AggregateError([], 'All promises were rejected')); return; }

      promises.forEach((p, i) => {
        MyPromise.resolve(p).then(
          resolve,
          reason => {
            errors[i] = reason;
            if (--remaining === 0) reject(new AggregateError(errors, 'All promises were rejected'));
          }
        );
      });
    });
  }

  // Deferred helper
  static deferred() {
    let resolve, reject;
    const promise = new MyPromise((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
  }
}

function resolvePromise(result, resolve, reject) {
  if (result instanceof MyPromise) {
    result.then(resolve, reject);
  } else if (result && (typeof result === 'object' || typeof result === 'function') && typeof result.then === 'function') {
    // Thenable
    let called = false;
    try {
      result.then(
        value => { if (!called) { called = true; resolvePromise(value, resolve, reject); } },
        reason => { if (!called) { called = true; reject(reason); } }
      );
    } catch (err) {
      if (!called) reject(err);
    }
  } else {
    resolve(result);
  }
}

// ===== Event Loop Simulation =====
export class EventLoop {
  constructor() {
    this.macroQueue = [];      // setTimeout, setInterval callbacks
    this.microQueue = [];      // Promise callbacks, queueMicrotask
    this.timers = [];          // { callback, delay, time, interval }
    this.time = 0;
    this.running = false;
  }

  setTimeout(callback, delay) {
    const id = this.timers.length;
    this.timers.push({ callback, delay, time: this.time + delay, id, interval: false });
    return id;
  }

  setInterval(callback, delay) {
    const id = this.timers.length;
    this.timers.push({ callback, delay, time: this.time + delay, id, interval: true });
    return id;
  }

  clearTimeout(id) {
    const timer = this.timers.find(t => t.id === id);
    if (timer) timer.cancelled = true;
  }

  clearInterval(id) { this.clearTimeout(id); }

  queueMicrotask(callback) {
    this.microQueue.push(callback);
  }

  // Process all pending microtasks
  drainMicrotasks() {
    while (this.microQueue.length > 0) {
      const task = this.microQueue.shift();
      task();
    }
  }

  // Advance time and process events
  tick(ms = 1) {
    this.time += ms;

    // Check timers
    for (const timer of this.timers) {
      if (timer.cancelled) continue;
      if (timer.time <= this.time) {
        this.macroQueue.push(timer.callback);
        if (timer.interval) {
          timer.time += timer.delay;
        } else {
          timer.cancelled = true;
        }
      }
    }

    // Process one macro task
    if (this.macroQueue.length > 0) {
      const task = this.macroQueue.shift();
      task();
    }

    // Drain microtasks
    this.drainMicrotasks();
  }

  // Run until all queues are empty
  run(maxTicks = 1000) {
    let ticks = 0;
    while (ticks < maxTicks) {
      this.drainMicrotasks();
      if (this.macroQueue.length === 0 && this.microQueue.length === 0) {
        const next = this.timers.filter(t => !t.cancelled).sort((a, b) => a.time - b.time)[0];
        if (!next) break;
        this.time = next.time;
        this.tick(0);
      } else {
        this.tick(0);
      }
      ticks++;
    }
    return ticks;
  }
}
