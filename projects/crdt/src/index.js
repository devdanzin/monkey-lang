/**
 * Tiny CRDT — Conflict-Free Replicated Data Types
 * 
 * Distributed data structures that converge:
 * - G-Counter: grow-only counter
 * - PN-Counter: positive-negative counter
 * - G-Set: grow-only set
 * - OR-Set: observed-remove set (add-wins)
 * - LWW-Register: last-writer-wins register
 * - LWW-Map: last-writer-wins map
 */

class GCounter {
  constructor(nodeId, counts = {}) {
    this.nodeId = nodeId;
    this.counts = { ...counts };
  }

  increment(n = 1) {
    this.counts[this.nodeId] = (this.counts[this.nodeId] || 0) + n;
    return this;
  }

  value() {
    return Object.values(this.counts).reduce((a, b) => a + b, 0);
  }

  merge(other) {
    const merged = { ...this.counts };
    for (const [node, count] of Object.entries(other.counts)) {
      merged[node] = Math.max(merged[node] || 0, count);
    }
    return new GCounter(this.nodeId, merged);
  }

  toJSON() { return { nodeId: this.nodeId, counts: this.counts }; }
}

class PNCounter {
  constructor(nodeId) {
    this.p = new GCounter(nodeId);
    this.n = new GCounter(nodeId);
  }

  increment(n = 1) { this.p.increment(n); return this; }
  decrement(n = 1) { this.n.increment(n); return this; }
  value() { return this.p.value() - this.n.value(); }

  merge(other) {
    const result = new PNCounter(this.p.nodeId);
    result.p = this.p.merge(other.p);
    result.n = this.n.merge(other.n);
    return result;
  }
}

class GSet {
  constructor(items = new Set()) {
    this.items = new Set(items);
  }

  add(item) { this.items.add(item); return this; }
  has(item) { return this.items.has(item); }
  value() { return new Set(this.items); }

  merge(other) {
    return new GSet(new Set([...this.items, ...other.items]));
  }
}

class ORSet {
  constructor(nodeId) {
    this.nodeId = nodeId;
    this.elements = new Map(); // value -> Set of {node, counter}
    this.counter = 0;
  }

  _tag() { return `${this.nodeId}:${++this.counter}`; }

  add(value) {
    if (!this.elements.has(value)) this.elements.set(value, new Set());
    this.elements.get(value).add(this._tag());
    return this;
  }

  remove(value) {
    this.elements.delete(value);
    return this;
  }

  has(value) { return this.elements.has(value) && this.elements.get(value).size > 0; }

  value() {
    const result = new Set();
    for (const [val, tags] of this.elements) {
      if (tags.size > 0) result.add(val);
    }
    return result;
  }

  merge(other) {
    const result = new ORSet(this.nodeId);
    result.counter = Math.max(this.counter, other.counter);
    
    // Union of all elements with their tags
    for (const [val, tags] of this.elements) {
      if (!result.elements.has(val)) result.elements.set(val, new Set());
      for (const tag of tags) result.elements.get(val).add(tag);
    }
    for (const [val, tags] of other.elements) {
      if (!result.elements.has(val)) result.elements.set(val, new Set());
      for (const tag of tags) result.elements.get(val).add(tag);
    }
    return result;
  }
}

class LWWRegister {
  constructor(value = null, timestamp = 0) {
    this._value = value;
    this.timestamp = timestamp;
  }

  set(value, timestamp = Date.now()) {
    if (timestamp >= this.timestamp) {
      this._value = value;
      this.timestamp = timestamp;
    }
    return this;
  }

  value() { return this._value; }

  merge(other) {
    return other.timestamp > this.timestamp ? other : this;
  }
}

class LWWMap {
  constructor() {
    this.registers = new Map();
    this.tombstones = new Map(); // key -> timestamp of removal
  }

  set(key, value, timestamp = Date.now()) {
    if (!this.registers.has(key)) {
      this.registers.set(key, new LWWRegister());
    }
    this.registers.get(key).set(value, timestamp);
    return this;
  }

  get(key) {
    const reg = this.registers.get(key);
    if (!reg) return undefined;
    const tomb = this.tombstones.get(key) || 0;
    return reg.timestamp > tomb ? reg.value() : undefined;
  }

  delete(key, timestamp = Date.now()) {
    this.tombstones.set(key, Math.max(this.tombstones.get(key) || 0, timestamp));
    return this;
  }

  has(key) { return this.get(key) !== undefined; }

  entries() {
    const result = {};
    for (const [key] of this.registers) {
      const val = this.get(key);
      if (val !== undefined) result[key] = val;
    }
    return result;
  }

  merge(other) {
    const result = new LWWMap();
    for (const [key, reg] of this.registers) {
      result.registers.set(key, reg);
    }
    for (const [key, reg] of other.registers) {
      if (result.registers.has(key)) {
        result.registers.set(key, result.registers.get(key).merge(reg));
      } else {
        result.registers.set(key, reg);
      }
    }
    for (const [key, ts] of this.tombstones) {
      result.tombstones.set(key, Math.max(result.tombstones.get(key) || 0, ts));
    }
    for (const [key, ts] of other.tombstones) {
      result.tombstones.set(key, Math.max(result.tombstones.get(key) || 0, ts));
    }
    return result;
  }
}

module.exports = { GCounter, PNCounter, GSet, ORSet, LWWRegister, LWWMap };
