// render-samples.js — Render sample images for README
import { Vec3, Point3, Color, HittableList, Sphere, Lambertian, Metal, Dielectric, DiffuseLight, Camera, Renderer, CheckerTexture, XZRect } from '../src/index.js';
import { writeFileSync } from 'fs';

function createRandomScene() {
  const world = new HittableList();
  world.add(new Sphere(new Point3(0, -1000, 0), 1000, new Lambertian(new CheckerTexture(new Color(0.2, 0.3, 0.1), new Color(0.9, 0.9, 0.9)))));
  for (let a = -11; a < 11; a++) {
    for (let b = -11; b < 11; b++) {
      const r = Math.random();
      const center = new Point3(a + 0.9 * Math.random(), 0.2, b + 0.9 * Math.random());
      if (center.sub(new Point3(4, 0.2, 0)).length() > 0.9) {
        if (r < 0.8) world.add(new Sphere(center, 0.2, new Lambertian(Color.random().mul(Color.random()))));
        else if (r < 0.95) world.add(new Sphere(center, 0.2, new Metal(Color.random(0.5, 1), Math.random() * 0.5)));
        else world.add(new Sphere(center, 0.2, new Dielectric(1.5)));
      }
    }
  }
  world.add(new Sphere(new Point3(0, 1, 0), 1.0, new Dielectric(1.5)));
  world.add(new Sphere(new Point3(-4, 1, 0), 1.0, new Lambertian(new Color(0.4, 0.2, 0.1))));
  world.add(new Sphere(new Point3(4, 1, 0), 1.0, new Metal(new Color(0.7, 0.6, 0.5), 0.0)));
  return world;
}

function createSimpleScene() {
  const world = new HittableList();
  world.add(new Sphere(new Point3(0, -100.5, -1), 100, new Lambertian(new Color(0.8, 0.8, 0.0))));
  world.add(new Sphere(new Point3(0, 0, -1), 0.5, new Lambertian(new Color(0.1, 0.2, 0.5))));
  world.add(new Sphere(new Point3(-1, 0, -1), 0.5, new Dielectric(1.5)));
  world.add(new Sphere(new Point3(-1, 0, -1), -0.4, new Dielectric(1.5)));
  world.add(new Sphere(new Point3(1, 0, -1), 0.5, new Metal(new Color(0.8, 0.6, 0.2), 0.0)));
  return world;
}

const scenes = [
  {
    name: 'three-spheres',
    world: createSimpleScene(),
    cam: { lookFrom: new Point3(-2, 2, 1), lookAt: new Point3(0, 0, -1), vfov: 20, aspectRatio: 3/2 },
    width: 400, spp: 100
  },
  {
    name: 'random-scene',
    world: createRandomScene(),
    cam: { lookFrom: new Point3(13, 2, 3), lookAt: new Point3(0, 0, 0), vfov: 20, aspectRatio: 3/2, aperture: 0.1, focusDist: 10 },
    width: 400, spp: 50
  }
];

for (const s of scenes) {
  const height = Math.floor(s.width / s.cam.aspectRatio);
  console.error(`Rendering ${s.name} (${s.width}x${height}, ${s.spp} spp)...`);
  const start = performance.now();

  const cam = new Camera(s.cam);
  const renderer = new Renderer({
    width: s.width, height, samplesPerPixel: s.spp, maxDepth: 50,
    camera: cam, world: s.world
  });

  const ppm = renderer.renderPPM();
  writeFileSync(`examples/${s.name}.ppm`, ppm);
  const elapsed = ((performance.now() - start) / 1000).toFixed(1);
  console.error(`  → ${s.name}.ppm (${elapsed}s)`);
}

console.error('Done! Convert with: convert examples/*.ppm examples/*.png');
