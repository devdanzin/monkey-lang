// btree.js — B-tree implementation for key-value indexing
// Order = t means each node can hold at most 2t-1 keys and 2t children

export class BTreeNode {
  constructor(isLeaf = true) {
    this.keys = [];     // key-value pairs: [{key, value}]
    this.children = []; // child nodes
    this.isLeaf = isLeaf;
  }

  get n() { return this.keys.length; }
}

export class BTree {
  constructor(order = 4) {
    this.t = order; // minimum degree
    this.root = new BTreeNode(true);
    this._size = 0;
  }

  get size() { return this._size; }

  // ===== Search =====
  get(key) {
    return this._search(this.root, key);
  }

  _search(node, key) {
    let i = 0;
    while (i < node.n && key > node.keys[i].key) i++;

    if (i < node.n && key === node.keys[i].key) {
      return node.keys[i].value;
    }

    if (node.isLeaf) return undefined;
    return this._search(node.children[i], key);
  }

  has(key) {
    return this.get(key) !== undefined;
  }

  // ===== Insert =====
  set(key, value) {
    const root = this.root;

    // Check if key already exists (update in place)
    if (this._update(root, key, value)) return this;

    // If root is full, split it
    if (root.n === 2 * this.t - 1) {
      const newRoot = new BTreeNode(false);
      newRoot.children.push(root);
      this._splitChild(newRoot, 0);
      this.root = newRoot;
      this._insertNonFull(newRoot, key, value);
    } else {
      this._insertNonFull(root, key, value);
    }
    this._size++;
    return this;
  }

  _update(node, key, value) {
    let i = 0;
    while (i < node.n && key > node.keys[i].key) i++;

    if (i < node.n && key === node.keys[i].key) {
      node.keys[i].value = value;
      return true;
    }

    if (node.isLeaf) return false;
    return this._update(node.children[i], key, value);
  }

  _insertNonFull(node, key, value) {
    let i = node.n - 1;

    if (node.isLeaf) {
      // Insert key in sorted position
      while (i >= 0 && key < node.keys[i].key) i--;
      node.keys.splice(i + 1, 0, { key, value });
    } else {
      while (i >= 0 && key < node.keys[i].key) i--;
      i++;
      if (node.children[i].n === 2 * this.t - 1) {
        this._splitChild(node, i);
        if (key > node.keys[i].key) i++;
      }
      this._insertNonFull(node.children[i], key, value);
    }
  }

  _splitChild(parent, index) {
    const t = this.t;
    const child = parent.children[index];
    const newNode = new BTreeNode(child.isLeaf);

    // Median key moves up to parent
    const median = child.keys[t - 1];

    // Right half goes to new node
    newNode.keys = child.keys.splice(t);
    child.keys.pop(); // remove median from original

    if (!child.isLeaf) {
      newNode.children = child.children.splice(t);
    }

    parent.keys.splice(index, 0, median);
    parent.children.splice(index + 1, 0, newNode);
  }

  // ===== Delete =====
  delete(key) {
    if (!this._delete(this.root, key)) return false;
    this._size--;

    // Shrink root if empty
    if (this.root.n === 0 && !this.root.isLeaf) {
      this.root = this.root.children[0];
    }
    return true;
  }

  _delete(node, key) {
    let i = 0;
    while (i < node.n && key > node.keys[i].key) i++;

    if (i < node.n && key === node.keys[i].key) {
      if (node.isLeaf) {
        node.keys.splice(i, 1);
        return true;
      }
      return this._deleteInternal(node, i);
    }

    if (node.isLeaf) return false;

    // Ensure child has enough keys before recursing
    if (node.children[i].n < this.t) {
      this._fillChild(node, i);
      // After fill, need to re-find the correct child
      i = 0;
      while (i < node.n && key > node.keys[i].key) i++;
      if (i < node.n && key === node.keys[i].key) {
        if (node.isLeaf) {
          node.keys.splice(i, 1);
          return true;
        }
        return this._deleteInternal(node, i);
      }
    }

    return this._delete(node.children[i], key);
  }

  _deleteInternal(node, idx) {
    const t = this.t;

    // Case 2a: left child has >= t keys
    if (node.children[idx].n >= t) {
      const pred = this._predecessor(node.children[idx]);
      node.keys[idx] = { ...pred };
      return this._delete(node.children[idx], pred.key);
    }

    // Case 2b: right child has >= t keys
    if (node.children[idx + 1].n >= t) {
      const succ = this._successor(node.children[idx + 1]);
      node.keys[idx] = { ...succ };
      return this._delete(node.children[idx + 1], succ.key);
    }

    // Case 2c: merge children
    const key = node.keys[idx].key;
    this._merge(node, idx);
    return this._delete(node.children[idx], key);
  }

  _predecessor(node) {
    while (!node.isLeaf) node = node.children[node.n];
    return node.keys[node.n - 1];
  }

  _successor(node) {
    while (!node.isLeaf) node = node.children[0];
    return node.keys[0];
  }

  _fillChild(node, idx) {
    const t = this.t;

    // Try borrowing from left sibling
    if (idx > 0 && node.children[idx - 1].n >= t) {
      this._borrowFromLeft(node, idx);
    }
    // Try borrowing from right sibling
    else if (idx < node.n && node.children[idx + 1].n >= t) {
      this._borrowFromRight(node, idx);
    }
    // Merge with a sibling
    else {
      if (idx < node.n) this._merge(node, idx);
      else this._merge(node, idx - 1);
    }
  }

  _borrowFromLeft(node, idx) {
    const child = node.children[idx];
    const sibling = node.children[idx - 1];

    child.keys.unshift({ ...node.keys[idx - 1] });
    node.keys[idx - 1] = { ...sibling.keys.pop() };

    if (!sibling.isLeaf) {
      child.children.unshift(sibling.children.pop());
    }
  }

  _borrowFromRight(node, idx) {
    const child = node.children[idx];
    const sibling = node.children[idx + 1];

    child.keys.push({ ...node.keys[idx] });
    node.keys[idx] = { ...sibling.keys.shift() };

    if (!sibling.isLeaf) {
      child.children.push(sibling.children.shift());
    }
  }

  _merge(node, idx) {
    const left = node.children[idx];
    const right = node.children[idx + 1];

    left.keys.push({ ...node.keys[idx] });
    left.keys.push(...right.keys);
    if (!left.isLeaf) {
      left.children.push(...right.children);
    }

    node.keys.splice(idx, 1);
    node.children.splice(idx + 1, 1);
  }

  // ===== Range Queries =====
  range(minKey, maxKey) {
    const results = [];
    this._rangeSearch(this.root, minKey, maxKey, results);
    return results;
  }

  _rangeSearch(node, min, max, results) {
    let i = 0;
    while (i < node.n && node.keys[i].key < min) i++;

    for (; i < node.n; i++) {
      if (!node.isLeaf && node.children[i]) {
        this._rangeSearch(node.children[i], min, max, results);
      }
      if (node.keys[i].key > max) return;
      if (node.keys[i].key >= min && node.keys[i].key <= max) {
        results.push({ key: node.keys[i].key, value: node.keys[i].value });
      }
    }

    // Visit rightmost child
    if (!node.isLeaf && node.children[node.n]) {
      this._rangeSearch(node.children[node.n], min, max, results);
    }
  }

  // ===== Iteration =====
  *entries() {
    yield* this._inorder(this.root);
  }

  *keys() {
    for (const { key } of this.entries()) yield key;
  }

  *values() {
    for (const { value } of this.entries()) yield value;
  }

  *_inorder(node) {
    for (let i = 0; i < node.n; i++) {
      if (!node.isLeaf) yield* this._inorder(node.children[i]);
      yield node.keys[i];
    }
    if (!node.isLeaf && node.children[node.n]) {
      yield* this._inorder(node.children[node.n]);
    }
  }

  // ===== Min/Max =====
  min() {
    let node = this.root;
    while (!node.isLeaf) node = node.children[0];
    return node.n > 0 ? node.keys[0] : undefined;
  }

  max() {
    let node = this.root;
    while (!node.isLeaf) node = node.children[node.n];
    return node.n > 0 ? node.keys[node.n - 1] : undefined;
  }

  // ===== Utility =====
  toArray() {
    return [...this.entries()];
  }

  clear() {
    this.root = new BTreeNode(true);
    this._size = 0;
  }

  height() {
    let h = 0;
    let node = this.root;
    while (!node.isLeaf) {
      h++;
      node = node.children[0];
    }
    return h;
  }
}
