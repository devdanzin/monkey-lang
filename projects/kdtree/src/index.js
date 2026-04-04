// ===== k-d Tree =====
// Space-partitioning tree for multi-dimensional point queries

class KDNode {
  constructor(point, data = null, axis = 0) {
    this.point = point;
    this.data = data;
    this.axis = axis;
    this.left = null;
    this.right = null;
  }
}

export class KDTree {
  constructor(dimensions = 2) {
    this.dimensions = dimensions;
    this.root = null;
    this._size = 0;
  }

  get size() { return this._size; }

  insert(point, data = null) {
    this.root = this._insert(this.root, point, data, 0);
    this._size++;
  }

  _insert(node, point, data, depth) {
    if (!node) return new KDNode(point, data, depth % this.dimensions);
    
    const axis = node.axis;
    if (point[axis] < node.point[axis]) {
      node.left = this._insert(node.left, point, data, depth + 1);
    } else {
      node.right = this._insert(node.right, point, data, depth + 1);
    }
    return node;
  }

  // Build balanced tree from points
  static fromPoints(points, dimensions = 2) {
    const tree = new KDTree(dimensions);
    tree.root = tree._buildBalanced([...points.map((p, i) => ({ point: Array.isArray(p) ? p : p.point, data: p.data ?? null, index: i }))], 0);
    tree._size = points.length;
    return tree;
  }

  _buildBalanced(items, depth) {
    if (items.length === 0) return null;
    const axis = depth % this.dimensions;
    items.sort((a, b) => a.point[axis] - b.point[axis]);
    const mid = items.length >> 1;
    const node = new KDNode(items[mid].point, items[mid].data, axis);
    node.left = this._buildBalanced(items.slice(0, mid), depth + 1);
    node.right = this._buildBalanced(items.slice(mid + 1), depth + 1);
    return node;
  }

  // Nearest neighbor search
  nearest(target, k = 1) {
    const best = []; // [{point, data, dist}] sorted by distance desc
    this._nearest(this.root, target, k, best);
    return best.sort((a, b) => a.dist - b.dist);
  }

  _nearest(node, target, k, best) {
    if (!node) return;
    
    const dist = this._distance(node.point, target);
    
    if (best.length < k) {
      best.push({ point: node.point, data: node.data, dist });
      best.sort((a, b) => b.dist - a.dist);
    } else if (dist < best[0].dist) {
      best[0] = { point: node.point, data: node.data, dist };
      best.sort((a, b) => b.dist - a.dist);
    }
    
    const axis = node.axis;
    const diff = target[axis] - node.point[axis];
    
    const near = diff < 0 ? node.left : node.right;
    const far = diff < 0 ? node.right : node.left;
    
    this._nearest(near, target, k, best);
    
    // Check if we need to search the other side
    if (best.length < k || Math.abs(diff) < best[0].dist) {
      this._nearest(far, target, k, best);
    }
  }

  // Range search: find all points within radius of target
  rangeSearch(target, radius) {
    const results = [];
    this._rangeSearch(this.root, target, radius, results);
    return results;
  }

  _rangeSearch(node, target, radius, results) {
    if (!node) return;
    
    const dist = this._distance(node.point, target);
    if (dist <= radius) {
      results.push({ point: node.point, data: node.data, dist });
    }
    
    const axis = node.axis;
    const diff = target[axis] - node.point[axis];
    
    if (diff - radius <= 0) this._rangeSearch(node.left, target, radius, results);
    if (diff + radius >= 0) this._rangeSearch(node.right, target, radius, results);
  }

  // Rectangular range search
  rectSearch(min, max) {
    const results = [];
    this._rectSearch(this.root, min, max, results);
    return results;
  }

  _rectSearch(node, min, max, results) {
    if (!node) return;
    
    let inRange = true;
    for (let i = 0; i < this.dimensions; i++) {
      if (node.point[i] < min[i] || node.point[i] > max[i]) { inRange = false; break; }
    }
    if (inRange) results.push({ point: node.point, data: node.data });
    
    const axis = node.axis;
    if (min[axis] <= node.point[axis]) this._rectSearch(node.left, min, max, results);
    if (max[axis] >= node.point[axis]) this._rectSearch(node.right, min, max, results);
  }

  _distance(a, b) {
    let sum = 0;
    for (let i = 0; i < this.dimensions; i++) sum += (a[i] - b[i]) ** 2;
    return Math.sqrt(sum);
  }
}
