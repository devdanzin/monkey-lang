// vec3.test.js — Tests for Vec3 math and Ray

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Vec3, Point3, Color } from './vec3.js';
import { Ray } from './ray.js';

const EPSILON = 1e-6;
function approx(a, b, msg = '') {
  assert.ok(Math.abs(a - b) < EPSILON, `${msg}: ${a} ≈ ${b} (diff: ${Math.abs(a - b)})`);
}
function vec3Approx(v, x, y, z, msg = '') {
  approx(v.x, x, `${msg} x`);
  approx(v.y, y, `${msg} y`);
  approx(v.z, z, `${msg} z`);
}

describe('Vec3 — Construction', () => {
  it('default constructor', () => {
    const v = new Vec3();
    assert.equal(v.x, 0);
    assert.equal(v.y, 0);
    assert.equal(v.z, 0);
  });

  it('parameterized constructor', () => {
    const v = new Vec3(1, 2, 3);
    assert.equal(v.x, 1);
    assert.equal(v.y, 2);
    assert.equal(v.z, 3);
  });

  it('Vec3.zero()', () => {
    vec3Approx(Vec3.zero(), 0, 0, 0);
  });

  it('Vec3.one()', () => {
    vec3Approx(Vec3.one(), 1, 1, 1);
  });

  it('aliases work', () => {
    assert.equal(Point3, Vec3);
    assert.equal(Color, Vec3);
  });
});

describe('Vec3 — Arithmetic', () => {
  it('add', () => {
    vec3Approx(new Vec3(1, 2, 3).add(new Vec3(4, 5, 6)), 5, 7, 9);
  });

  it('sub', () => {
    vec3Approx(new Vec3(4, 5, 6).sub(new Vec3(1, 2, 3)), 3, 3, 3);
  });

  it('mul scalar', () => {
    vec3Approx(new Vec3(1, 2, 3).mul(2), 2, 4, 6);
  });

  it('mul vector (component-wise)', () => {
    vec3Approx(new Vec3(1, 2, 3).mul(new Vec3(4, 5, 6)), 4, 10, 18);
  });

  it('div', () => {
    vec3Approx(new Vec3(4, 6, 8).div(2), 2, 3, 4);
  });

  it('negate', () => {
    vec3Approx(new Vec3(1, -2, 3).negate(), -1, 2, -3);
  });
});

describe('Vec3 — Dot and Cross', () => {
  it('dot product', () => {
    assert.equal(new Vec3(1, 2, 3).dot(new Vec3(4, 5, 6)), 32);
  });

  it('dot product orthogonal', () => {
    assert.equal(new Vec3(1, 0, 0).dot(new Vec3(0, 1, 0)), 0);
  });

  it('cross product', () => {
    vec3Approx(new Vec3(1, 0, 0).cross(new Vec3(0, 1, 0)), 0, 0, 1);
  });

  it('cross product anti-commutative', () => {
    const a = new Vec3(1, 2, 3);
    const b = new Vec3(4, 5, 6);
    const ab = a.cross(b);
    const ba = b.cross(a);
    vec3Approx(ab.add(ba), 0, 0, 0, 'a×b + b×a = 0');
  });

  it('cross product of parallel vectors is zero', () => {
    vec3Approx(new Vec3(1, 2, 3).cross(new Vec3(2, 4, 6)), 0, 0, 0);
  });
});

describe('Vec3 — Length', () => {
  it('lengthSquared', () => {
    assert.equal(new Vec3(3, 4, 0).lengthSquared(), 25);
  });

  it('length', () => {
    approx(new Vec3(3, 4, 0).length(), 5);
  });

  it('unit vector has length 1', () => {
    approx(new Vec3(3, 4, 0).unit().length(), 1);
  });

  it('unit of zero vector', () => {
    vec3Approx(new Vec3(0, 0, 0).unit(), 0, 0, 0);
  });
});

describe('Vec3 — Reflection & Refraction', () => {
  it('reflects off horizontal surface', () => {
    const v = new Vec3(1, -1, 0).unit();
    const n = new Vec3(0, 1, 0);
    const r = v.reflect(n);
    approx(r.x, v.x, 'x preserved');
    approx(r.y, -v.y, 'y flipped');
  });

  it('normal incidence reflects straight back', () => {
    const v = new Vec3(0, -1, 0);
    const n = new Vec3(0, 1, 0);
    const r = v.reflect(n);
    vec3Approx(r, 0, 1, 0);
  });

  it('refraction at normal incidence', () => {
    const v = new Vec3(0, -1, 0);
    const n = new Vec3(0, 1, 0);
    const r = v.refract(n, 1.0); // same medium
    vec3Approx(r, 0, -1, 0, 'straight through');
  });

  it('nearZero detects tiny vectors', () => {
    assert.ok(new Vec3(1e-9, 1e-9, 1e-9).nearZero());
    assert.ok(!new Vec3(0.1, 0, 0).nearZero());
  });
});

describe('Vec3 — Utilities', () => {
  it('clamp', () => {
    vec3Approx(new Vec3(-1, 0.5, 2).clamp(0, 1), 0, 0.5, 1);
  });

  it('lerp at 0', () => {
    vec3Approx(new Vec3(0, 0, 0).lerp(new Vec3(10, 10, 10), 0), 0, 0, 0);
  });

  it('lerp at 1', () => {
    vec3Approx(new Vec3(0, 0, 0).lerp(new Vec3(10, 10, 10), 1), 10, 10, 10);
  });

  it('lerp at 0.5', () => {
    vec3Approx(new Vec3(0, 0, 0).lerp(new Vec3(10, 10, 10), 0.5), 5, 5, 5);
  });

  it('toString', () => {
    assert.ok(new Vec3(1, 2, 3).toString().includes('1.0000'));
  });
});

describe('Vec3 — Random', () => {
  it('random in range', () => {
    const v = Vec3.random(5, 10);
    assert.ok(v.x >= 5 && v.x <= 10);
    assert.ok(v.y >= 5 && v.y <= 10);
    assert.ok(v.z >= 5 && v.z <= 10);
  });

  it('randomInUnitSphere has length < 1', () => {
    for (let i = 0; i < 10; i++) {
      assert.ok(Vec3.randomInUnitSphere().length() < 1);
    }
  });

  it('randomUnitVector has length ≈ 1', () => {
    for (let i = 0; i < 10; i++) {
      approx(Vec3.randomUnitVector().length(), 1, 'unit');
    }
  });

  it('randomInHemisphere has positive dot with normal', () => {
    const n = new Vec3(0, 1, 0);
    for (let i = 0; i < 10; i++) {
      assert.ok(Vec3.randomInHemisphere(n).dot(n) >= 0);
    }
  });

  it('randomInUnitDisk has z=0 and length < 1', () => {
    for (let i = 0; i < 10; i++) {
      const v = Vec3.randomInUnitDisk();
      assert.equal(v.z, 0);
      assert.ok(v.length() < 1);
    }
  });
});

describe('Ray', () => {
  it('construction', () => {
    const r = new Ray(new Vec3(0, 0, 0), new Vec3(1, 0, 0));
    vec3Approx(r.origin, 0, 0, 0);
    vec3Approx(r.direction, 1, 0, 0);
    assert.equal(r.time, 0);
  });

  it('at(t) computes point on ray', () => {
    const r = new Ray(new Vec3(1, 2, 3), new Vec3(1, 0, 0));
    vec3Approx(r.at(0), 1, 2, 3);
    vec3Approx(r.at(1), 2, 2, 3);
    vec3Approx(r.at(5), 6, 2, 3);
  });

  it('at(-t) goes backward', () => {
    const r = new Ray(new Vec3(0, 0, 0), new Vec3(1, 1, 1));
    vec3Approx(r.at(-1), -1, -1, -1);
  });

  it('stores time', () => {
    const r = new Ray(Vec3.zero(), new Vec3(1, 0, 0), 0.5);
    assert.equal(r.time, 0.5);
  });
});
