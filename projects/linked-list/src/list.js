// Linked List — Singly and Doubly linked with full API

class SNode { constructor(value) { this.value = value; this.next = null; } }

export class SinglyLinkedList {
  constructor() { this.head = null; this.tail = null; this._size = 0; }
  get size() { return this._size; }
  get isEmpty() { return this._size === 0; }

  // Add to end
  push(value) { const n = new SNode(value); if (!this.head) { this.head = this.tail = n; } else { this.tail.next = n; this.tail = n; } this._size++; return this; }
  // Add to front
  unshift(value) { const n = new SNode(value); n.next = this.head; this.head = n; if (!this.tail) this.tail = n; this._size++; return this; }
  // Remove from end
  pop() { if (!this.head) return undefined; if (this.head === this.tail) { const v = this.head.value; this.head = this.tail = null; this._size--; return v; } let cur = this.head; while (cur.next !== this.tail) cur = cur.next; const v = this.tail.value; this.tail = cur; this.tail.next = null; this._size--; return v; }
  // Remove from front
  shift() { if (!this.head) return undefined; const v = this.head.value; this.head = this.head.next; if (!this.head) this.tail = null; this._size--; return v; }
  // Get at index
  get(index) { if (index < 0 || index >= this._size) return undefined; let cur = this.head, i = 0; while (i < index) { cur = cur.next; i++; } return cur.value; }
  // Set at index
  set(index, value) { if (index < 0 || index >= this._size) return false; let cur = this.head, i = 0; while (i < index) { cur = cur.next; i++; } cur.value = value; return true; }
  // Insert at index
  insert(index, value) { if (index === 0) return this.unshift(value); if (index === this._size) return this.push(value); if (index < 0 || index > this._size) return this; let cur = this.head, i = 0; while (i < index - 1) { cur = cur.next; i++; } const n = new SNode(value); n.next = cur.next; cur.next = n; this._size++; return this; }
  // Remove at index
  remove(index) { if (index === 0) return this.shift(); if (index === this._size - 1) return this.pop(); if (index < 0 || index >= this._size) return undefined; let cur = this.head, i = 0; while (i < index - 1) { cur = cur.next; i++; } const v = cur.next.value; cur.next = cur.next.next; this._size--; return v; }
  // Find index of value
  indexOf(value) { let cur = this.head, i = 0; while (cur) { if (cur.value === value) return i; cur = cur.next; i++; } return -1; }
  contains(value) { return this.indexOf(value) !== -1; }
  // Convert to array
  toArray() { const arr = []; let cur = this.head; while (cur) { arr.push(cur.value); cur = cur.next; } return arr; }
  // Reverse in place
  reverse() { let prev = null, cur = this.head; this.tail = this.head; while (cur) { const next = cur.next; cur.next = prev; prev = cur; cur = next; } this.head = prev; return this; }
  // Clear
  clear() { this.head = this.tail = null; this._size = 0; return this; }
  // Iterator
  *[Symbol.iterator]() { let cur = this.head; while (cur) { yield cur.value; cur = cur.next; } }
  // From array
  static from(arr) { const list = new SinglyLinkedList(); for (const v of arr) list.push(v); return list; }
}

class DNode { constructor(value) { this.value = value; this.prev = null; this.next = null; } }

export class DoublyLinkedList {
  constructor() { this.head = null; this.tail = null; this._size = 0; }
  get size() { return this._size; }
  get isEmpty() { return this._size === 0; }

  push(value) { const n = new DNode(value); if (!this.head) { this.head = this.tail = n; } else { n.prev = this.tail; this.tail.next = n; this.tail = n; } this._size++; return this; }
  unshift(value) { const n = new DNode(value); if (!this.head) { this.head = this.tail = n; } else { n.next = this.head; this.head.prev = n; this.head = n; } this._size++; return this; }
  pop() { if (!this.tail) return undefined; const v = this.tail.value; if (this.head === this.tail) { this.head = this.tail = null; } else { this.tail = this.tail.prev; this.tail.next = null; } this._size--; return v; }
  shift() { if (!this.head) return undefined; const v = this.head.value; if (this.head === this.tail) { this.head = this.tail = null; } else { this.head = this.head.next; this.head.prev = null; } this._size--; return v; }

  _getNode(index) { if (index < 0 || index >= this._size) return null; let cur; if (index <= this._size / 2) { cur = this.head; for (let i = 0; i < index; i++) cur = cur.next; } else { cur = this.tail; for (let i = this._size - 1; i > index; i--) cur = cur.prev; } return cur; }

  get(index) { const n = this._getNode(index); return n ? n.value : undefined; }
  set(index, value) { const n = this._getNode(index); if (!n) return false; n.value = value; return true; }

  insert(index, value) {
    if (index === 0) return this.unshift(value);
    if (index === this._size) return this.push(value);
    const after = this._getNode(index);
    if (!after) return this;
    const n = new DNode(value);
    n.prev = after.prev; n.next = after;
    after.prev.next = n; after.prev = n;
    this._size++; return this;
  }

  remove(index) {
    if (index === 0) return this.shift();
    if (index === this._size - 1) return this.pop();
    const n = this._getNode(index);
    if (!n) return undefined;
    n.prev.next = n.next; n.next.prev = n.prev;
    this._size--; return n.value;
  }

  indexOf(value) { let cur = this.head, i = 0; while (cur) { if (cur.value === value) return i; cur = cur.next; i++; } return -1; }
  contains(value) { return this.indexOf(value) !== -1; }
  toArray() { const arr = []; let cur = this.head; while (cur) { arr.push(cur.value); cur = cur.next; } return arr; }
  reverse() { let cur = this.head; while (cur) { [cur.prev, cur.next] = [cur.next, cur.prev]; cur = cur.prev; } [this.head, this.tail] = [this.tail, this.head]; return this; }
  clear() { this.head = this.tail = null; this._size = 0; return this; }
  *[Symbol.iterator]() { let cur = this.head; while (cur) { yield cur.value; cur = cur.next; } }
  static from(arr) { const list = new DoublyLinkedList(); for (const v of arr) list.push(v); return list; }
}
