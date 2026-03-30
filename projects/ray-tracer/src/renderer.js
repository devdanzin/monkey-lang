// renderer.js — The core ray tracing loop

import { Color, Vec3 } from './vec3.js';
import { BVHNode } from './bvh.js';

export class Renderer {
  constructor({
    width = 400,
    height = 225,
    samplesPerPixel = 100,
    maxDepth = 50,
    camera,
    world,
    background = null  // null = sky gradient
  } = {}) {
    this.width = width;
    this.height = height;
    this.samplesPerPixel = samplesPerPixel;
    this.maxDepth = maxDepth;
    this.camera = camera;
    this.world = world;
    this.background = background;

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
        // Sky gradient (background)
        let bg;
        if (this.background) {
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

      currentAttenuation = currentAttenuation.mul(result.attenuation);
      currentRay = result.scattered;
    }

    return totalEmitted; // Max depth reached
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
    const pixels = this.render((p) => {
      if (Math.floor(p * 100) % 10 === 0) {
        process.stderr.write(`\r${Math.floor(p * 100)}%`);
      }
    });
    process.stderr.write('\r100%\n');

    let ppm = `P3\n${this.width} ${this.height}\n255\n`;
    for (let i = 0; i < pixels.length; i += 4) {
      ppm += `${pixels[i]} ${pixels[i + 1]} ${pixels[i + 2]}\n`;
    }
    return ppm;
  }
}
