// Multi-Map — one key, multiple values
export class MultiMap {
  constructor() { this._map = new Map(); }
  set(key, value) { if (!this._map.has(key)) this._map.set(key, []); this._map.get(key).push(value); return this; }
  get(key) { return this._map.get(key) || []; }
  has(key) { return this._map.has(key) && this._map.get(key).length > 0; }
  delete(key, value) { if (value === undefined) { this._map.delete(key); return; } const arr = this._map.get(key); if (!arr) return; const i = arr.indexOf(value); if (i >= 0) arr.splice(i, 1); if (arr.length === 0) this._map.delete(key); }
  get size() { let n = 0; for (const v of this._map.values()) n += v.length; return n; }
  get keyCount() { return this._map.size; }
  keys() { return this._map.keys(); }
  values() { return (function*(map) { for (const arr of map.values()) yield* arr; })(this._map); }
  entries() { return (function*(map) { for (const [k, arr] of map) for (const v of arr) yield [k, v]; })(this._map); }
  clear() { this._map.clear(); }
  toObject() { const obj = {}; for (const [k, v] of this._map) obj[k] = [...v]; return obj; }
}
