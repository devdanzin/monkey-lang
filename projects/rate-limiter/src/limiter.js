// Rate Limiter — Token Bucket + Sliding Window + Fixed Window

export class TokenBucket {
  constructor({ capacity, refillRate, refillInterval = 1000 }) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.refillRate = refillRate;
    this.refillInterval = refillInterval;
    this.lastRefill = Date.now();
  }

  _refill() {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = Math.floor(elapsed / this.refillInterval) * this.refillRate;
    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }

  tryConsume(count = 1) {
    this._refill();
    if (this.tokens >= count) { this.tokens -= count; return true; }
    return false;
  }

  get available() { this._refill(); return this.tokens; }
  get waitTime() { this._refill(); if (this.tokens >= 1) return 0; return Math.ceil((1 - this.tokens) / this.refillRate * this.refillInterval); }
}

export class SlidingWindow {
  constructor({ windowMs, maxRequests }) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.timestamps = [];
  }

  tryConsume() {
    const now = Date.now();
    this._cleanup(now);
    if (this.timestamps.length < this.maxRequests) { this.timestamps.push(now); return true; }
    return false;
  }

  get available() { this._cleanup(Date.now()); return this.maxRequests - this.timestamps.length; }
  get waitTime() { this._cleanup(Date.now()); if (this.timestamps.length < this.maxRequests) return 0; return this.timestamps[0] + this.windowMs - Date.now(); }

  _cleanup(now) {
    const cutoff = now - this.windowMs;
    while (this.timestamps.length && this.timestamps[0] <= cutoff) this.timestamps.shift();
  }
}

export class FixedWindow {
  constructor({ windowMs, maxRequests }) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.count = 0;
    this.windowStart = Date.now();
  }

  tryConsume() {
    this._checkWindow();
    if (this.count < this.maxRequests) { this.count++; return true; }
    return false;
  }

  get available() { this._checkWindow(); return this.maxRequests - this.count; }
  get waitTime() { this._checkWindow(); if (this.count < this.maxRequests) return 0; return this.windowStart + this.windowMs - Date.now(); }

  _checkWindow() {
    const now = Date.now();
    if (now - this.windowStart >= this.windowMs) { this.count = 0; this.windowStart = now; }
  }
}

// Per-key rate limiter (e.g., per IP)
export class KeyedRateLimiter {
  constructor(factory) {
    this.limiters = new Map();
    this.factory = factory;
  }

  tryConsume(key, count = 1) {
    if (!this.limiters.has(key)) this.limiters.set(key, this.factory());
    return this.limiters.get(key).tryConsume(count);
  }

  available(key) {
    if (!this.limiters.has(key)) return this.factory().available;
    return this.limiters.get(key).available;
  }

  reset(key) { this.limiters.delete(key); }
  resetAll() { this.limiters.clear(); }
}
