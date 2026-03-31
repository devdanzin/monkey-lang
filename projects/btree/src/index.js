/**
 * Tiny B-Tree
 * 
 * Self-balancing tree for databases/filesystems:
 * - Insert with split
 * - Search
 * - Delete with merge/redistribute
 * - Range queries
 * - In-order traversal
 * - Configurable order (min degree)
 */

class BTreeNode {
  constructor(leaf = true) {
    this.keys = [];
    this.children = [];
    this.leaf = leaf;
  }
}

class BTree {
  constructor(t = 2) {
    this.t = t; // minimum degree
    this.root = new BTreeNode(true);
  }

  search(key, node = this.root) {
    let i = 0;
    while (i < node.keys.length && key > node.keys[i]) i++;
    if (i < node.keys.length && key === node.keys[i]) return true;
    if (node.leaf) return false;
    return this.search(key, node.children[i]);
  }

  insert(key) {
    const root = this.root;
    if (root.keys.length === 2 * this.t - 1) {
      const newRoot = new BTreeNode(false);
      newRoot.children.push(root);
      this._splitChild(newRoot, 0);
      this.root = newRoot;
      this._insertNonFull(newRoot, key);
    } else {
      this._insertNonFull(root, key);
    }
  }

  _insertNonFull(node, key) {
    let i = node.keys.length - 1;
    if (node.leaf) {
      while (i >= 0 && key < node.keys[i]) i--;
      node.keys.splice(i + 1, 0, key);
    } else {
      while (i >= 0 && key < node.keys[i]) i--;
      i++;
      if (node.children[i].keys.length === 2 * this.t - 1) {
        this._splitChild(node, i);
        if (key > node.keys[i]) i++;
      }
      this._insertNonFull(node.children[i], key);
    }
  }

  _splitChild(parent, i) {
    const t = this.t;
    const child = parent.children[i];
    const newNode = new BTreeNode(child.leaf);
    
    // Move upper half of keys to new node
    newNode.keys = child.keys.splice(t);
    const midKey = child.keys.pop();
    
    if (!child.leaf) {
      newNode.children = child.children.splice(t);
    }
    
    parent.keys.splice(i, 0, midKey);
    parent.children.splice(i + 1, 0, newNode);
  }

  delete(key) {
    this._delete(this.root, key);
    if (this.root.keys.length === 0 && !this.root.leaf) {
      this.root = this.root.children[0];
    }
  }

  _delete(node, key) {
    const t = this.t;
    let i = 0;
    while (i < node.keys.length && key > node.keys[i]) i++;
    
    if (i < node.keys.length && key === node.keys[i]) {
      if (node.leaf) {
        node.keys.splice(i, 1);
      } else {
        // Replace with predecessor or successor
        if (node.children[i].keys.length >= t) {
          const pred = this._getPredecessor(node.children[i]);
          node.keys[i] = pred;
          this._delete(node.children[i], pred);
        } else if (node.children[i + 1].keys.length >= t) {
          const succ = this._getSuccessor(node.children[i + 1]);
          node.keys[i] = succ;
          this._delete(node.children[i + 1], succ);
        } else {
          this._merge(node, i);
          this._delete(node.children[i], key);
        }
      }
    } else if (!node.leaf) {
      const child = node.children[i];
      if (child.keys.length < t) {
        this._fill(node, i);
        // Re-find the index after potential merge
        if (i > node.keys.length) i--;
      }
      this._delete(node.children[i], key);
    }
  }

  _getPredecessor(node) {
    while (!node.leaf) node = node.children[node.keys.length];
    return node.keys[node.keys.length - 1];
  }

  _getSuccessor(node) {
    while (!node.leaf) node = node.children[0];
    return node.keys[0];
  }

  _merge(node, i) {
    const left = node.children[i];
    const right = node.children[i + 1];
    left.keys.push(node.keys[i]);
    left.keys.push(...right.keys);
    if (!left.leaf) left.children.push(...right.children);
    node.keys.splice(i, 1);
    node.children.splice(i + 1, 1);
  }

  _fill(node, i) {
    const t = this.t;
    if (i > 0 && node.children[i - 1].keys.length >= t) {
      this._borrowFromPrev(node, i);
    } else if (i < node.keys.length && node.children[i + 1].keys.length >= t) {
      this._borrowFromNext(node, i);
    } else {
      if (i < node.keys.length) this._merge(node, i);
      else this._merge(node, i - 1);
    }
  }

  _borrowFromPrev(node, i) {
    const child = node.children[i];
    const sibling = node.children[i - 1];
    child.keys.unshift(node.keys[i - 1]);
    node.keys[i - 1] = sibling.keys.pop();
    if (!sibling.leaf) child.children.unshift(sibling.children.pop());
  }

  _borrowFromNext(node, i) {
    const child = node.children[i];
    const sibling = node.children[i + 1];
    child.keys.push(node.keys[i]);
    node.keys[i] = sibling.keys.shift();
    if (!sibling.leaf) child.children.push(sibling.children.shift());
  }

  inOrder(node = this.root) {
    const result = [];
    this._inOrder(node, result);
    return result;
  }

  _inOrder(node, result) {
    for (let i = 0; i < node.keys.length; i++) {
      if (!node.leaf) this._inOrder(node.children[i], result);
      result.push(node.keys[i]);
    }
    if (!node.leaf) this._inOrder(node.children[node.keys.length], result);
  }

  range(low, high) {
    return this.inOrder().filter(k => k >= low && k <= high);
  }

  get size() { return this.inOrder().length; }
  get height() { return this._height(this.root); }
  _height(node) { return node.leaf ? 1 : 1 + this._height(node.children[0]); }
}

module.exports = { BTree };
