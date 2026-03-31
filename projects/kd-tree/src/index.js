/**
 * Tiny K-D Tree — k-dimensional spatial search
 * 
 * - Build from points
 * - Nearest neighbor search
 * - K-nearest neighbors
 * - Range search (rectangular)
 * - Radius search (circular)
 */

class KDNode {
  constructor(point, left = null, right = null, axis = 0) {
    this.point = point;
    this.left = left;
    this.right = right;
    this.axis = axis;
  }
}

class KDTree {
  constructor(points = [], dimensions = null) {
    this.dimensions = dimensions || (points.length > 0 ? points[0].length : 2);
    this.root = points.length > 0 ? this._build(points, 0) : null;
    this.size = points.length;
  }

  _build(points, depth) {
    if (points.length === 0) return null;
    const axis = depth % this.dimensions;
    points.sort((a, b) => a[axis] - b[axis]);
    const mid = Math.floor(points.length / 2);
    return new KDNode(
      points[mid],
      this._build(points.slice(0, mid), depth + 1),
      this._build(points.slice(mid + 1), depth + 1),
      axis
    );
  }

  _dist(a, b) {
    let sum = 0;
    for (let i = 0; i < this.dimensions; i++) {
      sum += (a[i] - b[i]) ** 2;
    }
    return sum;
  }

  nearest(target) {
    if (!this.root) return null;
    let best = { point: null, dist: Infinity };
    this._nearestHelper(this.root, target, best);
    return best.point;
  }

  _nearestHelper(node, target, best) {
    if (!node) return;
    const d = this._dist(node.point, target);
    if (d < best.dist) {
      best.dist = d;
      best.point = node.point;
    }

    const axis = node.axis;
    const diff = target[axis] - node.point[axis];
    const close = diff < 0 ? node.left : node.right;
    const far = diff < 0 ? node.right : node.left;

    this._nearestHelper(close, target, best);
    if (diff * diff < best.dist) {
      this._nearestHelper(far, target, best);
    }
  }

  kNearest(target, k) {
    if (!this.root) return [];
    const heap = []; // max-heap by distance
    this._kNearestHelper(this.root, target, k, heap);
    return heap.sort((a, b) => a.dist - b.dist).map(h => h.point);
  }

  _kNearestHelper(node, target, k, heap) {
    if (!node) return;
    const d = this._dist(node.point, target);
    
    if (heap.length < k) {
      heap.push({ point: node.point, dist: d });
      heap.sort((a, b) => b.dist - a.dist); // max-heap
    } else if (d < heap[0].dist) {
      heap[0] = { point: node.point, dist: d };
      heap.sort((a, b) => b.dist - a.dist);
    }

    const axis = node.axis;
    const diff = target[axis] - node.point[axis];
    const close = diff < 0 ? node.left : node.right;
    const far = diff < 0 ? node.right : node.left;

    this._kNearestHelper(close, target, k, heap);
    const worstDist = heap.length < k ? Infinity : heap[0].dist;
    if (diff * diff < worstDist) {
      this._kNearestHelper(far, target, k, heap);
    }
  }

  rangeSearch(min, max) {
    const results = [];
    this._rangeHelper(this.root, min, max, results);
    return results;
  }

  _rangeHelper(node, min, max, results) {
    if (!node) return;
    let inside = true;
    for (let i = 0; i < this.dimensions; i++) {
      if (node.point[i] < min[i] || node.point[i] > max[i]) { inside = false; break; }
    }
    if (inside) results.push(node.point);

    const axis = node.axis;
    if (min[axis] <= node.point[axis]) this._rangeHelper(node.left, min, max, results);
    if (max[axis] >= node.point[axis]) this._rangeHelper(node.right, min, max, results);
  }

  radiusSearch(center, radius) {
    const results = [];
    const r2 = radius * radius;
    this._radiusHelper(this.root, center, r2, results);
    return results;
  }

  _radiusHelper(node, center, r2, results) {
    if (!node) return;
    if (this._dist(node.point, center) <= r2) {
      results.push(node.point);
    }
    const axis = node.axis;
    const diff = center[axis] - node.point[axis];
    const close = diff < 0 ? node.left : node.right;
    const far = diff < 0 ? node.right : node.left;
    this._radiusHelper(close, center, r2, results);
    if (diff * diff <= r2) {
      this._radiusHelper(far, center, r2, results);
    }
  }
}

module.exports = { KDTree };
