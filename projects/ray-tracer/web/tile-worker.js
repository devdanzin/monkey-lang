// tile-worker.js — Renders a tile (rectangular region) of the image
importScripts('bundle.js');

const { Vec3, Camera, BVHNode, HittableList,
        createRandomScene, createSimpleScene, createCornellBox,
        createGlassStudy, createMetalShowcase, createLitRoom, createTexturedWorld, createSmokyCornell, createSolarSystem, createShowcase, createMotionBlur, createFinalScene, createMuseum } = self.RayTracer;

self.onmessage = function(e) {
  const { tile, config } = e.data;
  const { width, height, samplesPerPixel, maxDepth, scene, cameraConfig, background, renderMode, bgMode } = config;
  const { x0, y0, x1, y1, tileId } = tile;

  // Notify main thread that we're building the scene
  self.postMessage({ building: true, tileId: tile.tileId });

  // Build scene (each worker builds its own — no shared state needed)
  let world;
  if (scene === 'random') world = createRandomScene();
  else if (scene === 'cornell') world = createCornellBox();
  else if (scene === 'glass') world = createGlassStudy();
  else if (scene === 'metal') world = createMetalShowcase();
  else if (scene === 'lit') world = createLitRoom();
  else if (scene === 'textured') world = createTexturedWorld();
  else if (scene === 'smoky') world = createSmokyCornell();
  else if (scene === 'solar') world = createSolarSystem();
  else if (scene === 'showcase') world = createShowcase();
  else if (scene === 'motion') world = createMotionBlur();
  else if (scene === 'final') world = createFinalScene();
  else if (scene === 'museum') world = createMuseum();
  else if (scene === 'sunset') world = createSimpleScene();
  else world = createSimpleScene();

  let sceneHit;
  if (world.objects && world.objects.length > 4) {
    sceneHit = new BVHNode([...world.objects]);
  } else {
    sceneHit = world;
  }

  const cam = new Camera(cameraConfig);
  const bg = background ? new Vec3(background.x, background.y, background.z) : null;

  const tileW = x1 - x0;
  const tileH = y1 - y0;
  const pixels = new Uint8ClampedArray(tileW * tileH * 4);

  for (let py = y0; py < y1; py++) {
    const j = height - 1 - py; // Flip y (image coords are top-down)
    for (let px = x0; px < x1; px++) {
      let r = 0, g = 0, b = 0;

      for (let s = 0; s < samplesPerPixel; s++) {
        const u = (px + Math.random()) / (width - 1);
        const v = (j + Math.random()) / (height - 1);
        const ray = cam.getRay(u, v);

        let color;
        if (renderMode === 'normals') {
          const rec = sceneHit.hit(ray, 0.001, Infinity);
          if (rec) {
            const n = rec.normal;
            color = new Vec3((n.x+1)*0.5, (n.y+1)*0.5, (n.z+1)*0.5);
          } else {
            color = new Vec3(0, 0, 0);
          }
        } else if (renderMode === 'depth') {
          const rec = sceneHit.hit(ray, 0.001, Infinity);
          if (rec) {
            const d = 1 - Math.min(rec.t / 20, 1);
            color = new Vec3(d, d, d);
          } else {
            color = new Vec3(0.5, 0.7, 1.0);
          }
        } else if (renderMode === 'flat') {
          const rec = sceneHit.hit(ray, 0.001, Infinity);
          if (rec && rec.material.texture) {
            color = rec.material.texture.value(0, 0, rec.p);
          } else if (rec && rec.material.albedo) {
            color = rec.material.albedo;
          } else if (rec && rec.material.emit) {
            color = rec.material.emit;
          } else if (!rec) {
            if (bg) color = bg;
            else {
              const ud = ray.direction.unit();
              const t = 0.5 * (ud.y + 1.0);
              color = new Vec3(1,1,1).mul(1-t).add(new Vec3(0.5,0.7,1.0).mul(t));
            }
          } else {
            color = new Vec3(0.5, 0.5, 0.5);
          }
        } else {
          color = rayColor(ray, sceneHit, maxDepth, bg, bgMode);
        }
        r += color.x; g += color.y; b += color.z;
      }

      const scale = 1.0 / samplesPerPixel;
      const idx = ((py - y0) * tileW + (px - x0)) * 4;
      pixels[idx]     = Math.floor(256 * Math.max(0, Math.min(0.999, Math.sqrt(r * scale))));
      pixels[idx + 1] = Math.floor(256 * Math.max(0, Math.min(0.999, Math.sqrt(g * scale))));
      pixels[idx + 2] = Math.floor(256 * Math.max(0, Math.min(0.999, Math.sqrt(b * scale))));
      pixels[idx + 3] = 255;
    }
  }

  self.postMessage({ tileId, x0, y0, tileW, tileH, pixels });
};

function rayColor(ray, world, depth, bg, bgMode) {
  if (depth <= 0) return new Vec3(0, 0, 0);
  const rec = world.hit(ray, 0.001, Infinity);
  if (rec) {
    const emitted = rec.material.emitted
      ? rec.material.emitted(0, 0, rec.p)
      : new Vec3(0, 0, 0);
    const result = rec.material.scatter(ray, rec);
    if (result) return emitted.add(rayColor(result.scattered, world, depth - 1, bg, bgMode).mul(result.attenuation));
    return emitted;
  }
  // Environment background
  if (bgMode === 'sunset') {
    const ud = ray.direction.unit();
    const t = 0.5 * (ud.y + 1.0);
    if (t < 0.35) return new Vec3(0.05, 0.05, 0.08);
    if (t < 0.5) { const h = (t-0.35)/0.15; return new Vec3(0.1+h*0.8, 0.05+h*0.35, 0.05+h*0.05); }
    if (t < 0.7) { const h = (t-0.5)/0.2; return new Vec3(0.9-h*0.6, 0.4-h*0.2, 0.1+h*0.4); }
    const h = (t-0.7)/0.3; return new Vec3(0.3-h*0.25, 0.2-h*0.15, 0.5-h*0.3);
  }
  if (bg) return bg;
  const unitDir = ray.direction.unit();
  const t = 0.5 * (unitDir.y + 1.0);
  return new Vec3(1, 1, 1).mul(1 - t).add(new Vec3(0.5, 0.7, 1.0).mul(t));
}
