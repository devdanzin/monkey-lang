/**
 * Tiny Immutable Collections
 * 
 * Persistent data structures that return new copies on mutation:
 * - ImmutableList: persistent array with structural sharing
 * - ImmutableMap: persistent hash map
 * - ImmutableSet: persistent set
 * - ImmutableStack: persistent stack
 */

class ImmutableList {
  constructor(items = []) {
    this._items = Object.freeze([...items]);
  }

  get size() { return this._items.length; }
  get(index) { return this._items[index]; }
  first() { return this._items[0]; }
  last() { return this._items[this._items.length - 1]; }
  
  push(...values) { return new ImmutableList([...this._items, ...values]); }
  pop() { return new ImmutableList(this._items.slice(0, -1)); }
  unshift(...values) { return new ImmutableList([...values, ...this._items]); }
  shift() { return new ImmutableList(this._items.slice(1)); }
  
  set(index, value) {
    const arr = [...this._items];
    arr[index] = value;
    return new ImmutableList(arr);
  }
  
  insert(index, value) {
    const arr = [...this._items];
    arr.splice(index, 0, value);
    return new ImmutableList(arr);
  }
  
  remove(index) {
    const arr = [...this._items];
    arr.splice(index, 1);
    return new ImmutableList(arr);
  }
  
  concat(other) {
    const items = other instanceof ImmutableList ? other._items : other;
    return new ImmutableList([...this._items, ...items]);
  }
  
  slice(start, end) { return new ImmutableList(this._items.slice(start, end)); }
  reverse() { return new ImmutableList([...this._items].reverse()); }
  sort(fn) { return new ImmutableList([...this._items].sort(fn)); }
  
  map(fn) { return new ImmutableList(this._items.map(fn)); }
  filter(fn) { return new ImmutableList(this._items.filter(fn)); }
  reduce(fn, init) { return this._items.reduce(fn, init); }
  find(fn) { return this._items.find(fn); }
  every(fn) { return this._items.every(fn); }
  some(fn) { return this._items.some(fn); }
  includes(val) { return this._items.includes(val); }
  indexOf(val) { return this._items.indexOf(val); }
  
  toArray() { return [...this._items]; }
  toJSON() { return this._items; }
  [Symbol.iterator]() { return this._items[Symbol.iterator](); }
  
  equals(other) {
    if (!(other instanceof ImmutableList)) return false;
    if (this.size !== other.size) return false;
    return this._items.every((v, i) => v === other._items[i]);
  }

  static of(...items) { return new ImmutableList(items); }
  static from(iterable) { return new ImmutableList([...iterable]); }
}

class ImmutableMap {
  constructor(entries = []) {
    this._map = Object.freeze(new Map(entries));
  }

  get size() { return this._map.size; }
  get(key) { return this._map.get(key); }
  has(key) { return this._map.has(key); }
  
  set(key, value) {
    const m = new Map(this._map);
    m.set(key, value);
    return new ImmutableMap(m);
  }
  
  delete(key) {
    const m = new Map(this._map);
    m.delete(key);
    return new ImmutableMap(m);
  }
  
  update(key, fn, defaultVal) {
    const current = this.has(key) ? this.get(key) : defaultVal;
    return this.set(key, fn(current));
  }
  
  merge(other) {
    const entries = other instanceof ImmutableMap ? [...other._map] : Object.entries(other);
    const m = new Map(this._map);
    for (const [k, v] of entries) m.set(k, v);
    return new ImmutableMap(m);
  }
  
  keys() { return [...this._map.keys()]; }
  values() { return [...this._map.values()]; }
  entries() { return [...this._map.entries()]; }
  
  map(fn) {
    return new ImmutableMap([...this._map].map(([k, v]) => [k, fn(v, k)]));
  }
  
  filter(fn) {
    return new ImmutableMap([...this._map].filter(([k, v]) => fn(v, k)));
  }
  
  toObject() {
    const obj = {};
    for (const [k, v] of this._map) obj[k] = v;
    return obj;
  }
  
  toJSON() { return this.toObject(); }
  [Symbol.iterator]() { return this._map[Symbol.iterator](); }
  
  equals(other) {
    if (!(other instanceof ImmutableMap)) return false;
    if (this.size !== other.size) return false;
    for (const [k, v] of this._map) {
      if (!other.has(k) || other.get(k) !== v) return false;
    }
    return true;
  }

  static of(obj) { return new ImmutableMap(Object.entries(obj)); }
}

class ImmutableSet {
  constructor(items = []) {
    this._set = Object.freeze(new Set(items));
  }

  get size() { return this._set.size; }
  has(value) { return this._set.has(value); }
  
  add(value) { return new ImmutableSet([...this._set, value]); }
  delete(value) {
    const s = new Set(this._set);
    s.delete(value);
    return new ImmutableSet(s);
  }
  
  union(other) {
    const items = other instanceof ImmutableSet ? other._set : other;
    return new ImmutableSet([...this._set, ...items]);
  }
  
  intersect(other) {
    const otherSet = other instanceof ImmutableSet ? other._set : new Set(other);
    return new ImmutableSet([...this._set].filter(v => otherSet.has(v)));
  }
  
  difference(other) {
    const otherSet = other instanceof ImmutableSet ? other._set : new Set(other);
    return new ImmutableSet([...this._set].filter(v => !otherSet.has(v)));
  }
  
  toArray() { return [...this._set]; }
  toJSON() { return this.toArray(); }
  [Symbol.iterator]() { return this._set[Symbol.iterator](); }
  
  equals(other) {
    if (!(other instanceof ImmutableSet)) return false;
    if (this.size !== other.size) return false;
    for (const v of this._set) if (!other.has(v)) return false;
    return true;
  }

  static of(...items) { return new ImmutableSet(items); }
}

class ImmutableStack {
  constructor(items = []) {
    this._items = Object.freeze([...items]);
  }

  get size() { return this._items.length; }
  get isEmpty() { return this._items.length === 0; }
  
  push(value) { return new ImmutableStack([...this._items, value]); }
  pop() {
    if (this.isEmpty) throw new Error('Stack is empty');
    return [this._items[this._items.length - 1], new ImmutableStack(this._items.slice(0, -1))];
  }
  peek() { return this._items[this._items.length - 1]; }
  
  toArray() { return [...this._items]; }
  [Symbol.iterator]() { return this._items[Symbol.iterator](); }
}

module.exports = { ImmutableList, ImmutableMap, ImmutableSet, ImmutableStack };
