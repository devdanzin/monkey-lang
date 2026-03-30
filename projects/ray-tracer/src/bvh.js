// bvh.js — Bounding Volume Hierarchy for O(log n) ray intersection

import { AABB } from './aabb.js';

export class BVHNode {
  constructor(objects, start = 0, end = objects.length) {
    const span = end - start;

    if (span === 1) {
      this.left = this.right = objects[start];
    } else if (span === 2) {
      this.left = objects[start];
      this.right = objects[start + 1];
    } else {
      // Choose random axis to split on
      const axis = Math.floor(Math.random() * 3);
      const comp = axis === 0 ? 'x' : axis === 1 ? 'y' : 'z';

      // Sort objects by their bounding box center on the chosen axis
      const slice = objects.slice(start, end);
      slice.sort((a, b) => {
        const boxA = a.boundingBox();
        const boxB = b.boundingBox();
        if (!boxA || !boxB) return 0;
        return boxA.minimum[comp] - boxB.minimum[comp];
      });

      // Put sorted objects back
      for (let i = 0; i < slice.length; i++) {
        objects[start + i] = slice[i];
      }

      const mid = start + Math.floor(span / 2);
      this.left = new BVHNode(objects, start, mid);
      this.right = new BVHNode(objects, mid, end);
    }

    const boxLeft = this.left.boundingBox ? this.left.boundingBox() : null;
    const boxRight = this.right.boundingBox ? this.right.boundingBox() : null;

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
