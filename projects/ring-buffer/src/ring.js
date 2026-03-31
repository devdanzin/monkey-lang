// Ring Buffer — fixed-size circular queue

export class RingBuffer {
  constructor(capacity) {
    if (capacity < 1) throw new Error('Capacity must be >= 1');
    this._buf = new Array(capacity);
    this._capacity = capacity;
    this._head = 0; // read position
    this._tail = 0; // write position
    this._size = 0;
  }

  push(value) {
    if (this._size === this._capacity) {
      // Overwrite oldest
      this._buf[this._tail] = value;
      this._tail = (this._tail + 1) % this._capacity;
      this._head = (this._head + 1) % this._capacity;
    } else {
      this._buf[this._tail] = value;
      this._tail = (this._tail + 1) % this._capacity;
      this._size++;
    }
    return this;
  }

  shift() {
    if (this._size === 0) return undefined;
    const value = this._buf[this._head];
    this._buf[this._head] = undefined;
    this._head = (this._head + 1) % this._capacity;
    this._size--;
    return value;
  }

  peek() { return this._size === 0 ? undefined : this._buf[this._head]; }
  peekLast() { return this._size === 0 ? undefined : this._buf[(this._tail - 1 + this._capacity) % this._capacity]; }

  get size() { return this._size; }
  get capacity() { return this._capacity; }
  get isFull() { return this._size === this._capacity; }
  get isEmpty() { return this._size === 0; }

  clear() { this._buf.fill(undefined); this._head = 0; this._tail = 0; this._size = 0; }

  toArray() {
    const result = [];
    for (let i = 0; i < this._size; i++) {
      result.push(this._buf[(this._head + i) % this._capacity]);
    }
    return result;
  }

  *[Symbol.iterator]() {
    for (let i = 0; i < this._size; i++) {
      yield this._buf[(this._head + i) % this._capacity];
    }
  }

  at(index) {
    if (index < 0 || index >= this._size) return undefined;
    return this._buf[(this._head + index) % this._capacity];
  }
}
