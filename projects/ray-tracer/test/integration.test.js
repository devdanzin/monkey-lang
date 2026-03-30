import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  Vec3, Ray, Sphere, HittableList, Lambertian, Metal, Dielectric, DiffuseLight, ColoredGlass,
  Camera, Renderer, Color, Point3,
  Disk, Cylinder, Cone, Box, Triangle, Mesh, XZRect,
  Translate, RotateY, ConstantMedium, MovingSphere,
  CheckerTexture, NoiseTexture, MarbleTexture, StripeTexture, PlanetTexture,
  CSGUnion, CSGDifference,
  SkyGradient, SolidBackground, SunsetGradient, StarfieldBackground,
  bilateralFilter, reinhardToneMap, acesToneMap,
  loadScene
} from '../src/index.js';

const W = 6, H = 4, SPP = 2, DEPTH = 8;

function render(world, camOpts = {}, env = null, bg = null) {
  const cam = new Camera({ lookFrom: new Point3(0, 2, 5), lookAt: new Point3(0, 0, 0), vfov: 60, aspectRatio: W/H, ...camOpts });
  const renderer = new Renderer({ width: W, height: H, samplesPerPixel: SPP, maxDepth: DEPTH, camera: cam, world, background: bg });
  if (env) renderer.environment = env;
  return renderer.render();
}

describe('Integration: New geometry', () => {
  it('disk + cylinder + sphere', () => {
    const w = new HittableList();
    const mat = new Lambertian(new Color(0.5, 0.5, 0.5));
    w.add(new Cylinder(new Vec3(0, 0, -1), 0.5, 0, 1, mat));
    w.add(new Disk(new Vec3(0, 1, -1), new Vec3(0, 1, 0), 0.5, mat));
    w.add(new Sphere(new Vec3(0, 1.5, -1), 0.3, new Metal(new Vec3(0.8, 0.8, 0.8), 0)));
    const pixels = render(w);
    assert.equal(pixels.length, W * H * 4);
  });

  it('cone with colored glass', () => {
    const w = new HittableList();
    w.add(new Cone(new Vec3(0, 2, -2), 1, 2, new Lambertian(new Color(0.8, 0.3, 0.3))));
    w.add(new Sphere(new Vec3(1, 0.5, -1), 0.5, new ColoredGlass(1.5, new Color(0.2, 0.8, 0.2), 2)));
    const pixels = render(w);
    assert.equal(pixels.length, W * H * 4);
  });
});

describe('Integration: CSG + transforms', () => {
  it('CSG union with transforms', () => {
    const w = new HittableList();
    const mat = new Lambertian(new Color(0.5, 0.5, 0.5));
    const s1 = new Sphere(new Vec3(0, 0, -2), 0.5, mat);
    const s2 = new Sphere(new Vec3(0.3, 0, -2), 0.5, mat);
    const u = new CSGUnion(s1, s2);
    w.add(new Translate(u, new Vec3(0, 1, 0)));
    const pixels = render(w);
    assert.equal(pixels.length, W * H * 4);
  });

  it('CSG difference (sphere minus box)', () => {
    const w = new HittableList();
    const mat = new Lambertian(new Color(0.7, 0.3, 0.3));
    const s = new Sphere(new Vec3(0, 0, -2), 1, mat);
    const b = new Box(new Vec3(-0.6, -0.6, -2.6), new Vec3(0.6, 0.6, -1.4), mat);
    w.add(new CSGDifference(s, b));
    const pixels = render(w);
    assert.equal(pixels.length, W * H * 4);
  });
});

describe('Integration: Environment maps', () => {
  it('renders with SkyGradient', () => {
    const w = new HittableList();
    w.add(new Sphere(new Vec3(0, 0, -2), 0.5, new Metal(new Vec3(0.95, 0.95, 0.95), 0)));
    const pixels = render(w, {}, new SkyGradient(new Color(0.8, 0.9, 1.0), new Color(0.2, 0.3, 0.8)));
    assert.equal(pixels.length, W * H * 4);
  });

  it('renders with SunsetGradient', () => {
    const w = new HittableList();
    w.add(new Sphere(new Vec3(0, 0, -2), 0.5, new Dielectric(1.5)));
    const pixels = render(w, {}, new SunsetGradient());
    assert.equal(pixels.length, W * H * 4);
  });

  it('renders with StarfieldBackground', () => {
    const w = new HittableList();
    w.add(new Sphere(new Vec3(0, 0, -2), 0.5, new DiffuseLight(new Color(3, 3, 3))));
    const pixels = render(w, {}, new StarfieldBackground());
    assert.equal(pixels.length, W * H * 4);
  });
});

describe('Integration: ColoredGlass', () => {
  it('red glass tints light', () => {
    const w = new HittableList();
    w.add(new Sphere(new Vec3(0, 0, -1), 0.5, new ColoredGlass(1.5, new Color(0.9, 0.1, 0.1), 3)));
    w.add(new Sphere(new Vec3(0, -100.5, -1), 100, new Lambertian(new Color(0.8, 0.8, 0.8))));
    const pixels = render(w);
    assert.equal(pixels.length, W * H * 4);
  });
});

describe('Integration: Post-processing', () => {
  it('bilateral filter + tone mapping chain', () => {
    const w = new HittableList();
    w.add(new Sphere(new Vec3(0, 0, -1), 0.5, new Lambertian(new Color(0.5, 0.5, 0.5))));
    const pixels = render(w);

    // Denoise
    const denoised = bilateralFilter(pixels, W, H, 2, 25);
    assert.equal(denoised.length, pixels.length);

    // Tone map
    const reinhard = reinhardToneMap(denoised, W, H);
    assert.equal(reinhard.length, pixels.length);

    const aces = acesToneMap(denoised, W, H);
    assert.equal(aces.length, pixels.length);
  });
});

describe('Integration: JSON scene format roundtrip', () => {
  it('loads and renders complex scene', () => {
    const json = {
      objects: [
        { type: 'sphere', center: [0, 0, -1], radius: 0.5, material: { type: 'lambertian', texture: { type: 'checker', even: [0.1,0.1,0.1], odd: [0.9,0.9,0.9] } } },
        { type: 'sphere', center: [1, 0, -1], radius: 0.5, material: { type: 'metal', color: [0.8,0.6,0.2], fuzz: 0.1 } },
        { type: 'sphere', center: [-1, 0, -1], radius: 0.5, material: { type: 'dielectric', ior: 1.5 } },
        { type: 'xz_rect', x0: -2, x1: 2, z0: -2, z1: 2, k: 3, material: { type: 'light', emit: [4,4,4] } },
        { type: 'box', min: [0,-0.5,-2], max: [0.5,0.5,-1.5], material: { type: 'lambertian', color: [0.3,0.7,0.3] }, rotate_y: 30, translate: [-2, 0, 0] }
      ],
      camera: { lookFrom: [0, 2, 5], lookAt: [0, 0, -1], vfov: 60, aspectRatio: 2 }
    };
    const { world, camera: camOpts } = loadScene(json);
    const cam = new Camera({ lookFrom: new Vec3(...camOpts.lookFrom), lookAt: new Vec3(...camOpts.lookAt), vfov: camOpts.vfov, aspectRatio: camOpts.aspectRatio });
    const renderer = new Renderer({ width: 4, height: 2, samplesPerPixel: 2, maxDepth: 5, camera: cam, world });
    const pixels = renderer.render();
    assert.equal(pixels.length, 4 * 2 * 4);
  });
});
