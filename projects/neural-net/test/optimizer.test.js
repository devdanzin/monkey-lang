import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Matrix } from '../src/matrix.js';
import { SGD, MomentumSGD, Adam, RMSProp, createOptimizer } from '../src/optimizer.js';

function mat(rows, cols, values) {
  const m = new Matrix(rows, cols);
  for (let i = 0; i < values.length; i++) m.data[i] = values[i];
  return m;
}

describe('SGD Optimizer', () => {
  it('updates parameter in gradient direction', () => {
    const opt = new SGD(0.1);
    const param = mat(1, 3, [1, 2, 3]);
    const grad = mat(1, 3, [1, 1, 1]);
    const result = opt.update(param, grad);
    assert.ok(Math.abs(result.data[0] - 0.9) < 0.001);
  });
});

describe('MomentumSGD', () => {
  it('accumulates velocity', () => {
    const opt = new MomentumSGD(0.1, 0.9);
    const param = mat(1, 3, [1, 2, 3]);
    const grad = mat(1, 3, [1, 1, 1]);
    
    const r1 = opt.update(param, grad, 'w');
    assert.ok(Math.abs(r1.data[0] - 0.9) < 0.001);
    
    const r2 = opt.update(r1, grad, 'w');
    assert.ok(r2.data[0] < r1.data[0], 'Should accelerate');
  });
});

describe('Adam Optimizer', () => {
  it('converges on simple problem', () => {
    const opt = new Adam(0.1);
    let param = mat(1, 1, [5.0]);
    
    for (let i = 0; i < 100; i++) {
      opt.step();
      const grad = mat(1, 1, [param.data[0]]);
      param = opt.update(param, grad, 'p');
    }
    
    assert.ok(Math.abs(param.data[0]) < 2.0, `Should converge toward 0, got ${param.data[0]}`);
  });

  it('has bias correction', () => {
    const opt = new Adam(0.01);
    opt.step();
    const param = mat(1, 1, [10]);
    const grad = mat(1, 1, [1]);
    const r1 = opt.update(param, grad, 'test');
    assert.ok(Math.abs(r1.data[0] - (10 - 0.01)) < 0.01);
  });

  it('handles multi-dimensional parameters', () => {
    const opt = new Adam(0.01);
    let w = mat(2, 3, [1, 2, 3, 4, 5, 6]);
    const grad = mat(2, 3, [0.1, 0.2, 0.3, 0.4, 0.5, 0.6]);
    
    opt.step();
    const result = opt.update(w, grad, 'w');
    assert.equal(result.rows, 2);
    assert.equal(result.cols, 3);
    assert.ok(result.data[0] < 1);
  });
});

describe('RMSProp', () => {
  it('adapts learning rate', () => {
    const opt = new RMSProp(0.01, 0.99);
    let param = mat(1, 1, [5.0]);
    
    for (let i = 0; i < 50; i++) {
      const grad = mat(1, 1, [param.data[0]]);
      param = opt.update(param, grad, 'p');
    }
    
    assert.ok(Math.abs(param.data[0]) < 4.5, `Should move toward 0, got ${param.data[0]}`);
  });
});

describe('createOptimizer', () => {
  it('creates SGD', () => {
    const opt = createOptimizer('sgd', { lr: 0.05 });
    assert.equal(opt.name, 'sgd');
    assert.equal(opt.lr, 0.05);
  });

  it('creates Adam', () => {
    const opt = createOptimizer('adam', { lr: 0.001 });
    assert.equal(opt.name, 'adam');
  });

  it('creates RMSProp', () => {
    const opt = createOptimizer('rmsprop');
    assert.equal(opt.name, 'rmsprop');
  });

  it('throws on unknown optimizer', () => {
    assert.throws(() => createOptimizer('unknown'));
  });
});
