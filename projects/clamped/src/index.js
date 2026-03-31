/**
 * Tiny Clamped Number
 * 
 * Numbers that stay within bounds:
 * - Clamp: value always between min and max
 * - Wrap: value wraps around (like angles 0-360)
 * - Saturating arithmetic: add/sub that clamp at bounds
 * - Percentage: 0-100 clamped
 * - Normalized: 0-1 clamped
 */

class Clamped {
  constructor(value, min = -Infinity, max = Infinity) {
    this.min = min;
    this.max = max;
    this._value = this._clamp(value);
  }

  _clamp(v) { return Math.min(this.max, Math.max(this.min, v)); }
  get value() { return this._value; }
  set value(v) { this._value = this._clamp(v); }

  add(n) { return new Clamped(this._value + n, this.min, this.max); }
  sub(n) { return new Clamped(this._value - n, this.min, this.max); }
  mul(n) { return new Clamped(this._value * n, this.min, this.max); }
  div(n) { return new Clamped(this._value / n, this.min, this.max); }

  lerp(target, t) {
    return new Clamped(this._value + (target - this._value) * t, this.min, this.max);
  }

  normalize() { return (this._value - this.min) / (this.max - this.min); }
  
  isAtMin() { return this._value === this.min; }
  isAtMax() { return this._value === this.max; }
  
  map(fn) { return new Clamped(fn(this._value), this.min, this.max); }
  
  toString() { return String(this._value); }
  valueOf() { return this._value; }
  toJSON() { return { value: this._value, min: this.min, max: this.max }; }

  static percentage(value) { return new Clamped(value, 0, 100); }
  static normalized(value) { return new Clamped(value, 0, 1); }
  static byte(value) { return new Clamped(Math.round(value), 0, 255); }
  static angle(value) { return new Wrapped(value, 0, 360); }
}

class Wrapped {
  constructor(value, min = 0, max = 360) {
    this.min = min;
    this.max = max;
    this._value = this._wrap(value);
  }

  _wrap(v) {
    const range = this.max - this.min;
    if (range <= 0) return this.min;
    let result = ((v - this.min) % range);
    if (result < 0) result += range;
    return result + this.min;
  }

  get value() { return this._value; }
  set value(v) { this._value = this._wrap(v); }

  add(n) { return new Wrapped(this._value + n, this.min, this.max); }
  sub(n) { return new Wrapped(this._value - n, this.min, this.max); }

  distanceTo(target) {
    const range = this.max - this.min;
    const d = this._wrap(target) - this._value;
    if (Math.abs(d) <= range / 2) return d;
    return d > 0 ? d - range : d + range;
  }

  toString() { return String(this._value); }
  valueOf() { return this._value; }
}

module.exports = { Clamped, Wrapped };
