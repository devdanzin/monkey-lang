// physics.js — 2D physics engine

// ===== Vector2D =====
export class Vec2 {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }
  add(v) { return new Vec2(this.x + v.x, this.y + v.y); }
  sub(v) { return new Vec2(this.x - v.x, this.y - v.y); }
  scale(s) { return new Vec2(this.x * s, this.y * s); }
  dot(v) { return this.x * v.x + this.y * v.y; }
  cross(v) { return this.x * v.y - this.y * v.x; }
  length() { return Math.sqrt(this.x * this.x + this.y * this.y); }
  lengthSq() { return this.x * this.x + this.y * this.y; }
  normalize() { const l = this.length(); return l > 0 ? this.scale(1 / l) : new Vec2(); }
  negate() { return new Vec2(-this.x, -this.y); }
  perp() { return new Vec2(-this.y, this.x); }
  rotate(angle) {
    const c = Math.cos(angle), s = Math.sin(angle);
    return new Vec2(this.x * c - this.y * s, this.x * s + this.y * c);
  }
  distTo(v) { return this.sub(v).length(); }
  equals(v, eps = 1e-10) { return Math.abs(this.x - v.x) < eps && Math.abs(this.y - v.y) < eps; }
  clone() { return new Vec2(this.x, this.y); }
  static zero() { return new Vec2(0, 0); }
}

// ===== AABB =====
export class AABB {
  constructor(min, max) { this.min = min; this.max = max; }

  intersects(other) {
    return this.min.x <= other.max.x && this.max.x >= other.min.x &&
           this.min.y <= other.max.y && this.max.y >= other.min.y;
  }

  contains(point) {
    return point.x >= this.min.x && point.x <= this.max.x &&
           point.y >= this.min.y && point.y <= this.max.y;
  }

  get center() { return new Vec2((this.min.x + this.max.x) / 2, (this.min.y + this.max.y) / 2); }
  get width() { return this.max.x - this.min.x; }
  get height() { return this.max.y - this.min.y; }
}

// ===== Shapes =====
export class Circle {
  constructor(radius) { this.type = 'circle'; this.radius = radius; }
  getAABB(pos) {
    return new AABB(
      new Vec2(pos.x - this.radius, pos.y - this.radius),
      new Vec2(pos.x + this.radius, pos.y + this.radius)
    );
  }
  area() { return Math.PI * this.radius * this.radius; }
}

export class Rectangle {
  constructor(width, height) {
    this.type = 'rect';
    this.width = width;
    this.height = height;
    this.vertices = [
      new Vec2(-width / 2, -height / 2), new Vec2(width / 2, -height / 2),
      new Vec2(width / 2, height / 2), new Vec2(-width / 2, height / 2),
    ];
  }
  getAABB(pos) {
    return new AABB(
      new Vec2(pos.x - this.width / 2, pos.y - this.height / 2),
      new Vec2(pos.x + this.width / 2, pos.y + this.height / 2)
    );
  }
  getWorldVertices(pos, angle = 0) {
    return this.vertices.map(v => v.rotate(angle).add(pos));
  }
  area() { return this.width * this.height; }
}

// ===== Rigid Body =====
export class Body {
  constructor(shape, x = 0, y = 0, mass = 1) {
    this.shape = shape;
    this.position = new Vec2(x, y);
    this.velocity = Vec2.zero();
    this.acceleration = Vec2.zero();
    this.force = Vec2.zero();
    this.mass = mass;
    this.invMass = mass > 0 ? 1 / mass : 0;
    this.restitution = 0.5; // bounciness
    this.friction = 0.3;
    this.angle = 0;
    this.angularVelocity = 0;
    this.isStatic = mass === 0;
    this.inertia = this._computeInertia();
    this.invInertia = this.inertia > 0 ? 1 / this.inertia : 0;
  }

  _computeInertia() {
    if (this.isStatic) return 0;
    if (this.shape.type === 'circle') return 0.5 * this.mass * this.shape.radius * this.shape.radius;
    if (this.shape.type === 'rect') return this.mass * (this.shape.width ** 2 + this.shape.height ** 2) / 12;
    return 1;
  }

  applyForce(force) { this.force = this.force.add(force); }
  applyImpulse(impulse) { this.velocity = this.velocity.add(impulse.scale(this.invMass)); }

  getAABB() { return this.shape.getAABB(this.position); }
}

// ===== Collision Detection =====
export function detectCollision(a, b) {
  if (a.shape.type === 'circle' && b.shape.type === 'circle') return circleVsCircle(a, b);
  if (a.shape.type === 'rect' && b.shape.type === 'rect') return rectVsRect(a, b);
  if (a.shape.type === 'circle' && b.shape.type === 'rect') return circleVsRect(a, b);
  if (a.shape.type === 'rect' && b.shape.type === 'circle') {
    const result = circleVsRect(b, a);
    if (result) result.normal = result.normal.negate();
    return result;
  }
  return null;
}

function circleVsCircle(a, b) {
  const diff = b.position.sub(a.position);
  const dist = diff.length();
  const totalRadius = a.shape.radius + b.shape.radius;
  if (dist >= totalRadius) return null;
  const normal = dist > 0 ? diff.normalize() : new Vec2(1, 0);
  return { normal, depth: totalRadius - dist, a, b };
}

function circleVsRect(circle, rect) {
  const vertices = rect.shape.getWorldVertices(rect.position, rect.angle);
  let closestDist = Infinity;
  let closestPoint = null;

  // Find closest point on rectangle to circle center
  for (let i = 0; i < vertices.length; i++) {
    const start = vertices[i];
    const end = vertices[(i + 1) % vertices.length];
    const closest = closestPointOnSegment(circle.position, start, end);
    const dist = circle.position.distTo(closest);
    if (dist < closestDist) { closestDist = dist; closestPoint = closest; }
  }

  if (closestDist >= circle.shape.radius) return null;
  const normal = circle.position.sub(closestPoint).normalize();
  return { normal, depth: circle.shape.radius - closestDist, a: circle, b: rect };
}

function closestPointOnSegment(point, a, b) {
  const ab = b.sub(a);
  let t = point.sub(a).dot(ab) / ab.lengthSq();
  t = Math.max(0, Math.min(1, t));
  return a.add(ab.scale(t));
}

function rectVsRect(a, b) {
  // SAT (Separating Axis Theorem)
  const vA = a.shape.getWorldVertices(a.position, a.angle);
  const vB = b.shape.getWorldVertices(b.position, b.angle);
  const axes = getAxes(vA).concat(getAxes(vB));

  let minDepth = Infinity;
  let minAxis = null;

  for (const axis of axes) {
    const [minA, maxA] = project(vA, axis);
    const [minB, maxB] = project(vB, axis);
    const overlap = Math.min(maxA, maxB) - Math.max(minA, minB);
    if (overlap <= 0) return null; // separating axis found
    if (overlap < minDepth) {
      minDepth = overlap;
      minAxis = axis;
    }
  }

  // Ensure normal points from a to b
  const dir = b.position.sub(a.position);
  if (dir.dot(minAxis) < 0) minAxis = minAxis.negate();

  return { normal: minAxis, depth: minDepth, a, b };
}

function getAxes(vertices) {
  const axes = [];
  for (let i = 0; i < vertices.length; i++) {
    const edge = vertices[(i + 1) % vertices.length].sub(vertices[i]);
    axes.push(edge.perp().normalize());
  }
  return axes;
}

function project(vertices, axis) {
  let min = Infinity, max = -Infinity;
  for (const v of vertices) {
    const p = v.dot(axis);
    min = Math.min(min, p);
    max = Math.max(max, p);
  }
  return [min, max];
}

// ===== Impulse Resolution =====
export function resolveCollision(collision) {
  const { normal, depth, a, b } = collision;

  // Separate bodies
  const totalInvMass = a.invMass + b.invMass;
  if (totalInvMass === 0) return;
  const correction = normal.scale(depth / totalInvMass);
  a.position = a.position.sub(correction.scale(a.invMass));
  b.position = b.position.add(correction.scale(b.invMass));

  // Relative velocity
  const relVel = b.velocity.sub(a.velocity);
  const velAlongNormal = relVel.dot(normal);

  // Don't resolve if separating
  if (velAlongNormal > 0) return;

  // Restitution (bounciness)
  const e = Math.min(a.restitution, b.restitution);

  // Impulse magnitude
  const j = -(1 + e) * velAlongNormal / totalInvMass;

  // Apply impulse
  const impulse = normal.scale(j);
  a.velocity = a.velocity.sub(impulse.scale(a.invMass));
  b.velocity = b.velocity.add(impulse.scale(b.invMass));

  // Friction
  const tangent = relVel.sub(normal.scale(velAlongNormal)).normalize();
  const jt = -relVel.dot(tangent) / totalInvMass;
  const mu = Math.sqrt(a.friction * a.friction + b.friction * b.friction);
  const frictionImpulse = Math.abs(jt) < j * mu
    ? tangent.scale(jt) : tangent.scale(-j * mu);
  a.velocity = a.velocity.sub(frictionImpulse.scale(a.invMass));
  b.velocity = b.velocity.add(frictionImpulse.scale(b.invMass));
}

// ===== World =====
export class World {
  constructor(gravity = new Vec2(0, 9.81)) {
    this.gravity = gravity;
    this.bodies = [];
    this.iterations = 1;
  }

  addBody(body) { this.bodies.push(body); return body; }
  removeBody(body) { this.bodies = this.bodies.filter(b => b !== body); }

  step(dt) {
    // Apply gravity and integrate forces
    for (const body of this.bodies) {
      if (body.isStatic) continue;
      body.velocity = body.velocity.add(this.gravity.scale(dt));
      body.velocity = body.velocity.add(body.force.scale(body.invMass * dt));
      body.position = body.position.add(body.velocity.scale(dt));
      body.angle += body.angularVelocity * dt;
      body.force = Vec2.zero();
    }

    // Collision detection and resolution
    for (let iter = 0; iter < this.iterations; iter++) {
      for (let i = 0; i < this.bodies.length; i++) {
        for (let j = i + 1; j < this.bodies.length; j++) {
          // Broad phase: AABB check
          if (!this.bodies[i].getAABB().intersects(this.bodies[j].getAABB())) continue;
          // Narrow phase
          const collision = detectCollision(this.bodies[i], this.bodies[j]);
          if (collision) resolveCollision(collision);
        }
      }
    }
  }
}
