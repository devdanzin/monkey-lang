// ===== Circuit Breaker Pattern =====
// Prevents cascading failures in distributed systems

const State = { CLOSED: 'closed', OPEN: 'open', HALF_OPEN: 'half-open' };

export class CircuitBreaker {
  constructor(fn, options = {}) {
    this.fn = fn;
    this.state = State.CLOSED;
    this.failureThreshold = options.failureThreshold ?? 5;
    this.successThreshold = options.successThreshold ?? 2;
    this.timeout = options.timeout ?? 30000; // ms before trying again
    this.resetTimeout = options.resetTimeout ?? this.timeout;
    
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = null;
    this.totalCalls = 0;
    this.totalFailures = 0;
    this.totalSuccesses = 0;
    this._listeners = [];
  }

  async call(...args) {
    this.totalCalls++;
    
    if (this.state === State.OPEN) {
      if (Date.now() - this.lastFailureTime >= this.resetTimeout) {
        this._transition(State.HALF_OPEN);
      } else {
        throw new CircuitBreakerError('Circuit breaker is OPEN');
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
    this.totalSuccesses++;
    
    if (this.state === State.HALF_OPEN) {
      this.successes++;
      if (this.successes >= this.successThreshold) {
        this._transition(State.CLOSED);
      }
    }
    
    if (this.state === State.CLOSED) {
      this.failures = 0;
    }
  }

  _onFailure() {
    this.totalFailures++;
    this.lastFailureTime = Date.now();
    
    if (this.state === State.HALF_OPEN) {
      this._transition(State.OPEN);
      return;
    }
    
    if (this.state === State.CLOSED) {
      this.failures++;
      if (this.failures >= this.failureThreshold) {
        this._transition(State.OPEN);
      }
    }
  }

  _transition(newState) {
    const oldState = this.state;
    this.state = newState;
    this.failures = 0;
    this.successes = 0;
    
    for (const listener of this._listeners) {
      listener({ from: oldState, to: newState });
    }
  }

  reset() {
    this._transition(State.CLOSED);
  }

  get isOpen() { return this.state === State.OPEN; }
  get isClosed() { return this.state === State.CLOSED; }
  get isHalfOpen() { return this.state === State.HALF_OPEN; }

  get stats() {
    return {
      state: this.state,
      totalCalls: this.totalCalls,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
      failureRate: this.totalCalls > 0 ? this.totalFailures / this.totalCalls : 0,
    };
  }

  onStateChange(listener) {
    this._listeners.push(listener);
    return () => { this._listeners = this._listeners.filter(l => l !== listener); };
  }
}

export class CircuitBreakerError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

export { State };
