// renderer.test.js — Tests for the ray marcher

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { vec3 } from './vec3.js';
import { sdSphere, sdBox, sdPlane, opUnion, opTranslate, opSmoothUnion, estimateNormal } from './sdf.js';
import { march, softShadow, ambientOcclusion, lookAt, Renderer } from './renderer.js';
import { existsSync, unlinkSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('Ray Marching', () => {
  it('hits a sphere', () => {
    const scene = (p) => sdSphere(p, 1);
    const result = march(vec3(0, 0, 5), vec3(0, 0, -1), scene);
    assert.ok(result.hit);
    assert.ok(Math.abs(result.point.z - 1) < 0.01);
  });

  it('misses when ray goes past', () => {
    const scene = (p) => sdSphere(p, 1);
    const result = march(vec3(5, 0, 5), vec3(0, 0, -1), scene);
    assert.ok(!result.hit);
  });

  it('hits a box', () => {
    const scene = (p) => sdBox(p, vec3(1, 1, 1));
    const result = march(vec3(0, 0, 5), vec3(0, 0, -1), scene);
    assert.ok(result.hit);
    assert.ok(Math.abs(result.point.z - 1) < 0.01);
  });

  it('hits a plane', () => {
    const scene = (p) => sdPlane(p);
    const result = march(vec3(0, 5, 0), vec3(0, -1, 0), scene);
    assert.ok(result.hit);
    assert.ok(Math.abs(result.point.y) < 0.01);
  });

  it('marches through combined scene', () => {
    const scene = (p) => opUnion(
      sdSphere(opTranslate(p, vec3(-1, 0, 0)), 1),
      sdSphere(opTranslate(p, vec3(1, 0, 0)), 1)
    );
    const result = march(vec3(0, 0, 5), vec3(0, 0, -1), scene);
    assert.ok(result.hit);
  });
});

describe('Soft Shadows', () => {
  it('no shadow for unobstructed light', () => {
    const scene = (p) => sdSphere(opTranslate(p, vec3(5, 5, 5)), 1);
    const shadow = softShadow(vec3(0, 0, 0), vec3(0, 1, 0), scene);
    assert.ok(shadow > 0.9);
  });

  it('full shadow when blocked', () => {
    const scene = (p) => sdSphere(opTranslate(p, vec3(0, 2, 0)), 0.5);
    const shadow = softShadow(vec3(0, 0, 0), vec3(0, 1, 0), scene);
    assert.ok(shadow < 0.1);
  });
});

describe('Ambient Occlusion', () => {
  it('open area has high AO', () => {
    const scene = (p) => sdPlane(p);
    const ao = ambientOcclusion(vec3(0, 0, 0), vec3(0, 1, 0), scene);
    assert.ok(ao > 0.5);
  });

  it('concavity has lower AO', () => {
    const scene = (p) => sdSphere(p, 2); // inside a large sphere
    const ao = ambientOcclusion(vec3(0, 1.9, 0), vec3(0, 1, 0), scene);
    // Near the surface of the inner sphere, AO should be less than fully open
    assert.ok(ao < 1);
  });
});

describe('Camera', () => {
  it('lookAt produces orthogonal basis', () => {
    const cam = lookAt(vec3(0, 0, 5), vec3(0, 0, 0));
    assert.ok(Math.abs(cam.forward.dot(cam.right)) < 0.01);
    assert.ok(Math.abs(cam.forward.dot(cam.up)) < 0.01);
    assert.ok(Math.abs(cam.right.dot(cam.up)) < 0.01);
  });

  it('forward points toward target', () => {
    const cam = lookAt(vec3(0, 0, 5), vec3(0, 0, 0));
    assert.ok(cam.forward.z < -0.9);
  });
});

describe('Renderer', () => {
  it('renders a small image', () => {
    const renderer = new Renderer({ width: 16, height: 16 });
    const scene = (p) => sdSphere(p, 1);
    const image = renderer.render(scene);
    assert.equal(image.width, 16);
    assert.equal(image.height, 16);
    assert.equal(image.pixels.length, 16 * 16 * 3);
  });

  it('center pixel hits sphere (not sky color)', () => {
    const renderer = new Renderer({ width: 16, height: 16, eye: vec3(0, 0, 5), target: vec3(0, 0, 0) });
    const scene = (p) => sdSphere(p, 1);
    const image = renderer.render(scene);
    // Center pixel should be lit (not pure sky blue)
    const cx = 8, cy = 8;
    const idx = (cy * 16 + cx) * 3;
    // Sky is ~(127, 178, 255), sphere should be different
    const r = image.pixels[idx], g = image.pixels[idx + 1], b = image.pixels[idx + 2];
    // At least one channel should differ from sky
    assert.ok(r !== 127 || g !== 178 || b !== 255, `Center pixel looks like sky: ${r},${g},${b}`);
  });

  it('renders to PPM file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sdf-'));
    const outPath = join(dir, 'test.ppm');
    const renderer = new Renderer({ width: 8, height: 8 });
    const scene = (p) => sdSphere(p, 1);
    renderer.renderToFile(scene, outPath);
    assert.ok(existsSync(outPath));
  });

  it('PPM format is correct', () => {
    const renderer = new Renderer({ width: 4, height: 4 });
    const scene = (p) => sdSphere(p, 1);
    const image = renderer.render(scene);
    const ppm = renderer.toPPM(image);
    assert.ok(ppm.startsWith('P3\n4 4\n255\n'));
    const lines = ppm.trim().split('\n');
    assert.equal(lines.length, 3 + 16); // header + 4*4 pixels
  });

  it('antialiasing with multiple samples', () => {
    const renderer = new Renderer({ width: 8, height: 8, samples: 4 });
    const scene = (p) => sdSphere(p, 1);
    const image = renderer.render(scene);
    assert.equal(image.pixels.length, 8 * 8 * 3);
  });

  it('renders complex scene', () => {
    const renderer = new Renderer({ width: 16, height: 16 });
    const scene = (p) => opUnion(
      sdPlane(p),
      opSmoothUnion(
        sdSphere(opTranslate(p, vec3(-1, 1, 0)), 1),
        sdBox(opTranslate(p, vec3(1, 1, 0)), vec3(0.8, 0.8, 0.8)),
        0.5
      )
    );
    const image = renderer.render(scene);
    assert.equal(image.pixels.length, 16 * 16 * 3);
    // Verify not all black
    let hasNonZero = false;
    for (let i = 0; i < image.pixels.length; i++) {
      if (image.pixels[i] > 0) { hasNonZero = true; break; }
    }
    assert.ok(hasNonZero, 'Image should not be all black');
  });
});
