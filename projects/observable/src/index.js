// ===== Observable (RxJS-like) =====

export class Observable {
  constructor(subscribeFn) {
    this._subscribe = subscribeFn;
  }

  subscribe(observerOrNext, error, complete) {
    const observer = typeof observerOrNext === 'function'
      ? { next: observerOrNext, error: error || (() => {}), complete: complete || (() => {}) }
      : { next: observerOrNext.next || (() => {}), error: observerOrNext.error || (() => {}), complete: observerOrNext.complete || (() => {}) };

    let active = true;
    const subscription = {
      unsubscribe() { active = false; },
      get closed() { return !active; },
    };

    const safeObserver = {
      next(value) { if (active) observer.next(value); },
      error(err) { if (active) { active = false; observer.error(err); } },
      complete() { if (active) { active = false; observer.complete(); } },
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

  // ===== Operators =====

  map(fn) {
    return new Observable(observer => {
      return this.subscribe({
        next: value => observer.next(fn(value)),
        error: err => observer.error(err),
        complete: () => observer.complete(),
      }).unsubscribe;
    });
  }

  filter(predicate) {
    return new Observable(observer => {
      return this.subscribe({
        next: value => { if (predicate(value)) observer.next(value); },
        error: err => observer.error(err),
        complete: () => observer.complete(),
      }).unsubscribe;
    });
  }

  take(count) {
    return new Observable(observer => {
      let taken = 0;
      const sub = this.subscribe({
        next(value) {
          if (taken < count) { observer.next(value); taken++; }
          if (taken >= count) { observer.complete(); sub.unsubscribe(); }
        },
        error: err => observer.error(err),
        complete: () => observer.complete(),
      });
      return () => sub.unsubscribe();
    });
  }

  skip(count) {
    return new Observable(observer => {
      let skipped = 0;
      return this.subscribe({
        next: value => { if (++skipped > count) observer.next(value); },
        error: err => observer.error(err),
        complete: () => observer.complete(),
      }).unsubscribe;
    });
  }

  scan(fn, seed) {
    return new Observable(observer => {
      let acc = seed;
      return this.subscribe({
        next: value => { acc = fn(acc, value); observer.next(acc); },
        error: err => observer.error(err),
        complete: () => observer.complete(),
      }).unsubscribe;
    });
  }

  reduce(fn, seed) {
    return new Observable(observer => {
      let acc = seed;
      return this.subscribe({
        next: value => { acc = fn(acc, value); },
        error: err => observer.error(err),
        complete: () => { observer.next(acc); observer.complete(); },
      }).unsubscribe;
    });
  }

  tap(fn) {
    return new Observable(observer => {
      return this.subscribe({
        next: value => { fn(value); observer.next(value); },
        error: err => observer.error(err),
        complete: () => observer.complete(),
      }).unsubscribe;
    });
  }

  distinctUntilChanged(comparator = (a, b) => a === b) {
    return new Observable(observer => {
      let prev; let hasPrev = false;
      return this.subscribe({
        next: value => {
          if (!hasPrev || !comparator(prev, value)) {
            prev = value; hasPrev = true;
            observer.next(value);
          }
        },
        error: err => observer.error(err),
        complete: () => observer.complete(),
      }).unsubscribe;
    });
  }

  // ===== Static creators =====

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

  static timer(delayMs) {
    return new Observable(observer => {
      const id = setTimeout(() => { observer.next(0); observer.complete(); }, delayMs);
      return () => clearTimeout(id);
    });
  }

  static empty() {
    return new Observable(observer => observer.complete());
  }

  static never() {
    return new Observable(() => {});
  }

  // ===== Combination =====

  static merge(...observables) {
    return new Observable(observer => {
      let completed = 0;
      const subs = observables.map(obs => obs.subscribe({
        next: v => observer.next(v),
        error: err => observer.error(err),
        complete: () => { if (++completed === observables.length) observer.complete(); },
      }));
      return () => subs.forEach(s => s.unsubscribe());
    });
  }

  // Convert to promise (takes first value)
  toPromise() {
    return new Promise((resolve, reject) => {
      this.take(1).subscribe({
        next: resolve,
        error: reject,
        complete: () => {},
      });
    });
  }

  // Collect all values into array
  toArray() {
    return this.reduce((arr, v) => [...arr, v], []).toPromise();
  }

  pipe(...operators) {
    return operators.reduce((obs, op) => op(obs), this);
  }
}
