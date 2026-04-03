/**
 * Vec2 — 2D vector math
 */
class Vec2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  add(v) { return new Vec2(this.x + v.x, this.y + v.y); }
  sub(v) { return new Vec2(this.x - v.x, this.y - v.y); }
  mul(s) { return new Vec2(this.x * s, this.y * s); }
  div(s) { return new Vec2(this.x / s, this.y / s); }
  dot(v) { return this.x * v.x + this.y * v.y; }
  
  length() { return Math.sqrt(this.x * this.x + this.y * this.y); }
  lengthSq() { return this.x * this.x + this.y * this.y; }
  
  normalize() {
    const len = this.length();
    return len > 0 ? this.div(len) : new Vec2(0, 0);
  }

  limit(max) {
    const lenSq = this.lengthSq();
    if (lenSq > max * max) {
      return this.normalize().mul(max);
    }
    return this;
  }

  dist(v) { return this.sub(v).length(); }
  distSq(v) { return this.sub(v).lengthSq(); }

  angle() { return Math.atan2(this.y, this.x); }
  
  rotate(angle) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return new Vec2(this.x * cos - this.y * sin, this.x * sin + this.y * cos);
  }

  clone() { return new Vec2(this.x, this.y); }
  
  static fromAngle(angle, length = 1) {
    return new Vec2(Math.cos(angle) * length, Math.sin(angle) * length);
  }

  static random(maxX = 1, maxY = maxX) {
    return new Vec2(Math.random() * maxX, Math.random() * maxY);
  }
}

module.exports = { Vec2 };
