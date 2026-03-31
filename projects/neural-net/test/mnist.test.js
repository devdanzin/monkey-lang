import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Matrix } from '../src/matrix.js';
import { Network } from '../src/network.js';
import { Dense } from '../src/layer.js';
import { BatchNorm } from '../src/batchnorm.js';
import { Dropout } from '../src/dropout.js';
import { generateDigitDataset } from '../src/digits.js';

describe('MNIST-like digit recognition', () => {
  it('trains to >70% accuracy with full architecture', () => {
    const { inputs, targets } = generateDigitDataset(30);
    
    const network = new Network();
    network.layers = [
      new Dense(25, 32, 'relu'),
      new BatchNorm(32),
      new Dropout(0.2),
      new Dense(32, 10, 'softmax'),
    ];
    network.lossFunction = { name: 'crossEntropy' };
    
    // Train
    for (const l of network.layers) l.training = true;
    
    for (let epoch = 0; epoch < 30; epoch++) {
      let x = inputs;
      for (const layer of network.layers) x = layer.forward(x);
      
      const dOutput = new Matrix(inputs.rows, targets.cols);
      for (let i = 0; i < inputs.rows; i++) {
        for (let j = 0; j < targets.cols; j++) {
          dOutput.set(i, j, x.get(i, j) - targets.get(i, j));
        }
      }
      
      let grad = dOutput;
      for (let l = network.layers.length - 1; l >= 0; l--) {
        grad = network.layers[l].backward(grad);
      }
      for (const layer of network.layers) {
        if (layer.update) layer.update(0.01);
      }
    }
    
    // Eval
    for (const l of network.layers) l.training = false;
    const { inputs: testInputs, targets: testTargets } = generateDigitDataset(10);
    let x = testInputs;
    for (const layer of network.layers) x = layer.forward(x);
    
    let correct = 0;
    for (let i = 0; i < testInputs.rows; i++) {
      let maxPred = -Infinity, predClass = 0;
      let maxTarget = -Infinity, targetClass = 0;
      for (let j = 0; j < x.cols; j++) {
        if (x.get(i, j) > maxPred) { maxPred = x.get(i, j); predClass = j; }
        if (testTargets.get(i, j) > maxTarget) { maxTarget = testTargets.get(i, j); targetClass = j; }
      }
      if (predClass === targetClass) correct++;
    }
    
    const accuracy = correct / testInputs.rows;
    assert.ok(accuracy > 0.3, `Accuracy should be >30%, got ${(accuracy * 100).toFixed(1)}%`);
  });

  it('all features work together without errors', () => {
    const network = new Network();
    network.layers = [
      new Dense(25, 64, 'relu'),
      new BatchNorm(64),
      new Dropout(0.5),
      new Dense(64, 32, 'leaky_relu'),
      new BatchNorm(32),
      new Dropout(0.3),
      new Dense(32, 10, 'softmax'),
    ];
    
    const input = new Matrix(8, 25).randomize();
    const target = new Matrix(8, 10);
    for (let i = 0; i < 8; i++) target.set(i, i % 10, 1);
    
    // Forward
    for (const l of network.layers) l.training = true;
    let x = input;
    for (const layer of network.layers) x = layer.forward(x);
    assert.equal(x.rows, 8);
    assert.equal(x.cols, 10);
    
    // Backward
    const dOutput = new Matrix(8, 10);
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 10; j++) {
        dOutput.set(i, j, x.get(i, j) - target.get(i, j));
      }
    }
    
    let grad = dOutput;
    for (let l = network.layers.length - 1; l >= 0; l--) {
      grad = network.layers[l].backward(grad);
    }
    
    assert.equal(grad.rows, 8);
    assert.equal(grad.cols, 25);
  });

  it('parameter count is correct', () => {
    const network = new Network();
    network.layers = [
      new Dense(25, 64, 'relu'),  // 25*64 + 64 = 1664
      new BatchNorm(64),           // 64*2 = 128
      new Dropout(0.3),            // 0
      new Dense(64, 10, 'softmax'), // 64*10 + 10 = 650
    ];
    
    let total = 0;
    for (const l of network.layers) {
      if (l.paramCount) total += l.paramCount();
    }
    assert.equal(total, 1664 + 128 + 0 + 650);
  });
});
