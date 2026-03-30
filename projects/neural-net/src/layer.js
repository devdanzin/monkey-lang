// layer.js — Dense (fully connected) layer

import { Matrix } from './matrix.js';
import { getActivation } from './activation.js';

export class Dense {
  constructor(inputSize, outputSize, activation = 'relu', { dropout = 0 } = {}) {
    this.inputSize = inputSize;
    this.outputSize = outputSize;
    this.activation = getActivation(activation);
    this.dropoutRate = dropout;

    // Weights and biases (Xavier initialized)
    this.weights = Matrix.random(inputSize, outputSize);
    this.biases = Matrix.zeros(1, outputSize);

    // Cache for backpropagation
    this.input = null;
    this.z = null;  // Pre-activation
    this.a = null;  // Post-activation (output)
    this.dropoutMask = null;
    this.training = true;

    // Momentum (velocity)
    this.vWeights = Matrix.zeros(inputSize, outputSize);
    this.vBiases = Matrix.zeros(1, outputSize);
    
    // Gradients
    this.dWeights = null;
    this.dBiases = null;
  }

  // Forward pass: output = activation(input · weights + bias)
  forward(input) {
    this.input = input;
    this.z = input.dot(this.weights).add(this.biases);
    this.a = this.activation.forward(this.z);

    // Apply dropout during training
    if (this.dropoutRate > 0 && this.training) {
      this.dropoutMask = this.a.map(() => Math.random() > this.dropoutRate ? 1 / (1 - this.dropoutRate) : 0);
      this.a = this.a.mul(this.dropoutMask);
    }

    return this.a;
  }

  // Backward pass: compute gradients and return gradient for previous layer
  backward(dOutput) {
    // If softmax, dOutput is already the combined gradient
    let dz;
    if (this.activation.name === 'softmax') {
      dz = dOutput; // Cross-entropy + softmax: dz = output - target
    } else {
      // Element-wise: dz = dOutput * activation'(z)
      const activGrad = this.activation.backward(this.a);
      dz = dOutput.mul(activGrad);
    }

    // Gradient for weights: input^T · dz
    this.dWeights = this.input.T().dot(dz);
    // Gradient for biases: sum of dz along batch axis
    this.dBiases = dz.sumAxis(0);
    // Gradient for input (to pass to previous layer): dz · weights^T
    return dz.dot(this.weights.T());
  }

  // Update weights with optimizer
  update(learningRate, momentum = 0) {
    const batchSize = this.input.rows;
    const gradW = this.dWeights.mul(learningRate / batchSize);
    const gradB = this.dBiases.mul(learningRate / batchSize);

    if (momentum > 0) {
      this.vWeights = this.vWeights.mul(momentum).add(gradW);
      this.vBiases = this.vBiases.mul(momentum).add(gradB);
      this.weights = this.weights.sub(this.vWeights);
      this.biases = this.biases.sub(this.vBiases);
    } else {
      this.weights = this.weights.sub(gradW);
      this.biases = this.biases.sub(gradB);
    }
  }

  // Parameter count
  paramCount() {
    return this.inputSize * this.outputSize + this.outputSize;
  }
}
