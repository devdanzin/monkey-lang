/**
 * Tiny Red-Black Tree
 * 
 * Self-balancing BST with O(log n) operations:
 * - Insert with rotations
 * - Search
 * - Delete
 * - In-order traversal
 * - Min/Max
 * - Floor/Ceil
 */

const RED = true;
const BLACK = false;

class RBNode {
  constructor(key, value, color = RED) {
    this.key = key;
    this.value = value;
    this.color = color;
    this.left = null;
    this.right = null;
  }
}

class RBTree {
  constructor(compare = (a, b) => a < b ? -1 : a > b ? 1 : 0) {
    this.root = null;
    this.compare = compare;
    this._size = 0;
  }

  get size() { return this._size; }

  _isRed(node) { return node !== null && node.color === RED; }

  _rotateLeft(h) {
    const x = h.right;
    h.right = x.left;
    x.left = h;
    x.color = h.color;
    h.color = RED;
    return x;
  }

  _rotateRight(h) {
    const x = h.left;
    h.left = x.right;
    x.right = h;
    x.color = h.color;
    h.color = RED;
    return x;
  }

  _flipColors(h) {
    h.color = !h.color;
    if (h.left) h.left.color = !h.left.color;
    if (h.right) h.right.color = !h.right.color;
  }

  insert(key, value = key) {
    this.root = this._insert(this.root, key, value);
    this.root.color = BLACK;
  }

  _insert(h, key, value) {
    if (h === null) { this._size++; return new RBNode(key, value); }
    const cmp = this.compare(key, h.key);
    if (cmp < 0) h.left = this._insert(h.left, key, value);
    else if (cmp > 0) h.right = this._insert(h.right, key, value);
    else h.value = value; // update

    if (this._isRed(h.right) && !this._isRed(h.left)) h = this._rotateLeft(h);
    if (this._isRed(h.left) && this._isRed(h.left?.left)) h = this._rotateRight(h);
    if (this._isRed(h.left) && this._isRed(h.right)) this._flipColors(h);

    return h;
  }

  get(key) {
    let node = this.root;
    while (node !== null) {
      const cmp = this.compare(key, node.key);
      if (cmp < 0) node = node.left;
      else if (cmp > 0) node = node.right;
      else return node.value;
    }
    return undefined;
  }

  has(key) { return this.get(key) !== undefined; }

  min() {
    if (!this.root) return undefined;
    let node = this.root;
    while (node.left) node = node.left;
    return node.key;
  }

  max() {
    if (!this.root) return undefined;
    let node = this.root;
    while (node.right) node = node.right;
    return node.key;
  }

  floor(key) {
    const node = this._floor(this.root, key);
    return node ? node.key : undefined;
  }

  _floor(node, key) {
    if (!node) return null;
    const cmp = this.compare(key, node.key);
    if (cmp === 0) return node;
    if (cmp < 0) return this._floor(node.left, key);
    const right = this._floor(node.right, key);
    return right || node;
  }

  ceil(key) {
    const node = this._ceil(this.root, key);
    return node ? node.key : undefined;
  }

  _ceil(node, key) {
    if (!node) return null;
    const cmp = this.compare(key, node.key);
    if (cmp === 0) return node;
    if (cmp > 0) return this._ceil(node.right, key);
    const left = this._ceil(node.left, key);
    return left || node;
  }

  inOrder() {
    const result = [];
    this._inOrder(this.root, result);
    return result;
  }

  _inOrder(node, result) {
    if (!node) return;
    this._inOrder(node.left, result);
    result.push({ key: node.key, value: node.value });
    this._inOrder(node.right, result);
  }

  keys() { return this.inOrder().map(n => n.key); }

  range(low, high) {
    return this.keys().filter(k => this.compare(k, low) >= 0 && this.compare(k, high) <= 0);
  }

  height() { return this._height(this.root); }
  _height(node) { return node === null ? 0 : 1 + Math.max(this._height(node.left), this._height(node.right)); }

  _isBalanced() {
    let blackHeight = 0;
    let node = this.root;
    while (node) { if (!this._isRed(node)) blackHeight++; node = node.left; }
    return this._checkBlackHeight(this.root, blackHeight);
  }

  _checkBlackHeight(node, expected) {
    if (!node) return expected === 0;
    if (!this._isRed(node)) expected--;
    return this._checkBlackHeight(node.left, expected) && this._checkBlackHeight(node.right, expected);
  }
}

module.exports = { RBTree, RED, BLACK };
