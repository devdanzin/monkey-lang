/**
 * pdf.js — Probability Distribution Functions for importance sampling
 * 
 * PDFs are used for:
 * - Cosine-weighted BRDF sampling (diffuse surfaces)
 * - Light source sampling (direct illumination)
 * - Mixture PDFs (MIS — combine BRDF + light sampling)
 */

import { Vec3 } from './vec3.js';
import { buildONB } from './sampling.js';

/**
 * Cosine-weighted hemisphere PDF for diffuse BRDF sampling.
 */
export class CosinePDF {
  constructor(normal) {
    this.normal = normal;
    [this.tangent, this.bitangent] = buildONB(normal);
  }

  /**
   * Generate a random direction according to cosine-weighted distribution.
   */
  generate() {
    const r1 = Math.random();
    const r2 = Math.random();
    const phi = 2 * Math.PI * r1;
    const sqrtR2 = Math.sqrt(r2);
    const x = Math.cos(phi) * sqrtR2;
    const y = Math.sin(phi) * sqrtR2;
    const z = Math.sqrt(1 - r2);
    return this.tangent.mul(x).add(this.bitangent.mul(y)).add(this.normal.mul(z));
  }

  /**
   * Evaluate the PDF for a given direction.
   */
  value(direction) {
    const cosTheta = this.normal.dot(direction.unit());
    return cosTheta <= 0 ? 0 : cosTheta / Math.PI;
  }
}

/**
 * PDF for sampling a hittable object (e.g., area light).
 * Generates directions toward random points on the target.
 */
export class HittablePDF {
  /**
   * @param {Object} target - Object with randomPoint() method
   * @param {Vec3} origin - Point we're sampling from
   */
  constructor(target, origin) {
    this.target = target;
    this.origin = origin;
  }

  generate() {
    const targetPoint = this.target.randomPoint();
    return targetPoint.sub(this.origin).unit();
  }

  value(direction) {
    // Compute the PDF for sampling this direction toward the target
    if (!this.target.pdfValue) {
      // Fallback: uniform over solid angle
      return 1.0 / (2 * Math.PI);
    }
    return this.target.pdfValue(this.origin, direction);
  }
}

/**
 * Mixture PDF — combine two PDFs with a mixing weight.
 * Used for MIS: mix BRDF sampling with light sampling.
 */
export class MixturePDF {
  /**
   * @param {Object} pdf1 - First PDF (e.g., CosinePDF)
   * @param {Object} pdf2 - Second PDF (e.g., HittablePDF)
   * @param {number} [weight=0.5] - Weight for pdf1 (pdf2 gets 1-weight)
   */
  constructor(pdf1, pdf2, weight = 0.5) {
    this.pdf1 = pdf1;
    this.pdf2 = pdf2;
    this.weight = weight;
  }

  generate() {
    return Math.random() < this.weight
      ? this.pdf1.generate()
      : this.pdf2.generate();
  }

  value(direction) {
    return this.weight * this.pdf1.value(direction)
      + (1 - this.weight) * this.pdf2.value(direction);
  }
}

/**
 * Multi-light PDF — samples one of multiple lights uniformly.
 */
export class MultiLightPDF {
  /**
   * @param {Object[]} lights - Array of light objects with randomPoint() + pdfValue()
   * @param {Vec3} origin - Point we're sampling from
   */
  constructor(lights, origin) {
    this.lights = lights;
    this.origin = origin;
  }

  generate() {
    if (this.lights.length === 0) return Vec3.randomUnitVector();
    const idx = Math.floor(Math.random() * this.lights.length);
    const light = this.lights[idx];
    const point = light.randomPoint();
    return point.sub(this.origin).unit();
  }

  value(direction) {
    if (this.lights.length === 0) return 0;
    // Average PDF over all lights
    let total = 0;
    for (const light of this.lights) {
      if (light.pdfValue) {
        total += light.pdfValue(this.origin, direction);
      }
    }
    return total / this.lights.length;
  }
}
