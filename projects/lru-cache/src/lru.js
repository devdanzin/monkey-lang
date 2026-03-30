// LRU Cache — O(1) get/set using doubly-linked list + Map

class Node {
  constructor(key, value) {
    this.key = key;
    this.value = value;
    this.prev = null;
    this.next = null;
  }
}

export class LRUCache {
  constructor(capacity, { onEvict } = {}) {
    if (capacity < 1) throw new Error('Capacity must be >= 1');
    this.capacity = capacity;
    this.map = new Map();
    this.onEvict = onEvict || null;

    // Sentinel nodes
    this.head = new Node(null, null); // Most recently used
    this.tail = new Node(null, null); // Least recently used
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  // Get value (moves to front)
  get(key) {
    const node = this.map.get(key);
    if (!node) return undefined;
    this._moveToFront(node);
    return node.value;
  }

  // Check if key exists (without moving)
  has(key) {
    return this.map.has(key);
  }

  // Peek at value without moving
  peek(key) {
    const node = this.map.get(key);
    return node ? node.value : undefined;
  }

  // Set value (moves/adds to front, evicts if needed)
  set(key, value) {
    let node = this.map.get(key);

    if (node) {
      node.value = value;
      this._moveToFront(node);
    } else {
      node = new Node(key, value);
      this.map.set(key, node);
      this._addToFront(node);

      if (this.map.size > this.capacity) {
        this._evictLRU();
      }
    }

    return this;
  }

  // Delete key
  delete(key) {
    const node = this.map.get(key);
    if (!node) return false;
    this._remove(node);
    this.map.delete(key);
    return true;
  }

  // Clear all
  clear() {
    this.map.clear();
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  // Current size
  get size() { return this.map.size; }

  // Get all keys (most recent first)
  keys() {
    const result = [];
    let node = this.head.next;
    while (node !== this.tail) {
      result.push(node.key);
      node = node.next;
    }
    return result;
  }

  // Get all values (most recent first)
  values() {
    const result = [];
    let node = this.head.next;
    while (node !== this.tail) {
      result.push(node.value);
      node = node.next;
    }
    return result;
  }

  // Get all entries (most recent first)
  entries() {
    const result = [];
    let node = this.head.next;
    while (node !== this.tail) {
      result.push([node.key, node.value]);
      node = node.next;
    }
    return result;
  }

  // forEach
  forEach(fn) {
    let node = this.head.next;
    while (node !== this.tail) {
      fn(node.value, node.key, this);
      node = node.next;
    }
  }

  // Resize cache
  resize(newCapacity) {
    if (newCapacity < 1) throw new Error('Capacity must be >= 1');
    this.capacity = newCapacity;
    while (this.map.size > this.capacity) {
      this._evictLRU();
    }
  }

  // Internal: add node right after head
  _addToFront(node) {
    node.prev = this.head;
    node.next = this.head.next;
    this.head.next.prev = node;
    this.head.next = node;
  }

  // Internal: remove node from list
  _remove(node) {
    node.prev.next = node.next;
    node.next.prev = node.prev;
  }

  // Internal: move existing node to front
  _moveToFront(node) {
    this._remove(node);
    this._addToFront(node);
  }

  // Internal: evict least recently used
  _evictLRU() {
    const lru = this.tail.prev;
    if (lru === this.head) return;
    this._remove(lru);
    this.map.delete(lru.key);
    if (this.onEvict) this.onEvict(lru.key, lru.value);
  }
}
