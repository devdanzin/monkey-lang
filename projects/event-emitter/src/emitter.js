// Event Emitter from scratch — Node.js EventEmitter-compatible API

export class EventEmitter {
  constructor() {
    this._listeners = new Map();
    this._maxListeners = 10;
  }

  // Add listener
  on(event, fn) {
    if (!this._listeners.has(event)) this._listeners.set(event, []);
    this._listeners.get(event).push({ fn, once: false });
    return this;
  }

  // Add one-time listener
  once(event, fn) {
    if (!this._listeners.has(event)) this._listeners.set(event, []);
    this._listeners.get(event).push({ fn, once: true });
    return this;
  }

  // Remove listener
  off(event, fn) {
    const list = this._listeners.get(event);
    if (!list) return this;
    this._listeners.set(event, list.filter(l => l.fn !== fn));
    if (this._listeners.get(event).length === 0) this._listeners.delete(event);
    return this;
  }

  // Remove all listeners (optionally for specific event)
  removeAllListeners(event) {
    if (event) this._listeners.delete(event);
    else this._listeners.clear();
    return this;
  }

  // Emit event
  emit(event, ...args) {
    const list = this._listeners.get(event);
    if (!list || list.length === 0) return false;

    // Copy list to avoid mutation during iteration
    const listeners = [...list];
    const toRemove = [];

    for (const entry of listeners) {
      entry.fn(...args);
      if (entry.once) toRemove.push(entry);
    }

    // Remove once listeners
    if (toRemove.length) {
      this._listeners.set(event, list.filter(l => !toRemove.includes(l)));
    }

    return true;
  }

  // Get listener count
  listenerCount(event) {
    const list = this._listeners.get(event);
    return list ? list.length : 0;
  }

  // Get all event names
  eventNames() {
    return [...this._listeners.keys()];
  }

  // Get listeners for an event
  listeners(event) {
    const list = this._listeners.get(event);
    return list ? list.map(l => l.fn) : [];
  }

  // Prepend listener (add to front)
  prependListener(event, fn) {
    if (!this._listeners.has(event)) this._listeners.set(event, []);
    this._listeners.get(event).unshift({ fn, once: false });
    return this;
  }

  // Set max listeners
  setMaxListeners(n) {
    this._maxListeners = n;
    return this;
  }

  getMaxListeners() {
    return this._maxListeners;
  }

  // Wait for event (returns promise)
  waitFor(event, timeout) {
    return new Promise((resolve, reject) => {
      let timer;
      const handler = (...args) => {
        if (timer) clearTimeout(timer);
        resolve(args.length === 1 ? args[0] : args);
      };
      this.once(event, handler);
      if (timeout) {
        timer = setTimeout(() => {
          this.off(event, handler);
          reject(new Error(`Timeout waiting for event '${event}'`));
        }, timeout);
      }
    });
  }

  // Pipe all events to another emitter
  pipe(target) {
    const origEmit = this.emit.bind(this);
    this.emit = (event, ...args) => {
      origEmit(event, ...args);
      target.emit(event, ...args);
      return true;
    };
    return target;
  }
}

// Mixin - add emitter methods to any object
export function mixin(target) {
  const emitter = new EventEmitter();
  for (const method of ['on', 'once', 'off', 'emit', 'removeAllListeners', 'listenerCount', 'eventNames', 'listeners']) {
    target[method] = emitter[method].bind(emitter);
  }
  return target;
}
