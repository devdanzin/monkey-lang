// renderer.js — The core ray tracing loop

import { Color, Vec3 } from './vec3.js';
import { Ray } from './ray.js';
import { BVHNode } from './bvh.js';

export class Renderer {
  constructor({
    width = 400,
    height = 225,
    samplesPerPixel = 100,
    maxDepth = 50,
    camera,
    world,
    background = null,  // null = sky gradient
    backgroundFn = null, // Function(ray) → Color — dynamic background
    lights = []          // Array of area light objects (rectangles/spheres with DiffuseLight)
  } = {}) {
    this.width = width;
    this.height = height;
    this.samplesPerPixel = samplesPerPixel;
    this.maxDepth = maxDepth;
    this.camera = camera;
    this.world = world;
    this.background = background;
    this.backgroundFn = backgroundFn;
    this.lights = lights; // For importance sampling
    this.environment = null;

    // Build BVH from world objects if world is a HittableList
    if (world.objects && world.objects.length > 4) {
      this.scene = new BVHNode([...world.objects]);
    } else {
      this.scene = world;
    }
  }

  // Trace a single ray (iterative for performance)
  rayColor(ray, depth) {
    let currentRay = ray;
    let currentAttenuation = new Color(1, 1, 1);
    let totalEmitted = new Color(0, 0, 0);

    for (let d = 0; d < depth; d++) {
      const rec = this.scene.hit(currentRay, 0.001, Infinity);

      if (!rec) {
        // Sky/background
        let bg;
        if (this.backgroundFn) {
          bg = this.backgroundFn(currentRay);
        } else if (this.environment) {
          bg = this.environment.sample(currentRay.direction);
        } else if (this.background) {
          bg = this.background;
        } else {
          const unitDirection = currentRay.direction.unit();
          const t = 0.5 * (unitDirection.y + 1.0);
          bg = new Color(1, 1, 1).mul(1 - t).add(new Color(0.5, 0.7, 1.0).mul(t));
        }
        return totalEmitted.add(currentAttenuation.mul(bg));
      }

      // Emitted light
      const emitted = rec.material.emitted
        ? rec.material.emitted(0, 0, rec.p)
        : new Color(0, 0, 0);
      totalEmitted = totalEmitted.add(currentAttenuation.mul(emitted));

      const result = rec.material.scatter(currentRay, rec);
      if (!result) {
        return totalEmitted;
      }

      // Direct light sampling (next event estimation) for area lights
      if (this.lights.length > 0 && !rec.material.emitted) {
        const directLight = this._sampleLights(rec);
        totalEmitted = totalEmitted.add(currentAttenuation.mul(result.attenuation).mul(directLight));
      }

      currentAttenuation = currentAttenuation.mul(result.attenuation);
      currentRay = result.scattered;
    }

    return totalEmitted; // Max depth reached
  }

  // Sample area lights for direct illumination (next event estimation)
  _sampleLights(rec) {
    let totalLight = new Color(0, 0, 0);

    for (const light of this.lights) {
      if (!light.randomPoint || !light.material?.emitted) continue;

      // Random point on the light surface
      const lightPoint = light.randomPoint();
      const toLight = lightPoint.sub(rec.p);
      const distSq = toLight.lengthSquared();
      const dist = Math.sqrt(distSq);
      const lightDir = toLight.mul(1 / dist);

      // Check if surface faces the light
      const cosTheta = lightDir.dot(rec.normal);
      if (cosTheta <= 0) continue;

      // Check if light faces the surface
      const lightNormal = light.normal || new Vec3(0, -1, 0);
      const cosAlpha = Math.abs(lightDir.negate().dot(lightNormal));
      if (cosAlpha <= 0) continue;

      // Shadow ray
      const shadowRay = new Ray(rec.p, lightDir);
      const shadowHit = this.scene.hit(shadowRay, 0.001, dist - 0.001);
      if (shadowHit) continue; // Occluded

      // Light contribution: Le * cos(theta) * cos(alpha) * area / dist^2
      const lightEmission = light.material.emitted(0, 0, lightPoint);
      const lightArea = light.area ? light.area() : 1;
      const contribution = lightEmission.mul(cosTheta * cosAlpha * lightArea / (distSq * Math.PI));
      totalLight = totalLight.add(contribution);
    }

    return totalLight;
  }

  // Render to a flat RGBA array (for Canvas or image output)
  render(onProgress = null) {
    const pixels = new Uint8ClampedArray(this.width * this.height * 4);
    let pixelsDone = 0;
    const totalPixels = this.width * this.height;

    for (let j = this.height - 1; j >= 0; j--) {
      for (let i = 0; i < this.width; i++) {
        let color = new Color(0, 0, 0);

        for (let s = 0; s < this.samplesPerPixel; s++) {
          const u = (i + Math.random()) / (this.width - 1);
          const v = (j + Math.random()) / (this.height - 1);
          const ray = this.camera.getRay(u, v);
          color = color.add(this.rayColor(ray, this.maxDepth));
        }

        // Average and gamma-correct (gamma 2 = sqrt)
        const scale = 1.0 / this.samplesPerPixel;
        const r = Math.sqrt(color.x * scale);
        const g = Math.sqrt(color.y * scale);
        const b = Math.sqrt(color.z * scale);

        const idx = ((this.height - 1 - j) * this.width + i) * 4;
        pixels[idx] = Math.floor(256 * Math.max(0, Math.min(0.999, r)));
        pixels[idx + 1] = Math.floor(256 * Math.max(0, Math.min(0.999, g)));
        pixels[idx + 2] = Math.floor(256 * Math.max(0, Math.min(0.999, b)));
        pixels[idx + 3] = 255;

        pixelsDone++;
      }

      if (onProgress) {
        onProgress(pixelsDone / totalPixels);
      }
    }

    return pixels;
  }

  // Render to PPM format (portable pixmap — simple image format)
  renderPPM() {
    const startTime = performance.now();
    let lastUpdate = startTime;
    
    const pixels = this.render((p) => {
      const now = performance.now();
      if (now - lastUpdate > 500 || p >= 0.999) { // Update every 500ms
        lastUpdate = now;
        const elapsed = (now - startTime) / 1000;
        const eta = p > 0 ? (elapsed / p) * (1 - p) : 0;
        const pct = Math.floor(p * 100);
        const bar = '█'.repeat(Math.floor(p * 30)) + '░'.repeat(30 - Math.floor(p * 30));
        const raysPerSec = (p * this.width * this.height * this.samplesPerPixel) / elapsed;
        process.stderr.write(`\r  ${bar} ${pct}% | ${elapsed.toFixed(1)}s elapsed | ETA ${eta.toFixed(1)}s | ${(raysPerSec/1e6).toFixed(1)}M rays/s`);
      }
    });
    
    const totalTime = ((performance.now() - startTime) / 1000).toFixed(1);
    const totalRays = this.width * this.height * this.samplesPerPixel;
    process.stderr.write(`\r  ${'█'.repeat(30)} 100% | ${totalTime}s | ${(totalRays/1e6).toFixed(1)}M rays\n`);

    let ppm = `P3\n${this.width} ${this.height}\n255\n`;
    for (let i = 0; i < pixels.length; i += 4) {
      ppm += `${pixels[i]} ${pixels[i + 1]} ${pixels[i + 2]}\n`;
    }
    return ppm;
  }
}
