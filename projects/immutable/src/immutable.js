// immutable.js — Immutable data structures

// ===== Persistent List =====
const EMPTY_LIST = Object.freeze({ type: 'empty', get size() { return 0; }, [Symbol.iterator]() { return { next: () => ({ done: true }) }; } });

export function cons(head, tail = EMPTY_LIST) {
  return Object.freeze({
    type: 'cons',
    head,
    tail,
    get size() { return 1 + tail.size; },
    [Symbol.iterator]() {
      let current = this;
      return { next() { if (current.type === 'empty') return { done: true }; const val = current.head; current = current.tail; return { value: val, done: false }; } };
    }
  });
}

export function list(...items) {
  let result = EMPTY_LIST;
  for (let i = items.length - 1; i >= 0; i--) result = cons(items[i], result);
  return result;
}

export function head(lst) { return lst.type === 'empty' ? undefined : lst.head; }
export function tail(lst) { return lst.type === 'empty' ? EMPTY_LIST : lst.tail; }
export function isEmpty(lst) { return lst.type === 'empty'; }

export function listMap(lst, fn) {
  if (isEmpty(lst)) return EMPTY_LIST;
  return cons(fn(head(lst)), listMap(tail(lst), fn));
}

export function listFilter(lst, fn) {
  if (isEmpty(lst)) return EMPTY_LIST;
  const h = head(lst);
  const rest = listFilter(tail(lst), fn);
  return fn(h) ? cons(h, rest) : rest;
}

export function listReduce(lst, fn, init) {
  let acc = init;
  let current = lst;
  while (!isEmpty(current)) { acc = fn(acc, head(current)); current = tail(current); }
  return acc;
}

export function listToArray(lst) { return [...lst]; }
export function listFromArray(arr) { return list(...arr); }
export function listReverse(lst) { return listReduce(lst, (acc, v) => cons(v, acc), EMPTY_LIST); }

export { EMPTY_LIST };

// ===== Persistent Map (HAMT-like, simplified) =====
export class PMap {
  constructor(entries = []) {
    this._data = new Map(entries);
    Object.freeze(this);
  }

  get(key, defaultVal) { return this._data.has(key) ? this._data.get(key) : defaultVal; }
  has(key) { return this._data.has(key); }
  
  assoc(key, value) {
    const newEntries = [...this._data.entries()];
    const idx = newEntries.findIndex(([k]) => k === key);
    if (idx >= 0) newEntries[idx] = [key, value];
    else newEntries.push([key, value]);
    return new PMap(newEntries);
  }

  dissoc(key) {
    return new PMap([...this._data.entries()].filter(([k]) => k !== key));
  }

  update(key, fn, defaultVal) {
    const current = this.get(key, defaultVal);
    return this.assoc(key, fn(current));
  }

  merge(other) {
    const entries = [...this._data.entries()];
    for (const [k, v] of other._data) {
      const idx = entries.findIndex(([ek]) => ek === k);
      if (idx >= 0) entries[idx] = [k, v];
      else entries.push([k, v]);
    }
    return new PMap(entries);
  }

  get size() { return this._data.size; }
  keys() { return [...this._data.keys()]; }
  values() { return [...this._data.values()]; }
  entries() { return [...this._data.entries()]; }
  
  map(fn) { return new PMap(this.entries().map(([k, v]) => [k, fn(v, k)])); }
  filter(fn) { return new PMap(this.entries().filter(([k, v]) => fn(v, k))); }

  toObject() { return Object.fromEntries(this._data); }
  static fromObject(obj) { return new PMap(Object.entries(obj)); }

  equals(other) {
    if (this.size !== other.size) return false;
    for (const [k, v] of this._data) if (!other.has(k) || other.get(k) !== v) return false;
    return true;
  }
}
