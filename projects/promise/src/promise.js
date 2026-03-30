// Promise/A+ implementation from scratch
// Spec: https://promisesaplus.com/

const PENDING = 'pending';
const FULFILLED = 'fulfilled';
const REJECTED = 'rejected';

export class MyPromise {
  constructor(executor) {
    this._state = PENDING;
    this._value = undefined;
    this._handlers = [];

    try {
      executor(
        value => this._resolve(value),
        reason => this._reject(reason)
      );
    } catch (err) {
      this._reject(err);
    }
  }

  _resolve(value) {
    // If resolving with a thenable, adopt its state
    if (value && (typeof value === 'object' || typeof value === 'function')) {
      try {
        const then = value.then;
        if (typeof then === 'function') {
          let called = false;
          try {
            then.call(
              value,
              y => { if (!called) { called = true; this._resolve(y); } },
              r => { if (!called) { called = true; this._reject(r); } }
            );
          } catch (e) {
            if (!called) this._reject(e);
          }
          return;
        }
      } catch (e) {
        this._reject(e);
        return;
      }
    }

    if (this._state !== PENDING) return;
    this._state = FULFILLED;
    this._value = value;
    this._flush();
  }

  _reject(reason) {
    if (this._state !== PENDING) return;
    this._state = REJECTED;
    this._value = reason;
    this._flush();
  }

  _flush() {
    queueMicrotask(() => {
      for (const handler of this._handlers) {
        this._handle(handler);
      }
      this._handlers = [];
    });
  }

  _handle({ onFulfilled, onRejected, resolve, reject }) {
    if (this._state === PENDING) {
      this._handlers.push({ onFulfilled, onRejected, resolve, reject });
      return;
    }

    queueMicrotask(() => {
      const cb = this._state === FULFILLED ? onFulfilled : onRejected;

      if (!cb) {
        if (this._state === FULFILLED) resolve(this._value);
        else reject(this._value);
        return;
      }

      try {
        const result = cb(this._value);
        resolve(result);
      } catch (err) {
        reject(err);
      }
    });
  }

  then(onFulfilled, onRejected) {
    return new MyPromise((resolve, reject) => {
      this._handle({
        onFulfilled: typeof onFulfilled === 'function' ? onFulfilled : null,
        onRejected: typeof onRejected === 'function' ? onRejected : null,
        resolve,
        reject,
      });
    });
  }

  catch(onRejected) {
    return this.then(null, onRejected);
  }

  finally(callback) {
    return this.then(
      value => MyPromise.resolve(callback()).then(() => value),
      reason => MyPromise.resolve(callback()).then(() => { throw reason; })
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
      const results = [];
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

  static allSettled(promises) {
    return new MyPromise(resolve => {
      const results = [];
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

  static race(promises) {
    return new MyPromise((resolve, reject) => {
      for (const p of promises) {
        MyPromise.resolve(p).then(resolve, reject);
      }
    });
  }

  static any(promises) {
    return new MyPromise((resolve, reject) => {
      const errors = [];
      let remaining = promises.length;
      if (remaining === 0) { reject(new AggregateError([], 'All promises were rejected')); return; }

      promises.forEach((p, i) => {
        MyPromise.resolve(p).then(resolve, reason => {
          errors[i] = reason;
          if (--remaining === 0) reject(new AggregateError(errors, 'All promises were rejected'));
        });
      });
    });
  }
}
