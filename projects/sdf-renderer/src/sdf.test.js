// sdf.test.js — Tests for signed distance functions

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { vec3 } from './vec3.js';
import {
  sdSphere, sdBox, sdPlane, sdTorus, sdCylinder, sdCapsule, sdRoundBox,
  opUnion, opIntersection, opSubtraction, opSmoothUnion,
  opTranslate, opRotateY, opScale, opRepeat,
  estimateNormal,
} from './sdf.js';

const EPS = 0.01;
function approx(a, b, eps = EPS) { assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`); }

describe('SDF Primitives', () => {
  describe('Sphere', () => {
    it('origin is inside (negative)', () => { approx(sdSphere(vec3(0, 0, 0), 1), -1); });
    it('on surface is zero', () => { approx(sdSphere(vec3(1, 0, 0), 1), 0); });
    it('outside is positive', () => { approx(sdSphere(vec3(2, 0, 0), 1), 1); });
    it('inside is negative', () => { approx(sdSphere(vec3(0.5, 0, 0), 1), -0.5); });
  });

  describe('Box', () => {
    it('origin is inside', () => { assert.ok(sdBox(vec3(0, 0, 0), vec3(1, 1, 1)) < 0); });
    it('corner distance', () => { approx(sdBox(vec3(2, 0, 0), vec3(1, 1, 1)), 1); });
    it('on face is zero', () => { approx(sdBox(vec3(1, 0, 0), vec3(1, 1, 1)), 0); });
    it('inside distance', () => { approx(sdBox(vec3(0, 0, 0), vec3(1, 1, 1)), -1); });
  });

  describe('Plane', () => {
    it('above plane is positive', () => { approx(sdPlane(vec3(0, 1, 0)), 1); });
    it('on plane is zero', () => { approx(sdPlane(vec3(0, 0, 0)), 0); });
    it('below plane is negative', () => { approx(sdPlane(vec3(0, -1, 0)), -1); });
  });

  describe('Torus', () => {
    it('center of tube is zero', () => { approx(sdTorus(vec3(2, 0, 0), 2, 0.5), -0.5, 0.05); });
    it('outside is positive', () => { assert.ok(sdTorus(vec3(5, 0, 0), 2, 0.5) > 0); });
    it('center of torus', () => { approx(sdTorus(vec3(0, 0, 0), 2, 0.5), 1.5); });
  });

  describe('Cylinder', () => {
    it('inside is negative', () => { assert.ok(sdCylinder(vec3(0, 0, 0), 1, 1) < 0); });
    it('outside is positive', () => { assert.ok(sdCylinder(vec3(2, 0, 0), 1, 1) > 0); });
  });

  describe('Capsule', () => {
    it('center is inside', () => {
      assert.ok(sdCapsule(vec3(0, 0, 0), vec3(0, -1, 0), vec3(0, 1, 0), 0.5) < 0);
    });
    it('at end cap', () => {
      approx(sdCapsule(vec3(0, 1.5, 0), vec3(0, -1, 0), vec3(0, 1, 0), 0.5), 0);
    });
  });
});

describe('CSG Operations', () => {
  it('union = min', () => {
    assert.equal(opUnion(1, 2), 1);
    assert.equal(opUnion(-1, 0.5), -1);
  });

  it('intersection = max', () => {
    assert.equal(opIntersection(1, 2), 2);
    assert.equal(opIntersection(-1, 0.5), 0.5);
  });

  it('subtraction', () => {
    assert.equal(opSubtraction(1, -2), 2);
  });

  it('smooth union blends', () => {
    const d1 = 0.1;
    const d2 = 0.2;
    const smooth = opSmoothUnion(d1, d2, 0.5);
    assert.ok(smooth < d1); // Smooth union gives smaller distance
  });
});

describe('Transforms', () => {
  it('translate moves point', () => {
    const p = opTranslate(vec3(5, 0, 0), vec3(3, 0, 0));
    approx(p.x, 2);
  });

  it('rotate Y by 90 degrees', () => {
    const p = opRotateY(vec3(1, 0, 0), Math.PI / 2);
    approx(p.x, 0, 0.01);
    approx(p.z, -1, 0.01);
  });

  it('scale', () => {
    const p = opScale(vec3(2, 4, 6), 2);
    approx(p.x, 1);
    approx(p.y, 2);
    approx(p.z, 3);
  });
});

describe('Normal Estimation', () => {
  it('sphere normal at (1,0,0) points right', () => {
    const n = estimateNormal((p) => sdSphere(p, 1), vec3(1, 0, 0));
    approx(n.x, 1, 0.01);
    approx(n.y, 0, 0.01);
    approx(n.z, 0, 0.01);
  });

  it('sphere normal at (0,1,0) points up', () => {
    const n = estimateNormal((p) => sdSphere(p, 1), vec3(0, 1, 0));
    approx(n.x, 0, 0.01);
    approx(n.y, 1, 0.01);
  });

  it('plane normal points up', () => {
    const n = estimateNormal((p) => sdPlane(p), vec3(0, 0, 0));
    approx(n.y, 1, 0.01);
  });

  it('box normal at face center', () => {
    const n = estimateNormal((p) => sdBox(p, vec3(1, 1, 1)), vec3(1, 0, 0));
    approx(n.x, 1, 0.05);
    approx(n.y, 0, 0.05);
    approx(n.z, 0, 0.05);
  });
});

describe('Combined Scenes', () => {
  it('sphere-box union', () => {
    const scene = (p) => opUnion(sdSphere(p, 1), sdBox(opTranslate(p, vec3(3, 0, 0)), vec3(0.5, 0.5, 0.5)));
    approx(scene(vec3(0, 0, 0)), -1);
    assert.ok(scene(vec3(1.5, 0, 0)) > 0); // between them
    assert.ok(scene(vec3(3, 0, 0)) < 0); // inside box
  });

  it('sphere with sphere subtracted (hollow)', () => {
    const hollow = (p) => opSubtraction(sdSphere(p, 1), sdSphere(p, 0.8));
    assert.ok(hollow(vec3(0, 0, 0)) > 0); // center is outside (subtracted)
    assert.ok(hollow(vec3(0.9, 0, 0)) < 0); // in the shell
  });

  it('normal estimation on combined scene', () => {
    const scene = (p) => opSmoothUnion(sdSphere(p, 1), sdSphere(opTranslate(p, vec3(1, 0, 0)), 1), 0.5);
    const n = estimateNormal(scene, vec3(0, 1, 0));
    assert.ok(Math.abs(n.y) > 0.5); // normal should point generally up
  });
});
