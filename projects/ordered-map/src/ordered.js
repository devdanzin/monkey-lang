// Ordered Map — insertion order maintained with sorted iteration option
export class OrderedMap {
  constructor() { this._keys = []; this._map = new Map(); }
  set(key, value) { if (!this._map.has(key)) this._keys.push(key); this._map.set(key, value); return this; }
  get(key) { return this._map.get(key); }
  has(key) { return this._map.has(key); }
  delete(key) { if (!this._map.has(key)) return false; this._map.delete(key); this._keys.splice(this._keys.indexOf(key), 1); return true; }
  get size() { return this._map.size; }
  first() { return this._keys.length ? [this._keys[0], this._map.get(this._keys[0])] : undefined; }
  last() { const k = this._keys[this._keys.length - 1]; return k !== undefined ? [k, this._map.get(k)] : undefined; }
  at(index) { const k = this._keys[index]; return k !== undefined ? [k, this._map.get(k)] : undefined; }
  keys() { return this._keys[Symbol.iterator](); }
  values() { return this._keys.map(k => this._map.get(k))[Symbol.iterator](); }
  entries() { return this._keys.map(k => [k, this._map.get(k)])[Symbol.iterator](); }
  *[Symbol.iterator]() { for (const k of this._keys) yield [k, this._map.get(k)]; }
  toObject() { const o = {}; for (const k of this._keys) o[k] = this._map.get(k); return o; }
  clear() { this._keys = []; this._map.clear(); }
}
