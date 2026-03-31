/**
 * Tiny Ray Marcher
 *
 * Renders scenes using sphere tracing / ray marching with signed distance
 * functions (SDFs). Instead of explicit geometry, surfaces are defined as
 * the zero-level set of distance functions.
 *
 * Features:
 * - SDF primitives: sphere, box, torus, cylinder, plane, capsule
 * - CSG operations: union, intersection, subtraction, smooth union
 * - Domain operations: repetition, twist, bend
 * - Normals via gradient estimation
 * - Phong shading with shadows and ambient occlusion
 * - Renders to a pixel buffer (Uint8Array RGBA)
 */

// ==================== Vector Math ====================

const vec3 = (x = 0, y = 0, z = 0) => ({ x, y, z });
const add = (a, b) => vec3(a.x + b.x, a.y + b.y, a.z + b.z);
const sub = (a, b) => vec3(a.x - b.x, a.y - b.y, a.z - b.z);
const mul = (a, s) => vec3(a.x * s, a.y * s, a.z * s);
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const length = (v) => Math.sqrt(dot(v, v));
const normalize = (v) => { const l = length(v) || 1; return mul(v, 1 / l); };
const mix = (a, b, t) => vec3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
const abs3 = (v) => vec3(Math.abs(v.x), Math.abs(v.y), Math.abs(v.z));
const max3 = (a, b) => vec3(Math.max(a.x, b.x), Math.max(a.y, b.y), Math.max(a.z, b.z));
const min3s = (v) => Math.min(v.x, Math.min(v.y, v.z));
const max3s = (v) => Math.max(v.x, Math.max(v.y, v.z));
const clamp = (x, lo, hi) => Math.min(Math.max(x, lo), hi);
const reflect = (I, N) => sub(I, mul(N, 2 * dot(I, N)));
const cross = (a, b) => vec3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);

// ==================== SDF Primitives ====================

const sdSphere = (radius = 1) => (p) => length(p) - radius;

const sdBox = (size = vec3(1, 1, 1)) => (p) => {
  const q = sub(abs3(p), size);
  return length(max3(q, vec3(0, 0, 0))) + Math.min(max3s(q), 0);
};

const sdTorus = (majorR = 1, minorR = 0.3) => (p) => {
  const q = vec3(Math.sqrt(p.x * p.x + p.z * p.z) - majorR, p.y, 0);
  return length(q) - minorR;
};

const sdCylinder = (radius = 0.5, height = 1) => (p) => {
  const d = vec3(Math.sqrt(p.x * p.x + p.z * p.z) - radius, Math.abs(p.y) - height, 0);
  return Math.min(Math.max(d.x, d.y), 0) + length(max3(d, vec3(0, 0, 0)));
};

const sdPlane = (normal = vec3(0, 1, 0), offset = 0) => (p) => dot(p, normal) + offset;

const sdCapsule = (a = vec3(0, -0.5, 0), b = vec3(0, 0.5, 0), r = 0.2) => (p) => {
  const pa = sub(p, a);
  const ba = sub(b, a);
  const h = clamp(dot(pa, ba) / dot(ba, ba), 0, 1);
  return length(sub(pa, mul(ba, h))) - r;
};

// ==================== CSG Operations ====================

const opUnion = (sdfA, sdfB) => (p) => Math.min(sdfA(p), sdfB(p));

const opIntersect = (sdfA, sdfB) => (p) => Math.max(sdfA(p), sdfB(p));

const opSubtract = (sdfA, sdfB) => (p) => Math.max(sdfA(p), -sdfB(p));

const opSmoothUnion = (sdfA, sdfB, k = 0.5) => (p) => {
  const dA = sdfA(p);
  const dB = sdfB(p);
  const h = clamp(0.5 + 0.5 * (dB - dA) / k, 0, 1);
  return dB * (1 - h) + dA * h - k * h * (1 - h);
};

// ==================== Domain Operations ====================

const opTranslate = (sdf, offset) => (p) => sdf(sub(p, offset));

const opScale = (sdf, s) => (p) => sdf(mul(p, 1 / s)) * s;

const opRepeat = (sdf, period) => (p) => {
  const q = vec3(
    ((p.x % period.x) + period.x * 1.5) % period.x - period.x * 0.5,
    p.y,
    ((p.z % period.z) + period.z * 1.5) % period.z - period.z * 0.5
  );
  return sdf(q);
};

const opTwist = (sdf, k = 1) => (p) => {
  const c = Math.cos(k * p.y);
  const s = Math.sin(k * p.y);
  const q = vec3(c * p.x - s * p.z, p.y, s * p.x + c * p.z);
  return sdf(q);
};

// ==================== Materials ====================

/**
 * @typedef {Object} Material
 * @property {Object} color - {x,y,z} RGB 0-1
 * @property {number} ambient
 * @property {number} diffuse
 * @property {number} specular
 * @property {number} shininess
 * @property {number} reflectivity
 */

const material = (color = vec3(0.8, 0.2, 0.2), opts = {}) => ({
  color,
  ambient: opts.ambient ?? 0.1,
  diffuse: opts.diffuse ?? 0.7,
  specular: opts.specular ?? 0.3,
  shininess: opts.shininess ?? 32,
  reflectivity: opts.reflectivity ?? 0,
});

// ==================== Scene ====================

class Scene {
  constructor() {
    this.objects = []; // [{sdf, material}]
    this.lights = [];  // [{pos, color, intensity}]
    this.background = vec3(0.1, 0.1, 0.15);
    this.maxSteps = 128;
    this.maxDist = 100;
    this.epsilon = 0.001;
    this.shadowSoftness = 16;
  }

  add(sdf, mat = material()) {
    this.objects.push({ sdf, material: mat });
    return this;
  }

  addLight(pos, color = vec3(1, 1, 1), intensity = 1) {
    this.lights.push({ pos, color, intensity });
    return this;
  }

  /** Evaluate the scene SDF, returning {dist, materialIdx} */
  map(p) {
    let minDist = Infinity;
    let closest = -1;
    for (let i = 0; i < this.objects.length; i++) {
      const d = this.objects[i].sdf(p);
      if (d < minDist) {
        minDist = d;
        closest = i;
      }
    }
    return { dist: minDist, idx: closest };
  }

  /** Estimate surface normal via central differences */
  normal(p) {
    const e = this.epsilon;
    const d = this.map(p).dist;
    return normalize(vec3(
      this.map(vec3(p.x + e, p.y, p.z)).dist - this.map(vec3(p.x - e, p.y, p.z)).dist,
      this.map(vec3(p.x, p.y + e, p.z)).dist - this.map(vec3(p.x, p.y - e, p.z)).dist,
      this.map(vec3(p.x, p.y, p.z + e)).dist - this.map(vec3(p.x, p.y, p.z - e)).dist
    ));
  }

  /** March a ray, returning {hit, dist, steps, idx} */
  march(origin, dir) {
    let t = 0;
    for (let i = 0; i < this.maxSteps; i++) {
      const p = add(origin, mul(dir, t));
      const { dist, idx } = this.map(p);
      if (dist < this.epsilon) return { hit: true, dist: t, steps: i, idx };
      t += dist;
      if (t > this.maxDist) break;
    }
    return { hit: false, dist: t, steps: this.maxSteps, idx: -1 };
  }

  /** Soft shadow factor (0 = full shadow, 1 = lit) */
  shadow(origin, dir, maxDist) {
    let res = 1;
    let t = this.epsilon * 10;
    for (let i = 0; i < 64; i++) {
      const p = add(origin, mul(dir, t));
      const d = this.map(p).dist;
      if (d < this.epsilon) return 0;
      res = Math.min(res, this.shadowSoftness * d / t);
      t += d;
      if (t > maxDist) break;
    }
    return clamp(res, 0, 1);
  }

  /** Ambient occlusion estimation */
  ao(p, n) {
    let occ = 0;
    let scale = 1;
    for (let i = 0; i < 5; i++) {
      const h = 0.01 + 0.12 * i;
      const d = this.map(add(p, mul(n, h))).dist;
      occ += (h - d) * scale;
      scale *= 0.95;
    }
    return clamp(1 - 3 * occ, 0, 1);
  }
}

// ==================== Camera ====================

class Camera {
  constructor(eye, target, up = vec3(0, 1, 0), fov = 60) {
    this.eye = eye;
    this.fov = fov;
    const forward = normalize(sub(target, eye));
    const right = normalize(cross(forward, up));
    const camUp = cross(right, forward);
    this.forward = forward;
    this.right = right;
    this.up = camUp;
  }

  ray(u, v) {
    const scale = Math.tan(this.fov * Math.PI / 360);
    const dir = normalize(add(
      add(this.forward, mul(this.right, u * scale)),
      mul(this.up, v * scale)
    ));
    return { origin: this.eye, dir };
  }
}

// ==================== Renderer ====================

function render(scene, camera, width, height) {
  const pixels = new Uint8Array(width * height * 4);
  const aspect = width / height;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const u = ((x + 0.5) / width * 2 - 1) * aspect;
      const v = 1 - (y + 0.5) / height * 2;
      const { origin, dir } = camera.ray(u, v);

      const color = shade(scene, origin, dir, 0);
      const idx = (y * width + x) * 4;
      pixels[idx]     = clamp(Math.floor(color.x * 255), 0, 255);
      pixels[idx + 1] = clamp(Math.floor(color.y * 255), 0, 255);
      pixels[idx + 2] = clamp(Math.floor(color.z * 255), 0, 255);
      pixels[idx + 3] = 255;
    }
  }
  return pixels;
}

function shade(scene, origin, dir, depth) {
  if (depth > 3) return scene.background;

  const result = scene.march(origin, dir);
  if (!result.hit) return scene.background;

  const p = add(origin, mul(dir, result.dist));
  const n = scene.normal(p);
  const mat = scene.objects[result.idx].material;
  const surfaceP = add(p, mul(n, scene.epsilon * 2)); // offset from surface

  let color = mul(mat.color, mat.ambient);

  // Ambient occlusion
  const ao = scene.ao(surfaceP, n);

  for (const light of scene.lights) {
    const toLight = sub(light.pos, p);
    const lightDist = length(toLight);
    const lightDir = normalize(toLight);

    // Shadow
    const shadowFactor = scene.shadow(surfaceP, lightDir, lightDist);

    // Diffuse
    const diff = Math.max(dot(n, lightDir), 0);
    const diffColor = mul(mul(mat.color, mat.diffuse * diff * light.intensity), shadowFactor);

    // Specular (Blinn-Phong)
    const halfDir = normalize(sub(lightDir, dir));
    const spec = Math.pow(Math.max(dot(n, halfDir), 0), mat.shininess);
    const specColor = mul(mul(light.color, mat.specular * spec * light.intensity), shadowFactor);

    color = add(color, mul(add(diffColor, specColor), ao));
  }

  // Reflection
  if (mat.reflectivity > 0 && depth < 3) {
    const reflDir = reflect(dir, n);
    const reflColor = shade(scene, surfaceP, reflDir, depth + 1);
    color = add(mul(color, 1 - mat.reflectivity), mul(reflColor, mat.reflectivity));
  }

  return color;
}

// ==================== PPM Output ====================

function toPPM(pixels, width, height) {
  let ppm = `P3\n${width} ${height}\n255\n`;
  for (let i = 0; i < pixels.length; i += 4) {
    ppm += `${pixels[i]} ${pixels[i + 1]} ${pixels[i + 2]}\n`;
  }
  return ppm;
}

// ==================== Example Scenes ====================

function demoScene() {
  const scene = new Scene();

  // Ground plane
  scene.add(
    sdPlane(vec3(0, 1, 0), 1),
    material(vec3(0.4, 0.4, 0.4), { ambient: 0.15, diffuse: 0.6 })
  );

  // Red sphere
  scene.add(
    opTranslate(sdSphere(0.8), vec3(-1.2, 0, 0)),
    material(vec3(0.9, 0.15, 0.15), { specular: 0.5, shininess: 64 })
  );

  // Blue torus
  scene.add(
    opTranslate(sdTorus(0.7, 0.25), vec3(1.2, 0, 0)),
    material(vec3(0.15, 0.3, 0.9), { specular: 0.4, shininess: 48 })
  );

  // Smooth-unioned green blobs
  scene.add(
    opSmoothUnion(
      opTranslate(sdSphere(0.5), vec3(0, 0.3, 1.5)),
      opTranslate(sdSphere(0.5), vec3(0.6, 0, 1.5)),
      0.4
    ),
    material(vec3(0.2, 0.85, 0.3), { specular: 0.3, shininess: 32 })
  );

  // Metallic box with sphere subtracted (CSG)
  scene.add(
    opTranslate(
      opSubtract(sdBox(vec3(0.5, 0.5, 0.5)), sdSphere(0.65)),
      vec3(0, 0.5, -1.5)
    ),
    material(vec3(0.85, 0.7, 0.2), { specular: 0.6, shininess: 128, reflectivity: 0.3 })
  );

  scene.addLight(vec3(3, 5, 2), vec3(1, 0.95, 0.9), 1);
  scene.addLight(vec3(-2, 3, -1), vec3(0.6, 0.7, 1), 0.5);

  return scene;
}

module.exports = {
  // Vector math
  vec3, add, sub, mul, dot, length, normalize, mix, abs3, max3, clamp, reflect, cross,
  // SDF primitives
  sdSphere, sdBox, sdTorus, sdCylinder, sdPlane, sdCapsule,
  // CSG operations
  opUnion, opIntersect, opSubtract, opSmoothUnion,
  // Domain operations
  opTranslate, opScale, opRepeat, opTwist,
  // Material & scene
  material, Scene, Camera,
  // Rendering
  render, shade, toPPM,
  // Scenes
  demoScene,
};
