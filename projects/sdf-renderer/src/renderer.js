// renderer.js — SDF ray marcher with sphere marching

import { Vec3, vec3, clamp, mix } from './vec3.js';
import { estimateNormal } from './sdf.js';
import { writeFileSync } from 'node:fs';

// ===== Ray Marching =====
const MAX_STEPS = 128;
const MAX_DIST = 100;
const SURF_DIST = 0.001;

export function march(origin, direction, sceneFn) {
  let t = 0;
  for (let i = 0; i < MAX_STEPS; i++) {
    const p = origin.add(direction.mul(t));
    const d = sceneFn(p);
    if (d < SURF_DIST) return { hit: true, t, steps: i, point: p };
    t += d;
    if (t > MAX_DIST) break;
  }
  return { hit: false, t, steps: MAX_STEPS, point: origin.add(direction.mul(t)) };
}

// ===== Soft Shadows =====
export function softShadow(origin, direction, sceneFn, mint = 0.02, maxt = 10, k = 8) {
  let res = 1.0;
  let t = mint;
  for (let i = 0; i < 64 && t < maxt; i++) {
    const p = origin.add(direction.mul(t));
    const h = sceneFn(p);
    if (h < SURF_DIST) return 0.0;
    res = Math.min(res, k * h / t);
    t += clamp(h, 0.02, 0.5);
  }
  return clamp(res, 0, 1);
}

// ===== Ambient Occlusion =====
export function ambientOcclusion(p, n, sceneFn, steps = 5) {
  let occ = 0;
  let sca = 1;
  for (let i = 0; i < steps; i++) {
    const h = 0.01 + 0.12 * i;
    const d = sceneFn(p.add(n.mul(h)));
    occ += (h - d) * sca;
    sca *= 0.95;
  }
  return clamp(1 - 3 * occ, 0, 1);
}

// ===== Camera =====
export function lookAt(eye, target, up = vec3(0, 1, 0)) {
  const f = target.sub(eye).normalize();
  const r = f.cross(up).normalize();
  const u = r.cross(f);
  return { forward: f, right: r, up: u };
}

export function getRayDirection(uv, eye, target, fov = 1.0) {
  const cam = lookAt(eye, target);
  const rd = cam.right.mul(uv.x).add(cam.up.mul(uv.y)).add(cam.forward.mul(fov)).normalize();
  return rd;
}

// ===== Shading =====
export function shade(hit, sceneFn, lightPos, lightColor, ambientColor, eye) {
  if (!hit.hit) {
    // Sky gradient
    return vec3(0.5, 0.7, 1.0);
  }

  const p = hit.point;
  const n = estimateNormal(sceneFn, p);
  const l = lightPos.sub(p).normalize();
  const v = eye.sub(p).normalize();
  const h = l.add(v).normalize();

  // Diffuse (Lambertian)
  const diff = Math.max(0, n.dot(l));

  // Specular (Blinn-Phong)
  const spec = Math.pow(Math.max(0, n.dot(h)), 32);

  // Shadow
  const shadow = softShadow(p.add(n.mul(0.01)), l, sceneFn);

  // Ambient occlusion
  const ao = ambientOcclusion(p, n, sceneFn);

  // Combine
  const color = ambientColor.mul(ao)
    .add(lightColor.mul(diff * shadow))
    .add(vec3(1, 1, 1).mul(spec * shadow * 0.5));

  return color;
}

// ===== Renderer =====
export class Renderer {
  constructor(options = {}) {
    this.width = options.width || 320;
    this.height = options.height || 240;
    this.samples = options.samples || 1; // antialiasing samples per pixel
    this.eye = options.eye || vec3(0, 2, 5);
    this.target = options.target || vec3(0, 0, 0);
    this.lightPos = options.lightPos || vec3(5, 8, 5);
    this.lightColor = options.lightColor || vec3(1, 0.9, 0.8);
    this.ambientColor = options.ambientColor || vec3(0.1, 0.1, 0.15);
    this.fov = options.fov || 1.0;
    this.gamma = options.gamma || 2.2;
  }

  render(sceneFn) {
    const { width, height, samples, eye, target, lightPos, lightColor, ambientColor, fov, gamma } = this;
    const pixels = new Uint8Array(width * height * 3);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let color = vec3(0, 0, 0);

        for (let s = 0; s < samples; s++) {
          const jx = samples > 1 ? Math.random() : 0.5;
          const jy = samples > 1 ? Math.random() : 0.5;
          const u = ((x + jx) / width - 0.5) * 2 * (width / height);
          const v = -((y + jy) / height - 0.5) * 2;
          const uv = vec3(u, v, 0);
          const rd = getRayDirection(uv, eye, target, fov);
          const hit = march(eye, rd, sceneFn);
          const c = shade(hit, sceneFn, lightPos, lightColor, ambientColor, eye);
          color = color.add(c);
        }

        color = color.div(samples);

        // Gamma correction
        const r = Math.pow(clamp(color.x, 0, 1), 1 / gamma);
        const g = Math.pow(clamp(color.y, 0, 1), 1 / gamma);
        const b = Math.pow(clamp(color.z, 0, 1), 1 / gamma);

        const idx = (y * width + x) * 3;
        pixels[idx] = Math.floor(r * 255);
        pixels[idx + 1] = Math.floor(g * 255);
        pixels[idx + 2] = Math.floor(b * 255);
      }
    }

    return { width, height, pixels };
  }

  // Output as PPM (Portable PixMap)
  toPPM(image) {
    let ppm = `P3\n${image.width} ${image.height}\n255\n`;
    for (let i = 0; i < image.pixels.length; i += 3) {
      ppm += `${image.pixels[i]} ${image.pixels[i + 1]} ${image.pixels[i + 2]}\n`;
    }
    return ppm;
  }

  renderToFile(sceneFn, outputPath) {
    const image = this.render(sceneFn);
    const ppm = this.toPPM(image);
    writeFileSync(outputPath, ppm);
    return image;
  }
}
