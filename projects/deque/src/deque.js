// Deque — double-ended queue (circular buffer implementation)

export class Deque {
  constructor(capacity = 16) {
    this._buf = new Array(capacity);
    this._head = 0;
    this._tail = 0;
    this._size = 0;
    this._capacity = capacity;
  }

  _grow() {
    const newCap = this._capacity * 2;
    const newBuf = new Array(newCap);
    for (let i = 0; i < this._size; i++) newBuf[i] = this._buf[(this._head + i) % this._capacity];
    this._buf = newBuf;
    this._head = 0;
    this._tail = this._size;
    this._capacity = newCap;
  }

  pushBack(val) {
    if (this._size === this._capacity) this._grow();
    this._buf[this._tail] = val;
    this._tail = (this._tail + 1) % this._capacity;
    this._size++;
    return this;
  }

  pushFront(val) {
    if (this._size === this._capacity) this._grow();
    this._head = (this._head - 1 + this._capacity) % this._capacity;
    this._buf[this._head] = val;
    this._size++;
    return this;
  }

  popBack() {
    if (this._size === 0) return undefined;
    this._tail = (this._tail - 1 + this._capacity) % this._capacity;
    const val = this._buf[this._tail];
    this._buf[this._tail] = undefined;
    this._size--;
    return val;
  }

  popFront() {
    if (this._size === 0) return undefined;
    const val = this._buf[this._head];
    this._buf[this._head] = undefined;
    this._head = (this._head + 1) % this._capacity;
    this._size--;
    return val;
  }

  peekFront() { return this._size === 0 ? undefined : this._buf[this._head]; }
  peekBack() { return this._size === 0 ? undefined : this._buf[(this._tail - 1 + this._capacity) % this._capacity]; }

  get size() { return this._size; }
  get isEmpty() { return this._size === 0; }

  at(index) {
    if (index < 0 || index >= this._size) return undefined;
    return this._buf[(this._head + index) % this._capacity];
  }

  clear() { this._buf.fill(undefined); this._head = 0; this._tail = 0; this._size = 0; }

  toArray() {
    const arr = [];
    for (let i = 0; i < this._size; i++) arr.push(this._buf[(this._head + i) % this._capacity]);
    return arr;
  }

  *[Symbol.iterator]() { for (let i = 0; i < this._size; i++) yield this._buf[(this._head + i) % this._capacity]; }
}
