// network.js — Neural network: stack of layers

import { Dense } from './layer.js';
import { getLoss } from './loss.js';
import { Matrix } from './matrix.js';

export class Network {
  constructor() {
    this.layers = [];
    this.lossFunction = null;
  }

  // Add a dense layer
  dense(inputSize, outputSize, activation = 'relu') {
    this.layers.push(new Dense(inputSize, outputSize, activation));
    return this; // Chainable
  }

  // Set loss function
  loss(name) {
    this.lossFunction = getLoss(name);
    return this;
  }

  // Forward pass through all layers
  forward(input) {
    let x = input;
    for (const layer of this.layers) {
      x = layer.forward(x);
    }
    return x;
  }

  // Predict (forward pass, no training)
  predict(input) {
    if (Array.isArray(input)) input = Matrix.fromArray(input);
    if (input.cols === undefined) input = Matrix.fromArray([input]);
    return this.forward(input);
  }

  // Train on a batch
  trainBatch(input, target, learningRate = 0.01, momentum = 0) {
    if (Array.isArray(input)) input = Matrix.fromArray(input);
    if (Array.isArray(target)) target = Matrix.fromArray(target);

    // Forward
    const output = this.forward(input);

    // Compute loss
    const loss = this.lossFunction.compute(output, target);

    // Backward
    let grad = this.lossFunction.gradient(output, target);
    for (let i = this.layers.length - 1; i >= 0; i--) {
      grad = this.layers[i].backward(grad);
    }

    // Update weights
    for (const layer of this.layers) {
      layer.update(learningRate, momentum);
    }

    return loss;
  }

  // Train for multiple epochs
  train(data, { epochs = 100, learningRate = 0.01, batchSize = 32, momentum = 0, verbose = false, onEpoch = null, lrSchedule = null } = {}) {
    const { inputs, targets } = data;
    const n = inputs.rows;
    const history = [];

    // Set training mode
    for (const l of this.layers) l.training = true;

    for (let epoch = 0; epoch < epochs; epoch++) {
      let epochLoss = 0;
      let batches = 0;

      // Learning rate scheduling
      let lr = learningRate;
      if (lrSchedule === 'cosine') {
        lr = learningRate * 0.5 * (1 + Math.cos(Math.PI * epoch / epochs));
      } else if (lrSchedule === 'step') {
        if (epoch > epochs * 0.5) lr *= 0.1;
        if (epoch > epochs * 0.75) lr *= 0.1;
      } else if (lrSchedule === 'linear') {
        lr = learningRate * (1 - epoch / epochs);
      }

    for (let epoch = 0; epoch < epochs; epoch++) {
      let epochLoss = 0;
      let batches = 0;

      // Shuffle indices
      const indices = Array.from({ length: n }, (_, i) => i);
      for (let i = n - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }

      for (let start = 0; start < n; start += batchSize) {
        const end = Math.min(start + batchSize, n);
        const batchIndices = indices.slice(start, end);

        // Create batch matrices
        const batchInput = new Matrix(batchIndices.length, inputs.cols);
        const batchTarget = new Matrix(batchIndices.length, targets.cols);

        for (let i = 0; i < batchIndices.length; i++) {
          const idx = batchIndices[i];
          for (let j = 0; j < inputs.cols; j++) batchInput.set(i, j, inputs.get(idx, j));
          for (let j = 0; j < targets.cols; j++) batchTarget.set(i, j, targets.get(idx, j));
        }

        epochLoss += this.trainBatch(batchInput, batchTarget, lr, momentum);
        batches++;
      }

      epochLoss /= batches;
      history.push(epochLoss);

      if (verbose && (epoch % Math.max(1, Math.floor(epochs / 20)) === 0 || epoch === epochs - 1)) {
        console.log(`Epoch ${epoch + 1}/${epochs} — Loss: ${epochLoss.toFixed(6)}`);
      }

      if (onEpoch) onEpoch(epoch, epochLoss);
    }

    // Set eval mode (disable dropout)
    for (const l of this.layers) l.training = false;

    return history;
  }

  // Evaluate accuracy on test data
  evaluate(inputs, targets) {
    const output = this.forward(inputs);
    const predicted = output.argmax();
    const actual = targets.argmax();

    let correct = 0;
    for (let i = 0; i < predicted.length; i++) {
      if (predicted[i] === actual[i]) correct++;
    }

    return {
      accuracy: correct / predicted.length,
      correct,
      total: predicted.length
    };
  }

  // Summary
  summary() {
    let totalParams = 0;
    const lines = ['Network Summary:'];
    lines.push('─'.repeat(60));
    lines.push(`${'Layer'.padEnd(20)} ${'Output'.padEnd(15)} ${'Params'.padEnd(10)} Activation`);
    lines.push('─'.repeat(60));

    for (let i = 0; i < this.layers.length; i++) {
      const l = this.layers[i];
      const params = l.paramCount();
      totalParams += params;
      lines.push(`Dense ${i + 1}`.padEnd(20) + `${l.outputSize}`.padEnd(15) + `${params}`.padEnd(10) + l.activation.name);
    }

    lines.push('─'.repeat(60));
    lines.push(`Total parameters: ${totalParams}`);
    return lines.join('\n');
  }
}
