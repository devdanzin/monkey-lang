// ===== Rope Data Structure =====
// Balanced binary tree for efficient string editing (used in text editors)

const LEAF_THRESHOLD = 64; // max leaf string length before splitting

class RopeNode {
  constructor(left = null, right = null, str = null) {
    this.left = left;
    this.right = right;
    this.str = str; // only for leaf nodes
    this.weight = str ? str.length : (left ? left.length : 0);
    this._length = str ? str.length : (left ? left.length : 0) + (right ? right.length : 0);
  }

  get length() { return this._length; }
  get isLeaf() { return this.str !== null; }
}

export class Rope {
  constructor(str = '') {
    this.root = typeof str === 'string' ? Rope._buildLeaf(str) : str;
  }

  static _buildLeaf(str) {
    if (str.length <= LEAF_THRESHOLD) {
      return new RopeNode(null, null, str);
    }
    const mid = Math.floor(str.length / 2);
    return new RopeNode(
      Rope._buildLeaf(str.slice(0, mid)),
      Rope._buildLeaf(str.slice(mid))
    );
  }

  get length() { return this.root ? this.root.length : 0; }

  // O(log n) character access
  charAt(index) {
    if (index < 0 || index >= this.length) return undefined;
    return this._charAt(this.root, index);
  }

  _charAt(node, index) {
    if (node.isLeaf) return node.str[index];
    if (index < node.weight) return this._charAt(node.left, index);
    return this._charAt(node.right, index - node.weight);
  }

  // O(log n) concat
  concat(other) {
    const otherRope = other instanceof Rope ? other : new Rope(other);
    if (this.length === 0) return otherRope;
    if (otherRope.length === 0) return this;
    
    const newRoot = new RopeNode(this.root, otherRope.root);
    return new Rope(newRoot);
  }

  // O(log n) split at index
  split(index) {
    if (index <= 0) return [new Rope(''), this];
    if (index >= this.length) return [this, new Rope('')];
    
    const [left, right] = this._split(this.root, index);
    return [new Rope(left), new Rope(right)];
  }

  _split(node, index) {
    if (node.isLeaf) {
      return [
        new RopeNode(null, null, node.str.slice(0, index)),
        new RopeNode(null, null, node.str.slice(index)),
      ];
    }

    if (index < node.weight) {
      const [ll, lr] = this._split(node.left, index);
      return [ll, new RopeNode(lr, node.right)];
    } else if (index > node.weight) {
      const [rl, rr] = this._split(node.right, index - node.weight);
      return [new RopeNode(node.left, rl), rr];
    } else {
      return [node.left || new RopeNode(null, null, ''), node.right || new RopeNode(null, null, '')];
    }
  }

  // O(log n) insert at index
  insert(index, str) {
    const [left, right] = this.split(index);
    return left.concat(str).concat(right);
  }

  // O(log n) delete range [start, end)
  delete(start, end) {
    if (start >= end) return this;
    const [left, rest] = this.split(start);
    const [, right] = new Rope(rest.root).split(end - start);
    return left.concat(right);
  }

  // O(n) convert to string
  toString() {
    const parts = [];
    this._collect(this.root, parts);
    return parts.join('');
  }

  _collect(node, parts) {
    if (!node) return;
    if (node.isLeaf) { parts.push(node.str); return; }
    this._collect(node.left, parts);
    this._collect(node.right, parts);
  }

  // Substring
  substring(start, end) {
    const [, rest] = this.split(start);
    const [sub] = new Rope(rest.root).split(end - start);
    return sub.toString();
  }

  // Line operations (useful for text editors)
  lines() {
    return this.toString().split('\n');
  }

  lineCount() {
    const str = this.toString();
    let count = 1;
    for (let i = 0; i < str.length; i++) {
      if (str[i] === '\n') count++;
    }
    return count;
  }
}
