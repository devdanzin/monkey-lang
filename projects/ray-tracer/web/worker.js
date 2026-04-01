// worker.js — Web Worker for progressive rendering
importScripts('bundle.js');

const { Vec3, Camera, BVHNode, HittableList,
        createRandomScene, createSimpleScene, createCornellBox,
        createGlassStudy, createMetalShowcase, createLitRoom, createTexturedWorld } = self.RayTracer;

let stopped = false;

self.onmessage = function(e) {
  const { action, config } = e.data;
  if (action === 'stop') { stopped = true; return; }
  if (action !== 'render') return;

  stopped = false;
  const { width, height, samplesPerPixel, maxDepth, scene, cameraConfig, background, bgMode, skyHour, skyTurbidity } = config;

  let world;
  if (scene === 'random') world = createRandomScene();
  else if (scene === 'cornell') world = createCornellBox();
  else if (scene === 'glass') world = createGlassStudy();
  else if (scene === 'metal') world = createMetalShowcase();
  else if (scene === 'lit') world = createLitRoom();
  else if (scene === 'textured') world = createTexturedWorld();
  else if (scene === 'preetham') world = createPreethamScene();
  else world = createSimpleScene();

  // Build BVH from world objects for acceleration
  let sceneHit;
  if (world.objects && world.objects.length > 4) {
    sceneHit = new BVHNode([...world.objects]);
  } else {
    sceneHit = world;
  }

  const cam = new Camera(cameraConfig);
  const bg = background ? new Vec3(background.x, background.y, background.z) : null;

  // Build Preetham sky function if needed
  let bgFn = null;
  if (bgMode === 'preetham') {
    bgFn = createPreethamBgFn(skyHour || 10, skyTurbidity || 2.5);
  }

  const rowPixels = new Uint8ClampedArray(width * 4);

  for (let j = height - 1; j >= 0; j--) {
    if (stopped) { self.postMessage({ type: 'stopped' }); return; }

    for (let i = 0; i < width; i++) {
      let r = 0, g = 0, b = 0;

      for (let s = 0; s < samplesPerPixel; s++) {
        const u = (i + Math.random()) / (width - 1);
        const v = (j + Math.random()) / (height - 1);
        const ray = cam.getRay(u, v);
        const color = rayColor(ray, sceneHit, maxDepth, bg, bgFn);
        r += color.x; g += color.y; b += color.z;
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

function rayColor(ray, world, depth, bg, bgFn) {
  if (depth <= 0) return new Vec3(0, 0, 0);
  const rec = world.hit(ray, 0.001, Infinity);
  if (rec) {
    const emitted = rec.material.emitted
      ? rec.material.emitted(0, 0, rec.p)
      : new Vec3(0, 0, 0);
    const result = rec.material.scatter(ray, rec);
    if (result) return emitted.add(rayColor(result.scattered, world, depth - 1, bg, bgFn).mul(result.attenuation));
    return emitted;
  }
  // Background
  if (bgFn) return bgFn(ray);
  if (bg) return bg;
  const unitDir = ray.direction.unit();
  const t = 0.5 * (unitDir.y + 1.0);
  return new Vec3(1, 1, 1).mul(1 - t).add(new Vec3(0.5, 0.7, 1.0).mul(t));
}

// --- Preetham Sky (inline for web worker) ---
function createPreethamBgFn(hour, turbidity) {
  // Sun direction from hour
  const solarAngle = (hour - 6) / 12 * Math.PI;
  const elevation = Math.sin(solarAngle) * (Math.PI / 2);
  const azimuth = solarAngle;
  const sunDir = new Vec3(
    Math.cos(elevation) * Math.sin(azimuth),
    Math.sin(elevation),
    Math.cos(elevation) * Math.cos(azimuth)
  ).unit();

  const thetaS = Math.acos(Math.max(0, Math.min(1, sunDir.y)));
  const T = turbidity;
  const intensity = Math.max(0.1, Math.sin(Math.max(0, elevation)) * 1.5);

  // Perez coefficients
  const cY = [[0.1787, -1.4630], [-0.3554, 0.4275], [-0.0227, 5.3251], [0.1206, -2.5771], [-0.0670, 0.3703]].map(([a, b]) => a * T + b);
  const cx = [[-0.0193, -0.2592], [-0.0665, 0.0008], [-0.0004, 0.2125], [-0.0641, -0.8989], [-0.0033, 0.0452]].map(([a, b]) => a * T + b);
  const cy = [[-0.0167, -0.2608], [-0.0950, 0.0092], [-0.0079, 0.2102], [-0.0441, -1.6537], [-0.0109, 0.0529]].map(([a, b]) => a * T + b);

  // Zenith values
  const chi = (4.0 / 9.0 - T / 120.0) * (Math.PI - 2 * thetaS);
  const zenithY = (4.0453 * T - 4.9710) * Math.tan(chi) - 0.2155 * T + 2.4192;

  const t2 = thetaS * thetaS, t3 = t2 * thetaS, T2 = T * T;
  const zenithx = (0.00166*t3-0.00375*t2+0.00209*thetaS+0)*T2+(-0.02903*t3+0.06377*t2-0.03202*thetaS+0.00394)*T+(0.11693*t3-0.21196*t2+0.06052*thetaS+0.25886);
  const zenithy = (0.00275*t3-0.00610*t2+0.00317*thetaS+0)*T2+(-0.04214*t3+0.08970*t2-0.04153*thetaS+0.00516)*T+(0.15346*t3-0.26756*t2+0.06670*thetaS+0.26688);

  function perez(c, theta, gamma) {
    const ct = Math.max(0.001, Math.cos(theta));
    const cg = Math.cos(gamma);
    return (1 + c[0] * Math.exp(c[1] / ct)) * (1 + c[2] * Math.exp(c[3] * gamma) + c[4] * cg * cg);
  }

  // Precompute zenith Perez values
  const pY0 = perez(cY, 0, thetaS);
  const px0 = perez(cx, 0, thetaS);
  const py0 = perez(cy, 0, thetaS);

  return function(ray) {
    const dir = ray.direction.unit();
    if (dir.y < 0) {
      const t = Math.max(0, -dir.y);
      return new Vec3(0.05 * (1 - t), 0.05 * (1 - t), 0.08 * (1 - t));
    }
    const theta = Math.acos(Math.max(0, Math.min(1, dir.y)));
    const cosGamma = Math.max(-1, Math.min(1, dir.x * sunDir.x + dir.y * sunDir.y + dir.z * sunDir.z));
    const gamma = Math.acos(cosGamma);

    const Y = zenithY * perez(cY, theta, gamma) / pY0;
    const x = zenithx * perez(cx, theta, gamma) / px0;
    const y = zenithy * perez(cy, theta, gamma) / py0;

    if (y <= 0) return new Vec3(0, 0, 0);
    const Yabs = Math.max(0, Y) * intensity;
    const X = (x / y) * Yabs;
    const Z = ((1 - x - y) / y) * Yabs;
    const r = Math.max(0, 3.2406 * X - 1.5372 * Yabs - 0.4986 * Z);
    const g = Math.max(0, -0.9689 * X + 1.8758 * Yabs + 0.0415 * Z);
    const b = Math.max(0, 0.0557 * X - 0.2040 * Yabs + 1.0570 * Z);

    // Sun disk
    const sunAngle = gamma;
    const sunRadius = 0.02;
    if (sunAngle < sunRadius) {
      const st = sunAngle / sunRadius;
      const limb = 1 - st * st;
      return new Vec3(r + limb * 50, g + limb * 47.5, b + limb * 40);
    } else if (sunAngle < sunRadius * 3) {
      const st = (sunAngle - sunRadius) / (sunRadius * 2);
      const glow = Math.exp(-st * 3) * 5;
      return new Vec3(r + glow, g + glow * 0.9, b + glow * 0.7);
    }
    return new Vec3(r, g, b);
  };
}

function createPreethamScene() {
  const { Sphere, XZRect, Lambertian, Metal, Dielectric, CheckerTexture, MarbleTexture } = self.RayTracer;
  const world = new HittableList();

  // Reflective ground with checker
  world.add(new XZRect(-20, 20, -20, 20, 0,
    new Metal(new Vec3(0.7, 0.7, 0.7), 0.15)));

  // Central glass sphere
  world.add(new Sphere(new Vec3(0, 1.5, 0), 1.5, new Dielectric(1.5)));

  // Metal spheres
  world.add(new Sphere(new Vec3(-3, 1, 2), 1, new Metal(new Vec3(0.8, 0.2, 0.2), 0.05)));
  world.add(new Sphere(new Vec3(3, 1, 2), 1, new Metal(new Vec3(0.2, 0.2, 0.8), 0.05)));
  world.add(new Sphere(new Vec3(-1.5, 0.6, 3), 0.6, new Metal(new Vec3(0.9, 0.7, 0.2), 0.02)));

  // Marble sphere
  world.add(new Sphere(new Vec3(1.5, 0.7, 3.5), 0.7, new Lambertian(new MarbleTexture())));

  // Small scattered spheres
  for (let i = 0; i < 15; i++) {
    const x = -6 + Math.random() * 12;
    const z = -3 + Math.random() * 8;
    const r = 0.15 + Math.random() * 0.25;
    const color = new Vec3(0.2 + Math.random() * 0.6, 0.2 + Math.random() * 0.6, 0.2 + Math.random() * 0.6);
    if (Math.random() > 0.5) {
      world.add(new Sphere(new Vec3(x, r, z), r, new Lambertian(color)));
    } else {
      world.add(new Sphere(new Vec3(x, r, z), r, new Metal(color, Math.random() * 0.3)));
    }
  }

  return world;
}
