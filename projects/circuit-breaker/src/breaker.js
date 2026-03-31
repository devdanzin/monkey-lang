// Circuit Breaker — resilience pattern (closed → open → half-open)
const CLOSED = 'closed', OPEN = 'open', HALF_OPEN = 'half-open';

export class CircuitBreaker {
  constructor({ threshold = 5, timeout = 30000, resetTimeout = 60000, onStateChange } = {}) {
    this.threshold = threshold;
    this.timeout = timeout;
    this.resetTimeout = resetTimeout;
    this.onStateChange = onStateChange || (() => {});
    this._state = CLOSED;
    this._failures = 0;
    this._successes = 0;
    this._lastFailure = 0;
    this._halfOpenAllowed = 1;
  }

  get state() { return this._state; }
  get failures() { return this._failures; }

  async execute(fn) {
    if (this._state === OPEN) {
      if (Date.now() - this._lastFailure >= this.resetTimeout) {
        this._transition(HALF_OPEN);
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = this.timeout > 0
        ? await Promise.race([fn(), new Promise((_, r) => setTimeout(() => r(new Error('Timeout')), this.timeout))])
        : await fn();
      this._onSuccess();
      return result;
    } catch (err) {
      this._onFailure();
      throw err;
    }
  }

  _onSuccess() {
    this._failures = 0;
    if (this._state === HALF_OPEN) this._transition(CLOSED);
  }

  _onFailure() {
    this._failures++;
    this._lastFailure = Date.now();
    if (this._state === HALF_OPEN || this._failures >= this.threshold) {
      this._transition(OPEN);
    }
  }

  _transition(newState) {
    const old = this._state;
    this._state = newState;
    if (old !== newState) this.onStateChange(newState, old);
  }

  reset() { this._state = CLOSED; this._failures = 0; }
}
