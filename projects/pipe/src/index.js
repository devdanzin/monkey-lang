/**
 * Tiny Pipe Operator
 * 
 * Functional pipeline utilities:
 * - pipe: compose left-to-right
 * - compose: compose right-to-left
 * - Pipeline class: chainable, lazy evaluation
 * - tap: side-effect without changing value
 * - when: conditional step
 * - tryCatch: error handling in pipeline
 * - parallel: run multiple transforms, collect results
 * - Async pipeline support
 */

function pipe(...fns) {
  return (x) => fns.reduce((v, f) => f(v), x);
}

function compose(...fns) {
  return (x) => fns.reduceRight((v, f) => f(v), x);
}

function tap(fn) {
  return (x) => { fn(x); return x; };
}

function when(predicate, fn) {
  return (x) => predicate(x) ? fn(x) : x;
}

function unless(predicate, fn) {
  return (x) => predicate(x) ? x : fn(x);
}

function tryCatch(fn, handler) {
  return (x) => { try { return fn(x); } catch (e) { return handler(e, x); } };
}

function parallel(...fns) {
  return (x) => fns.map(f => f(x));
}

function identity(x) { return x; }

class Pipeline {
  constructor(value) {
    this._value = value;
    this._steps = [];
  }

  static of(value) { return new Pipeline(value); }

  pipe(fn) {
    const p = new Pipeline(this._value);
    p._steps = [...this._steps, fn];
    return p;
  }

  tap(fn) { return this.pipe(tap(fn)); }
  when(pred, fn) { return this.pipe(when(pred, fn)); }
  unless(pred, fn) { return this.pipe(unless(pred, fn)); }

  map(fn) {
    return this.pipe(v => Array.isArray(v) ? v.map(fn) : fn(v));
  }

  filter(fn) {
    return this.pipe(v => Array.isArray(v) ? v.filter(fn) : v);
  }

  reduce(fn, init) {
    return this.pipe(v => Array.isArray(v) ? v.reduce(fn, init) : v);
  }

  tryCatch(handler) {
    const lastStep = this._steps[this._steps.length - 1];
    if (!lastStep) return this;
    const p = new Pipeline(this._value);
    p._steps = [...this._steps.slice(0, -1), tryCatch(lastStep, handler)];
    return p;
  }

  value() {
    return this._steps.reduce((v, f) => f(v), this._value);
  }

  valueOf() { return this.value(); }
  toString() { return String(this.value()); }
}

// Async pipeline
function pipeAsync(...fns) {
  return async (x) => {
    let result = x;
    for (const fn of fns) {
      result = await fn(result);
    }
    return result;
  };
}

class AsyncPipeline {
  constructor(value) {
    this._value = value;
    this._steps = [];
  }

  static of(value) { return new AsyncPipeline(value); }

  pipe(fn) {
    const p = new AsyncPipeline(this._value);
    p._steps = [...this._steps, fn];
    return p;
  }

  async value() {
    let result = this._value;
    for (const fn of this._steps) {
      result = await fn(result);
    }
    return result;
  }
}

module.exports = {
  pipe, compose, tap, when, unless, tryCatch, parallel, identity,
  Pipeline, pipeAsync, AsyncPipeline,
};
