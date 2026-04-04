// ===== B-Tree =====
//
// A self-balancing tree data structure that maintains sorted data
// and allows searches, insertions, deletions, and range queries
// in O(log n) time.
//
// Properties (order t):
//   - Every node has at most 2t-1 keys
//   - Every non-root node has at least t-1 keys
//   - The root has at least 1 key (unless empty)
//   - All leaves are at the same depth
//   - A non-leaf node with k keys has k+1 children

class BTreeNode {
  constructor(leaf = true) {
    this.keys = [];      // sorted array of keys
    this.values = [];    // corresponding values
    this.children = [];  // child pointers (length = keys.length + 1 for internal nodes)
    this.leaf = leaf;
  }
}

export class BTree {
  constructor(order = 3) {
    this.t = order;          // minimum degree (each node has at most 2t-1 keys)
    this.root = new BTreeNode(true);
    this._size = 0;
  }

  get size() { return this._size; }

  // ===== Search =====
  
  get(key) {
    return this._search(this.root, key);
  }

  has(key) {
    return this.get(key) !== undefined;
  }

  _search(node, key) {
    let i = 0;
    while (i < node.keys.length && key > node.keys[i]) i++;
    
    if (i < node.keys.length && key === node.keys[i]) {
      return node.values[i];
    }
    
    if (node.leaf) return undefined;
    return this._search(node.children[i], key);
  }

  // ===== Insert =====
  
  set(key, value) {
    const root = this.root;
    
    // If root is full, split it
    if (root.keys.length === 2 * this.t - 1) {
      const newRoot = new BTreeNode(false);
      newRoot.children.push(root);
      this._splitChild(newRoot, 0);
      this.root = newRoot;
      this._insertNonFull(newRoot, key, value);
    } else {
      this._insertNonFull(root, key, value);
    }
  }

  _insertNonFull(node, key, value) {
    let i = node.keys.length - 1;
    
    // Check if key already exists (update value)
    for (let j = 0; j < node.keys.length; j++) {
      if (node.keys[j] === key) {
        node.values[j] = value;
        return; // update, don't increment size
      }
    }
    
    this._size++;
    
    if (node.leaf) {
      // Insert into leaf
      while (i >= 0 && key < node.keys[i]) i--;
      node.keys.splice(i + 1, 0, key);
      node.values.splice(i + 1, 0, value);
    } else {
      // Find child to descend into
      while (i >= 0 && key < node.keys[i]) i--;
      i++;
      
      // Split child if full
      if (node.children[i].keys.length === 2 * this.t - 1) {
        this._splitChild(node, i);
        if (key > node.keys[i]) i++;
        if (key === node.keys[i]) {
          node.values[i] = value;
          this._size--; // was increment but this is update
          return;
        }
      }
      
      this._size--; // will be incremented in recursive call
      this._insertNonFull(node.children[i], key, value);
    }
  }

  _splitChild(parent, childIndex) {
    const t = this.t;
    const child = parent.children[childIndex];
    const newChild = new BTreeNode(child.leaf);
    
    // Middle key goes up to parent
    const midKey = child.keys[t - 1];
    const midVal = child.values[t - 1];
    
    // Right half goes to new child
    newChild.keys = child.keys.splice(t);
    newChild.values = child.values.splice(t);
    child.keys.pop(); // remove the middle key
    child.values.pop();
    
    if (!child.leaf) {
      newChild.children = child.children.splice(t);
    }
    
    // Insert middle key and new child into parent
    parent.keys.splice(childIndex, 0, midKey);
    parent.values.splice(childIndex, 0, midVal);
    parent.children.splice(childIndex + 1, 0, newChild);
  }

  // ===== Delete =====
  
  delete(key) {
    if (!this.has(key)) return false;
    
    this._delete(this.root, key);
    this._size--;
    
    // If root has no keys and has a child, shrink tree
    if (this.root.keys.length === 0 && !this.root.leaf) {
      this.root = this.root.children[0];
    }
    
    return true;
  }

  _delete(node, key) {
    const t = this.t;
    let i = 0;
    while (i < node.keys.length && key > node.keys[i]) i++;
    
    if (i < node.keys.length && key === node.keys[i]) {
      if (node.leaf) {
        // Case 1: key in leaf — just remove it
        node.keys.splice(i, 1);
        node.values.splice(i, 1);
      } else {
        // Case 2: key in internal node
        const leftChild = node.children[i];
        const rightChild = node.children[i + 1];
        
        if (leftChild.keys.length >= t) {
          // Case 2a: predecessor has enough keys
          const [predKey, predVal] = this._predecessor(leftChild);
          node.keys[i] = predKey;
          node.values[i] = predVal;
          this._delete(leftChild, predKey);
        } else if (rightChild.keys.length >= t) {
          // Case 2b: successor has enough keys
          const [succKey, succVal] = this._successor(rightChild);
          node.keys[i] = succKey;
          node.values[i] = succVal;
          this._delete(rightChild, succKey);
        } else {
          // Case 2c: merge children
          this._mergeChildren(node, i);
          this._delete(node.children[i], key);
        }
      }
    } else {
      // Key not in this node — descend to child
      if (node.leaf) return; // key not found
      
      const child = node.children[i];
      
      // Ensure child has at least t keys
      if (child.keys.length < t) {
        this._fillChild(node, i);
        // Re-find the index after potential merge
        i = 0;
        while (i < node.keys.length && key > node.keys[i]) i++;
        if (i < node.keys.length && key === node.keys[i]) {
          return this._delete(node, key);
        }
      }
      
      this._delete(node.children[i], key);
    }
  }

  _predecessor(node) {
    while (!node.leaf) node = node.children[node.children.length - 1];
    const i = node.keys.length - 1;
    return [node.keys[i], node.values[i]];
  }

  _successor(node) {
    while (!node.leaf) node = node.children[0];
    return [node.keys[0], node.values[0]];
  }

  _mergeChildren(node, i) {
    const left = node.children[i];
    const right = node.children[i + 1];
    
    // Move key from parent down to left child
    left.keys.push(node.keys[i]);
    left.values.push(node.values[i]);
    
    // Move all keys from right to left
    left.keys.push(...right.keys);
    left.values.push(...right.values);
    if (!left.leaf) left.children.push(...right.children);
    
    // Remove key and right child from parent
    node.keys.splice(i, 1);
    node.values.splice(i, 1);
    node.children.splice(i + 1, 1);
  }

  _fillChild(node, i) {
    const t = this.t;
    
    // Try borrowing from left sibling
    if (i > 0 && node.children[i - 1].keys.length >= t) {
      this._borrowFromLeft(node, i);
    }
    // Try borrowing from right sibling
    else if (i < node.children.length - 1 && node.children[i + 1].keys.length >= t) {
      this._borrowFromRight(node, i);
    }
    // Merge with a sibling
    else {
      if (i < node.children.length - 1) {
        this._mergeChildren(node, i);
      } else {
        this._mergeChildren(node, i - 1);
      }
    }
  }

  _borrowFromLeft(node, i) {
    const child = node.children[i];
    const leftSibling = node.children[i - 1];
    
    // Move parent key down to child
    child.keys.unshift(node.keys[i - 1]);
    child.values.unshift(node.values[i - 1]);
    
    // Move last key of left sibling up to parent
    node.keys[i - 1] = leftSibling.keys.pop();
    node.values[i - 1] = leftSibling.values.pop();
    
    // Move last child of left sibling to child
    if (!child.leaf) {
      child.children.unshift(leftSibling.children.pop());
    }
  }

  _borrowFromRight(node, i) {
    const child = node.children[i];
    const rightSibling = node.children[i + 1];
    
    // Move parent key down to child
    child.keys.push(node.keys[i]);
    child.values.push(node.values[i]);
    
    // Move first key of right sibling up to parent
    node.keys[i] = rightSibling.keys.shift();
    node.values[i] = rightSibling.values.shift();
    
    // Move first child of right sibling to child
    if (!child.leaf) {
      child.children.push(rightSibling.children.shift());
    }
  }

  // ===== Traversal =====
  
  // In-order traversal: yields [key, value] pairs in sorted order
  *entries() {
    yield* this._traverse(this.root);
  }

  *_traverse(node) {
    for (let i = 0; i < node.keys.length; i++) {
      if (!node.leaf) yield* this._traverse(node.children[i]);
      yield [node.keys[i], node.values[i]];
    }
    if (!node.leaf && node.children.length > node.keys.length) {
      yield* this._traverse(node.children[node.keys.length]);
    }
  }

  keys() { return [...this.entries()].map(([k]) => k); }
  values() { return [...this.entries()].map(([, v]) => v); }

  // Range query: keys in [low, high]
  range(low, high) {
    const result = [];
    this._rangeSearch(this.root, low, high, result);
    return result;
  }

  _rangeSearch(node, low, high, result) {
    let i = 0;
    while (i < node.keys.length && node.keys[i] < low) {
      if (!node.leaf) this._rangeSearch(node.children[i], low, high, result);
      i++;
    }
    
    while (i < node.keys.length && node.keys[i] <= high) {
      if (!node.leaf) this._rangeSearch(node.children[i], low, high, result);
      result.push([node.keys[i], node.values[i]]);
      i++;
    }
    
    if (!node.leaf && i < node.children.length) {
      this._rangeSearch(node.children[i], low, high, result);
    }
  }

  // Min and max
  min() {
    if (this._size === 0) return undefined;
    let node = this.root;
    while (!node.leaf) node = node.children[0];
    return [node.keys[0], node.values[0]];
  }

  max() {
    if (this._size === 0) return undefined;
    let node = this.root;
    while (!node.leaf) node = node.children[node.children.length - 1];
    return [node.keys[node.keys.length - 1], node.values[node.values.length - 1]];
  }

  // Height
  get height() {
    let h = 0;
    let node = this.root;
    while (!node.leaf) { h++; node = node.children[0]; }
    return h;
  }
}
