// LRU cache with TTL support
export class LRUTTLCache {
  constructor({ max = 100, ttl = 0 } = {}) {
    this._max = max; this._ttl = ttl; this._map = new Map(); this._timers = new Map();
  }
  get(key) {
    if (!this._map.has(key)) return undefined;
    const entry = this._map.get(key);
    if (entry.expires && Date.now() > entry.expires) { this.delete(key); return undefined; }
    // Move to end (most recent)
    this._map.delete(key); this._map.set(key, entry);
    return entry.value;
  }
  set(key, value, ttl) {
    this.delete(key);
    const expires = (ttl || this._ttl) ? Date.now() + (ttl || this._ttl) : 0;
    this._map.set(key, { value, expires });
    if (this._map.size > this._max) { const oldest = this._map.keys().next().value; this.delete(oldest); }
    return this;
  }
  has(key) { return this.get(key) !== undefined; }
  delete(key) { this._map.delete(key); return this; }
  clear() { this._map.clear(); }
  get size() { return this._map.size; }
  keys() { return [...this._map.keys()]; }
  values() { return [...this._map.values()].map(e => e.value); }
  entries() { return [...this._map.entries()].map(([k, e]) => [k, e.value]); }
}
