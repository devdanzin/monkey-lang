// Semaphore + Mutex — async concurrency primitives

export class Semaphore {
  constructor(permits = 1) {
    this._permits = permits;
    this._max = permits;
    this._queue = [];
  }

  async acquire() {
    if (this._permits > 0) { this._permits--; return; }
    return new Promise(resolve => this._queue.push(resolve));
  }

  release() {
    if (this._queue.length > 0) { const next = this._queue.shift(); next(); }
    else if (this._permits < this._max) this._permits++;
  }

  get available() { return this._permits; }
  get waiting() { return this._queue.length; }

  async use(fn) {
    await this.acquire();
    try { return await fn(); }
    finally { this.release(); }
  }
}

export class Mutex extends Semaphore {
  constructor() { super(1); }

  async lock() { return this.acquire(); }
  unlock() { this.release(); }

  async withLock(fn) { return this.use(fn); }
}

export class ReadWriteLock {
  constructor() { this._readers = 0; this._writer = false; this._readQueue = []; this._writeQueue = []; }

  async readLock() {
    if (!this._writer && this._writeQueue.length === 0) { this._readers++; return; }
    return new Promise(resolve => this._readQueue.push(resolve));
  }

  readUnlock() {
    this._readers--;
    if (this._readers === 0 && this._writeQueue.length > 0) {
      this._writer = true;
      this._writeQueue.shift()();
    }
  }

  async writeLock() {
    if (!this._writer && this._readers === 0) { this._writer = true; return; }
    return new Promise(resolve => this._writeQueue.push(resolve));
  }

  writeUnlock() {
    this._writer = false;
    // Prefer writers
    if (this._writeQueue.length > 0) { this._writer = true; this._writeQueue.shift()(); }
    else { while (this._readQueue.length > 0) { this._readers++; this._readQueue.shift()(); } }
  }
}

// Barrier — wait for N parties to arrive
export class Barrier {
  constructor(parties) {
    this._parties = parties;
    this._arrived = 0;
    this._waiters = [];
  }

  async arrive() {
    this._arrived++;
    if (this._arrived >= this._parties) {
      for (const w of this._waiters) w();
      this._waiters = [];
      this._arrived = 0;
      return;
    }
    return new Promise(resolve => this._waiters.push(resolve));
  }
}
