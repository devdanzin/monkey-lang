/**
 * Boid — an individual agent in the flock
 */
const { Vec2 } = require('./vec2.js');

class Boid {
  constructor(x, y, vx = 0, vy = 0) {
    this.position = new Vec2(x, y);
    this.velocity = new Vec2(vx, vy);
    this.acceleration = new Vec2(0, 0);
  }

  applyForce(force) {
    this.acceleration = this.acceleration.add(force);
  }

  update(maxSpeed = 4, dt = 1) {
    this.velocity = this.velocity.add(this.acceleration.mul(dt));
    this.velocity = this.velocity.limit(maxSpeed);
    this.position = this.position.add(this.velocity.mul(dt));
    this.acceleration = new Vec2(0, 0);
  }

  wrapEdges(width, height) {
    if (this.position.x > width) this.position.x -= width;
    if (this.position.x < 0) this.position.x += width;
    if (this.position.y > height) this.position.y -= height;
    if (this.position.y < 0) this.position.y += height;
  }

  heading() {
    return this.velocity.angle();
  }
}

module.exports = { Boid };
