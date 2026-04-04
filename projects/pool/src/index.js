// ===== Object Pool =====

export class Pool {
  constructor(factory, { max = 10, min = 0 } = {}) {
    this._factory = factory;
    this._max = max;
    this._min = min;
    this._available = [];
    this._inUse = new Set();
    this._waiting = [];
    
    // Pre-create min objects
    for (let i = 0; i < min; i++) this._available.push(factory());
  }

  async acquire() {
    if (this._available.length > 0) {
      const obj = this._available.pop();
      this._inUse.add(obj);
      return obj;
    }
    if (this._inUse.size < this._max) {
      const obj = await Promise.resolve(this._factory());
      this._inUse.add(obj);
      return obj;
    }
    // Wait for release
    return new Promise(resolve => this._waiting.push(resolve));
  }

  release(obj) {
    this._inUse.delete(obj);
    if (this._waiting.length > 0) {
      const resolve = this._waiting.shift();
      this._inUse.add(obj);
      resolve(obj);
    } else {
      this._available.push(obj);
    }
  }

  get size() { return this._available.length + this._inUse.size; }
  get available() { return this._available.length; }
  get inUse() { return this._inUse.size; }
  get waiting() { return this._waiting.length; }

  drain() { this._available = []; this._inUse.clear(); }
}
