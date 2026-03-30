// material.js — Materials define how rays scatter off surfaces

import { Vec3, Color } from './vec3.js';
import { Ray } from './ray.js';
import { SolidColor } from './texture.js';

// Lambertian (matte/diffuse)
export class Lambertian {
  constructor(albedo) {
    // Accept either a Color (Vec3) or a Texture
    this.texture = albedo instanceof Vec3 ? new SolidColor(albedo) : albedo;
    this.albedo = albedo instanceof Vec3 ? albedo : null; // backward compat
  }

  scatter(rayIn, rec) {
    let scatterDirection = rec.normal.add(Vec3.randomUnitVector());
    if (scatterDirection.nearZero()) scatterDirection = rec.normal;
    const attenuation = this.texture.value(0, 0, rec.p);
    return {
      scattered: new Ray(rec.p, scatterDirection),
      attenuation
    };
  }
}

// Metal (reflective)
export class Metal {
  constructor(albedo, fuzz = 0) {
    this.albedo = albedo;
    this.fuzz = Math.min(fuzz, 1);
  }

  scatter(rayIn, rec) {
    const reflected = rayIn.direction.unit().reflect(rec.normal);
    const scattered = new Ray(
      rec.p,
      reflected.add(Vec3.randomInUnitSphere().mul(this.fuzz))
    );
    if (scattered.direction.dot(rec.normal) <= 0) return null;
    return { scattered, attenuation: this.albedo };
  }
}

// Dielectric (glass/water — refracts)
export class Dielectric {
  constructor(indexOfRefraction) {
    this.ir = indexOfRefraction;
  }

  scatter(rayIn, rec) {
    const refractionRatio = rec.frontFace ? (1.0 / this.ir) : this.ir;
    const unitDirection = rayIn.direction.unit();
    const cosTheta = Math.min(unitDirection.negate().dot(rec.normal), 1.0);
    const sinTheta = Math.sqrt(1.0 - cosTheta * cosTheta);

    const cannotRefract = refractionRatio * sinTheta > 1.0;
    let direction;

    if (cannotRefract || this._reflectance(cosTheta, refractionRatio) > Math.random()) {
      direction = unitDirection.reflect(rec.normal);
    } else {
      direction = unitDirection.refract(rec.normal, refractionRatio);
    }

    return {
      scattered: new Ray(rec.p, direction),
      attenuation: new Color(1, 1, 1)
    };
  }

  // Schlick's approximation for reflectance
  _reflectance(cosine, refIdx) {
    let r0 = (1 - refIdx) / (1 + refIdx);
    r0 = r0 * r0;
    return r0 + (1 - r0) * Math.pow(1 - cosine, 5);
  }
}

// Colored glass — like Dielectric but tints transmitted light
export class ColoredGlass {
  constructor(indexOfRefraction, color, density = 1.0) {
    this.ir = indexOfRefraction;
    this.color = color; // Tint color
    this.density = density; // How strongly light is absorbed
  }

  scatter(rayIn, rec) {
    const refractionRatio = rec.frontFace ? (1.0 / this.ir) : this.ir;
    const unitDirection = rayIn.direction.unit();
    const cosTheta = Math.min(unitDirection.negate().dot(rec.normal), 1.0);
    const sinTheta = Math.sqrt(1.0 - cosTheta * cosTheta);

    const cannotRefract = refractionRatio * sinTheta > 1.0;
    let direction;

    if (cannotRefract || this._reflectance(cosTheta, refractionRatio) > Math.random()) {
      direction = unitDirection.reflect(rec.normal);
      return { scattered: new Ray(rec.p, direction), attenuation: new Color(1, 1, 1) };
    } else {
      direction = unitDirection.refract(rec.normal, refractionRatio);
      // Tint transmitted light (Beer-Lambert absorption)
      const attenuation = rec.frontFace
        ? new Color(1, 1, 1)  // Entering glass — no absorption yet
        : new Color(
            Math.exp(-this.density * (1 - this.color.x) * rec.t),
            Math.exp(-this.density * (1 - this.color.y) * rec.t),
            Math.exp(-this.density * (1 - this.color.z) * rec.t)
          );
      return { scattered: new Ray(rec.p, direction), attenuation };
    }
  }

  _reflectance(cosine, refIdx) {
    let r0 = (1 - refIdx) / (1 + refIdx);
    r0 = r0 * r0;
    return r0 + (1 - r0) * Math.pow(1 - cosine, 5);
  }
}

// Emissive (light source)
export class DiffuseLight {
  constructor(emit) {
    this.emit = emit; // Color — intensity of emitted light
  }

  scatter(rayIn, rec) {
    return null; // Lights don't scatter
  }

  emitted(u, v, p) {
    return this.emit;
  }
}
