// Hash Map — open addressing with linear probing, auto-resize

const EMPTY = Symbol('EMPTY');
const DELETED = Symbol('DELETED');

export class HashMap {
  constructor(initialCapacity = 16, loadFactor = 0.75) {
    this._capacity = initialCapacity;
    this._loadFactor = loadFactor;
    this._size = 0;
    this._keys = new Array(initialCapacity).fill(EMPTY);
    this._values = new Array(initialCapacity).fill(EMPTY);
  }

  get size() { return this._size; }
  get isEmpty() { return this._size === 0; }
  get capacity() { return this._capacity; }

  set(key, value) {
    if (this._size >= this._capacity * this._loadFactor) this._resize(this._capacity * 2);
    let idx = this._hash(key);
    let firstDeleted = -1;

    for (let i = 0; i < this._capacity; i++) {
      const pos = (idx + i) % this._capacity;
      if (this._keys[pos] === EMPTY) {
        const insertPos = firstDeleted >= 0 ? firstDeleted : pos;
        this._keys[insertPos] = key;
        this._values[insertPos] = value;
        this._size++;
        return this;
      }
      if (this._keys[pos] === DELETED && firstDeleted < 0) { firstDeleted = pos; continue; }
      if (this._keys[pos] === key) { this._values[pos] = value; return this; }
    }

    if (firstDeleted >= 0) { this._keys[firstDeleted] = key; this._values[firstDeleted] = value; this._size++; }
    return this;
  }

  get(key) {
    const pos = this._find(key);
    return pos >= 0 ? this._values[pos] : undefined;
  }

  has(key) { return this._find(key) >= 0; }

  delete(key) {
    const pos = this._find(key);
    if (pos < 0) return false;
    this._keys[pos] = DELETED;
    this._values[pos] = EMPTY;
    this._size--;
    return true;
  }

  keys() { return this._entries().map(([k]) => k); }
  values() { return this._entries().map(([, v]) => v); }
  entries() { return this._entries(); }

  forEach(fn) { for (const [k, v] of this._entries()) fn(v, k, this); }

  clear() { this._keys.fill(EMPTY); this._values.fill(EMPTY); this._size = 0; }

  _entries() {
    const result = [];
    for (let i = 0; i < this._capacity; i++) {
      if (this._keys[i] !== EMPTY && this._keys[i] !== DELETED) {
        result.push([this._keys[i], this._values[i]]);
      }
    }
    return result;
  }

  _find(key) {
    let idx = this._hash(key);
    for (let i = 0; i < this._capacity; i++) {
      const pos = (idx + i) % this._capacity;
      if (this._keys[pos] === EMPTY) return -1;
      if (this._keys[pos] === key) return pos;
    }
    return -1;
  }

  _hash(key) {
    const str = String(key);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    return ((hash % this._capacity) + this._capacity) % this._capacity;
  }

  _resize(newCapacity) {
    const oldKeys = this._keys;
    const oldValues = this._values;
    this._capacity = newCapacity;
    this._keys = new Array(newCapacity).fill(EMPTY);
    this._values = new Array(newCapacity).fill(EMPTY);
    this._size = 0;

    for (let i = 0; i < oldKeys.length; i++) {
      if (oldKeys[i] !== EMPTY && oldKeys[i] !== DELETED) {
        this.set(oldKeys[i], oldValues[i]);
      }
    }
  }

  *[Symbol.iterator]() { for (const e of this._entries()) yield e; }
}
