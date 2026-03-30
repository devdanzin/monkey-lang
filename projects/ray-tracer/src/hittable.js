// hittable.js — Abstract hit interface + hit record

export class HitRecord {
  constructor() {
    this.p = null;       // Point of intersection
    this.normal = null;  // Surface normal (always faces against the ray)
    this.t = 0;          // Parameter along the ray
    this.frontFace = true;
    this.material = null;
  }

  setFaceNormal(ray, outwardNormal) {
    this.frontFace = ray.direction.dot(outwardNormal) < 0;
    this.normal = this.frontFace ? outwardNormal : outwardNormal.negate();
  }
}

export class HittableList {
  constructor() {
    this.objects = [];
  }

  add(object) {
    this.objects.push(object);
  }

  hit(ray, tMin, tMax) {
    let closestSoFar = tMax;
    let hitAnything = null;

    for (const object of this.objects) {
      const rec = object.hit(ray, tMin, closestSoFar);
      if (rec) {
        closestSoFar = rec.t;
        hitAnything = rec;
      }
    }

    return hitAnything;
  }
}
