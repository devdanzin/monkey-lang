// ===== Red-Black Tree =====
// Properties:
// 1. Every node is red or black
// 2. Root is black
// 3. Every leaf (NIL) is black
// 4. Red node has only black children
// 5. All paths from node to descendant leaves have same # black nodes

const RED = 0;
const BLACK = 1;

class RBNode {
  constructor(key, value = key) {
    this.key = key;
    this.value = value;
    this.color = RED;
    this.left = null;
    this.right = null;
    this.parent = null;
  }
}

export class RedBlackTree {
  constructor(comparator = (a, b) => a < b ? -1 : a > b ? 1 : 0) {
    this.NIL = new RBNode(null, null);
    this.NIL.color = BLACK;
    this.root = this.NIL;
    this.size = 0;
    this.compare = comparator;
  }

  // ===== Rotations =====
  _rotateLeft(x) {
    const y = x.right;
    x.right = y.left;
    if (y.left !== this.NIL) y.left.parent = x;
    y.parent = x.parent;
    if (x.parent === null) this.root = y;
    else if (x === x.parent.left) x.parent.left = y;
    else x.parent.right = y;
    y.left = x;
    x.parent = y;
  }

  _rotateRight(x) {
    const y = x.left;
    x.left = y.right;
    if (y.right !== this.NIL) y.right.parent = x;
    y.parent = x.parent;
    if (x.parent === null) this.root = y;
    else if (x === x.parent.right) x.parent.right = y;
    else x.parent.left = y;
    y.right = x;
    x.parent = y;
  }

  // ===== Insert =====
  insert(key, value = key) {
    const node = new RBNode(key, value);
    node.left = this.NIL;
    node.right = this.NIL;

    let parent = null;
    let current = this.root;

    while (current !== this.NIL) {
      parent = current;
      const cmp = this.compare(key, current.key);
      if (cmp < 0) current = current.left;
      else if (cmp > 0) current = current.right;
      else { current.value = value; return; } // update existing
    }

    node.parent = parent;
    if (parent === null) this.root = node;
    else if (this.compare(key, parent.key) < 0) parent.left = node;
    else parent.right = node;

    this.size++;
    this._insertFixup(node);
  }

  _insertFixup(z) {
    while (z.parent && z.parent.color === RED) {
      if (z.parent === z.parent.parent?.left) {
        const uncle = z.parent.parent.right;
        if (uncle && uncle.color === RED) {
          // Case 1: uncle is red
          z.parent.color = BLACK;
          uncle.color = BLACK;
          z.parent.parent.color = RED;
          z = z.parent.parent;
        } else {
          if (z === z.parent.right) {
            // Case 2: z is right child
            z = z.parent;
            this._rotateLeft(z);
          }
          // Case 3: z is left child
          z.parent.color = BLACK;
          z.parent.parent.color = RED;
          this._rotateRight(z.parent.parent);
        }
      } else {
        // Mirror cases
        const uncle = z.parent.parent?.left;
        if (uncle && uncle.color === RED) {
          z.parent.color = BLACK;
          uncle.color = BLACK;
          z.parent.parent.color = RED;
          z = z.parent.parent;
        } else {
          if (z === z.parent.left) {
            z = z.parent;
            this._rotateRight(z);
          }
          z.parent.color = BLACK;
          z.parent.parent.color = RED;
          this._rotateLeft(z.parent.parent);
        }
      }
    }
    this.root.color = BLACK;
  }

  // ===== Search =====
  find(key) {
    let node = this.root;
    while (node !== this.NIL) {
      const cmp = this.compare(key, node.key);
      if (cmp === 0) return node.value;
      node = cmp < 0 ? node.left : node.right;
    }
    return undefined;
  }

  has(key) { return this.find(key) !== undefined; }

  // ===== Min/Max =====
  _minimum(node) {
    while (node.left !== this.NIL) node = node.left;
    return node;
  }

  _maximum(node) {
    while (node.right !== this.NIL) node = node.right;
    return node;
  }

  min() { return this.root === this.NIL ? undefined : this._minimum(this.root).key; }
  max() { return this.root === this.NIL ? undefined : this._maximum(this.root).key; }

  // ===== Delete =====
  delete(key) {
    let z = this.root;
    while (z !== this.NIL) {
      const cmp = this.compare(key, z.key);
      if (cmp === 0) break;
      z = cmp < 0 ? z.left : z.right;
    }
    if (z === this.NIL) return false;

    let y = z;
    let yOriginalColor = y.color;
    let x;

    if (z.left === this.NIL) {
      x = z.right;
      this._transplant(z, z.right);
    } else if (z.right === this.NIL) {
      x = z.left;
      this._transplant(z, z.left);
    } else {
      y = this._minimum(z.right);
      yOriginalColor = y.color;
      x = y.right;
      if (y.parent === z) {
        x.parent = y;
      } else {
        this._transplant(y, y.right);
        y.right = z.right;
        y.right.parent = y;
      }
      this._transplant(z, y);
      y.left = z.left;
      y.left.parent = y;
      y.color = z.color;
    }

    this.size--;
    if (yOriginalColor === BLACK) this._deleteFixup(x);
    return true;
  }

  _transplant(u, v) {
    if (u.parent === null) this.root = v;
    else if (u === u.parent.left) u.parent.left = v;
    else u.parent.right = v;
    v.parent = u.parent;
  }

  _deleteFixup(x) {
    while (x !== this.root && x.color === BLACK) {
      if (x === x.parent.left) {
        let w = x.parent.right;
        if (w.color === RED) {
          w.color = BLACK;
          x.parent.color = RED;
          this._rotateLeft(x.parent);
          w = x.parent.right;
        }
        if (w.left.color === BLACK && w.right.color === BLACK) {
          w.color = RED;
          x = x.parent;
        } else {
          if (w.right.color === BLACK) {
            w.left.color = BLACK;
            w.color = RED;
            this._rotateRight(w);
            w = x.parent.right;
          }
          w.color = x.parent.color;
          x.parent.color = BLACK;
          w.right.color = BLACK;
          this._rotateLeft(x.parent);
          x = this.root;
        }
      } else {
        let w = x.parent.left;
        if (w.color === RED) {
          w.color = BLACK;
          x.parent.color = RED;
          this._rotateRight(x.parent);
          w = x.parent.left;
        }
        if (w.right.color === BLACK && w.left.color === BLACK) {
          w.color = RED;
          x = x.parent;
        } else {
          if (w.left.color === BLACK) {
            w.right.color = BLACK;
            w.color = RED;
            this._rotateLeft(w);
            w = x.parent.left;
          }
          w.color = x.parent.color;
          x.parent.color = BLACK;
          w.left.color = BLACK;
          this._rotateRight(x.parent);
          x = this.root;
        }
      }
    }
    x.color = BLACK;
  }

  // ===== Traversal =====
  inOrder() {
    const result = [];
    const traverse = (node) => {
      if (node === this.NIL) return;
      traverse(node.left);
      result.push(node.key);
      traverse(node.right);
    };
    traverse(this.root);
    return result;
  }

  // ===== Verify RB Properties =====
  verify() {
    if (this.root === this.NIL) return { valid: true, blackHeight: 0 };
    
    // Property 2: root is black
    if (this.root.color !== BLACK) return { valid: false, violation: 'Root is not black' };
    
    return this._verifyNode(this.root);
  }

  _verifyNode(node) {
    if (node === this.NIL) return { valid: true, blackHeight: 1 };
    
    // Property 4: red node has black children
    if (node.color === RED) {
      if ((node.left !== this.NIL && node.left.color === RED) ||
          (node.right !== this.NIL && node.right.color === RED)) {
        return { valid: false, violation: `Red node ${node.key} has red child` };
      }
    }
    
    // BST property
    if (node.left !== this.NIL && this.compare(node.left.key, node.key) >= 0) {
      return { valid: false, violation: `BST violation at ${node.key}` };
    }
    if (node.right !== this.NIL && this.compare(node.right.key, node.key) <= 0) {
      return { valid: false, violation: `BST violation at ${node.key}` };
    }
    
    const leftResult = this._verifyNode(node.left);
    if (!leftResult.valid) return leftResult;
    
    const rightResult = this._verifyNode(node.right);
    if (!rightResult.valid) return rightResult;
    
    // Property 5: equal black heights
    if (leftResult.blackHeight !== rightResult.blackHeight) {
      return { valid: false, violation: `Black height mismatch at ${node.key}: left=${leftResult.blackHeight}, right=${rightResult.blackHeight}` };
    }
    
    return { 
      valid: true, 
      blackHeight: leftResult.blackHeight + (node.color === BLACK ? 1 : 0)
    };
  }

  // ===== Range query =====
  range(low, high) {
    const result = [];
    const traverse = (node) => {
      if (node === this.NIL) return;
      if (this.compare(node.key, low) >= 0) traverse(node.left);
      if (this.compare(node.key, low) >= 0 && this.compare(node.key, high) <= 0) {
        result.push(node.key);
      }
      if (this.compare(node.key, high) <= 0) traverse(node.right);
    };
    traverse(this.root);
    return result;
  }

  [Symbol.iterator]() {
    const items = this.inOrder();
    let i = 0;
    return { next() { return i < items.length ? { value: items[i++], done: false } : { done: true }; }};
  }
}

export { RED, BLACK };
