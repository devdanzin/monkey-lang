// Counter Map — count occurrences
export class Counter extends Map {
  constructor(iterable) { super(); if (iterable) for (const item of iterable) this.increment(item); }
  increment(key, n = 1) { this.set(key, (this.get(key) || 0) + n); return this; }
  decrement(key, n = 1) { this.set(key, (this.get(key) || 0) - n); return this; }
  get total() { let s = 0; for (const v of this.values()) s += v; return s; }
  mostCommon(n) { return [...this.entries()].sort((a, b) => b[1] - a[1]).slice(0, n); }
  leastCommon(n) { return [...this.entries()].sort((a, b) => a[1] - b[1]).slice(0, n); }
  merge(other) { for (const [k, v] of other) this.increment(k, v); return this; }
  subtract(other) { for (const [k, v] of other) this.decrement(k, v); return this; }
  toObject() { return Object.fromEntries(this); }
  static from(iterable) { return new Counter(iterable); }
}
