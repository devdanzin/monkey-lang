// ===== Skip List =====
// Probabilistic sorted data structure with O(log n) average operations
// Used in Redis sorted sets, LevelDB, etc.

class SkipNode {
  constructor(key, value, level) {
    this.key = key;
    this.value = value;
    this.forward = new Array(level + 1).fill(null);
  }
}

export class SkipList {
  constructor(maxLevel = 16, p = 0.5, comparator = (a, b) => a < b ? -1 : a > b ? 1 : 0) {
    this.maxLevel = maxLevel;
    this.p = p;
    this.compare = comparator;
    this.level = 0;
    this.header = new SkipNode(null, null, maxLevel);
    this._size = 0;
  }

  get size() { return this._size; }

  _randomLevel() {
    let lvl = 0;
    while (Math.random() < this.p && lvl < this.maxLevel) lvl++;
    return lvl;
  }

  insert(key, value = key) {
    const update = new Array(this.maxLevel + 1).fill(null);
    let current = this.header;

    // Find position at each level
    for (let i = this.level; i >= 0; i--) {
      while (current.forward[i] !== null && this.compare(current.forward[i].key, key) < 0) {
        current = current.forward[i];
      }
      update[i] = current;
    }

    const next = current.forward[0];

    // Update existing key
    if (next !== null && this.compare(next.key, key) === 0) {
      next.value = value;
      return;
    }

    // Insert new node
    const newLevel = this._randomLevel();
    if (newLevel > this.level) {
      for (let i = this.level + 1; i <= newLevel; i++) {
        update[i] = this.header;
      }
      this.level = newLevel;
    }

    const newNode = new SkipNode(key, value, newLevel);
    for (let i = 0; i <= newLevel; i++) {
      newNode.forward[i] = update[i].forward[i];
      update[i].forward[i] = newNode;
    }

    this._size++;
  }

  search(key) {
    let current = this.header;
    for (let i = this.level; i >= 0; i--) {
      while (current.forward[i] !== null && this.compare(current.forward[i].key, key) < 0) {
        current = current.forward[i];
      }
    }
    const next = current.forward[0];
    if (next !== null && this.compare(next.key, key) === 0) {
      return next.value;
    }
    return undefined;
  }

  has(key) { return this.search(key) !== undefined; }

  delete(key) {
    const update = new Array(this.maxLevel + 1).fill(null);
    let current = this.header;

    for (let i = this.level; i >= 0; i--) {
      while (current.forward[i] !== null && this.compare(current.forward[i].key, key) < 0) {
        current = current.forward[i];
      }
      update[i] = current;
    }

    const target = current.forward[0];
    if (target === null || this.compare(target.key, key) !== 0) return false;

    for (let i = 0; i <= this.level; i++) {
      if (update[i].forward[i] !== target) break;
      update[i].forward[i] = target.forward[i];
    }

    // Reduce level if needed
    while (this.level > 0 && this.header.forward[this.level] === null) {
      this.level--;
    }

    this._size--;
    return true;
  }

  // Min/Max
  min() {
    const first = this.header.forward[0];
    return first ? first.key : undefined;
  }

  max() {
    let current = this.header;
    for (let i = this.level; i >= 0; i--) {
      while (current.forward[i] !== null) current = current.forward[i];
    }
    return current === this.header ? undefined : current.key;
  }

  // Range query: all keys in [low, high]
  range(low, high) {
    const result = [];
    let current = this.header;
    
    // Find starting position
    for (let i = this.level; i >= 0; i--) {
      while (current.forward[i] !== null && this.compare(current.forward[i].key, low) < 0) {
        current = current.forward[i];
      }
    }
    
    current = current.forward[0];
    while (current !== null && this.compare(current.key, high) <= 0) {
      result.push(current.key);
      current = current.forward[0];
    }
    
    return result;
  }

  // In-order traversal
  toArray() {
    const result = [];
    let current = this.header.forward[0];
    while (current !== null) {
      result.push(current.key);
      current = current.forward[0];
    }
    return result;
  }

  entries() {
    const result = [];
    let current = this.header.forward[0];
    while (current !== null) {
      result.push([current.key, current.value]);
      current = current.forward[0];
    }
    return result;
  }

  [Symbol.iterator]() {
    let current = this.header.forward[0];
    return {
      next() {
        if (current === null) return { done: true };
        const result = { value: [current.key, current.value], done: false };
        current = current.forward[0];
        return result;
      }
    };
  }
}
