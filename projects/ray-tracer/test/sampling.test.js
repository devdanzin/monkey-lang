import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Vec3 } from '../src/vec3.js';
import { cosineWeightedHemisphere, cosineWeightedPDF, uniformHemisphere, buildONB, powerHeuristic } from '../src/sampling.js';

describe('Importance Sampling', () => {
  describe('buildONB', () => {
    it('produces orthogonal vectors', () => {
      const n = new Vec3(0, 1, 0);
      const [t, b] = buildONB(n);
      assert.ok(Math.abs(t.dot(b)) < 0.001, 'Tangent and bitangent should be orthogonal');
      assert.ok(Math.abs(t.dot(n)) < 0.001, 'Tangent and normal should be orthogonal');
      assert.ok(Math.abs(b.dot(n)) < 0.001, 'Bitangent and normal should be orthogonal');
    });

    it('works for arbitrary normals', () => {
      const normals = [
        new Vec3(1, 0, 0),
        new Vec3(0, 0, 1),
        new Vec3(1, 1, 1).unit(),
        new Vec3(-0.5, 0.8, 0.3).unit(),
      ];
      for (const n of normals) {
        const [t, b] = buildONB(n);
        assert.ok(Math.abs(t.dot(b)) < 0.01, `Failed for normal ${n}`);
        assert.ok(Math.abs(t.dot(n)) < 0.01, `Failed for normal ${n}`);
      }
    });
  });

  describe('cosineWeightedHemisphere', () => {
    it('generates directions in the correct hemisphere', () => {
      const normal = new Vec3(0, 1, 0);
      for (let i = 0; i < 100; i++) {
        const dir = cosineWeightedHemisphere(normal);
        const dot = dir.dot(normal);
        assert.ok(dot >= -0.01, `Direction should be in hemisphere: dot=${dot}`);
      }
    });

    it('produces unit vectors', () => {
      const normal = new Vec3(0, 1, 0);
      for (let i = 0; i < 50; i++) {
        const dir = cosineWeightedHemisphere(normal);
        const len = dir.length();
        assert.ok(Math.abs(len - 1) < 0.01, `Should be unit vector: len=${len}`);
      }
    });

    it('distribution is cosine-weighted (biased toward normal)', () => {
      const normal = new Vec3(0, 1, 0);
      let totalDot = 0;
      const N = 10000;
      for (let i = 0; i < N; i++) {
        const dir = cosineWeightedHemisphere(normal);
        totalDot += dir.dot(normal);
      }
      const avgCosTheta = totalDot / N;
      // For cosine-weighted: E[cos(θ)] = 2/3 ≈ 0.667
      assert.ok(avgCosTheta > 0.55 && avgCosTheta < 0.75,
        `Average cos(θ) should be ~0.667, got ${avgCosTheta.toFixed(3)}`);
    });
  });

  describe('cosineWeightedPDF', () => {
    it('returns cos(θ)/π for valid directions', () => {
      const normal = new Vec3(0, 1, 0);
      const dir = new Vec3(0, 1, 0); // aligned with normal → cos(θ) = 1
      const pdf = cosineWeightedPDF(normal, dir);
      assert.ok(Math.abs(pdf - 1 / Math.PI) < 0.001);
    });

    it('returns 0 for directions below hemisphere', () => {
      const normal = new Vec3(0, 1, 0);
      const dir = new Vec3(0, -1, 0);
      assert.equal(cosineWeightedPDF(normal, dir), 0);
    });
  });

  describe('uniformHemisphere', () => {
    it('generates directions in correct hemisphere', () => {
      const normal = new Vec3(0, 1, 0);
      for (let i = 0; i < 100; i++) {
        const dir = uniformHemisphere(normal);
        assert.ok(dir.dot(normal) >= -0.01);
      }
    });

    it('distribution is uniform (average cos ≈ 0.5)', () => {
      const normal = new Vec3(0, 1, 0);
      let totalDot = 0;
      const N = 10000;
      for (let i = 0; i < N; i++) {
        const dir = uniformHemisphere(normal);
        totalDot += dir.dot(normal);
      }
      const avgCosTheta = totalDot / N;
      // For uniform hemisphere: E[cos(θ)] = 0.5
      assert.ok(avgCosTheta > 0.4 && avgCosTheta < 0.6,
        `Average cos(θ) should be ~0.5, got ${avgCosTheta.toFixed(3)}`);
    });
  });

  describe('powerHeuristic', () => {
    it('returns 1 when only one strategy has nonzero pdf', () => {
      const w = powerHeuristic(1, 1.0, 1, 0.0);
      assert.ok(Math.abs(w - 1) < 0.01);
    });

    it('returns 0.5 for equal pdfs', () => {
      const w = powerHeuristic(1, 1.0, 1, 1.0);
      assert.ok(Math.abs(w - 0.5) < 0.01);
    });
  });
});
