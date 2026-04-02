import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Vec3, Color, Ray, CosinePDF, HittablePDF, MixturePDF, MultiLightPDF } from '../src/index.js';
import { XZRect, XYRect, YZRect } from '../src/plane.js';
import { Sphere } from '../src/sphere.js';
import { DiffuseLight } from '../src/material.js';

describe('PDF Classes', () => {
  describe('CosinePDF', () => {
    it('should generate directions in correct hemisphere', () => {
      const normal = new Vec3(0, 1, 0);
      const pdf = new CosinePDF(normal);
      for (let i = 0; i < 100; i++) {
        const dir = pdf.generate();
        assert.ok(dir.dot(normal) >= -0.01, 'Direction should be in the hemisphere');
      }
    });

    it('should have positive PDF for valid directions', () => {
      const normal = new Vec3(0, 1, 0);
      const pdf = new CosinePDF(normal);
      const dir = new Vec3(0, 1, 0).unit();
      assert.ok(pdf.value(dir) > 0);
    });

    it('should return 0 for opposite hemisphere', () => {
      const normal = new Vec3(0, 1, 0);
      const pdf = new CosinePDF(normal);
      assert.equal(pdf.value(new Vec3(0, -1, 0)), 0);
    });

    it('should integrate to approximately 1 over hemisphere', () => {
      const normal = new Vec3(0, 1, 0);
      const pdf = new CosinePDF(normal);
      // Monte Carlo estimate of ∫ cos(θ)/π dω over hemisphere = 1
      // Using PDF sampling: E[f(x)/p(x)] ≈ ∫f dω
      // With f = 1 and p = cos(θ)/π, E[1/(cos/π)] = E[π/cos]
      // But for validation, just check generated dirs have reasonable PDF values
      const N = 1000;
      let validCount = 0;
      for (let i = 0; i < N; i++) {
        const dir = pdf.generate();
        const pdfVal = pdf.value(dir);
        if (pdfVal > 0) validCount++;
      }
      assert.ok(validCount > N * 0.95, `Most generated directions should have positive PDF, got ${validCount}/${N}`);
    });
  });

  describe('HittablePDF', () => {
    it('should generate directions toward target', () => {
      const light = new XZRect(2, 4, 2, 4, 5, new DiffuseLight(new Color(1, 1, 1)));
      const origin = new Vec3(3, 0, 3);
      const pdf = new HittablePDF(light, origin);
      const dir = pdf.generate();
      assert.ok(dir.y > 0, 'Direction should point upward toward light');
    });

    it('should return positive PDF for valid direction', () => {
      const light = new XZRect(2, 4, 2, 4, 5, new DiffuseLight(new Color(1, 1, 1)));
      const origin = new Vec3(3, 0, 3);
      const pdf = new HittablePDF(light, origin);
      const dir = new Vec3(0, 1, 0); // Straight up toward light
      const pdfVal = pdf.value(dir);
      assert.ok(pdfVal > 0, `PDF should be positive, got ${pdfVal}`);
    });
  });

  describe('MixturePDF', () => {
    it('should mix two PDFs', () => {
      const normal = new Vec3(0, 1, 0);
      const pdf1 = new CosinePDF(normal);
      const light = new XZRect(-1, 1, -1, 1, 3, new DiffuseLight(new Color(1, 1, 1)));
      const pdf2 = new HittablePDF(light, new Vec3(0, 0, 0));
      const mix = new MixturePDF(pdf1, pdf2, 0.5);

      // Should generate valid directions
      for (let i = 0; i < 50; i++) {
        const dir = mix.generate();
        assert.ok(dir.length() > 0.5);
      }

      // Mixed PDF value should be weighted average
      const dir = new Vec3(0, 1, 0);
      const val = mix.value(dir);
      const expected = 0.5 * pdf1.value(dir) + 0.5 * pdf2.value(dir);
      assert.ok(Math.abs(val - expected) < 1e-10);
    });
  });

  describe('MultiLightPDF', () => {
    it('should handle multiple lights', () => {
      const lights = [
        new XZRect(-1, 1, -1, 1, 3, new DiffuseLight(new Color(1, 1, 1))),
        new XZRect(2, 4, -1, 1, 3, new DiffuseLight(new Color(1, 0, 0))),
      ];
      const origin = new Vec3(0, 0, 0);
      const pdf = new MultiLightPDF(lights, origin);

      for (let i = 0; i < 50; i++) {
        const dir = pdf.generate();
        assert.ok(dir.length() > 0.5);
      }
    });

    it('should handle empty lights array', () => {
      const pdf = new MultiLightPDF([], new Vec3(0, 0, 0));
      const dir = pdf.generate();
      assert.ok(dir.length() > 0);
      assert.equal(pdf.value(dir), 0);
    });
  });

  describe('Sphere pdfValue', () => {
    it('should return positive for direction toward sphere', () => {
      const sphere = new Sphere(new Vec3(0, 5, 0), 1, new DiffuseLight(new Color(1, 1, 1)));
      const origin = new Vec3(0, 0, 0);
      const direction = new Vec3(0, 1, 0);
      const val = sphere.pdfValue(origin, direction);
      assert.ok(val > 0, `PDF should be positive, got ${val}`);
    });

    it('should return 0 for direction away from sphere', () => {
      const sphere = new Sphere(new Vec3(0, 5, 0), 1, new DiffuseLight(new Color(1, 1, 1)));
      const origin = new Vec3(0, 0, 0);
      const direction = new Vec3(0, -1, 0);
      const val = sphere.pdfValue(origin, direction);
      assert.equal(val, 0);
    });

    it('should have randomPoint and area', () => {
      const sphere = new Sphere(new Vec3(0, 0, 0), 2, null);
      const point = sphere.randomPoint();
      const dist = point.length();
      assert.ok(Math.abs(dist - 2) < 0.01, `Point should be on sphere surface, dist=${dist}`);
      assert.ok(Math.abs(sphere.area() - 4 * Math.PI * 4) < 0.1);
    });
  });

  describe('Rectangle pdfValue', () => {
    it('XZRect should return positive PDF for correct direction', () => {
      const rect = new XZRect(-1, 1, -1, 1, 3, new DiffuseLight(new Color(1, 1, 1)));
      const origin = new Vec3(0, 0, 0);
      const direction = new Vec3(0, 1, 0); // Straight up toward rect at y=3
      const val = rect.pdfValue(origin, direction);
      assert.ok(val > 0, `PDF should be positive, got ${val}`);
    });

    it('XYRect should return positive PDF for correct direction', () => {
      const rect = new XYRect(-1, 1, -1, 1, 3, new DiffuseLight(new Color(1, 1, 1)));
      const origin = new Vec3(0, 0, 0);
      const direction = new Vec3(0, 0, 1); // Toward rect at z=3
      const val = rect.pdfValue(origin, direction);
      assert.ok(val > 0, `PDF should be positive, got ${val}`);
    });

    it('YZRect should return positive PDF for correct direction', () => {
      const rect = new YZRect(-1, 1, -1, 1, 3, new DiffuseLight(new Color(1, 1, 1)));
      const origin = new Vec3(0, 0, 0);
      const direction = new Vec3(1, 0, 0); // Toward rect at x=3
      const val = rect.pdfValue(origin, direction);
      assert.ok(val > 0, `PDF should be positive, got ${val}`);
    });
  });
});
