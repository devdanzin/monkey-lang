// Binary Heap / Priority Queue — min-heap and max-heap

export class BinaryHeap {
  constructor(comparator) {
    this.data = [];
    this.compare = comparator || ((a, b) => a - b);
  }

  get size() { return this.data.length; }
  get isEmpty() { return this.data.length === 0; }

  push(value) { this.data.push(value); this._bubbleUp(this.data.length - 1); return this; }
  peek() { return this.data[0]; }

  pop() {
    if (this.data.length === 0) return undefined;
    const top = this.data[0];
    const last = this.data.pop();
    if (this.data.length > 0) { this.data[0] = last; this._sinkDown(0); }
    return top;
  }

  // Push then pop (more efficient than push + pop separately)
  pushPop(value) {
    if (this.data.length > 0 && this.compare(this.data[0], value) < 0) {
      [value, this.data[0]] = [this.data[0], value];
      this._sinkDown(0);
    }
    return value;
  }

  // Replace root
  replace(value) {
    const top = this.data[0];
    this.data[0] = value;
    this._sinkDown(0);
    return top;
  }

  toArray() { return [...this.data]; }
  toSortedArray() { const clone = new BinaryHeap(this.compare); clone.data = [...this.data]; const result = []; while (clone.size) result.push(clone.pop()); return result; }
  clear() { this.data = []; }

  static from(arr, comparator) {
    const heap = new BinaryHeap(comparator);
    heap.data = [...arr];
    // Heapify from bottom up
    for (let i = Math.floor(arr.length / 2) - 1; i >= 0; i--) heap._sinkDown(i);
    return heap;
  }

  _bubbleUp(i) {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.compare(this.data[i], this.data[p]) >= 0) break;
      [this.data[i], this.data[p]] = [this.data[p], this.data[i]];
      i = p;
    }
  }

  _sinkDown(i) {
    const n = this.data.length;
    while (true) {
      let smallest = i;
      const l = 2 * i + 1, r = 2 * i + 2;
      if (l < n && this.compare(this.data[l], this.data[smallest]) < 0) smallest = l;
      if (r < n && this.compare(this.data[r], this.data[smallest]) < 0) smallest = r;
      if (smallest === i) break;
      [this.data[i], this.data[smallest]] = [this.data[smallest], this.data[i]];
      i = smallest;
    }
  }
}

// Convenience wrappers
export class MinHeap extends BinaryHeap { constructor() { super((a, b) => a - b); } }
export class MaxHeap extends BinaryHeap { constructor() { super((a, b) => b - a); } }

// Priority Queue with key-value pairs
export class PriorityQueue {
  constructor() { this._heap = new BinaryHeap((a, b) => a.priority - b.priority); }
  get size() { return this._heap.size; }
  get isEmpty() { return this._heap.isEmpty; }
  enqueue(value, priority = 0) { this._heap.push({ value, priority }); return this; }
  dequeue() { const item = this._heap.pop(); return item ? item.value : undefined; }
  peek() { const item = this._heap.peek(); return item ? item.value : undefined; }
  clear() { this._heap.clear(); }
}
