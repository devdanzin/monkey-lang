/**
 * Tiny Rope — Efficient string data structure for large texts
 * 
 * Binary tree of string chunks. O(log n) insert/delete/index.
 * Used by text editors for efficient editing of large documents.
 */

class RopeNode {
  constructor(left, right) {
    this.left = left;
    this.right = right;
    this.weight = left ? left.length : 0;
    this._length = (left ? left.length : 0) + (right ? right.length : 0);
  }
  get length() { return this._length; }
  get isLeaf() { return false; }
}

class RopeLeaf {
  constructor(text) {
    this.text = text;
    this._length = text.length;
  }
  get length() { return this._length; }
  get isLeaf() { return true; }
}

const MAX_LEAF = 64;

class Rope {
  constructor(root = null) {
    this.root = root;
  }

  get length() { return this.root ? this.root.length : 0; }

  static from(str) {
    if (str.length === 0) return new Rope();
    return new Rope(buildTree(str));
  }

  charAt(index) {
    if (index < 0 || index >= this.length) return undefined;
    return charAt(this.root, index);
  }

  toString() {
    const parts = [];
    collect(this.root, parts);
    return parts.join('');
  }

  insert(index, text) {
    if (!this.root) return Rope.from(text);
    const [left, right] = split(this.root, index);
    const mid = buildTree(text);
    return new Rope(join(join(left, mid), right));
  }

  delete(start, length) {
    if (!this.root) return this;
    const [left, rest] = split(this.root, start);
    const [_, right] = split(rest, length);
    return new Rope(join(left, right));
  }

  substring(start, end) {
    if (!this.root) return '';
    const [_, rest] = split(this.root, start);
    const [mid, __] = split(rest, end - start);
    const parts = [];
    collect(mid, parts);
    return parts.join('');
  }

  concat(other) {
    if (!this.root) return other;
    if (!other.root) return this;
    return new Rope(join(this.root, other.root));
  }

  indexOf(str) {
    return this.toString().indexOf(str);
  }

  lines() {
    return this.toString().split('\n');
  }

  lineAt(lineNum) {
    const lines = this.lines();
    return lineNum < lines.length ? lines[lineNum] : undefined;
  }

  rebalance() {
    return Rope.from(this.toString());
  }
}

function buildTree(str) {
  if (str.length <= MAX_LEAF) return new RopeLeaf(str);
  const mid = Math.floor(str.length / 2);
  return new RopeNode(buildTree(str.slice(0, mid)), buildTree(str.slice(mid)));
}

function charAt(node, index) {
  if (node.isLeaf) return node.text[index];
  if (index < node.weight) return charAt(node.left, index);
  return charAt(node.right, index - node.weight);
}

function collect(node, parts) {
  if (!node) return;
  if (node.isLeaf) { parts.push(node.text); return; }
  collect(node.left, parts);
  collect(node.right, parts);
}

function split(node, index) {
  if (!node) return [null, null];
  if (node.isLeaf) {
    if (index <= 0) return [null, node];
    if (index >= node.length) return [node, null];
    return [new RopeLeaf(node.text.slice(0, index)), new RopeLeaf(node.text.slice(index))];
  }
  if (index <= node.weight) {
    const [ll, lr] = split(node.left, index);
    return [ll, join(lr, node.right)];
  }
  const [rl, rr] = split(node.right, index - node.weight);
  return [join(node.left, rl), rr];
}

function join(left, right) {
  if (!left) return right;
  if (!right) return left;
  return new RopeNode(left, right);
}

module.exports = { Rope };
