// benchmark.js — Multi-core CLI benchmark
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { Vec3, Point3, Color, HittableList, Sphere, Lambertian, Metal, Dielectric, Camera, Renderer, BVHNode } from '../src/index.js';
import { cpus } from 'os';
import { fileURLToPath } from 'url';

function createScene() {
  const world = new HittableList();
  world.add(new Sphere(new Point3(0, -1000, 0), 1000, new Lambertian(new Color(0.5, 0.5, 0.5))));
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

if (!isMainThread) {
  // Worker: render assigned rows
  const { width, height, spp, maxDepth, startRow, endRow } = workerData;

  const world = createScene();
  const cam = new Camera({
    lookFrom: new Point3(13, 2, 3),
    lookAt: new Point3(0, 0, 0),
    vup: new Vec3(0, 1, 0),
    vfov: 20,
    aspectRatio: 3 / 2,
    aperture: 0.1,
    focusDist: 10.0
  });

  // Build BVH
  const scene = new BVHNode([...world.objects]);

  const rowCount = endRow - startRow;
  const pixels = new Uint8ClampedArray(width * rowCount * 4);

  for (let j = startRow; j < endRow; j++) {
    const jFlip = height - 1 - j;
    for (let i = 0; i < width; i++) {
      let r = 0, g = 0, b = 0;
      for (let s = 0; s < spp; s++) {
        const u = (i + Math.random()) / (width - 1);
        const v = (jFlip + Math.random()) / (height - 1);
        const ray = cam.getRay(u, v);
        const color = rayColor(ray, scene, maxDepth);
        r += color.x; g += color.y; b += color.z;
      }
      const scale = 1.0 / spp;
      const idx = ((j - startRow) * width + i) * 4;
      pixels[idx] = Math.floor(256 * Math.max(0, Math.min(0.999, Math.sqrt(r * scale))));
      pixels[idx + 1] = Math.floor(256 * Math.max(0, Math.min(0.999, Math.sqrt(g * scale))));
      pixels[idx + 2] = Math.floor(256 * Math.max(0, Math.min(0.999, Math.sqrt(b * scale))));
      pixels[idx + 3] = 255;
    }
  }

  parentPort.postMessage({ startRow, pixels });
  process.exit(0);
}

function rayColor(ray, world, depth) {
  if (depth <= 0) return new Color(0, 0, 0);
  const rec = world.hit(ray, 0.001, Infinity);
  if (rec) {
    const result = rec.material.scatter(ray, rec);
    if (result) return rayColor(result.scattered, world, depth - 1).mul(result.attenuation);
    return new Color(0, 0, 0);
  }
  const unitDir = ray.direction.unit();
  const t = 0.5 * (unitDir.y + 1.0);
  return new Color(1, 1, 1).mul(1 - t).add(new Color(0.5, 0.7, 1.0).mul(t));
}

// Main thread: orchestrate multi-core rendering
async function benchmark() {
  const width = 200;
  const aspectRatio = 3 / 2;
  const height = Math.floor(width / aspectRatio);
  const spp = 10;
  const maxDepth = 50;
  const numCores = cpus().length;

  console.log(`Ray Tracer Benchmark`);
  console.log(`  Resolution: ${width}×${height}`);
  console.log(`  Samples: ${spp}/pixel`);
  console.log(`  Total rays: ${(width * height * spp / 1e6).toFixed(1)}M`);
  console.log(`  CPU cores: ${numCores}`);
  console.log();

  // Single-threaded baseline
  console.log('Single-threaded...');
  const t0 = performance.now();
  const world = createScene();
  const cam = new Camera({
    lookFrom: new Point3(13, 2, 3), lookAt: new Point3(0, 0, 0),
    vup: new Vec3(0, 1, 0), vfov: 20, aspectRatio, aperture: 0.1, focusDist: 10
  });
  const renderer = new Renderer({ width, height, samplesPerPixel: spp, maxDepth, camera: cam, world });
  renderer.render();
  const singleMs = performance.now() - t0;
  console.log(`  → ${(singleMs / 1000).toFixed(2)}s`);

  // Multi-threaded
  for (const threadCount of [2, 4, Math.min(numCores, 8)]) {
    if (threadCount > numCores) continue;
    console.log(`\n${threadCount} threads...`);
    const t1 = performance.now();

    const rowsPerThread = Math.ceil(height / threadCount);
    const promises = [];

    for (let i = 0; i < threadCount; i++) {
      const startRow = i * rowsPerThread;
      const endRow = Math.min(startRow + rowsPerThread, height);
      if (startRow >= height) break;

      promises.push(new Promise((resolve, reject) => {
        const w = new Worker(fileURLToPath(import.meta.url), {
          workerData: { width, height, spp, maxDepth, startRow, endRow }
        });
        w.on('message', resolve);
        w.on('error', reject);
      }));
    }

    await Promise.all(promises);
    const multiMs = performance.now() - t1;
    const speedup = singleMs / multiMs;
    console.log(`  → ${(multiMs / 1000).toFixed(2)}s (${speedup.toFixed(1)}x speedup)`);
  }

  console.log('\nDone!');
}

benchmark().catch(console.error);
