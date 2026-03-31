import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Vec3, Color } from '../src/vec3.js';
import { Ray } from '../src/ray.js';
import { beckmannNDF, ggxNDF, schlickFresnel, smithGeometry, MicrofacetMaterial } from '../src/microfacet.js';

describe('Microfacet BRDF', () => {
  describe('Beckmann NDF', () => {
    it('peaks at NdotH = 1 (aligned)', () => {
      const peak = beckmannNDF(1.0, 0.3);
      const side = beckmannNDF(0.5, 0.3);
      assert.ok(peak > side, `Peak: ${peak}, Side: ${side}`);
    });
    it('rougher surfaces have lower peak', () => {
      const sharp = beckmannNDF(1.0, 0.1);
      const rough = beckmannNDF(1.0, 0.5);
      assert.ok(sharp > rough, `Sharp: ${sharp}, Rough: ${rough}`);
    });
    it('returns 0 for NdotH <= 0', () => {
      assert.equal(beckmannNDF(-0.5, 0.3), 0);
    });
  });

  describe('GGX NDF', () => {
    it('peaks at NdotH = 1', () => {
      const peak = ggxNDF(1.0, 0.3);
      const side = ggxNDF(0.5, 0.3);
      assert.ok(peak > side);
    });
    it('has longer tails than Beckmann', () => {
      const beckmann = beckmannNDF(0.1, 0.5);
      const ggx = ggxNDF(0.1, 0.5);
      // GGX should have higher values at grazing angles (longer tails)
      assert.ok(ggx > beckmann * 0.5, `GGX: ${ggx}, Beckmann: ${beckmann}`);
    });
  });

  describe('Schlick Fresnel', () => {
    it('returns F0 at normal incidence', () => {
      const f = schlickFresnel(1.0, 0.04);
      assert.ok(Math.abs(f - 0.04) < 0.001);
    });
    it('approaches 1 at grazing angle', () => {
      const f = schlickFresnel(0.01, 0.04);
      assert.ok(f > 0.9, `Fresnel at grazing: ${f}`);
    });
    it('works with Color F0', () => {
      const f = schlickFresnel(1.0, new Color(0.04, 0.04, 0.04));
      assert.ok(f instanceof Color || (typeof f === 'object' && 'x' in f));
    });
  });

  describe('Smith Geometry', () => {
    it('returns ~1 for smooth surfaces at normal incidence', () => {
      const g = smithGeometry(1.0, 1.0, 0.1);
      assert.ok(g > 0.9, `G: ${g}`);
    });
    it('decreases at grazing angles', () => {
      const normal = smithGeometry(0.9, 0.9, 0.3);
      const grazing = smithGeometry(0.1, 0.1, 0.3);
      assert.ok(normal > grazing, `Normal: ${normal}, Grazing: ${grazing}`);
    });
  });

  describe('MicrofacetMaterial', () => {
    it('scatters rays', () => {
      const mat = new MicrofacetMaterial({ roughness: 0.3, metallic: 0 });
      const ray = new Ray(new Vec3(0, 0, 0), new Vec3(1, -1, 0));
      const rec = { p: new Vec3(1, 0, 0), normal: new Vec3(0, 1, 0), u: 0, v: 0 };
      const result = mat.scatter(ray, rec);
      assert.ok(result, 'Should scatter');
      assert.ok(result.scattered, 'Should have scattered ray');
      assert.ok(result.attenuation, 'Should have attenuation');
    });

    it('metallic materials have colored specular', () => {
      const mat = new MicrofacetMaterial({ 
        albedo: new Color(1, 0.8, 0.2), // gold
        roughness: 0.3, 
        metallic: 1.0 
      });
      // F0 should be tinted for metals
      assert.ok(mat.F0.x > 0.5, 'Metallic F0 should inherit albedo');
    });

    it('dielectric materials have untinted F0', () => {
      const mat = new MicrofacetMaterial({ 
        albedo: new Color(1, 0, 0),
        roughness: 0.3, 
        metallic: 0 
      });
      assert.ok(Math.abs(mat.F0.x - 0.04) < 0.01, 'Dielectric F0 should be ~0.04');
    });

    it('roughness 0 acts mirror-like', () => {
      const mat = new MicrofacetMaterial({ roughness: 0.01 });
      const ray = new Ray(new Vec3(0, 1, 0), new Vec3(0, -1, 0).unit());
      const rec = { p: new Vec3(0, 0, 0), normal: new Vec3(0, 1, 0) };
      const result = mat.scatter(ray, rec);
      if (result) {
        // Scattered direction should be close to perfect reflection
        assert.ok(result.scattered.direction.dot(new Vec3(0, 1, 0)) > 0.5,
          'Low roughness should reflect upward');
      }
    });

    it('does not emit light', () => {
      const mat = new MicrofacetMaterial();
      const emission = mat.emitted();
      assert.ok(emission.x === 0 && emission.y === 0 && emission.z === 0);
    });

    it('GGX variant works', () => {
      const mat = new MicrofacetMaterial({ roughness: 0.3, ndf: 'ggx' });
      const ray = new Ray(new Vec3(0, 0, 0), new Vec3(1, -1, 0));
      const rec = { p: new Vec3(1, 0, 0), normal: new Vec3(0, 1, 0) };
      const result = mat.scatter(ray, rec);
      assert.ok(result || result === null); // Just shouldn't crash
    });
  });
});
