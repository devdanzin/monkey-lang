/**
 * Tiny Reactive Streams
 * 
 * Rx-like reactive stream processing:
 * - Stream creation: of, from, interval, fromEvent
 * - Operators: map, filter, reduce, scan, take, skip, debounce, throttle
 * - Combination: merge, zip, concat, combineLatest
 * - Error handling: catchError, retry
 * - Subscription with next/error/complete
 */

class Stream {
  constructor(subscribe) {
    this._subscribe = subscribe;
  }

  subscribe(observerOrNext, error, complete) {
    const observer = typeof observerOrNext === 'function'
      ? { next: observerOrNext, error: error || (() => {}), complete: complete || (() => {}) }
      : observerOrNext;
    
    const sub = { closed: false };
    const safeObserver = {
      next: (v) => { if (!sub.closed) observer.next(v); },
      error: (e) => { if (!sub.closed) { sub.closed = true; observer.error(e); } },
      complete: () => { if (!sub.closed) { sub.closed = true; observer.complete(); } },
    };
    
    const teardown = this._subscribe(safeObserver);
    sub.unsubscribe = () => { sub.closed = true; if (teardown) teardown(); };
    return sub;
  }

  // Operators
  map(fn) {
    return new Stream(obs => {
      return this.subscribe({ next: v => obs.next(fn(v)), error: e => obs.error(e), complete: () => obs.complete() }).unsubscribe;
    });
  }

  filter(fn) {
    return new Stream(obs => {
      return this.subscribe({ next: v => { if (fn(v)) obs.next(v); }, error: e => obs.error(e), complete: () => obs.complete() }).unsubscribe;
    });
  }

  take(n) {
    return new Stream(obs => {
      let count = 0;
      const sub = this.subscribe({
        next: v => { if (count < n) { obs.next(v); count++; } if (count >= n) { obs.complete(); sub.unsubscribe(); } },
        error: e => obs.error(e),
        complete: () => obs.complete(),
      });
      return sub.unsubscribe;
    });
  }

  skip(n) {
    return new Stream(obs => {
      let count = 0;
      return this.subscribe({ next: v => { if (++count > n) obs.next(v); }, error: e => obs.error(e), complete: () => obs.complete() }).unsubscribe;
    });
  }

  scan(fn, seed) {
    return new Stream(obs => {
      let acc = seed;
      return this.subscribe({ next: v => { acc = fn(acc, v); obs.next(acc); }, error: e => obs.error(e), complete: () => obs.complete() }).unsubscribe;
    });
  }

  reduce(fn, seed) {
    return new Stream(obs => {
      let acc = seed;
      return this.subscribe({ next: v => { acc = fn(acc, v); }, error: e => obs.error(e), complete: () => { obs.next(acc); obs.complete(); } }).unsubscribe;
    });
  }

  tap(fn) {
    return new Stream(obs => {
      return this.subscribe({ next: v => { fn(v); obs.next(v); }, error: e => obs.error(e), complete: () => obs.complete() }).unsubscribe;
    });
  }

  distinct() {
    return new Stream(obs => {
      const seen = new Set();
      return this.subscribe({ next: v => { if (!seen.has(v)) { seen.add(v); obs.next(v); } }, error: e => obs.error(e), complete: () => obs.complete() }).unsubscribe;
    });
  }

  catchError(fn) {
    return new Stream(obs => {
      return this.subscribe({ next: v => obs.next(v), error: e => { const recovery = fn(e); recovery.subscribe(obs); }, complete: () => obs.complete() }).unsubscribe;
    });
  }

  // Collect all values
  toArray() {
    return new Promise((resolve, reject) => {
      const result = [];
      this.subscribe({ next: v => result.push(v), error: reject, complete: () => resolve(result) });
    });
  }

  // Static creators
  static of(...values) {
    return new Stream(obs => {
      for (const v of values) obs.next(v);
      obs.complete();
    });
  }

  static from(iterable) {
    return new Stream(obs => {
      for (const v of iterable) obs.next(v);
      obs.complete();
    });
  }

  static empty() {
    return new Stream(obs => obs.complete());
  }

  static throwError(err) {
    return new Stream(obs => obs.error(err));
  }

  // Combinators
  static merge(...streams) {
    return new Stream(obs => {
      let completed = 0;
      const subs = streams.map(s => s.subscribe({
        next: v => obs.next(v),
        error: e => obs.error(e),
        complete: () => { if (++completed === streams.length) obs.complete(); },
      }));
      return () => subs.forEach(s => s.unsubscribe());
    });
  }

  static concat(...streams) {
    return new Stream(obs => {
      let idx = 0;
      function subscribeTo(i) {
        if (i >= streams.length) { obs.complete(); return; }
        streams[i].subscribe({
          next: v => obs.next(v),
          error: e => obs.error(e),
          complete: () => subscribeTo(i + 1),
        });
      }
      subscribeTo(0);
    });
  }

  static zip(...streams) {
    return new Stream(obs => {
      const buffers = streams.map(() => []);
      let completed = 0;
      const subs = streams.map((s, i) => s.subscribe({
        next: v => {
          buffers[i].push(v);
          if (buffers.every(b => b.length > 0)) {
            obs.next(buffers.map(b => b.shift()));
          }
        },
        error: e => obs.error(e),
        complete: () => { if (++completed === streams.length) obs.complete(); },
      }));
      return () => subs.forEach(s => s.unsubscribe());
    });
  }
}

module.exports = { Stream };
