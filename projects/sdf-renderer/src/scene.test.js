import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { vec3 } from './vec3.js';
import { sdSphere, sdBox, sdPlane, opTranslate, opSmoothUnion } from './sdf.js';
import { Scene, Material, materials } from './scene.js';

describe('Scene', () => {
  it('adds objects and evaluates SDF', () => {
    const scene = new Scene();
    scene.add((p) => sdSphere(p, 1), materials.red);
    const { distance, material } = scene.evaluate(vec3(0, 0, 0));
    assert.ok(distance < 0);
    assert.equal(material, materials.red);
  });

  it('finds closest object', () => {
    const scene = new Scene();
    scene.add((p) => sdSphere(opTranslate(p, vec3(-2, 0, 0)), 1), materials.red);
    scene.add((p) => sdSphere(opTranslate(p, vec3(2, 0, 0)), 1), materials.blue);
    const { material } = scene.evaluate(vec3(-1.5, 0, 0));
    assert.equal(material, materials.red);
  });

  it('renders with materials', () => {
    const scene = new Scene();
    scene.add((p) => sdPlane(p), materials.floor);
    scene.add((p) => sdSphere(opTranslate(p, vec3(0, 1, 0)), 1), materials.red);
    scene.addLight(vec3(5, 8, 5));
    const image = scene.render({ width: 8, height: 8, eye: vec3(0, 3, 6), target: vec3(0, 0.5, 0) });
    assert.equal(image.pixels.length, 8 * 8 * 3);
  });

  it('renders with reflection', () => {
    const scene = new Scene();
    scene.add((p) => sdPlane(p), materials.mirror);
    scene.add((p) => sdSphere(opTranslate(p, vec3(0, 1, 0)), 1), materials.red);
    scene.addLight(vec3(5, 8, 5));
    const image = scene.render({ width: 8, height: 8, eye: vec3(0, 3, 6), target: vec3(0, 0.5, 0) });
    assert.ok(image.pixels.length > 0);
  });

  it('multiple lights', () => {
    const scene = new Scene();
    scene.add((p) => sdSphere(p, 1), materials.white);
    scene.addLight(vec3(5, 5, 5));
    scene.addLight(vec3(-5, 5, -5), vec3(0.3, 0.3, 1.0));
    const image = scene.render({ width: 8, height: 8 });
    assert.ok(image.pixels.length > 0);
  });

  it('complex scene with smooth union', () => {
    const scene = new Scene();
    scene.add((p) => sdPlane(p), materials.floor);
    scene.add((p) => opSmoothUnion(
      sdSphere(opTranslate(p, vec3(-1, 1, 0)), 1),
      sdBox(opTranslate(p, vec3(1, 1, 0)), vec3(0.8, 0.8, 0.8)),
      0.5
    ), materials.gold);
    scene.addLight(vec3(5, 8, 5));
    const image = scene.render({ width: 16, height: 16, eye: vec3(0, 3, 6), target: vec3(0, 0.5, 0) });
    let hasNonZero = false;
    for (let i = 0; i < image.pixels.length; i++) {
      if (image.pixels[i] > 0) { hasNonZero = true; break; }
    }
    assert.ok(hasNonZero);
  });

  it('Material has default values', () => {
    const mat = new Material();
    assert.ok(mat.color.x > 0);
    assert.ok(mat.specular >= 0);
    assert.ok(mat.reflectivity >= 0);
  });

  it('pre-built materials exist', () => {
    assert.ok(materials.red);
    assert.ok(materials.metal);
    assert.ok(materials.mirror);
    assert.equal(materials.mirror.reflectivity, 0.9);
  });
});
