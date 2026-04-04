// scene.js — Scene builder with material system and reflection

import { Vec3, vec3, clamp, mix } from './vec3.js';
import { estimateNormal } from './sdf.js';
import { march, softShadow, ambientOcclusion, lookAt } from './renderer.js';

// ===== Material =====
export class Material {
  constructor(options = {}) {
    this.color = options.color || vec3(0.8, 0.8, 0.8);
    this.specular = options.specular ?? 0.5;
    this.roughness = options.roughness ?? 0.3;
    this.reflectivity = options.reflectivity ?? 0;
    this.shininess = options.shininess ?? 32;
  }
}

// ===== Scene Object =====
export class SceneObject {
  constructor(sdfFn, material = new Material()) {
    this.sdfFn = sdfFn;
    this.material = material;
  }
}

// ===== Scene =====
export class Scene {
  constructor() {
    this.objects = [];
    this.lights = [];
    this.backgroundColor = vec3(0.5, 0.7, 1.0);
    this.ambientColor = vec3(0.1, 0.1, 0.15);
    this.maxBounces = 3;
  }

  add(sdfFn, material = new Material()) {
    this.objects.push(new SceneObject(sdfFn, material));
    return this;
  }

  addLight(position, color = vec3(1, 0.9, 0.8), intensity = 1) {
    this.lights.push({ position, color: color.mul(intensity) });
    return this;
  }

  // Combined SDF: finds closest object and returns distance + material
  evaluate(p) {
    let minDist = Infinity;
    let closestMat = null;
    for (const obj of this.objects) {
      const d = obj.sdfFn(p);
      if (d < minDist) {
        minDist = d;
        closestMat = obj.material;
      }
    }
    return { distance: minDist, material: closestMat };
  }

  // SDF function for the whole scene (for marching)
  sdf(p) {
    let min = Infinity;
    for (const obj of this.objects) {
      min = Math.min(min, obj.sdfFn(p));
    }
    return min;
  }

  // Shade a hit point with material
  shadeHit(hit, eye, bounceDepth = 0) {
    if (!hit.hit) return this.backgroundColor;

    const p = hit.point;
    const sceneSdf = (p) => this.sdf(p);
    const n = estimateNormal(sceneSdf, p);
    const { material } = this.evaluate(p);
    const v = eye.sub(p).normalize();

    let color = this.ambientColor.mul(material.color.x + material.color.y + material.color.z).div(3);

    // AO
    const ao = ambientOcclusion(p, n, sceneSdf);
    color = color.mul(ao);

    // For each light
    for (const light of this.lights) {
      const l = light.position.sub(p).normalize();
      const h = l.add(v).normalize();

      const diff = Math.max(0, n.dot(l));
      const spec = Math.pow(Math.max(0, n.dot(h)), material.shininess);
      const shadow = softShadow(p.add(n.mul(0.01)), l, sceneSdf);

      color = color.add(material.color.mul(diff * shadow).mul(light.color.x));
      color = color.add(vec3(1, 1, 1).mul(spec * shadow * material.specular));
    }

    // Reflection
    if (material.reflectivity > 0 && bounceDepth < this.maxBounces) {
      const reflDir = v.neg().reflect(n);
      const reflOrigin = p.add(n.mul(0.02));
      const reflHit = march(reflOrigin, reflDir, sceneSdf);
      const reflColor = this.shadeHit(reflHit, reflOrigin, bounceDepth + 1);
      color = color.mul(1 - material.reflectivity).add(reflColor.mul(material.reflectivity));
    }

    return color;
  }

  // Render the full scene
  render(options = {}) {
    const width = options.width || 320;
    const height = options.height || 240;
    const samples = options.samples || 1;
    const eye = options.eye || vec3(0, 2, 5);
    const target = options.target || vec3(0, 0, 0);
    const fov = options.fov || 1.0;
    const gamma = options.gamma || 2.2;

    const pixels = new Uint8Array(width * height * 3);
    const sceneSdf = (p) => this.sdf(p);
    const cam = lookAt(eye, target);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let color = vec3(0, 0, 0);

        for (let s = 0; s < samples; s++) {
          const jx = samples > 1 ? Math.random() : 0.5;
          const jy = samples > 1 ? Math.random() : 0.5;
          const u = ((x + jx) / width - 0.5) * 2 * (width / height);
          const v = -((y + jy) / height - 0.5) * 2;
          const rd = cam.right.mul(u).add(cam.up.mul(v)).add(cam.forward.mul(fov)).normalize();
          const hit = march(eye, rd, sceneSdf);
          const c = this.shadeHit(hit, eye);
          color = color.add(c);
        }

        color = color.div(samples);
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
}

// ===== Pre-built materials =====
export const materials = {
  red: new Material({ color: vec3(0.9, 0.1, 0.1), specular: 0.5 }),
  green: new Material({ color: vec3(0.1, 0.9, 0.1), specular: 0.3 }),
  blue: new Material({ color: vec3(0.1, 0.1, 0.9), specular: 0.5 }),
  white: new Material({ color: vec3(0.9, 0.9, 0.9), specular: 0.2 }),
  metal: new Material({ color: vec3(0.8, 0.8, 0.8), specular: 1.0, reflectivity: 0.5, shininess: 64 }),
  mirror: new Material({ color: vec3(1, 1, 1), specular: 1.0, reflectivity: 0.9, shininess: 128 }),
  gold: new Material({ color: vec3(1, 0.84, 0), specular: 0.8, reflectivity: 0.3, shininess: 64 }),
  floor: new Material({ color: vec3(0.4, 0.4, 0.4), specular: 0.1, reflectivity: 0.1 }),
};
