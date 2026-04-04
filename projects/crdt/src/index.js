// ===== CRDTs (Conflict-free Replicated Data Types) =====

// ===== G-Counter (Grow-only Counter) =====

export class GCounter {
  constructor(nodeId, state = {}) {
    this.nodeId = nodeId;
    this.state = { ...state };
    if (!(nodeId in this.state)) this.state[nodeId] = 0;
  }

  increment(amount = 1) {
    this.state[this.nodeId] = (this.state[this.nodeId] || 0) + amount;
  }

  get value() {
    return Object.values(this.state).reduce((sum, v) => sum + v, 0);
  }

  merge(other) {
    const merged = { ...this.state };
    for (const [node, count] of Object.entries(other.state)) {
      merged[node] = Math.max(merged[node] || 0, count);
    }
    return new GCounter(this.nodeId, merged);
  }

  toJSON() { return { ...this.state }; }
}

// ===== PN-Counter (Positive-Negative Counter) =====

export class PNCounter {
  constructor(nodeId, p = {}, n = {}) {
    this.nodeId = nodeId;
    this.p = new GCounter(nodeId, p);
    this.n = new GCounter(nodeId, n);
  }

  increment(amount = 1) { this.p.increment(amount); }
  decrement(amount = 1) { this.n.increment(amount); }
  get value() { return this.p.value - this.n.value; }

  merge(other) {
    const result = new PNCounter(this.nodeId);
    result.p = this.p.merge(other.p);
    result.n = this.n.merge(other.n);
    return result;
  }
}

// ===== G-Set (Grow-only Set) =====

export class GSet {
  constructor(elements = new Set()) {
    this.elements = new Set(elements);
  }

  add(element) { this.elements.add(element); }
  has(element) { return this.elements.has(element); }
  get size() { return this.elements.size; }
  values() { return [...this.elements]; }

  merge(other) {
    const merged = new GSet(this.elements);
    for (const e of other.elements) merged.add(e);
    return merged;
  }
}

// ===== OR-Set (Observed-Remove Set) =====

export class ORSet {
  constructor(nodeId) {
    this.nodeId = nodeId;
    this.elements = new Map(); // element → Set of unique tags
    this.tombstones = new Set(); // removed tags
    this._tagCounter = 0;
  }

  _newTag() { return `${this.nodeId}:${this._tagCounter++}`; }

  add(element) {
    const tag = this._newTag();
    if (!this.elements.has(element)) this.elements.set(element, new Set());
    this.elements.get(element).add(tag);
  }

  remove(element) {
    const tags = this.elements.get(element);
    if (tags) {
      for (const tag of tags) this.tombstones.add(tag);
      this.elements.delete(element);
    }
  }

  has(element) {
    const tags = this.elements.get(element);
    if (!tags) return false;
    for (const tag of tags) {
      if (!this.tombstones.has(tag)) return true;
    }
    return false;
  }

  values() {
    const result = [];
    for (const [element, tags] of this.elements) {
      for (const tag of tags) {
        if (!this.tombstones.has(tag)) { result.push(element); break; }
      }
    }
    return result;
  }

  get size() { return this.values().length; }

  merge(other) {
    const result = new ORSet(this.nodeId);
    result._tagCounter = Math.max(this._tagCounter, other._tagCounter);
    
    // Merge tombstones
    for (const t of this.tombstones) result.tombstones.add(t);
    for (const t of other.tombstones) result.tombstones.add(t);
    
    // Merge elements (union of tags)
    for (const [elem, tags] of this.elements) {
      if (!result.elements.has(elem)) result.elements.set(elem, new Set());
      for (const tag of tags) result.elements.get(elem).add(tag);
    }
    for (const [elem, tags] of other.elements) {
      if (!result.elements.has(elem)) result.elements.set(elem, new Set());
      for (const tag of tags) result.elements.get(elem).add(tag);
    }
    
    return result;
  }
}

// ===== LWW-Register (Last-Writer-Wins Register) =====

export class LWWRegister {
  constructor(nodeId, value = undefined, timestamp = 0) {
    this.nodeId = nodeId;
    this.value = value;
    this.timestamp = timestamp;
  }

  set(value, timestamp = Date.now()) {
    if (timestamp > this.timestamp) {
      this.value = value;
      this.timestamp = timestamp;
    }
  }

  get() { return this.value; }

  merge(other) {
    if (other.timestamp > this.timestamp) {
      return new LWWRegister(this.nodeId, other.value, other.timestamp);
    }
    if (other.timestamp === this.timestamp && other.nodeId > this.nodeId) {
      return new LWWRegister(this.nodeId, other.value, other.timestamp);
    }
    return new LWWRegister(this.nodeId, this.value, this.timestamp);
  }
}
