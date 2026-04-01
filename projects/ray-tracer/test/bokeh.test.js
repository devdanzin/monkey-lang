// bokeh.test.js — Aperture shape sampling tests
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  sampleCircle, sampleHexagon, samplePentagon, samplePolygon,
  sampleStar, sampleHeart, sampleRing, createBokehSampler, BOKEH_SHAPES
} from '../src/bokeh.js';
import { Camera } from '../src/camera.js';
import { Vec3, Point3 } from '../src/vec3.js';

describe('Bokeh shapes', () => {
  const N = 500;

  it('sampleCircle returns points inside unit disk', () => {
    for (let i = 0; i < N; i++) {
      const p = sampleCircle();
      assert.ok(p.x * p.x + p.y * p.y < 1, `Point (${p.x},${p.y}) outside unit disk`);
      assert.equal(p.z, 0);
    }
  });

  it('sampleHexagon returns points inside unit circle (bounding)', () => {
    for (let i = 0; i < N; i++) {
      const p = sampleHexagon();
      const r = Math.sqrt(p.x * p.x + p.y * p.y);
      assert.ok(r <= 1.01, `Hexagon point too far: r=${r}`);
      assert.equal(p.z, 0);
    }
  });

  it('samplePentagon returns points inside bounding circle', () => {
    for (let i = 0; i < N; i++) {
      const p = samplePentagon();
      const r = Math.sqrt(p.x * p.x + p.y * p.y);
      assert.ok(r <= 1.01, `Pentagon point too far: r=${r}`);
    }
  });

  it('samplePolygon with varying blades', () => {
    for (const blades of [3, 4, 7, 8]) {
      for (let i = 0; i < 100; i++) {
        const p = samplePolygon(blades);
        const r = Math.sqrt(p.x * p.x + p.y * p.y);
        assert.ok(r <= 1.01, `${blades}-gon point too far: r=${r}`);
      }
    }
  });

  it('sampleStar returns points inside bounding circle', () => {
    for (let i = 0; i < N; i++) {
      const p = sampleStar(6, 0.4);
      const r = Math.sqrt(p.x * p.x + p.y * p.y);
      assert.ok(r <= 1.01, `Star point too far: r=${r}`);
    }
  });

  it('sampleHeart returns points inside bounding box', () => {
    for (let i = 0; i < N; i++) {
      const p = sampleHeart();
      assert.ok(Math.abs(p.x) <= 1, `Heart x too far: ${p.x}`);
      assert.ok(Math.abs(p.y) <= 1, `Heart y too far: ${p.y}`);
    }
  });

  it('sampleRing returns points in annular region', () => {
    const inner = 0.5;
    for (let i = 0; i < N; i++) {
      const p = sampleRing(inner);
      const r2 = p.x * p.x + p.y * p.y;
      assert.ok(r2 < 1, `Ring point outside: r²=${r2}`);
      assert.ok(r2 >= inner * inner - 0.001, `Ring point inside hole: r²=${r2}`);
    }
  });

  it('createBokehSampler returns function for all shapes', () => {
    for (const shape of BOKEH_SHAPES) {
      const sampler = createBokehSampler(shape);
      assert.equal(typeof sampler, 'function');
      const p = sampler();
      assert.ok(p instanceof Vec3);
    }
  });

  it('createBokehSampler handles custom function', () => {
    const custom = () => new Vec3(0.1, 0.2, 0);
    const cam = new Camera({
      lookFrom: new Point3(0, 0, 0),
      lookAt: new Point3(0, 0, -1),
      aperture: 2,
      focusDist: 1,
      bokeh: custom
    });
    assert.equal(cam.bokehSampler, custom);
  });
});

describe('Camera with bokeh shapes', () => {
  it('creates camera with hexagonal bokeh', () => {
    const cam = new Camera({
      lookFrom: new Point3(0, 0, 0),
      lookAt: new Point3(0, 0, -1),
      aperture: 0.5,
      focusDist: 2,
      bokeh: 'hexagon'
    });
    const ray = cam.getRay(0.5, 0.5);
    assert.ok(ray.origin instanceof Vec3);
    assert.ok(ray.direction instanceof Vec3);
  });

  it('creates camera with star bokeh', () => {
    const cam = new Camera({
      lookFrom: new Point3(13, 2, 3),
      lookAt: new Point3(0, 0, 0),
      aperture: 0.1,
      focusDist: 10,
      bokeh: 'star',
      bokehOpts: { points: 8, innerRadius: 0.3 }
    });
    // Generate several rays — should not throw
    for (let i = 0; i < 100; i++) {
      cam.getRay(Math.random(), Math.random());
    }
  });

  it('zero aperture gives identical rays regardless of bokeh', () => {
    const cam = new Camera({
      lookFrom: new Point3(0, 0, 0),
      lookAt: new Point3(0, 0, -1),
      aperture: 0,
      focusDist: 1,
      bokeh: 'heart'
    });
    // All rays should originate from origin (no offset)
    for (let i = 0; i < 50; i++) {
      const ray = cam.getRay(0.5, 0.5);
      assert.ok(Math.abs(ray.origin.x) < 1e-10);
      assert.ok(Math.abs(ray.origin.y) < 1e-10);
      assert.ok(Math.abs(ray.origin.z) < 1e-10);
    }
  });

  it('BOKEH_SHAPES lists all available shapes', () => {
    assert.ok(BOKEH_SHAPES.includes('circle'));
    assert.ok(BOKEH_SHAPES.includes('hexagon'));
    assert.ok(BOKEH_SHAPES.includes('star'));
    assert.ok(BOKEH_SHAPES.includes('heart'));
    assert.ok(BOKEH_SHAPES.includes('ring'));
    assert.ok(BOKEH_SHAPES.length >= 7);
  });
});
