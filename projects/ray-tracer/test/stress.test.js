// stress-test.js — Render all scene types, verify no crashes
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  Vec3, Point3, Color, Ray, HittableList, Sphere, MovingSphere,
  Lambertian, Metal, Dielectric, DiffuseLight, Isotropic, ConstantMedium,
  Camera, Renderer, BVHNode,
  CheckerTexture, NoiseTexture, MarbleTexture, StripeTexture, PlanetTexture,
  Plane, XYRect, XZRect, YZRect, Box, Triangle, Mesh,
  Translate, RotateY
} from '../src/index.js';

const W = 8, H = 6, SPP = 2, DEPTH = 10;

function renderScene(name, world, camOpts = {}, bg = null) {
  it(`renders ${name} without crashing`, () => {
    const cam = new Camera({
      lookFrom: new Point3(0, 2, 5),
      lookAt: new Point3(0, 0, 0),
      vfov: 60,
      aspectRatio: W / H,
      ...camOpts
    });
    const renderer = new Renderer({ width: W, height: H, samplesPerPixel: SPP, maxDepth: DEPTH, camera: cam, world, background: bg });
    const pixels = renderer.render();
    assert.equal(pixels.length, W * H * 4);
    // All alpha should be 255
    for (let i = 3; i < pixels.length; i += 4) {
      assert.equal(pixels[i], 255);
    }
  });
}

describe('Stress tests — all scene types', () => {
  // 1. Simple scene
  {
    const world = new HittableList();
    world.add(new Sphere(new Vec3(0, 0, -1), 0.5, new Lambertian(new Color(0.5, 0.5, 0.5))));
    renderScene('simple sphere', world);
  }

  // 2. Metal + Dielectric
  {
    const world = new HittableList();
    world.add(new Sphere(new Vec3(0, 0, -1), 0.5, new Metal(new Color(0.8, 0.8, 0.8), 0.1)));
    world.add(new Sphere(new Vec3(1, 0, -1), 0.5, new Dielectric(1.5)));
    renderScene('metal + glass', world);
  }

  // 3. Emissive
  {
    const world = new HittableList();
    world.add(new Sphere(new Vec3(0, 0, -1), 0.5, new Lambertian(new Color(0.5, 0.5, 0.5))));
    world.add(new XZRect(-1, 1, -1, 1, 3, new DiffuseLight(new Color(4, 4, 4))));
    renderScene('emissive', world, {}, new Color(0, 0, 0));
  }

  // 4. Checker texture
  {
    const world = new HittableList();
    world.add(new Sphere(new Vec3(0, -100.5, 0), 100, new Lambertian(new CheckerTexture(new Color(0.1, 0.1, 0.1), new Color(0.9, 0.9, 0.9)))));
    world.add(new Sphere(new Vec3(0, 0, 0), 0.5, new Lambertian(new Color(0.5, 0.5, 0.5))));
    renderScene('checker texture', world);
  }

  // 5. Noise + Marble
  {
    const world = new HittableList();
    world.add(new Sphere(new Vec3(0, 0, 0), 0.5, new Lambertian(new NoiseTexture(new Color(0.5, 0.5, 0.5), 4))));
    world.add(new Sphere(new Vec3(1.2, 0, 0), 0.5, new Lambertian(new MarbleTexture(new Color(0.8, 0.8, 0.8), 3))));
    renderScene('noise + marble', world);
  }

  // 6. Planet + Stripe
  {
    const world = new HittableList();
    world.add(new Sphere(new Vec3(0, 0, 0), 0.5, new Lambertian(new PlanetTexture(new Color(0.2, 0.6, 0.15), new Color(0.1, 0.2, 0.7), new Color(0.9, 0.9, 0.9)))));
    world.add(new Sphere(new Vec3(1.5, 0, 0), 0.5, new Lambertian(new StripeTexture([new Color(0.8, 0.6, 0.3), new Color(0.6, 0.4, 0.2)]))));
    renderScene('planet + stripe', world);
  }

  // 7. Planes and Boxes
  {
    const world = new HittableList();
    const mat = new Lambertian(new Color(0.5, 0.5, 0.5));
    world.add(new XZRect(-2, 2, -2, 2, 0, mat));
    world.add(new Box(new Vec3(-0.5, 0, -0.5), new Vec3(0.5, 1, 0.5), mat));
    renderScene('planes + boxes', world);
  }

  // 8. Triangles + Mesh
  {
    const world = new HittableList();
    const mat = new Lambertian(new Color(0.5, 0.5, 0.5));
    world.add(new Triangle(new Vec3(-1, 0, -1), new Vec3(1, 0, -1), new Vec3(0, 2, -1), mat));
    const mesh = Mesh.fromOBJ('v -1 -1 -2\nv 1 -1 -2\nv 1 1 -2\nv -1 1 -2\nf 1 2 3 4', mat);
    world.add(mesh);
    renderScene('triangle + mesh', world);
  }

  // 9. Transforms
  {
    const world = new HittableList();
    const mat = new Lambertian(new Color(0.5, 0.5, 0.5));
    world.add(new Translate(new Sphere(new Vec3(0, 0, 0), 0.5, mat), new Vec3(2, 0, 0)));
    world.add(new Translate(new RotateY(new Box(new Vec3(0, 0, 0), new Vec3(1, 1, 1), mat), 45), new Vec3(-2, 0, 0)));
    renderScene('transforms', world);
  }

  // 10. Volumetric
  {
    const world = new HittableList();
    const mat = new Lambertian(new Color(1, 1, 1));
    world.add(new Sphere(new Vec3(0, -100.5, 0), 100, mat));
    const boundary = new Sphere(new Vec3(0, 0.5, 0), 0.5, mat);
    world.add(new ConstantMedium(boundary, 1.0, new Color(0.5, 0.5, 0.8)));
    renderScene('volumetric fog', world);
  }

  // 11. Moving spheres (motion blur)
  {
    const world = new HittableList();
    const mat = new Lambertian(new Color(0.5, 0.5, 0.5));
    world.add(new Sphere(new Vec3(0, -100.5, 0), 100, mat));
    world.add(new MovingSphere(new Vec3(0, 0.5, 0), new Vec3(0, 1.5, 0), 0, 1, 0.3, mat));
    renderScene('motion blur', world, { time0: 0, time1: 1 });
  }

  // 12. BVH with many objects
  {
    const world = new HittableList();
    const mat = new Lambertian(new Color(0.5, 0.5, 0.5));
    for (let i = 0; i < 100; i++) {
      world.add(new Sphere(Vec3.random(-5, 5), 0.2, mat));
    }
    renderScene('BVH stress (100 objects)', world);
  }

  // 13. Cornell box (mixed primitives)
  {
    const world = new HittableList();
    const white = new Lambertian(new Color(0.73, 0.73, 0.73));
    const red = new Lambertian(new Color(0.65, 0.05, 0.05));
    const green = new Lambertian(new Color(0.12, 0.45, 0.15));
    const light = new DiffuseLight(new Color(15, 15, 15));
    world.add(new YZRect(0, 555, 0, 555, 555, green));
    world.add(new YZRect(0, 555, 0, 555, 0, red));
    world.add(new XZRect(213, 343, 227, 332, 554, light));
    world.add(new XZRect(0, 555, 0, 555, 0, white));
    world.add(new XYRect(0, 555, 0, 555, 555, white));
    world.add(new Translate(new RotateY(new Box(new Vec3(0, 0, 0), new Vec3(165, 165, 165), white), -18), new Vec3(130, 0, 65)));
    renderScene('Cornell box', world, { lookFrom: new Point3(278, 278, -800), lookAt: new Point3(278, 278, 0), vfov: 40 }, new Color(0, 0, 0));
  }
});
