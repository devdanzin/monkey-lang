// Skip List — probabilistic sorted data structure

class Node {
  constructor(key, value, level) {
    this.key = key;
    this.value = value;
    this.next = new Array(level + 1).fill(null);
  }
}

export class SkipList {
  constructor({ maxLevel = 16, p = 0.5 } = {}) {
    this._maxLevel = maxLevel;
    this._p = p;
    this._level = 0;
    this._head = new Node(-Infinity, null, maxLevel);
    this._size = 0;
  }

  _randomLevel() {
    let level = 0;
    while (Math.random() < this._p && level < this._maxLevel) level++;
    return level;
  }

  insert(key, value) {
    const update = new Array(this._maxLevel + 1).fill(null);
    let current = this._head;

    for (let i = this._level; i >= 0; i--) {
      while (current.next[i] && current.next[i].key < key) current = current.next[i];
      update[i] = current;
    }

    const next = current.next[0];
    if (next && next.key === key) { next.value = value; return; } // Update existing

    const newLevel = this._randomLevel();
    if (newLevel > this._level) {
      for (let i = this._level + 1; i <= newLevel; i++) update[i] = this._head;
      this._level = newLevel;
    }

    const newNode = new Node(key, value, newLevel);
    for (let i = 0; i <= newLevel; i++) {
      newNode.next[i] = update[i].next[i];
      update[i].next[i] = newNode;
    }
    this._size++;
  }

  get(key) {
    let current = this._head;
    for (let i = this._level; i >= 0; i--) {
      while (current.next[i] && current.next[i].key < key) current = current.next[i];
    }
    const node = current.next[0];
    return node && node.key === key ? node.value : undefined;
  }

  has(key) { return this.get(key) !== undefined; }

  delete(key) {
    const update = new Array(this._maxLevel + 1).fill(null);
    let current = this._head;

    for (let i = this._level; i >= 0; i--) {
      while (current.next[i] && current.next[i].key < key) current = current.next[i];
      update[i] = current;
    }

    const target = current.next[0];
    if (!target || target.key !== key) return false;

    for (let i = 0; i <= this._level; i++) {
      if (update[i].next[i] !== target) break;
      update[i].next[i] = target.next[i];
    }
    while (this._level > 0 && !this._head.next[this._level]) this._level--;
    this._size--;
    return true;
  }

  get size() { return this._size; }

  range(lo, hi) {
    const result = [];
    let current = this._head;
    for (let i = this._level; i >= 0; i--) {
      while (current.next[i] && current.next[i].key < lo) current = current.next[i];
    }
    current = current.next[0];
    while (current && current.key <= hi) {
      result.push({ key: current.key, value: current.value });
      current = current.next[0];
    }
    return result;
  }

  *[Symbol.iterator]() {
    let current = this._head.next[0];
    while (current) { yield { key: current.key, value: current.value }; current = current.next[0]; }
  }

  toArray() { return [...this]; }
}
