// BiMap — two-way map (key→value and value→key)
export class BiMap {
  constructor() { this._fwd = new Map(); this._rev = new Map(); }
  set(key, value) { if (this._fwd.has(key)) this._rev.delete(this._fwd.get(key)); if (this._rev.has(value)) this._fwd.delete(this._rev.get(value)); this._fwd.set(key, value); this._rev.set(value, key); return this; }
  get(key) { return this._fwd.get(key); }
  getKey(value) { return this._rev.get(value); }
  has(key) { return this._fwd.has(key); }
  hasValue(value) { return this._rev.has(value); }
  delete(key) { if (!this._fwd.has(key)) return false; this._rev.delete(this._fwd.get(key)); this._fwd.delete(key); return true; }
  deleteValue(value) { if (!this._rev.has(value)) return false; this._fwd.delete(this._rev.get(value)); this._rev.delete(value); return true; }
  get size() { return this._fwd.size; }
  keys() { return this._fwd.keys(); }
  values() { return this._fwd.values(); }
  entries() { return this._fwd.entries(); }
  *[Symbol.iterator]() { yield* this._fwd; }
  inverse() { const b = new BiMap(); for (const [k, v] of this._fwd) b.set(v, k); return b; }
  clear() { this._fwd.clear(); this._rev.clear(); }
}
