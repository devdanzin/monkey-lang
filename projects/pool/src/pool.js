// Object Pool — acquire/release with max size, queue, idle timeout

export class Pool {
  constructor(factory, { max = 10, min = 0, idleTimeout = 30000, acquireTimeout = 5000, validate } = {}) {
    this.factory = factory;
    this.max = max;
    this.min = min;
    this.idleTimeout = idleTimeout;
    this.acquireTimeout = acquireTimeout;
    this.validate = validate || (() => true);
    this._available = [];
    this._inUse = new Set();
    this._waiting = [];
    this._created = 0;
  }

  async acquire() {
    // Try available pool
    while (this._available.length > 0) {
      const item = this._available.pop();
      if (this.validate(item)) { this._inUse.add(item); return item; }
      this._created--;
    }

    // Create new if under limit
    if (this._created < this.max) {
      this._created++;
      const item = await this.factory();
      this._inUse.add(item);
      return item;
    }

    // Wait for release
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this._waiting.indexOf(entry);
        if (idx >= 0) this._waiting.splice(idx, 1);
        reject(new Error('Acquire timeout'));
      }, this.acquireTimeout);

      const entry = { resolve: (item) => { clearTimeout(timer); this._inUse.add(item); resolve(item); }, reject };
      this._waiting.push(entry);
    });
  }

  release(item) {
    this._inUse.delete(item);

    // Give to waiting acquirer
    if (this._waiting.length > 0) {
      const waiter = this._waiting.shift();
      waiter.resolve(item);
      return;
    }

    // Return to pool
    this._available.push(item);
  }

  async destroy(item) {
    this._inUse.delete(item);
    const idx = this._available.indexOf(item);
    if (idx >= 0) this._available.splice(idx, 1);
    this._created--;
    if (item.destroy) await item.destroy();
  }

  get size() { return this._created; }
  get available() { return this._available.length; }
  get inUse() { return this._inUse.size; }
  get waiting() { return this._waiting.length; }

  async drain() {
    for (const item of this._available) { if (item.destroy) await item.destroy(); }
    this._available = [];
    // Note: in-use items should be released first
    this._created = this._inUse.size;
  }

  stats() { return { size: this.size, available: this.available, inUse: this.inUse, waiting: this.waiting }; }
}
