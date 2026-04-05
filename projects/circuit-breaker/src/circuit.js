// circuit.js — Circuit Breaker

export const State = { CLOSED: 'closed', OPEN: 'open', HALF_OPEN: 'half-open' };

export class CircuitBreaker {
  constructor(fn, options = {}) {
    this.fn = fn;
    this.state = State.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.failureThreshold = options.failureThreshold || 5;
    this.successThreshold = options.successThreshold || 2;
    this.timeout = options.timeout || 30000;
    this.lastFailure = null;
    this.listeners = { stateChange: [], success: [], failure: [], rejected: [] };
  }

  async execute(...args) {
    if (this.state === State.OPEN) {
      if (Date.now() - this.lastFailure >= this.timeout) {
        this._setState(State.HALF_OPEN);
      } else {
        this._emit('rejected');
        throw new CircuitBreakerError('Circuit is OPEN');
      }
    }

    try {
      const result = await this.fn(...args);
      this._onSuccess();
      return result;
    } catch (err) {
      this._onFailure();
      throw err;
    }
  }

  _onSuccess() {
    this.failureCount = 0;
    this._emit('success');
    if (this.state === State.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this._setState(State.CLOSED);
        this.successCount = 0;
      }
    }
  }

  _onFailure() {
    this.failureCount++;
    this.lastFailure = Date.now();
    this._emit('failure');
    if (this.state === State.HALF_OPEN) {
      this._setState(State.OPEN);
      this.successCount = 0;
    } else if (this.failureCount >= this.failureThreshold) {
      this._setState(State.OPEN);
    }
  }

  _setState(newState) {
    const prev = this.state;
    this.state = newState;
    this._emit('stateChange', { from: prev, to: newState });
  }

  reset() { this.state = State.CLOSED; this.failureCount = 0; this.successCount = 0; }
  open() { this._setState(State.OPEN); this.lastFailure = Date.now(); }

  on(event, handler) { this.listeners[event]?.push(handler); return this; }
  _emit(event, data) { for (const h of this.listeners[event] || []) h(data); }

  get stats() { return { state: this.state, failures: this.failureCount, successes: this.successCount }; }
}

export class CircuitBreakerError extends Error {
  constructor(message) { super(message); this.name = 'CircuitBreakerError'; }
}

// ===== Bulkhead =====
export class Bulkhead {
  constructor(maxConcurrent) {
    this.maxConcurrent = maxConcurrent;
    this.running = 0;
    this.queue = [];
  }

  async execute(fn) {
    if (this.running >= this.maxConcurrent) {
      return new Promise((resolve, reject) => {
        this.queue.push({ fn, resolve, reject });
      });
    }
    return this._run(fn);
  }

  async _run(fn) {
    this.running++;
    try { return await fn(); }
    finally {
      this.running--;
      if (this.queue.length > 0) {
        const { fn: nextFn, resolve, reject } = this.queue.shift();
        this._run(nextFn).then(resolve).catch(reject);
      }
    }
  }

  get pendingCount() { return this.queue.length; }
  get activeCount() { return this.running; }
}
