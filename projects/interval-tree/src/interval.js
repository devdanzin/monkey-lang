// Interval Tree — augmented BST for interval queries

class Node {
  constructor(lo, hi, value) { this.lo = lo; this.hi = hi; this.value = value; this.max = hi; this.left = null; this.right = null; }
}

export class IntervalTree {
  constructor() { this._root = null; this._size = 0; }

  insert(lo, hi, value) {
    this._root = this._insert(this._root, lo, hi, value);
    this._size++;
  }

  _insert(node, lo, hi, value) {
    if (!node) return new Node(lo, hi, value);
    if (lo < node.lo) node.left = this._insert(node.left, lo, hi, value);
    else node.right = this._insert(node.right, lo, hi, value);
    node.max = Math.max(node.max, hi);
    return node;
  }

  search(lo, hi) {
    const results = [];
    this._search(this._root, lo, hi, results);
    return results;
  }

  _search(node, lo, hi, results) {
    if (!node) return;
    if (node.lo <= hi && node.hi >= lo) results.push({ lo: node.lo, hi: node.hi, value: node.value });
    if (node.left && node.left.max >= lo) this._search(node.left, lo, hi, results);
    if (node.right && node.lo <= hi) this._search(node.right, lo, hi, results);
  }

  contains(point) { return this.search(point, point); }

  get size() { return this._size; }

  toArray() {
    const result = [];
    this._inorder(this._root, result);
    return result;
  }

  _inorder(node, result) {
    if (!node) return;
    this._inorder(node.left, result);
    result.push({ lo: node.lo, hi: node.hi, value: node.value });
    this._inorder(node.right, result);
  }
}
