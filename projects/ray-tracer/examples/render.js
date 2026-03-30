// render.js — Render the classic "Ray Tracing in One Weekend" final scene
import { Vec3, Point3, Color, HittableList, Sphere, Lambertian, Metal, Dielectric, Camera, Renderer } from '../src/index.js';

function randomScene() {
  const world = new HittableList();

  // Ground
  world.add(new Sphere(new Point3(0, -1000, 0), 1000, new Lambertian(new Color(0.5, 0.5, 0.5))));

  // Random small spheres
  for (let a = -11; a < 11; a++) {
    for (let b = -11; b < 11; b++) {
      const chooseMat = Math.random();
      const center = new Point3(a + 0.9 * Math.random(), 0.2, b + 0.9 * Math.random());

      if (center.sub(new Point3(4, 0.2, 0)).length() > 0.9) {
        if (chooseMat < 0.8) {
          // Diffuse
          const albedo = Color.random().mul(Color.random());
          world.add(new Sphere(center, 0.2, new Lambertian(albedo)));
        } else if (chooseMat < 0.95) {
          // Metal
          const albedo = Color.random(0.5, 1);
          const fuzz = Math.random() * 0.5;
          world.add(new Sphere(center, 0.2, new Metal(albedo, fuzz)));
        } else {
          // Glass
          world.add(new Sphere(center, 0.2, new Dielectric(1.5)));
        }
      }
    }
  }

  // Three big spheres
  world.add(new Sphere(new Point3(0, 1, 0), 1.0, new Dielectric(1.5)));
  world.add(new Sphere(new Point3(-4, 1, 0), 1.0, new Lambertian(new Color(0.4, 0.2, 0.1))));
  world.add(new Sphere(new Point3(4, 1, 0), 1.0, new Metal(new Color(0.7, 0.6, 0.5), 0.0)));

  return world;
}

// Parse args
const args = process.argv.slice(2);
const width = parseInt(args.find(a => a.startsWith('--width='))?.split('=')[1]) || 400;
const samples = parseInt(args.find(a => a.startsWith('--samples='))?.split('=')[1]) || 100;
const quick = args.includes('--quick');

const aspectRatio = 3 / 2;
const imgWidth = quick ? 200 : width;
const imgHeight = Math.floor(imgWidth / aspectRatio);
const spp = quick ? 10 : samples;

console.error(`Rendering ${imgWidth}x${imgHeight}, ${spp} samples/pixel...`);
const start = performance.now();

const world = randomScene();
const cam = new Camera({
  lookFrom: new Point3(13, 2, 3),
  lookAt: new Point3(0, 0, 0),
  vup: new Vec3(0, 1, 0),
  vfov: 20,
  aspectRatio,
  aperture: 0.1,
  focusDist: 10.0
});

const renderer = new Renderer({
  width: imgWidth,
  height: imgHeight,
  samplesPerPixel: spp,
  maxDepth: 50,
  camera: cam,
  world
});

const ppm = renderer.renderPPM();
process.stdout.write(ppm);

const elapsed = ((performance.now() - start) / 1000).toFixed(1);
console.error(`Done in ${elapsed}s (${(imgWidth * imgHeight * spp / 1e6).toFixed(1)}M rays)`);
