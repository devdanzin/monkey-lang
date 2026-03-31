// microfacet.js — Beckmann Microfacet BRDF for physically-based rendering
//
// Cook-Torrance specular model: f_r = D * F * G / (4 * cos_i * cos_o)
//   D = Normal Distribution Function (Beckmann)
//   F = Fresnel term (Schlick approximation)
//   G = Geometric attenuation (Smith-Beckmann)

import { Vec3, Color } from './vec3.js';
import { Ray } from './ray.js';

/**
 * Beckmann Normal Distribution Function
 * D(h) = exp(-tan²θ_h / α²) / (π * α² * cos⁴θ_h)
 */
export function beckmannNDF(NdotH, roughness) {
  if (NdotH <= 0) return 0;
  const alpha2 = roughness * roughness;
  const cos2 = NdotH * NdotH;
  const cos4 = cos2 * cos2;
  const tan2 = (1 - cos2) / cos2;
  return Math.exp(-tan2 / alpha2) / (Math.PI * alpha2 * cos4);
}

/**
 * GGX (Trowbridge-Reitz) Normal Distribution Function
 * D(h) = α² / (π * (cos²θ_h * (α² - 1) + 1)²)
 */
export function ggxNDF(NdotH, roughness) {
  if (NdotH <= 0) return 0;
  const alpha2 = roughness * roughness;
  const denom = NdotH * NdotH * (alpha2 - 1) + 1;
  return alpha2 / (Math.PI * denom * denom);
}

/**
 * Schlick's Fresnel approximation
 * F(θ) = F0 + (1 - F0) * (1 - cos θ)⁵
 */
export function schlickFresnel(cosTheta, F0) {
  const f = Math.pow(1 - Math.max(0, cosTheta), 5);
  if (typeof F0 === 'number') {
    return F0 + (1 - F0) * f;
  }
  // Color F0
  return new Color(
    F0.x + (1 - F0.x) * f,
    F0.y + (1 - F0.y) * f,
    F0.z + (1 - F0.z) * f
  );
}

/**
 * Smith's geometric attenuation (Beckmann-Smith)
 * G1(v) uses the Smith masking function for Beckmann
 */
function smithG1Beckmann(NdotV, roughness) {
  if (NdotV <= 0) return 0;
  const a = NdotV / (roughness * Math.sqrt(1 - NdotV * NdotV));
  if (a >= 1.6) return 1;
  const a2 = a * a;
  return (3.535 * a + 2.181 * a2) / (1 + 2.276 * a + 2.577 * a2);
}

export function smithGeometry(NdotV, NdotL, roughness) {
  return smithG1Beckmann(NdotV, roughness) * smithG1Beckmann(NdotL, roughness);
}

/**
 * Microfacet material for physically-based rendering.
 * Combines Cook-Torrance specular with Lambertian diffuse.
 */
export class MicrofacetMaterial {
  constructor({
    albedo = new Color(0.8, 0.8, 0.8),    // Diffuse color
    roughness = 0.3,                        // Surface roughness (0=mirror, 1=rough)
    metallic = 0.0,                         // 0=dielectric, 1=metal
    F0 = null,                              // Base reflectance (auto-computed if null)
    ndf = 'beckmann',                       // 'beckmann' or 'ggx'
  } = {}) {
    this.albedo = albedo;
    this.roughness = Math.max(0.01, roughness); // prevent division by zero
    this.metallic = metallic;
    this.F0 = F0 || new Color(
      0.04 * (1 - metallic) + albedo.x * metallic,
      0.04 * (1 - metallic) + albedo.y * metallic,
      0.04 * (1 - metallic) + albedo.z * metallic
    );
    this.ndfFunc = ndf === 'ggx' ? ggxNDF : beckmannNDF;
  }

  scatter(ray, rec) {
    // Reflect with roughness perturbation
    const reflected = ray.direction.unit().reflect(rec.normal);
    const fuzz = this.roughness;
    const scattered = reflected.add(Vec3.randomUnitVector().mul(fuzz)).unit();
    
    if (scattered.dot(rec.normal) <= 0) return null;

    // Evaluate BRDF for attenuation
    const V = ray.direction.mul(-1).unit(); // view direction
    const L = scattered; // light direction
    const N = rec.normal;
    const H = V.add(L).unit(); // half vector

    const NdotV = Math.max(N.dot(V), 0.001);
    const NdotL = Math.max(N.dot(L), 0.001);
    const NdotH = Math.max(N.dot(H), 0);
    const VdotH = Math.max(V.dot(H), 0);

    // Cook-Torrance specular
    const D = this.ndfFunc(NdotH, this.roughness);
    const F = schlickFresnel(VdotH, this.F0);
    const G = smithGeometry(NdotV, NdotL, this.roughness);
    
    const denom = 4 * NdotV * NdotL;
    const specular = denom > 0 ? new Color(
      D * F.x * G / denom,
      D * F.y * G / denom,
      D * F.z * G / denom
    ) : new Color(0, 0, 0);

    // Lambertian diffuse (metals have no diffuse)
    const kD = 1 - this.metallic;
    const diffuse = this.albedo.mul(kD / Math.PI);

    // Combined BRDF
    const attenuation = diffuse.add(specular);

    return {
      scattered: new Ray(rec.p, scattered),
      attenuation
    };
  }

  emitted() { return new Color(0, 0, 0); }
}
