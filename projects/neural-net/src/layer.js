// layer.js — Dense (fully connected) layer

import { Matrix } from './matrix.js';
import { getActivation } from './activation.js';

export class Dense {
  constructor(inputSize, outputSize, activation = 'relu') {
    this.inputSize = inputSize;
    this.outputSize = outputSize;
    this.activation = getActivation(activation);

    // Weights and biases (Xavier initialized)
    this.weights = Matrix.random(inputSize, outputSize);
    this.biases = Matrix.zeros(1, outputSize);

    // Cache for backpropagation
    this.input = null;
    this.z = null;  // Pre-activation
    this.a = null;  // Post-activation (output)

    // Gradients
    this.dWeights = null;
    this.dBiases = null;
  }

  // Forward pass: output = activation(input · weights + bias)
  forward(input) {
    this.input = input;
    this.z = input.dot(this.weights).add(this.biases);
    this.a = this.activation.forward(this.z);
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
  update(learningRate) {
    const batchSize = this.input.rows;
    this.weights = this.weights.sub(this.dWeights.mul(learningRate / batchSize));
    this.biases = this.biases.sub(this.dBiases.mul(learningRate / batchSize));
  }

  // Parameter count
  paramCount() {
    return this.inputSize * this.outputSize + this.outputSize;
  }
}
