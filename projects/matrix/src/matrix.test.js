import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Matrix, rotation2D } from './matrix.js';

const approx = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

describe('Creation', () => {
  it('from2D', () => { const m = Matrix.from2D([[1,2],[3,4]]); assert.equal(m.get(0,0), 1); assert.equal(m.get(1,1), 4); });
  it('identity', () => { const m = Matrix.identity(3); assert.equal(m.get(0,0), 1); assert.equal(m.get(0,1), 0); assert.equal(m.get(2,2), 1); });
  it('zeros', () => { const m = Matrix.zeros(2,3); assert.equal(m.get(1,2), 0); assert.equal(m.rows, 2); assert.equal(m.cols, 3); });
});

describe('Operations', () => {
  it('add', () => {
    const a = Matrix.from2D([[1,2],[3,4]]);
    const b = Matrix.from2D([[5,6],[7,8]]);
    const c = a.add(b);
    assert.equal(c.get(0,0), 6);
    assert.equal(c.get(1,1), 12);
  });
  it('subtract', () => {
    const a = Matrix.from2D([[5,6],[7,8]]);
    const b = Matrix.from2D([[1,2],[3,4]]);
    assert.equal(a.subtract(b).get(0,0), 4);
  });
  it('scale', () => {
    const m = Matrix.from2D([[1,2],[3,4]]);
    const s = m.scale(2);
    assert.equal(s.get(0,0), 2);
    assert.equal(s.get(1,1), 8);
  });
  it('multiply', () => {
    const a = Matrix.from2D([[1,2],[3,4]]);
    const b = Matrix.from2D([[5,6],[7,8]]);
    const c = a.multiply(b);
    assert.equal(c.get(0,0), 19);
    assert.equal(c.get(0,1), 22);
    assert.equal(c.get(1,0), 43);
    assert.equal(c.get(1,1), 50);
  });
  it('multiply non-square', () => {
    const a = Matrix.from2D([[1,2,3]]);
    const b = Matrix.from2D([[4],[5],[6]]);
    const c = a.multiply(b);
    assert.equal(c.get(0,0), 32);
  });
  it('multiply identity', () => {
    const a = Matrix.from2D([[1,2],[3,4]]);
    const i = Matrix.identity(2);
    assert.ok(a.multiply(i).equals(a));
  });
  it('transpose', () => {
    const m = Matrix.from2D([[1,2,3],[4,5,6]]);
    const t = m.transpose();
    assert.equal(t.rows, 3);
    assert.equal(t.cols, 2);
    assert.equal(t.get(0,1), 4);
  });
});

describe('Determinant', () => {
  it('2x2', () => { const m = Matrix.from2D([[1,2],[3,4]]); assert.ok(approx(m.determinant(), -2)); });
  it('3x3', () => { const m = Matrix.from2D([[1,2,3],[4,5,6],[7,8,0]]); assert.ok(approx(m.determinant(), 27)); });
  it('identity', () => { assert.ok(approx(Matrix.identity(3).determinant(), 1)); });
});

describe('LU Decomposition', () => {
  it('L*U = A', () => {
    const a = Matrix.from2D([[2,1,1],[4,3,3],[8,7,9]]);
    const { L, U } = a.lu();
    assert.ok(L.multiply(U).equals(a, 1e-10));
  });
});

describe('Inverse', () => {
  it('2x2 inverse', () => {
    const a = Matrix.from2D([[1,2],[3,4]]);
    const inv = a.inverse();
    assert.ok(a.multiply(inv).equals(Matrix.identity(2), 1e-10));
  });
  it('3x3 inverse', () => {
    const a = Matrix.from2D([[1,2,3],[0,1,4],[5,6,0]]);
    const inv = a.inverse();
    assert.ok(a.multiply(inv).equals(Matrix.identity(3), 1e-10));
  });
});

describe('Solve', () => {
  it('2x2 system', () => {
    // x + 2y = 5, 3x + 4y = 11
    const a = Matrix.from2D([[1,2],[3,4]]);
    const x = a.solve([5, 11]);
    assert.ok(approx(x[0], 1));
    assert.ok(approx(x[1], 2));
  });
});

describe('Trace', () => {
  it('trace of identity', () => { assert.equal(Matrix.identity(3).trace(), 3); });
  it('trace of matrix', () => { assert.equal(Matrix.from2D([[1,0],[0,5]]).trace(), 6); });
});

describe('Rotation', () => {
  it('90 degree rotation', () => {
    const r = rotation2D(Math.PI / 2);
    // [1,0] -> [0,1]
    const v = Matrix.from2D([[1],[0]]);
    const result = r.multiply(v);
    assert.ok(approx(result.get(0,0), 0));
    assert.ok(approx(result.get(1,0), 1));
  });
});

describe('Clone and Equals', () => {
  it('clone', () => {
    const a = Matrix.from2D([[1,2],[3,4]]);
    const b = a.clone();
    assert.ok(a.equals(b));
    b.set(0,0,99);
    assert.ok(!a.equals(b));
  });
});
