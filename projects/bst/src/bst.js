// bst.js — Binary Search Tree + AVL Tree

class BSTNode { constructor(key, value) { this.key = key; this.value = value; this.left = null; this.right = null; } }

export class BST {
  constructor(comparator = (a, b) => a - b) { this.root = null; this.size = 0; this.cmp = comparator; }

  insert(key, value = key) {
    this.root = this._insert(this.root, key, value);
    return this;
  }

  _insert(node, key, value) {
    if (!node) { this.size++; return new BSTNode(key, value); }
    const c = this.cmp(key, node.key);
    if (c < 0) node.left = this._insert(node.left, key, value);
    else if (c > 0) node.right = this._insert(node.right, key, value);
    else node.value = value;
    return node;
  }

  search(key) { return this._search(this.root, key); }
  _search(node, key) {
    if (!node) return undefined;
    const c = this.cmp(key, node.key);
    if (c === 0) return node.value;
    return c < 0 ? this._search(node.left, key) : this._search(node.right, key);
  }

  has(key) { return this.search(key) !== undefined; }

  delete(key) { const [root, deleted] = this._delete(this.root, key); this.root = root; if (deleted) this.size--; return deleted; }
  _delete(node, key) {
    if (!node) return [null, false];
    const c = this.cmp(key, node.key);
    if (c < 0) { const [left, d] = this._delete(node.left, key); node.left = left; return [node, d]; }
    if (c > 0) { const [right, d] = this._delete(node.right, key); node.right = right; return [node, d]; }
    if (!node.left) return [node.right, true];
    if (!node.right) return [node.left, true];
    let succ = node.right;
    while (succ.left) succ = succ.left;
    node.key = succ.key; node.value = succ.value;
    const [right] = this._delete(node.right, succ.key);
    node.right = right;
    return [node, true];
  }

  min() { let n = this.root; if (!n) return undefined; while (n.left) n = n.left; return n.value; }
  max() { let n = this.root; if (!n) return undefined; while (n.right) n = n.right; return n.value; }

  inorder() { const r = []; this._inorder(this.root, r); return r; }
  _inorder(n, r) { if (!n) return; this._inorder(n.left, r); r.push(n.key); this._inorder(n.right, r); }

  preorder() { const r = []; this._preorder(this.root, r); return r; }
  _preorder(n, r) { if (!n) return; r.push(n.key); this._preorder(n.left, r); this._preorder(n.right, r); }

  postorder() { const r = []; this._postorder(this.root, r); return r; }
  _postorder(n, r) { if (!n) return; this._postorder(n.left, r); this._postorder(n.right, r); r.push(n.key); }

  height() { return this._height(this.root); }
  _height(n) { return n ? 1 + Math.max(this._height(n.left), this._height(n.right)) : 0; }

  [Symbol.iterator]() { const items = this.inorder(); let i = 0; return { next() { return i < items.length ? { value: items[i++], done: false } : { done: true }; } }; }
}

// ===== AVL Tree =====
class AVLNode { constructor(key, value) { this.key = key; this.value = value; this.left = null; this.right = null; this.height = 1; } }

export class AVLTree {
  constructor(comparator = (a, b) => a - b) { this.root = null; this.size = 0; this.cmp = comparator; }

  _h(n) { return n ? n.height : 0; }
  _bf(n) { return this._h(n.left) - this._h(n.right); }
  _updateH(n) { n.height = 1 + Math.max(this._h(n.left), this._h(n.right)); }

  _rotateRight(y) { const x = y.left; y.left = x.right; x.right = y; this._updateH(y); this._updateH(x); return x; }
  _rotateLeft(x) { const y = x.right; x.right = y.left; y.left = x; this._updateH(x); this._updateH(y); return y; }

  _balance(n) {
    this._updateH(n);
    const bf = this._bf(n);
    if (bf > 1) { if (this._bf(n.left) < 0) n.left = this._rotateLeft(n.left); return this._rotateRight(n); }
    if (bf < -1) { if (this._bf(n.right) > 0) n.right = this._rotateRight(n.right); return this._rotateLeft(n); }
    return n;
  }

  insert(key, value = key) { this.root = this._insert(this.root, key, value); return this; }
  _insert(node, key, value) {
    if (!node) { this.size++; return new AVLNode(key, value); }
    const c = this.cmp(key, node.key);
    if (c < 0) node.left = this._insert(node.left, key, value);
    else if (c > 0) node.right = this._insert(node.right, key, value);
    else { node.value = value; return node; }
    return this._balance(node);
  }

  search(key) { return this._search(this.root, key); }
  _search(n, key) { if (!n) return undefined; const c = this.cmp(key, n.key); if (c === 0) return n.value; return c < 0 ? this._search(n.left, key) : this._search(n.right, key); }

  delete(key) { const [root, d] = this._delete(this.root, key); this.root = root; if (d) this.size--; return d; }
  _delete(n, key) {
    if (!n) return [null, false];
    const c = this.cmp(key, n.key);
    if (c < 0) { const [left, d] = this._delete(n.left, key); n.left = left; return [d ? this._balance(n) : n, d]; }
    if (c > 0) { const [right, d] = this._delete(n.right, key); n.right = right; return [d ? this._balance(n) : n, d]; }
    if (!n.left) return [n.right, true];
    if (!n.right) return [n.left, true];
    let succ = n.right; while (succ.left) succ = succ.left;
    n.key = succ.key; n.value = succ.value;
    const [right] = this._delete(n.right, succ.key);
    n.right = right;
    return [this._balance(n), true];
  }

  height() { return this._h(this.root); }
  inorder() { const r = []; const visit = n => { if (!n) return; visit(n.left); r.push(n.key); visit(n.right); }; visit(this.root); return r; }

  isBalanced() { return this._isBalanced(this.root); }
  _isBalanced(n) { if (!n) return true; return Math.abs(this._bf(n)) <= 1 && this._isBalanced(n.left) && this._isBalanced(n.right); }
}
