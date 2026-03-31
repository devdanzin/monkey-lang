import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Vec3, Color, XZRect, XYRect, YZRect, DiffuseLight, Lambertian, Renderer, Camera, HittableList } from '../src/index.js';

describe('Area Lights', () => {
  describe('Rectangle randomPoint', () => {
    it('XZRect randomPoint is within bounds', () => {
      const rect = new XZRect(1, 3, 2, 5, 10, null);
      for (let i = 0; i < 100; i++) {
        const p = rect.randomPoint();
        assert.ok(p.x >= 1 && p.x <= 3, `x=${p.x}`);
        assert.ok(p.y === 10, `y=${p.y}`);
        assert.ok(p.z >= 2 && p.z <= 5, `z=${p.z}`);
      }
    });

    it('XYRect randomPoint is within bounds', () => {
      const rect = new XYRect(0, 2, 0, 3, 5, null);
      for (let i = 0; i < 100; i++) {
        const p = rect.randomPoint();
        assert.ok(p.x >= 0 && p.x <= 2);
        assert.ok(p.y >= 0 && p.y <= 3);
        assert.ok(p.z === 5);
      }
    });

    it('YZRect randomPoint is within bounds', () => {
      const rect = new YZRect(0, 4, 1, 3, -1, null);
      for (let i = 0; i < 100; i++) {
        const p = rect.randomPoint();
        assert.ok(p.x === -1);
        assert.ok(p.y >= 0 && p.y <= 4);
        assert.ok(p.z >= 1 && p.z <= 3);
      }
    });

    it('XZRect area calculation', () => {
      const rect = new XZRect(0, 3, 0, 4, 0, null);
      assert.equal(rect.area(), 12);
    });
  });

  describe('Renderer with area lights', () => {
    it('accepts lights parameter', () => {
      const cam = new Camera({
        lookFrom: new Vec3(0, 0, 5),
        lookAt: new Vec3(0, 0, 0),
        vUp: new Vec3(0, 1, 0),
        vfov: 60,
        aspectRatio: 1,
      });
      const world = new HittableList();
      const light = new XZRect(-1, 1, -1, 1, 3, new DiffuseLight(new Color(10, 10, 10)));
      world.add(light);
      
      const renderer = new Renderer({
        width: 4, height: 4, samplesPerPixel: 1, maxDepth: 2,
        camera: cam, world, background: new Color(0, 0, 0),
        lights: [light],
      });
      assert.equal(renderer.lights.length, 1);
    });

    it('renders scene with area light (no crash)', () => {
      const cam = new Camera({
        lookFrom: new Vec3(278, 278, -800),
        lookAt: new Vec3(278, 278, 0),
        vUp: new Vec3(0, 1, 0),
        vfov: 40,
        aspectRatio: 1,
      });
      const world = new HittableList();
      
      // Floor
      world.add(new XZRect(0, 555, 0, 555, 0, new Lambertian(new Color(0.73, 0.73, 0.73))));
      
      // Light on ceiling
      const light = new XZRect(213, 343, 227, 332, 554, new DiffuseLight(new Color(15, 15, 15)));
      world.add(light);
      
      const renderer = new Renderer({
        width: 4, height: 4, samplesPerPixel: 2, maxDepth: 4,
        camera: cam, world, background: new Color(0, 0, 0),
        lights: [light],
      });
      
      const pixels = renderer.render();
      assert.ok(pixels instanceof Uint8ClampedArray);
      assert.equal(pixels.length, 4 * 4 * 4);
    });

    it('area light produces brighter pixels than no light', () => {
      const cam = new Camera({
        lookFrom: new Vec3(0, 1, 5),
        lookAt: new Vec3(0, 0, 0),
        vUp: new Vec3(0, 1, 0),
        vfov: 60,
        aspectRatio: 1,
      });
      
      // Scene without light
      const world1 = new HittableList();
      world1.add(new XZRect(-10, 10, -10, 10, 0, new Lambertian(new Color(0.8, 0.8, 0.8))));
      const r1 = new Renderer({
        width: 4, height: 4, samplesPerPixel: 4, maxDepth: 3,
        camera: cam, world: world1, background: new Color(0, 0, 0),
      });
      const p1 = r1.render();
      
      // Scene with area light
      const world2 = new HittableList();
      world2.add(new XZRect(-10, 10, -10, 10, 0, new Lambertian(new Color(0.8, 0.8, 0.8))));
      const light = new XZRect(-2, 2, -2, 2, 5, new DiffuseLight(new Color(15, 15, 15)));
      world2.add(light);
      const r2 = new Renderer({
        width: 4, height: 4, samplesPerPixel: 4, maxDepth: 3,
        camera: cam, world: world2, background: new Color(0, 0, 0),
        lights: [light],
      });
      const p2 = r2.render();
      
      // Sum brightness
      let sum1 = 0, sum2 = 0;
      for (let i = 0; i < p1.length; i += 4) {
        sum1 += p1[i] + p1[i+1] + p1[i+2];
        sum2 += p2[i] + p2[i+1] + p2[i+2];
      }
      // Scene with light should be brighter
      assert.ok(sum2 > sum1, `With light: ${sum2}, without: ${sum1}`);
    });
  });
});
