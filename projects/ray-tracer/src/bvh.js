// bvh.js — Bounding Volume Hierarchy for O(log n) ray intersection
// Supports SAH (Surface Area Heuristic) for optimal construction.

import { AABB } from './aabb.js';

export class BVHNode {
  constructor(objects, start = 0, end = objects.length, useSAH = true) {
    const span = end - start;

    if (span === 1) {
      this.left = this.right = objects[start];
    } else if (span === 2) {
      this.left = objects[start];
      this.right = objects[start + 1];
    } else if (useSAH && span <= 256) {
      // Use SAH for small-to-medium groups
      this._buildSAH(objects, start, end);
    } else {
      // Fallback to median split for very large groups
      this._buildMedian(objects, start, end, useSAH);
    }

    const boxLeft = this.left?.boundingBox ? this.left.boundingBox() : null;
    const boxRight = this.right?.boundingBox ? this.right.boundingBox() : null;

    if (boxLeft && boxRight) {
      this.box = AABB.surrounding(boxLeft, boxRight);
    } else if (boxLeft) {
      this.box = boxLeft;
    } else if (boxRight) {
      this.box = boxRight;
    } else {
      this.box = null;
    }
  }

  _buildSAH(objects, start, end) {
    const span = end - start;
    const slice = objects.slice(start, end);
    
    // Compute bounding box for all objects
    let parentBox = null;
    for (const obj of slice) {
      const box = obj.boundingBox();
      if (box) parentBox = parentBox ? AABB.surrounding(parentBox, box) : box;
    }
    
    if (!parentBox) {
      this._buildMedian(objects, start, end, false);
      return;
    }
    
    const parentSA = surfaceArea(parentBox);
    if (parentSA <= 0) {
      this._buildMedian(objects, start, end, false);
      return;
    }
    
    let bestCost = Infinity;
    let bestAxis = 0;
    let bestSplit = Math.floor(span / 2);
    
    // Try each axis
    for (let axis = 0; axis < 3; axis++) {
      const comp = ['x', 'y', 'z'][axis];
      
      // Sort by centroid on this axis
      const sorted = [...slice].sort((a, b) => {
        const boxA = a.boundingBox();
        const boxB = b.boundingBox();
        if (!boxA || !boxB) return 0;
        const centA = (boxA.minimum[comp] + boxA.maximum[comp]) * 0.5;
        const centB = (boxB.minimum[comp] + boxB.maximum[comp]) * 0.5;
        return centA - centB;
      });
      
      // Try multiple split positions (use buckets for efficiency)
      const numBuckets = Math.min(12, span);
      for (let i = 1; i < numBuckets; i++) {
        const splitIdx = Math.floor(i * span / numBuckets);
        if (splitIdx === 0 || splitIdx === span) continue;
        
        // Compute bounding boxes for left and right
        let leftBox = null, rightBox = null;
        for (let j = 0; j < splitIdx; j++) {
          const box = sorted[j].boundingBox();
          if (box) leftBox = leftBox ? AABB.surrounding(leftBox, box) : box;
        }
        for (let j = splitIdx; j < span; j++) {
          const box = sorted[j].boundingBox();
          if (box) rightBox = rightBox ? AABB.surrounding(rightBox, box) : box;
        }
        
        if (!leftBox || !rightBox) continue;
        
        // SAH cost: SA_left/SA_parent * N_left + SA_right/SA_parent * N_right + traverse_cost
        const cost = (surfaceArea(leftBox) / parentSA) * splitIdx +
                     (surfaceArea(rightBox) / parentSA) * (span - splitIdx) +
                     0.125; // traversal cost (empirical)
        
        if (cost < bestCost) {
          bestCost = cost;
          bestAxis = axis;
          bestSplit = splitIdx;
        }
      }
    }
    
    // Sort by best axis and split
    const comp = ['x', 'y', 'z'][bestAxis];
    slice.sort((a, b) => {
      const boxA = a.boundingBox();
      const boxB = b.boundingBox();
      if (!boxA || !boxB) return 0;
      return (boxA.minimum[comp] + boxA.maximum[comp]) - (boxB.minimum[comp] + boxB.maximum[comp]);
    });
    
    for (let i = 0; i < slice.length; i++) objects[start + i] = slice[i];
    
    const mid = start + bestSplit;
    this.left = new BVHNode(objects, start, mid, true);
    this.right = new BVHNode(objects, mid, end, true);
  }

  _buildMedian(objects, start, end, useSAH) {
    const span = end - start;
    // Choose axis with largest extent
    let parentBox = null;
    for (let i = start; i < end; i++) {
      const box = objects[i].boundingBox();
      if (box) parentBox = parentBox ? AABB.surrounding(parentBox, box) : box;
    }
    
    let axis;
    if (parentBox) {
      const dx = parentBox.maximum.x - parentBox.minimum.x;
      const dy = parentBox.maximum.y - parentBox.minimum.y;
      const dz = parentBox.maximum.z - parentBox.minimum.z;
      axis = dx > dy ? (dx > dz ? 0 : 2) : (dy > dz ? 1 : 2);
    } else {
      axis = Math.floor(Math.random() * 3);
    }
    
    const comp = ['x', 'y', 'z'][axis];
    const slice = objects.slice(start, end);
    slice.sort((a, b) => {
      const boxA = a.boundingBox();
      const boxB = b.boundingBox();
      if (!boxA || !boxB) return 0;
      return boxA.minimum[comp] - boxB.minimum[comp];
    });
    for (let i = 0; i < slice.length; i++) objects[start + i] = slice[i];

    const mid = start + Math.floor(span / 2);
    this.left = new BVHNode(objects, start, mid, useSAH);
    this.right = new BVHNode(objects, mid, end, useSAH);
  }

  hit(ray, tMin, tMax) {
    if (!this.box || !this.box.hit(ray, tMin, tMax)) return null;

    const hitLeft = this.left.hit(ray, tMin, tMax);
    const hitRight = this.right.hit(ray, tMin, hitLeft ? hitLeft.t : tMax);

    return hitRight || hitLeft;
  }

  boundingBox() {
    return this.box;
  }
}

function surfaceArea(box) {
  const dx = box.maximum.x - box.minimum.x;
  const dy = box.maximum.y - box.minimum.y;
  const dz = box.maximum.z - box.minimum.z;
  return 2 * (dx * dy + dy * dz + dz * dx);
}
