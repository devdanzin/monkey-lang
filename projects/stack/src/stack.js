// Stack — LIFO with extras
export class Stack {
  constructor(items = []) { this._items = [...items]; }
  push(...items) { this._items.push(...items); return this; }
  pop() { if (this.isEmpty) throw new Error('Stack underflow'); return this._items.pop(); }
  peek() { return this._items[this._items.length - 1]; }
  get size() { return this._items.length; }
  get isEmpty() { return this._items.length === 0; }
  clear() { this._items.length = 0; return this; }
  toArray() { return [...this._items]; }
  *[Symbol.iterator]() { for (let i = this._items.length - 1; i >= 0; i--) yield this._items[i]; }
  clone() { return new Stack(this._items); }
  contains(item) { return this._items.includes(item); }
  static from(iterable) { return new Stack([...iterable]); }
}
// Min-stack — O(1) getMin
export class MinStack {
  constructor() { this._stack = []; this._mins = []; }
  push(val) { this._stack.push(val); this._mins.push(this._mins.length === 0 ? val : Math.min(val, this._mins[this._mins.length - 1])); }
  pop() { this._mins.pop(); return this._stack.pop(); }
  peek() { return this._stack[this._stack.length - 1]; }
  getMin() { return this._mins[this._mins.length - 1]; }
  get size() { return this._stack.length; }
}
