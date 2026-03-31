// Tiny assertion library — chainable, expressive assertions

class AssertionError extends Error { constructor(msg) { super(msg); this.name = 'AssertionError'; } }

export function expect(value) { return new Assertion(value); }

class Assertion {
  constructor(value) { this._value = value; this._not = false; }

  get not() { this._not = !this._not; return this; }
  get be() { return this; }
  get to() { return this; }
  get a() { return this; }
  get an() { return this; }
  get is() { return this; }
  get that() { return this; }
  get and() { return this; }

  _check(condition, msg) {
    if (this._not ? condition : !condition) throw new AssertionError(msg);
    this._not = false;
    return this;
  }

  equal(expected) { return this._check(this._value === expected, `Expected ${this._value} to ${this._not ? 'not ' : ''}equal ${expected}`); }
  deepEqual(expected) { return this._check(JSON.stringify(this._value) === JSON.stringify(expected), `Expected deep equal`); }
  ok() { return this._check(!!this._value, `Expected truthy`); }
  truthy() { return this.ok(); }
  falsy() { return this._check(!this._value, `Expected falsy`); }
  null() { return this._check(this._value === null, `Expected null`); }
  undefined() { return this._check(this._value === undefined, `Expected undefined`); }
  type(t) { return this._check(typeof this._value === t, `Expected type ${t}, got ${typeof this._value}`); }
  instanceOf(cls) { return this._check(this._value instanceof cls, `Expected instanceof ${cls.name}`); }

  gt(n) { return this._check(this._value > n, `Expected ${this._value} > ${n}`); }
  gte(n) { return this._check(this._value >= n, `Expected ${this._value} >= ${n}`); }
  lt(n) { return this._check(this._value < n, `Expected ${this._value} < ${n}`); }
  lte(n) { return this._check(this._value <= n, `Expected ${this._value} <= ${n}`); }
  between(lo, hi) { return this._check(this._value >= lo && this._value <= hi, `Expected ${this._value} between ${lo} and ${hi}`); }

  include(item) {
    if (typeof this._value === 'string') return this._check(this._value.includes(item), `Expected to include "${item}"`);
    if (Array.isArray(this._value)) return this._check(this._value.includes(item), `Expected array to include ${item}`);
    return this._check(item in this._value, `Expected object to have key ${item}`);
  }

  match(re) { return this._check(re.test(this._value), `Expected to match ${re}`); }
  length(n) { return this._check(this._value.length === n, `Expected length ${n}, got ${this._value.length}`); }
  empty() { return this._check(this._value.length === 0, `Expected empty`); }

  throws(ErrorType) {
    let threw = false, err;
    try { this._value(); } catch (e) { threw = true; err = e; }
    if (ErrorType) return this._check(threw && err instanceof ErrorType, `Expected to throw ${ErrorType.name}`);
    return this._check(threw, `Expected to throw`);
  }

  property(key, val) {
    if (val !== undefined) return this._check(this._value[key] === val, `Expected .${key} to be ${val}`);
    return this._check(key in this._value, `Expected property ${key}`);
  }

  closeTo(expected, delta = 0.001) { return this._check(Math.abs(this._value - expected) <= delta, `Expected ${this._value} close to ${expected}`); }
}
