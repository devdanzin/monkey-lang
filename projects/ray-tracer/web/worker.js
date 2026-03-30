// worker.js — Web Worker for progressive rendering
importScripts('bundle.js');

const { Vec3, Camera, HittableList, Sphere, Lambertian, Metal, Dielectric,
        createRandomScene, createSimpleScene, createCornellBox } = self.RayTracer;

let stopped = false;

self.onmessage = function(e) {
  const { action, config } = e.data;

  if (action === 'stop') { stopped = true; return; }
  if (action !== 'render') return;

  stopped = false;
  const { width, height, samplesPerPixel, maxDepth, scene, cameraConfig } = config;

  // Build scene
  let world;
  if (scene === 'random') world = createRandomScene();
  else if (scene === 'cornell') world = createCornellBox();
  else world = createSimpleScene();

  const cam = new Camera(cameraConfig);

  // Progressive rendering: send one row at a time
  const rowPixels = new Uint8ClampedArray(width * 4);

  for (let j = height - 1; j >= 0; j--) {
    if (stopped) { self.postMessage({ type: 'stopped' }); return; }

    for (let i = 0; i < width; i++) {
      let r = 0, g = 0, b = 0;

      for (let s = 0; s < samplesPerPixel; s++) {
        const u = (i + Math.random()) / (width - 1);
        const v = (j + Math.random()) / (height - 1);
        const ray = cam.getRay(u, v);
        const color = rayColor(ray, world, maxDepth);
        r += color.x;
        g += color.y;
        b += color.z;
      }

      const scale = 1.0 / samplesPerPixel;
      const idx = i * 4;
      rowPixels[idx]     = Math.floor(256 * Math.max(0, Math.min(0.999, Math.sqrt(r * scale))));
      rowPixels[idx + 1] = Math.floor(256 * Math.max(0, Math.min(0.999, Math.sqrt(g * scale))));
      rowPixels[idx + 2] = Math.floor(256 * Math.max(0, Math.min(0.999, Math.sqrt(b * scale))));
      rowPixels[idx + 3] = 255;
    }

    self.postMessage({
      type: 'row',
      row: height - 1 - j,
      pixels: new Uint8ClampedArray(rowPixels),
      progress: (height - j) / height
    });
  }

  self.postMessage({ type: 'done' });
};

function rayColor(ray, world, depth) {
  if (depth <= 0) return new Vec3(0, 0, 0);
  const rec = world.hit(ray, 0.001, Infinity);
  if (rec) {
    const result = rec.material.scatter(ray, rec);
    if (result) return rayColor(result.scattered, world, depth - 1).mul(result.attenuation);
    return new Vec3(0, 0, 0);
  }
  const unitDir = ray.direction.unit();
  const t = 0.5 * (unitDir.y + 1.0);
  return new Vec3(1, 1, 1).mul(1 - t).add(new Vec3(0.5, 0.7, 1.0).mul(t));
}
