// scene-format.js — JSON scene import/export

import { Vec3 } from './vec3.js';
import { Sphere } from './sphere.js';
import { MovingSphere } from './moving-sphere.js';
import { Plane, XYRect, XZRect, YZRect, Box } from './plane.js';
import { Triangle } from './triangle.js';
import { Lambertian, Metal, Dielectric, DiffuseLight } from './material.js';
import { SolidColor, CheckerTexture, NoiseTexture, MarbleTexture, StripeTexture, PlanetTexture } from './texture.js';
import { Translate, RotateY } from './transform.js';
import { ConstantMedium } from './volume.js';
import { HittableList } from './hittable.js';

// Parse a Vec3 from JSON
function parseVec3(v) {
  if (Array.isArray(v)) return new Vec3(v[0], v[1], v[2]);
  return new Vec3(v.x || 0, v.y || 0, v.z || 0);
}

// Parse a texture from JSON
function parseTexture(t) {
  if (!t || typeof t === 'string') return null;
  if (t.type === 'solid') return new SolidColor(parseVec3(t.color));
  if (t.type === 'checker') return new CheckerTexture(parseVec3(t.even), parseVec3(t.odd), t.scale || 10);
  if (t.type === 'noise') return new NoiseTexture(parseVec3(t.color), t.scale || 4);
  if (t.type === 'marble') return new MarbleTexture(parseVec3(t.color), t.scale || 4);
  if (t.type === 'stripe') return new StripeTexture(t.colors.map(parseVec3), t.scale || 10);
  if (t.type === 'planet') return new PlanetTexture(parseVec3(t.land), parseVec3(t.ocean), t.cloud ? parseVec3(t.cloud) : null, t.scale || 3);
  return null;
}

// Parse a material from JSON
function parseMaterial(m) {
  if (!m) return new Lambertian(new Vec3(0.5, 0.5, 0.5));

  switch (m.type) {
    case 'lambertian': {
      const albedo = m.texture ? parseTexture(m.texture) : parseVec3(m.color || [0.5, 0.5, 0.5]);
      return new Lambertian(albedo);
    }
    case 'metal':
      return new Metal(parseVec3(m.color || [0.8, 0.8, 0.8]), m.fuzz || 0);
    case 'dielectric':
      return new Dielectric(m.ior || 1.5);
    case 'light':
      return new DiffuseLight(parseVec3(m.emit || [4, 4, 4]));
    default:
      return new Lambertian(parseVec3(m.color || [0.5, 0.5, 0.5]));
  }
}

// Parse a single object from JSON
function parseObject(obj) {
  const mat = parseMaterial(obj.material);

  let hittable;
  switch (obj.type) {
    case 'sphere':
      hittable = new Sphere(parseVec3(obj.center), obj.radius || 1, mat);
      break;
    case 'moving_sphere':
      hittable = new MovingSphere(parseVec3(obj.center0), parseVec3(obj.center1), obj.time0 || 0, obj.time1 || 1, obj.radius || 1, mat);
      break;
    case 'plane':
      hittable = new Plane(parseVec3(obj.point), parseVec3(obj.normal), mat);
      break;
    case 'xy_rect':
      hittable = new XYRect(obj.x0, obj.x1, obj.y0, obj.y1, obj.k, mat);
      break;
    case 'xz_rect':
      hittable = new XZRect(obj.x0, obj.x1, obj.z0, obj.z1, obj.k, mat);
      break;
    case 'yz_rect':
      hittable = new YZRect(obj.y0, obj.y1, obj.z0, obj.z1, obj.k, mat);
      break;
    case 'box':
      hittable = new Box(parseVec3(obj.min), parseVec3(obj.max), mat);
      break;
    case 'triangle':
      hittable = new Triangle(parseVec3(obj.v0), parseVec3(obj.v1), parseVec3(obj.v2), mat);
      break;
    case 'constant_medium':
      hittable = new ConstantMedium(parseObject(obj.boundary), obj.density || 0.01, parseVec3(obj.color || [0.5, 0.5, 0.5]));
      break;
    default:
      return null;
  }

  // Apply transforms
  if (obj.rotate_y) hittable = new RotateY(hittable, obj.rotate_y);
  if (obj.translate) hittable = new Translate(hittable, parseVec3(obj.translate));

  return hittable;
}

// Load a full scene from JSON
export function loadScene(json) {
  const scene = typeof json === 'string' ? JSON.parse(json) : json;
  const world = new HittableList();

  for (const obj of scene.objects || []) {
    const h = parseObject(obj);
    if (h) world.add(h);
  }

  return {
    world,
    camera: scene.camera || {},
    background: scene.background ? parseVec3(scene.background) : null,
    name: scene.name || 'Untitled'
  };
}

// Export a scene description to JSON
export function exportScene(name, objects, camera, background) {
  return {
    name,
    camera,
    background: background ? { x: background.x, y: background.y, z: background.z } : null,
    objects
  };
}
