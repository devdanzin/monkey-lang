import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Matrix, Conv2D, MaxPool2D, Flatten } from '../src/index.js';

describe('Conv2D', () => {
  it('computes correct output shape', () => {
    const conv = new Conv2D(5, 5, 1, 4, 3); // 5×5 input, 1 channel, 4 filters, 3×3
    assert.equal(conv.outputH, 3);
    assert.equal(conv.outputW, 3);
    assert.equal(conv.outputSize, 3 * 3 * 4); // 36
  });

  it('forward produces correct shape', () => {
    const conv = new Conv2D(5, 5, 1, 2, 3);
    const input = Matrix.random(4, 25); // batch of 4, 5×5×1 flattened
    const output = conv.forward(input);
    assert.equal(output.rows, 4);
    assert.equal(output.cols, 3 * 3 * 2); // 18
  });

  it('param count', () => {
    const conv = new Conv2D(5, 5, 1, 4, 3);
    assert.equal(conv.paramCount(), 4 * 9 * 1 + 4); // 4 filters × 3×3×1 + 4 biases = 40
  });
});

describe('MaxPool2D', () => {
  it('downsamples by factor of 2', () => {
    const pool = new MaxPool2D(4, 4, 1, 2);
    assert.equal(pool.outputH, 2);
    assert.equal(pool.outputW, 2);
    assert.equal(pool.outputSize, 4);
  });

  it('forward selects max values', () => {
    const pool = new MaxPool2D(4, 4, 1, 2);
    // 4×4 input with known values
    const data = [
      1, 2, 3, 4,
      5, 6, 7, 8,
      9, 10, 11, 12,
      13, 14, 15, 16
    ];
    const input = Matrix.fromArray([data]);
    const output = pool.forward(input);
    assert.equal(output.get(0, 0), 6);  // max of [1,2,5,6]
    assert.equal(output.get(0, 1), 8);  // max of [3,4,7,8]
    assert.equal(output.get(0, 2), 14); // max of [9,10,13,14]
    assert.equal(output.get(0, 3), 16); // max of [11,12,15,16]
  });

  it('backward routes gradients to max positions', () => {
    const pool = new MaxPool2D(4, 4, 1, 2);
    const data = [1,2,3,4, 5,6,7,8, 9,10,11,12, 13,14,15,16];
    pool.forward(Matrix.fromArray([data]));
    const dOutput = Matrix.fromArray([[1, 1, 1, 1]]);
    const dInput = pool.backward(dOutput);
    assert.equal(dInput.get(0, 5), 1);  // Index of max=6 in first pool
    assert.equal(dInput.get(0, 15), 1); // Index of max=16 in last pool
    assert.equal(dInput.get(0, 0), 0);  // Non-max position
  });
});

describe('Flatten', () => {
  it('passes through', () => {
    const flat = new Flatten();
    const input = Matrix.random(3, 16);
    const output = flat.forward(input);
    assert.equal(output.rows, 3);
    assert.equal(output.cols, 16);
  });
});
