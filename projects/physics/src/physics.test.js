import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Vec2, AABB, Circle, Rectangle, Body, detectCollision, resolveCollision, World } from './physics.js';

const approx = (a, b, eps = 0.01) => Math.abs(a - b) < eps;

describe('Vec2', () => {
  it('add', () => { assert.ok(new Vec2(1, 2).add(new Vec2(3, 4)).equals(new Vec2(4, 6))); });
  it('sub', () => { assert.ok(new Vec2(5, 3).sub(new Vec2(2, 1)).equals(new Vec2(3, 2))); });
  it('scale', () => { assert.ok(new Vec2(2, 3).scale(2).equals(new Vec2(4, 6))); });
  it('dot', () => { assert.equal(new Vec2(1, 0).dot(new Vec2(0, 1)), 0); });
  it('cross', () => { assert.equal(new Vec2(1, 0).cross(new Vec2(0, 1)), 1); });
  it('length', () => { assert.ok(approx(new Vec2(3, 4).length(), 5)); });
  it('normalize', () => { assert.ok(approx(new Vec2(3, 4).normalize().length(), 1)); });
  it('perp', () => { assert.ok(new Vec2(1, 0).perp().equals(new Vec2(0, 1))); });
  it('rotate', () => {
    const v = new Vec2(1, 0).rotate(Math.PI / 2);
    assert.ok(approx(v.x, 0) && approx(v.y, 1));
  });
  it('distTo', () => { assert.ok(approx(new Vec2(0, 0).distTo(new Vec2(3, 4)), 5)); });
});

describe('AABB', () => {
  it('intersects', () => {
    const a = new AABB(new Vec2(0, 0), new Vec2(2, 2));
    const b = new AABB(new Vec2(1, 1), new Vec2(3, 3));
    assert.ok(a.intersects(b));
  });
  it('does not intersect', () => {
    const a = new AABB(new Vec2(0, 0), new Vec2(1, 1));
    const b = new AABB(new Vec2(5, 5), new Vec2(6, 6));
    assert.ok(!a.intersects(b));
  });
  it('contains point', () => {
    const box = new AABB(new Vec2(0, 0), new Vec2(10, 10));
    assert.ok(box.contains(new Vec2(5, 5)));
    assert.ok(!box.contains(new Vec2(15, 5)));
  });
});

describe('Shapes', () => {
  it('circle AABB', () => {
    const c = new Circle(5);
    const aabb = c.getAABB(new Vec2(10, 10));
    assert.equal(aabb.min.x, 5);
    assert.equal(aabb.max.x, 15);
  });
  it('circle area', () => { assert.ok(approx(new Circle(1).area(), Math.PI)); });
  it('rectangle AABB', () => {
    const r = new Rectangle(4, 6);
    const aabb = r.getAABB(new Vec2(10, 10));
    assert.equal(aabb.min.x, 8);
    assert.equal(aabb.max.x, 12);
  });
  it('rectangle area', () => { assert.equal(new Rectangle(3, 4).area(), 12); });
  it('rectangle vertices', () => {
    const r = new Rectangle(2, 2);
    const verts = r.getWorldVertices(new Vec2(0, 0));
    assert.equal(verts.length, 4);
  });
});

describe('Collision Detection', () => {
  it('circle vs circle: colliding', () => {
    const a = new Body(new Circle(1), 0, 0);
    const b = new Body(new Circle(1), 1.5, 0);
    const col = detectCollision(a, b);
    assert.ok(col);
    assert.ok(col.depth > 0);
  });

  it('circle vs circle: not colliding', () => {
    const a = new Body(new Circle(1), 0, 0);
    const b = new Body(new Circle(1), 5, 0);
    assert.equal(detectCollision(a, b), null);
  });

  it('rect vs rect: colliding (SAT)', () => {
    const a = new Body(new Rectangle(2, 2), 0, 0);
    const b = new Body(new Rectangle(2, 2), 1.5, 0);
    const col = detectCollision(a, b);
    assert.ok(col);
    assert.ok(col.depth > 0);
  });

  it('rect vs rect: not colliding', () => {
    const a = new Body(new Rectangle(2, 2), 0, 0);
    const b = new Body(new Rectangle(2, 2), 10, 0);
    assert.equal(detectCollision(a, b), null);
  });

  it('circle vs rect: colliding', () => {
    const a = new Body(new Circle(1), 0, 0);
    const b = new Body(new Rectangle(2, 2), 1.5, 0);
    const col = detectCollision(a, b);
    assert.ok(col);
  });
});

describe('Collision Resolution', () => {
  it('separates overlapping circles', () => {
    const a = new Body(new Circle(1), 0, 0);
    const b = new Body(new Circle(1), 1, 0);
    const col = detectCollision(a, b);
    resolveCollision(col);
    const dist = a.position.distTo(b.position);
    assert.ok(dist >= 1.99); // should be separated to ~2
  });

  it('bounces circles apart', () => {
    const a = new Body(new Circle(1), 0, 0);
    const b = new Body(new Circle(1), 1.5, 0);
    a.velocity = new Vec2(1, 0);
    b.velocity = new Vec2(-1, 0);
    const col = detectCollision(a, b);
    resolveCollision(col);
    // After collision, velocities should reverse (or slow down)
    assert.ok(a.velocity.x <= 0);
    assert.ok(b.velocity.x >= 0);
  });

  it('static body does not move', () => {
    const ground = new Body(new Rectangle(100, 1), 0, 5, 0); // mass=0 → static
    const ball = new Body(new Circle(1), 0, 4.2);
    const col = detectCollision(ball, ground);
    if (col) resolveCollision(col);
    assert.equal(ground.position.y, 5); // unchanged
  });
});

describe('World', () => {
  it('creates world with gravity', () => {
    const world = new World();
    assert.ok(world.gravity.y > 0);
  });

  it('adds and removes bodies', () => {
    const world = new World();
    const b = world.addBody(new Body(new Circle(1)));
    assert.equal(world.bodies.length, 1);
    world.removeBody(b);
    assert.equal(world.bodies.length, 0);
  });

  it('gravity accelerates bodies', () => {
    const world = new World(new Vec2(0, 10));
    const ball = world.addBody(new Body(new Circle(1), 0, 0));
    world.step(1);
    assert.ok(ball.velocity.y > 0);
    assert.ok(ball.position.y > 0);
  });

  it('ball bounces off ground', () => {
    const world = new World(new Vec2(0, 10));
    const ball = world.addBody(new Body(new Circle(0.5), 0, 0));
    const ground = world.addBody(new Body(new Rectangle(20, 1), 0, 5, 0));
    // Simulate several frames
    for (let i = 0; i < 100; i++) world.step(0.016);
    // Ball should not pass through ground
    assert.ok(ball.position.y < 5.5);
  });

  it('static body stays still', () => {
    const world = new World(new Vec2(0, 10));
    const ground = world.addBody(new Body(new Rectangle(20, 1), 0, 10, 0));
    world.step(1);
    assert.equal(ground.position.x, 0);
    assert.equal(ground.position.y, 10);
  });

  it('applies external forces', () => {
    const world = new World(new Vec2(0, 0)); // no gravity
    const body = world.addBody(new Body(new Circle(1), 0, 0, 1));
    body.applyForce(new Vec2(10, 0));
    world.step(1);
    assert.ok(body.velocity.x > 0);
  });
});
