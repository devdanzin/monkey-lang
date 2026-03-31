import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Matrix } from '../src/index.js';

describe('creation', () => {
  it('zeros', () => { const m = Matrix.zeros(2, 3); assert.equal(m.get(0, 0), 0); assert.equal(m.rows, 2); assert.equal(m.cols, 3); });
  it('identity', () => { const m = Matrix.identity(3); assert.equal(m.get(0, 0), 1); assert.equal(m.get(0, 1), 0); assert.equal(m.get(1, 1), 1); });
  it('from array', () => { const m = Matrix.from([[1,2],[3,4]]); assert.equal(m.get(1, 0), 3); });
});

describe('operations', () => {
  it('add', () => { const a = Matrix.from([[1,2],[3,4]]); const b = Matrix.from([[5,6],[7,8]]); assert.deepEqual(a.add(b).toArray(), [[6,8],[10,12]]); });
  it('sub', () => { const a = Matrix.from([[5,6],[7,8]]); const b = Matrix.from([[1,2],[3,4]]); assert.deepEqual(a.sub(b).toArray(), [[4,4],[4,4]]); });
  it('scale', () => assert.deepEqual(Matrix.from([[1,2],[3,4]]).scale(2).toArray(), [[2,4],[6,8]]));
  it('mul', () => {
    const a = Matrix.from([[1,2],[3,4]]);
    const b = Matrix.from([[5,6],[7,8]]);
    assert.deepEqual(a.mul(b).toArray(), [[19,22],[43,50]]);
  });
  it('transpose', () => assert.deepEqual(Matrix.from([[1,2,3],[4,5,6]]).transpose().toArray(), [[1,4],[2,5],[3,6]]));
});

describe('properties', () => {
  it('determinant 2x2', () => assert.equal(Matrix.from([[1,2],[3,4]]).determinant(), -2));
  it('determinant 3x3', () => assert.equal(Matrix.from([[1,2,3],[4,5,6],[7,8,0]]).determinant(), 27));
  it('trace', () => assert.equal(Matrix.from([[1,0],[0,5]]).trace(), 6));
  it('identity * A = A', () => {
    const a = Matrix.from([[1,2],[3,4]]);
    assert.ok(Matrix.identity(2).mul(a).equals(a));
  });
});

describe('utility', () => {
  it('clone', () => { const a = Matrix.from([[1,2]]); const b = a.clone(); b.set(0, 0, 99); assert.equal(a.get(0, 0), 1); });
  it('equals', () => { const a = Matrix.from([[1,2]]); assert.ok(a.equals(a.clone())); });
});
