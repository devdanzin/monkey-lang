// Observable — reactive streams library (RxJS-lite)
// Supports: create, map, filter, reduce, take, skip, debounce, throttle, merge, combineLatest, pipe

export class Observable {
  constructor(subscribeFn) {
    this._subscribe = subscribeFn;
  }

  subscribe(observerOrNext, error, complete) {
    const observer = typeof observerOrNext === 'function'
      ? { next: observerOrNext, error: error || (() => {}), complete: complete || (() => {}) }
      : { next: observerOrNext.next || (() => {}), error: observerOrNext.error || (() => {}), complete: observerOrNext.complete || (() => {}) };

    let unsubscribed = false;
    const subscription = {
      unsubscribe() { unsubscribed = true; }
    };

    const safeObserver = {
      next(value) { if (!unsubscribed) observer.next(value); },
      error(err) { if (!unsubscribed) { observer.error(err); unsubscribed = true; } },
      complete() { if (!unsubscribed) { observer.complete(); unsubscribed = true; } },
    };

    try {
      const teardown = this._subscribe(safeObserver);
      const origUnsub = subscription.unsubscribe;
      subscription.unsubscribe = () => {
        origUnsub();
        if (typeof teardown === 'function') teardown();
      };
    } catch (err) {
      safeObserver.error(err);
    }

    return subscription;
  }

  // Pipe operators
  pipe(...operators) {
    return operators.reduce((obs, op) => op(obs), this);
  }

  // ===== Creation =====
  static of(...values) {
    return new Observable(observer => {
      for (const v of values) observer.next(v);
      observer.complete();
    });
  }

  static from(iterable) {
    return new Observable(observer => {
      for (const v of iterable) observer.next(v);
      observer.complete();
    });
  }

  static interval(ms) {
    return new Observable(observer => {
      let i = 0;
      const id = setInterval(() => observer.next(i++), ms);
      return () => clearInterval(id);
    });
  }

  static fromEvent(target, eventName) {
    return new Observable(observer => {
      const handler = e => observer.next(e);
      target.addEventListener(eventName, handler);
      return () => target.removeEventListener(eventName, handler);
    });
  }

  static fromPromise(promise) {
    return new Observable(observer => {
      promise.then(
        value => { observer.next(value); observer.complete(); },
        err => observer.error(err)
      );
    });
  }

  static empty() {
    return new Observable(observer => observer.complete());
  }

  static never() {
    return new Observable(() => {});
  }

  static throwError(err) {
    return new Observable(observer => observer.error(err));
  }

  // ===== Combination =====
  static merge(...observables) {
    return new Observable(observer => {
      let completed = 0;
      const subs = observables.map(obs =>
        obs.subscribe({
          next: v => observer.next(v),
          error: e => observer.error(e),
          complete: () => { if (++completed === observables.length) observer.complete(); }
        })
      );
      return () => subs.forEach(s => s.unsubscribe());
    });
  }

  static combineLatest(...observables) {
    return new Observable(observer => {
      const values = new Array(observables.length);
      const hasValue = new Array(observables.length).fill(false);
      let completed = 0;

      const subs = observables.map((obs, i) =>
        obs.subscribe({
          next: v => {
            values[i] = v;
            hasValue[i] = true;
            if (hasValue.every(Boolean)) observer.next([...values]);
          },
          error: e => observer.error(e),
          complete: () => { if (++completed === observables.length) observer.complete(); }
        })
      );
      return () => subs.forEach(s => s.unsubscribe());
    });
  }

  // ===== Convert to Promise =====
  toPromise() {
    return new Promise((resolve, reject) => {
      let last;
      this.subscribe({
        next: v => { last = v; },
        error: reject,
        complete: () => resolve(last),
      });
    });
  }

  // ===== Collect all values =====
  toArray() {
    return new Promise((resolve, reject) => {
      const arr = [];
      this.subscribe({
        next: v => arr.push(v),
        error: reject,
        complete: () => resolve(arr),
      });
    });
  }
}

// ===== Operators (pipeable) =====
export function map(fn) {
  return source => new Observable(observer => {
    return source.subscribe({
      next: v => observer.next(fn(v)),
      error: e => observer.error(e),
      complete: () => observer.complete(),
    });
  });
}

export function filter(predicate) {
  return source => new Observable(observer => {
    return source.subscribe({
      next: v => { if (predicate(v)) observer.next(v); },
      error: e => observer.error(e),
      complete: () => observer.complete(),
    });
  });
}

export function take(count) {
  return source => new Observable(observer => {
    let taken = 0;
    const sub = source.subscribe({
      next: v => {
        if (taken < count) { observer.next(v); taken++; }
        if (taken >= count) { observer.complete(); sub.unsubscribe(); }
      },
      error: e => observer.error(e),
      complete: () => observer.complete(),
    });
    return () => sub.unsubscribe();
  });
}

export function skip(count) {
  return source => new Observable(observer => {
    let skipped = 0;
    return source.subscribe({
      next: v => { if (skipped >= count) observer.next(v); else skipped++; },
      error: e => observer.error(e),
      complete: () => observer.complete(),
    });
  });
}

export function reduce(fn, seed) {
  return source => new Observable(observer => {
    let acc = seed;
    return source.subscribe({
      next: v => { acc = fn(acc, v); },
      error: e => observer.error(e),
      complete: () => { observer.next(acc); observer.complete(); },
    });
  });
}

export function scan(fn, seed) {
  return source => new Observable(observer => {
    let acc = seed;
    return source.subscribe({
      next: v => { acc = fn(acc, v); observer.next(acc); },
      error: e => observer.error(e),
      complete: () => observer.complete(),
    });
  });
}

export function tap(fn) {
  return source => new Observable(observer => {
    return source.subscribe({
      next: v => { fn(v); observer.next(v); },
      error: e => observer.error(e),
      complete: () => observer.complete(),
    });
  });
}

export function distinctUntilChanged(comparator) {
  const cmp = comparator || ((a, b) => a === b);
  return source => new Observable(observer => {
    let prev, hasPrev = false;
    return source.subscribe({
      next: v => {
        if (!hasPrev || !cmp(prev, v)) { observer.next(v); prev = v; hasPrev = true; }
      },
      error: e => observer.error(e),
      complete: () => observer.complete(),
    });
  });
}

export function switchMap(fn) {
  return source => new Observable(observer => {
    let innerSub = null;
    const outerSub = source.subscribe({
      next: v => {
        if (innerSub) innerSub.unsubscribe();
        innerSub = fn(v).subscribe({
          next: iv => observer.next(iv),
          error: e => observer.error(e),
        });
      },
      error: e => observer.error(e),
      complete: () => { if (!innerSub) observer.complete(); },
    });
    return () => { outerSub.unsubscribe(); if (innerSub) innerSub.unsubscribe(); };
  });
}

export function catchError(handler) {
  return source => new Observable(observer => {
    return source.subscribe({
      next: v => observer.next(v),
      error: e => handler(e).subscribe(observer),
      complete: () => observer.complete(),
    });
  });
}
