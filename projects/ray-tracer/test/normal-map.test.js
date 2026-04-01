import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Vec3, Color } from '../src/vec3.js';
import { Ray } from '../src/ray.js';
import { Triangle, Mesh } from '../src/triangle.js';
import { computeTBN, applyNormalMap, interpolateNormal, interpolateUV } from '../src/normal-map.js';

class MockMaterial {
  scatter() { return null; }
}

class MockNormalMap {
  constructor(value) {
    this._value = value;
  }
  value(u, v) {
    return this._value;
  }
}

describe('Normal Mapping', () => {
  describe('computeTBN', () => {
    it('computes orthogonal TBN basis', () => {
      const v0 = new Vec3(0, 0, 0);
      const v1 = new Vec3(1, 0, 0);
      const v2 = new Vec3(0, 1, 0);
      const uv0 = [0, 0], uv1 = [1, 0], uv2 = [0, 1];
      const normal = new Vec3(0, 0, 1);

      const tbn = computeTBN(v0, v1, v2, uv0, uv1, uv2, normal);

      // T, B, N should be roughly orthogonal
      assert.ok(Math.abs(tbn.tangent.dot(tbn.bitangent)) < 0.01, 'T·B should be ~0');
      assert.ok(Math.abs(tbn.tangent.dot(tbn.normal)) < 0.01, 'T·N should be ~0');
      assert.ok(Math.abs(tbn.bitangent.dot(tbn.normal)) < 0.01, 'B·N should be ~0');

      // All should be unit vectors
      assert.ok(Math.abs(tbn.tangent.length() - 1) < 0.01);
      assert.ok(Math.abs(tbn.bitangent.length() - 1) < 0.01);
      assert.ok(Math.abs(tbn.normal.length() - 1) < 0.01);
    });

    it('handles degenerate UVs gracefully', () => {
      const v0 = new Vec3(0, 0, 0);
      const v1 = new Vec3(1, 0, 0);
      const v2 = new Vec3(0, 1, 0);
      const uv0 = [0, 0], uv1 = [0, 0], uv2 = [0, 0]; // Degenerate
      const normal = new Vec3(0, 0, 1);

      const tbn = computeTBN(v0, v1, v2, uv0, uv1, uv2, normal);
      assert.ok(tbn.tangent instanceof Vec3);
      assert.ok(tbn.bitangent instanceof Vec3);
      assert.ok(Math.abs(tbn.tangent.length() - 1) < 0.01);
    });
  });

  describe('applyNormalMap', () => {
    it('neutral normal map (0.5, 0.5, 1.0) returns surface normal', () => {
      const normal = new Vec3(0, 0, 1);
      const tbn = computeTBN(
        new Vec3(0, 0, 0), new Vec3(1, 0, 0), new Vec3(0, 1, 0),
        [0, 0], [1, 0], [0, 1], normal
      );

      // Neutral normal in tangent space: (0.5, 0.5, 1.0) maps to (0, 0, 1) in [-1,1]
      const result = applyNormalMap(new Vec3(0.5, 0.5, 1.0), tbn);
      assert.ok(Math.abs(result.dot(normal) - 1) < 0.05, 'Neutral map should preserve surface normal');
    });

    it('perturbed normal map changes direction', () => {
      const normal = new Vec3(0, 0, 1);
      const tbn = computeTBN(
        new Vec3(0, 0, 0), new Vec3(1, 0, 0), new Vec3(0, 1, 0),
        [0, 0], [1, 0], [0, 1], normal
      );

      // Tilted normal: more X component
      const result = applyNormalMap(new Vec3(0.8, 0.5, 0.7), tbn);
      // Should not be parallel to original normal
      assert.ok(Math.abs(result.dot(normal)) < 0.99, 'Perturbed map should change normal');
      // Should be a unit vector
      assert.ok(Math.abs(result.length() - 1) < 0.01);
    });
  });

  describe('interpolateNormal', () => {
    it('returns n0 when u=0, v=0', () => {
      const n0 = new Vec3(0, 0, 1);
      const n1 = new Vec3(1, 0, 0);
      const n2 = new Vec3(0, 1, 0);
      const result = interpolateNormal(n0, n1, n2, 0, 0);
      assert.ok(result.sub(n0).length() < 0.01);
    });

    it('returns n1 when u=1, v=0', () => {
      const n0 = new Vec3(0, 0, 1);
      const n1 = new Vec3(1, 0, 0);
      const n2 = new Vec3(0, 1, 0);
      const result = interpolateNormal(n0, n1, n2, 1, 0);
      assert.ok(result.sub(n1).length() < 0.01);
    });

    it('interpolates and normalizes', () => {
      const n0 = new Vec3(0, 0, 1);
      const n1 = new Vec3(1, 0, 0);
      const n2 = new Vec3(0, 1, 0);
      const result = interpolateNormal(n0, n1, n2, 0.33, 0.33);
      assert.ok(Math.abs(result.length() - 1) < 0.01, 'Should be unit length');
    });
  });

  describe('interpolateUV', () => {
    it('returns uv0 at barycentric (0, 0)', () => {
      const result = interpolateUV([0.1, 0.2], [0.5, 0.6], [0.9, 0.1], 0, 0);
      assert.ok(Math.abs(result[0] - 0.1) < 0.001);
      assert.ok(Math.abs(result[1] - 0.2) < 0.001);
    });

    it('interpolates correctly at center', () => {
      const result = interpolateUV([0, 0], [1, 0], [0, 1], 1/3, 1/3);
      assert.ok(Math.abs(result[0] - 1/3) < 0.001);
      assert.ok(Math.abs(result[1] - 1/3) < 0.001);
    });
  });
});

describe('Triangle with smooth normals', () => {
  it('uses interpolated normals when provided', () => {
    const mat = new MockMaterial();
    const tri = new Triangle(
      new Vec3(0, 0, 0), new Vec3(1, 0, 0), new Vec3(0, 1, 0),
      mat,
      { normals: [new Vec3(0, 0, 1), new Vec3(0.3, 0, 0.95).unit(), new Vec3(0, 0.3, 0.95).unit()] }
    );

    const ray = new Ray(new Vec3(0.2, 0.2, 1), new Vec3(0, 0, -1));
    const rec = tri.hit(ray, 0.001, Infinity);
    assert.ok(rec, 'Should hit triangle');
    // Normal should be interpolated, not face normal
    assert.ok(rec.normal instanceof Vec3);
    assert.ok(Math.abs(rec.normal.length() - 1) < 0.01, 'Normal should be unit');
  });

  it('uses face normal without smooth normals', () => {
    const mat = new MockMaterial();
    const tri = new Triangle(
      new Vec3(0, 0, 0), new Vec3(1, 0, 0), new Vec3(0, 1, 0), mat
    );
    const ray = new Ray(new Vec3(0.2, 0.2, 1), new Vec3(0, 0, -1));
    const rec = tri.hit(ray, 0.001, Infinity);
    assert.ok(rec);
    // Should be face normal (0, 0, 1)
    assert.ok(Math.abs(rec.normal.z) > 0.99);
  });
});

describe('Triangle with normal map', () => {
  it('applies normal map when normalMap and uvs are provided', () => {
    const mat = new MockMaterial();
    // Neutral normal map → should be like face normal
    const neutralMap = new MockNormalMap(new Vec3(0.5, 0.5, 1.0));
    const tri = new Triangle(
      new Vec3(0, 0, 0), new Vec3(1, 0, 0), new Vec3(0, 1, 0),
      mat,
      {
        uvs: [[0, 0], [1, 0], [0, 1]],
        normalMap: neutralMap
      }
    );

    const ray = new Ray(new Vec3(0.2, 0.2, 1), new Vec3(0, 0, -1));
    const rec = tri.hit(ray, 0.001, Infinity);
    assert.ok(rec);
    // With neutral map, normal should be roughly the face normal
    assert.ok(rec.normal.z > 0.9, 'Neutral map should preserve ~face normal');
  });

  it('perturbed normal map changes hit normal', () => {
    const mat = new MockMaterial();
    const perturbedMap = new MockNormalMap(new Vec3(0.8, 0.5, 0.6));
    const tri = new Triangle(
      new Vec3(0, 0, 0), new Vec3(1, 0, 0), new Vec3(0, 1, 0),
      mat,
      {
        uvs: [[0, 0], [1, 0], [0, 1]],
        normalMap: perturbedMap
      }
    );

    const ray = new Ray(new Vec3(0.2, 0.2, 1), new Vec3(0, 0, -1));
    const rec = tri.hit(ray, 0.001, Infinity);
    assert.ok(rec);
    // With perturbed map, normal should differ from face normal
    assert.ok(rec.normal.z < 0.99, 'Perturbed map should change normal');
    assert.ok(Math.abs(rec.normal.length() - 1) < 0.01);
  });
});

describe('OBJ parser with normals and UVs', () => {
  it('parses OBJ with vertex normals', () => {
    const obj = `
v 0 0 0
v 1 0 0
v 0 1 0
vn 0 0 1
vn 0.3 0 0.95
vn 0 0.3 0.95
f 1//1 2//2 3//3
`;
    const mat = new MockMaterial();
    const mesh = Mesh.fromOBJ(obj, mat);
    assert.ok(mesh.triangles.length === 1);
    assert.ok(mesh.triangles[0].normals, 'Should have vertex normals');
    assert.ok(mesh.triangles[0].normals.length === 3);
  });

  it('parses OBJ with UVs and normals', () => {
    const obj = `
v 0 0 0
v 1 0 0
v 0 1 0
vt 0 0
vt 1 0
vt 0 1
vn 0 0 1
vn 0 0 1
vn 0 0 1
f 1/1/1 2/2/2 3/3/3
`;
    const mat = new MockMaterial();
    const mesh = Mesh.fromOBJ(obj, mat);
    assert.ok(mesh.triangles.length === 1);
    assert.ok(mesh.triangles[0].normals);
    assert.ok(mesh.triangles[0].uvs);
    assert.deepStrictEqual(mesh.triangles[0].uvs[0], [0, 0]);
    assert.deepStrictEqual(mesh.triangles[0].uvs[1], [1, 0]);
  });

  it('falls back to no normals/UVs for simple OBJ', () => {
    const obj = `
v 0 0 0
v 1 0 0
v 0 1 0
f 1 2 3
`;
    const mat = new MockMaterial();
    const mesh = Mesh.fromOBJ(obj, mat);
    assert.ok(mesh.triangles.length === 1);
    assert.ok(mesh.triangles[0].normals === null);
    assert.ok(mesh.triangles[0].uvs === null);
  });
});
