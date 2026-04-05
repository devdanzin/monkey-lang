// observable.js — Observable

export class Observable {
  constructor(subscribeFn) { this._subscribe = subscribeFn; }

  subscribe(observerOrNext, error, complete) {
    const observer = typeof observerOrNext === 'function'
      ? { next: observerOrNext, error: error || (e => { throw e; }), complete: complete || (() => {}) }
      : { next: observerOrNext.next || (() => {}), error: observerOrNext.error || (e => { throw e; }), complete: observerOrNext.complete || (() => {}) };

    let unsubscribed = false;
    const safeObserver = {
      next: (v) => { if (!unsubscribed) observer.next(v); },
      error: (e) => { if (!unsubscribed) observer.error(e); },
      complete: () => { if (!unsubscribed) { observer.complete(); unsubscribed = true; } },
    };

    const teardown = this._subscribe(safeObserver);
    return { unsubscribe() { unsubscribed = true; if (typeof teardown === 'function') teardown(); } };
  }

  pipe(...operators) { return operators.reduce((obs, op) => op(obs), this); }

  static of(...values) { return new Observable(obs => { for (const v of values) obs.next(v); obs.complete(); }); }
  static from(iterable) { return new Observable(obs => { for (const v of iterable) obs.next(v); obs.complete(); }); }
  static interval(ms) { return new Observable(obs => { let i = 0; const id = setInterval(() => obs.next(i++), ms); return () => clearInterval(id); }); }
  static empty() { return new Observable(obs => obs.complete()); }
}

// ===== Operators =====
export const map = (fn) => (source) => new Observable(obs => source.subscribe({ next: v => obs.next(fn(v)), error: e => obs.error(e), complete: () => obs.complete() }));

export const filter = (fn) => (source) => new Observable(obs => source.subscribe({ next: v => { if (fn(v)) obs.next(v); }, error: e => obs.error(e), complete: () => obs.complete() }));

export const take = (n) => (source) => new Observable(obs => { let count = 0; let sub; sub = source.subscribe({ next: v => { if (count < n) { obs.next(v); count++; if (count >= n) { obs.complete(); if (sub) sub.unsubscribe(); } } }, error: e => obs.error(e), complete: () => obs.complete() }); return () => sub.unsubscribe(); });

export const skip = (n) => (source) => new Observable(obs => { let count = 0; return source.subscribe({ next: v => { if (count++ >= n) obs.next(v); }, error: e => obs.error(e), complete: () => obs.complete() }); });

export const scan = (fn, seed) => (source) => new Observable(obs => { let acc = seed; return source.subscribe({ next: v => { acc = fn(acc, v); obs.next(acc); }, error: e => obs.error(e), complete: () => obs.complete() }); });

export const distinctUntilChanged = () => (source) => new Observable(obs => { let prev, hasPrev = false; return source.subscribe({ next: v => { if (!hasPrev || v !== prev) { obs.next(v); prev = v; hasPrev = true; } }, error: e => obs.error(e), complete: () => obs.complete() }); });

export const tap = (fn) => (source) => new Observable(obs => source.subscribe({ next: v => { fn(v); obs.next(v); }, error: e => obs.error(e), complete: () => obs.complete() }));

// ===== Subject =====
export class Subject extends Observable {
  constructor() { super(obs => { this._observers.push(obs); return () => { this._observers = this._observers.filter(o => o !== obs); }; }); this._observers = []; }
  next(value) { for (const obs of [...this._observers]) obs.next(value); }
  error(err) { for (const obs of [...this._observers]) obs.error(err); }
  complete() { for (const obs of [...this._observers]) obs.complete(); }
}

export class BehaviorSubject extends Subject {
  constructor(initialValue) { super(); this._value = initialValue; }
  get value() { return this._value; }
  next(value) { this._value = value; super.next(value); }
  subscribe(observerOrNext, error, complete) {
    const sub = super.subscribe(observerOrNext, error, complete);
    const observer = typeof observerOrNext === 'function' ? observerOrNext : observerOrNext.next;
    if (observer) observer(this._value);
    return sub;
  }
}

export class ReplaySubject extends Subject {
  constructor(bufferSize = Infinity) { super(); this._buffer = []; this._bufferSize = bufferSize; }
  next(value) { this._buffer.push(value); if (this._buffer.length > this._bufferSize) this._buffer.shift(); super.next(value); }
  subscribe(observerOrNext, error, complete) {
    const sub = super.subscribe(observerOrNext, error, complete);
    const observer = typeof observerOrNext === 'function' ? observerOrNext : observerOrNext.next;
    if (observer) for (const v of this._buffer) observer(v);
    return sub;
  }
}
