// ===== Key-Value Store =====
import { writeFileSync, readFileSync, existsSync, unlinkSync } from 'node:fs';

export class KVStore {
  constructor(options = {}) {
    this._data = new Map();
    this._expiry = new Map();
    this._file = options.file || null;
    if (this._file && existsSync(this._file)) this._load();
  }

  get(key) {
    if (this._expiry.has(key) && Date.now() > this._expiry.get(key)) { this.delete(key); return undefined; }
    return this._data.get(key);
  }

  set(key, value, ttl) {
    this._data.set(key, value);
    if (ttl) this._expiry.set(key, Date.now() + ttl);
    else this._expiry.delete(key);
    this._save();
    return this;
  }

  has(key) { return this.get(key) !== undefined; }
  
  delete(key) {
    const had = this._data.delete(key);
    this._expiry.delete(key);
    if (had) this._save();
    return had;
  }

  clear() { this._data.clear(); this._expiry.clear(); this._save(); }
  get size() { return this._data.size; }
  keys() { return [...this._data.keys()]; }
  values() { return [...this._data.values()]; }
  entries() { return [...this._data.entries()]; }

  // Batch operations
  mset(entries) { for (const [k, v] of entries) this.set(k, v); }
  mget(keys) { return keys.map(k => this.get(k)); }

  // Atomic increment
  incr(key, amount = 1) {
    const current = this.get(key) ?? 0;
    if (typeof current !== 'number') throw new Error('Value is not a number');
    this.set(key, current + amount);
    return current + amount;
  }

  // Persistence
  _save() {
    if (!this._file) return;
    const data = Object.fromEntries(this._data);
    writeFileSync(this._file, JSON.stringify(data, null, 2));
  }

  _load() {
    try {
      const raw = readFileSync(this._file, 'utf8');
      const data = JSON.parse(raw);
      for (const [k, v] of Object.entries(data)) this._data.set(k, v);
    } catch {}
  }

  destroy() { if (this._file && existsSync(this._file)) unlinkSync(this._file); }

  [Symbol.iterator]() { return this._data[Symbol.iterator](); }
}
