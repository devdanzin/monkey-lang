// AVL Tree — self-balancing binary search tree
// O(log n) insert, delete, search, min, max

class AVLNode {
  constructor(key, value) {
    this.key = key;
    this.value = value;
    this.left = null;
    this.right = null;
    this.height = 1;
  }
}

export class AVLTree {
  constructor(comparator) {
    this.root = null;
    this._size = 0;
    this.compare = comparator || ((a, b) => a < b ? -1 : a > b ? 1 : 0);
  }

  get size() { return this._size; }
  get isEmpty() { return this._size === 0; }

  // ===== Core operations =====

  insert(key, value = key) {
    this.root = this._insert(this.root, key, value);
    return this;
  }

  delete(key) {
    const sizeBefore = this._size;
    this.root = this._delete(this.root, key);
    return this._size < sizeBefore;
  }

  search(key) {
    const node = this._search(this.root, key);
    return node ? node.value : undefined;
  }

  has(key) {
    return this._search(this.root, key) !== null;
  }

  min() {
    if (!this.root) return undefined;
    let node = this.root;
    while (node.left) node = node.left;
    return { key: node.key, value: node.value };
  }

  max() {
    if (!this.root) return undefined;
    let node = this.root;
    while (node.right) node = node.right;
    return { key: node.key, value: node.value };
  }

  // ===== Traversals =====

  inOrder() {
    const result = [];
    this._inOrder(this.root, result);
    return result;
  }

  preOrder() {
    const result = [];
    this._preOrder(this.root, result);
    return result;
  }

  postOrder() {
    const result = [];
    this._postOrder(this.root, result);
    return result;
  }

  levelOrder() {
    if (!this.root) return [];
    const result = [], queue = [this.root];
    while (queue.length) {
      const node = queue.shift();
      result.push({ key: node.key, value: node.value });
      if (node.left) queue.push(node.left);
      if (node.right) queue.push(node.right);
    }
    return result;
  }

  // Get sorted keys
  keys() { return this.inOrder().map(n => n.key); }
  values() { return this.inOrder().map(n => n.value); }

  // ===== Range queries =====

  // Find all keys in [lo, hi]
  range(lo, hi) {
    const result = [];
    this._range(this.root, lo, hi, result);
    return result;
  }

  // Find kth smallest (1-indexed)
  kthSmallest(k) {
    const sorted = this.inOrder();
    return k > 0 && k <= sorted.length ? sorted[k - 1] : undefined;
  }

  // Floor: largest key <= given key
  floor(key) {
    let result = null;
    let node = this.root;
    while (node) {
      const cmp = this.compare(key, node.key);
      if (cmp === 0) return { key: node.key, value: node.value };
      if (cmp > 0) { result = node; node = node.right; }
      else node = node.left;
    }
    return result ? { key: result.key, value: result.value } : undefined;
  }

  // Ceiling: smallest key >= given key
  ceil(key) {
    let result = null;
    let node = this.root;
    while (node) {
      const cmp = this.compare(key, node.key);
      if (cmp === 0) return { key: node.key, value: node.value };
      if (cmp < 0) { result = node; node = node.left; }
      else node = node.right;
    }
    return result ? { key: result.key, value: result.value } : undefined;
  }

  // Get tree height
  height() { return this._height(this.root); }

  // Check if balanced
  isBalanced() { return this._isBalanced(this.root); }

  clear() { this.root = null; this._size = 0; }

  // ===== Internal =====

  _height(node) { return node ? node.height : 0; }

  _balanceFactor(node) { return this._height(node.left) - this._height(node.right); }

  _updateHeight(node) {
    node.height = 1 + Math.max(this._height(node.left), this._height(node.right));
  }

  _rotateRight(y) {
    const x = y.left;
    const t = x.right;
    x.right = y;
    y.left = t;
    this._updateHeight(y);
    this._updateHeight(x);
    return x;
  }

  _rotateLeft(x) {
    const y = x.right;
    const t = y.left;
    y.left = x;
    x.right = t;
    this._updateHeight(x);
    this._updateHeight(y);
    return y;
  }

  _balance(node) {
    this._updateHeight(node);
    const bf = this._balanceFactor(node);

    // Left heavy
    if (bf > 1) {
      if (this._balanceFactor(node.left) < 0) node.left = this._rotateLeft(node.left);
      return this._rotateRight(node);
    }

    // Right heavy
    if (bf < -1) {
      if (this._balanceFactor(node.right) > 0) node.right = this._rotateRight(node.right);
      return this._rotateLeft(node);
    }

    return node;
  }

  _insert(node, key, value) {
    if (!node) { this._size++; return new AVLNode(key, value); }
    const cmp = this.compare(key, node.key);
    if (cmp < 0) node.left = this._insert(node.left, key, value);
    else if (cmp > 0) node.right = this._insert(node.right, key, value);
    else { node.value = value; return node; } // Update
    return this._balance(node);
  }

  _delete(node, key) {
    if (!node) return null;
    const cmp = this.compare(key, node.key);
    if (cmp < 0) node.left = this._delete(node.left, key);
    else if (cmp > 0) node.right = this._delete(node.right, key);
    else {
      this._size--;
      if (!node.left) return node.right;
      if (!node.right) return node.left;
      // Find inorder successor
      let succ = node.right;
      while (succ.left) succ = succ.left;
      node.key = succ.key;
      node.value = succ.value;
      this._size++; // Will be decremented in recursive call
      node.right = this._delete(node.right, succ.key);
    }
    return this._balance(node);
  }

  _search(node, key) {
    if (!node) return null;
    const cmp = this.compare(key, node.key);
    if (cmp < 0) return this._search(node.left, key);
    if (cmp > 0) return this._search(node.right, key);
    return node;
  }

  _inOrder(node, result) {
    if (!node) return;
    this._inOrder(node.left, result);
    result.push({ key: node.key, value: node.value });
    this._inOrder(node.right, result);
  }

  _preOrder(node, result) {
    if (!node) return;
    result.push({ key: node.key, value: node.value });
    this._preOrder(node.left, result);
    this._preOrder(node.right, result);
  }

  _postOrder(node, result) {
    if (!node) return;
    this._postOrder(node.left, result);
    this._postOrder(node.right, result);
    result.push({ key: node.key, value: node.value });
  }

  _range(node, lo, hi, result) {
    if (!node) return;
    if (this.compare(lo, node.key) < 0) this._range(node.left, lo, hi, result);
    if (this.compare(lo, node.key) <= 0 && this.compare(node.key, hi) <= 0) {
      result.push({ key: node.key, value: node.value });
    }
    if (this.compare(node.key, hi) < 0) this._range(node.right, lo, hi, result);
  }

  _isBalanced(node) {
    if (!node) return true;
    const bf = this._balanceFactor(node);
    return Math.abs(bf) <= 1 && this._isBalanced(node.left) && this._isBalanced(node.right);
  }
}
