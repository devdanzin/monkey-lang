// showcase-advanced.js — Demonstrates all advanced features:
// Image textures, area lights, volumes (fog), motion blur, CSG, BVH
//
// Usage: node examples/showcase-advanced.js > showcase.ppm

import { 
  Vec3, Color, 
  Camera, Renderer, HittableList,
  Sphere, XZRect, XYRect, YZRect,
  Lambertian, Metal, Dielectric, DiffuseLight,
  ImageTexture, CheckerTexture, NoiseTexture, MarbleTexture,
  MovingSphere,
  ConstantMedium,
} from '../src/index.js';

// Build the scene
const world = new HittableList();
const lights = [];

// === Ground: checker floor ===
const checker = new CheckerTexture(
  new Color(0.2, 0.3, 0.1),
  new Color(0.9, 0.9, 0.9),
  10
);
world.add(new XZRect(-20, 20, -20, 20, 0, new Lambertian(checker)));

// === Area light on ceiling ===
const ceilingLight = new XZRect(-3, 3, -3, 3, 12, 
  new DiffuseLight(new Color(12, 12, 12))
);
world.add(ceilingLight);
lights.push(ceilingLight);

// === Image texture sphere ===
// Create a procedural "earth-like" image texture (blue/green)
const imgW = 64, imgH = 32;
const imgData = new Uint8Array(imgW * imgH * 3);
for (let y = 0; y < imgH; y++) {
  for (let x = 0; x < imgW; x++) {
    const idx = (y * imgW + x) * 3;
    const u = x / imgW, v = y / imgH;
    // Continent-like pattern
    const noise = Math.sin(u * 12) * Math.cos(v * 8) * 0.5 + 0.5;
    if (noise > 0.45) {
      // Land (green-brown)
      imgData[idx] = 50 + noise * 100;
      imgData[idx + 1] = 120 + noise * 60;
      imgData[idx + 2] = 30;
    } else {
      // Ocean (blue)
      imgData[idx] = 20;
      imgData[idx + 1] = 50 + noise * 80;
      imgData[idx + 2] = 150 + noise * 100;
    }
  }
}
const earthTex = new ImageTexture(imgData, imgW, imgH);
world.add(new Sphere(new Vec3(0, 2, 0), 2, new Lambertian(earthTex)));

// === Marble sphere ===
const marble = new MarbleTexture(new Color(0.8, 0.8, 0.9), 5);
world.add(new Sphere(new Vec3(-5, 1.5, 0), 1.5, new Lambertian(marble)));

// === Metal sphere ===
world.add(new Sphere(new Vec3(5, 1.5, 0), 1.5, new Metal(new Color(0.8, 0.6, 0.2), 0.1)));

// === Glass sphere ===
world.add(new Sphere(new Vec3(2, 1, 4), 1, new Dielectric(1.5)));

// === Motion blur sphere (bouncing ball) ===
world.add(new MovingSphere(
  new Vec3(-2, 1, 4),    // center at t=0
  new Vec3(-2, 2, 4),    // center at t=1 (bouncing up)
  0, 1,                   // time range
  1,                      // radius
  new Lambertian(new Color(0.9, 0.2, 0.2))
));

// === Volume (fog sphere) ===
const fogBoundary = new Sphere(new Vec3(0, 3, -5), 3, new Dielectric(1.5));
world.add(new ConstantMedium(fogBoundary, 0.1, new Color(0.8, 0.8, 1.0)));

// === Small noise-textured spheres ===
const noise = new NoiseTexture(new Color(0.7, 0.5, 0.3), 8);
world.add(new Sphere(new Vec3(-3, 0.5, 3), 0.5, new Lambertian(noise)));
world.add(new Sphere(new Vec3(3, 0.5, 3), 0.5, new Lambertian(noise)));

// === Wall light (YZ rectangle) ===
const wallLight = new YZRect(1, 5, -2, 2, -8,
  new DiffuseLight(new Color(6, 6, 8))
);
world.add(wallLight);
lights.push(wallLight);

// Camera
const camera = new Camera({
  lookFrom: new Vec3(0, 6, 15),
  lookAt: new Vec3(0, 2, 0),
  vUp: new Vec3(0, 1, 0),
  vfov: 40,
  aspectRatio: 16 / 9,
  aperture: 0.05,
  focusDist: 15,
  time0: 0,
  time1: 1,
});

// Render
const width = 400;
const height = Math.floor(width / (16 / 9));
const renderer = new Renderer({
  width,
  height,
  samplesPerPixel: 50,
  maxDepth: 20,
  camera,
  world,
  lights,
  background: new Color(0.01, 0.01, 0.02), // Very dark background
});

console.error('Rendering showcase scene...');
console.error(`${width}x${height}, 50 spp, max depth 20`);
const start = performance.now();
const pixels = renderer.render((pct) => {
  if (pct % 10 === 0) console.error(`  ${pct}%`);
});
const elapsed = ((performance.now() - start) / 1000).toFixed(1);
console.error(`Done in ${elapsed}s`);

// Output PPM
process.stdout.write(`P3\n${width} ${height}\n255\n`);
for (let j = 0; j < height; j++) {
  for (let i = 0; i < width; i++) {
    const idx = (j * width + i) * 4;
    process.stdout.write(`${pixels[idx]} ${pixels[idx+1]} ${pixels[idx+2]}\n`);
  }
}
