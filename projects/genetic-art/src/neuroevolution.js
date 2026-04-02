/**
 * Neuroevolution — evolve neural network weights using genetic algorithms.
 * 
 * A minimal feedforward neural network with:
 * - Configurable layer sizes
 * - Tanh/ReLU/sigmoid activation
 * - Weights encoded as flat gene arrays for GA evolution
 * 
 * No backpropagation needed — weights are evolved through selection,
 * crossover, and mutation.
 */

import { Individual } from './individual.js';

/**
 * Activation functions.
 */
const activations = {
  tanh: (x) => Math.tanh(x),
  relu: (x) => Math.max(0, x),
  sigmoid: (x) => 1 / (1 + Math.exp(-x)),
  linear: (x) => x
};

/**
 * Simple feedforward neural network for neuroevolution.
 * No training — weights are set externally (from genes).
 */
export class NeuralNet {
  /**
   * @param {number[]} layerSizes — e.g., [2, 4, 1] for 2 inputs, 4 hidden, 1 output
   * @param {string} [activation='tanh']
   * @param {string} [outputActivation='tanh']
   */
  constructor(layerSizes, activation = 'tanh', outputActivation = 'tanh') {
    this.layerSizes = layerSizes;
    this.activationFn = activations[activation] || activations.tanh;
    this.outputActivationFn = activations[outputActivation] || activations.tanh;
    this.weights = [];  // Array of weight matrices (flat)
    this.biases = [];   // Array of bias vectors

    // Initialize structure
    for (let i = 0; i < layerSizes.length - 1; i++) {
      const rows = layerSizes[i + 1];
      const cols = layerSizes[i];
      this.weights.push(new Float64Array(rows * cols));
      this.biases.push(new Float64Array(rows));
    }
  }

  /** Total number of parameters (weights + biases) */
  get paramCount() {
    let count = 0;
    for (let i = 0; i < this.layerSizes.length - 1; i++) {
      count += this.layerSizes[i + 1] * this.layerSizes[i]; // weights
      count += this.layerSizes[i + 1]; // biases
    }
    return count;
  }

  /**
   * Load weights from a flat gene array.
   * @param {number[]} genes — flat array of all weights and biases
   */
  fromGenes(genes) {
    let idx = 0;
    for (let l = 0; l < this.weights.length; l++) {
      for (let i = 0; i < this.weights[l].length; i++) {
        this.weights[l][i] = genes[idx++];
      }
      for (let i = 0; i < this.biases[l].length; i++) {
        this.biases[l][i] = genes[idx++];
      }
    }
    return this;
  }

  /**
   * Export weights as a flat gene array.
   * @returns {number[]}
   */
  toGenes() {
    const genes = [];
    for (let l = 0; l < this.weights.length; l++) {
      genes.push(...this.weights[l]);
      genes.push(...this.biases[l]);
    }
    return genes;
  }

  /**
   * Forward pass: compute output from input.
   * @param {number[]} input
   * @returns {number[]} output
   */
  forward(input) {
    let current = Float64Array.from(input);
    
    for (let l = 0; l < this.weights.length; l++) {
      const rows = this.layerSizes[l + 1];
      const cols = this.layerSizes[l];
      const next = new Float64Array(rows);
      const isOutput = l === this.weights.length - 1;
      const act = isOutput ? this.outputActivationFn : this.activationFn;

      for (let r = 0; r < rows; r++) {
        let sum = this.biases[l][r];
        for (let c = 0; c < cols; c++) {
          sum += this.weights[l][r * cols + c] * current[c];
        }
        next[r] = act(sum);
      }
      current = next;
    }
    return Array.from(current);
  }
}

/**
 * Create a neuroevolution fitness function.
 * 
 * @param {number[]} layerSizes — network architecture
 * @param {Function} evaluator — (net: NeuralNet) => number (fitness score)
 * @param {string} [activation='tanh']
 * @param {string} [outputActivation='tanh']
 * @returns {Function} fitness function for gene arrays
 */
export function neuroFitness(layerSizes, evaluator, activation = 'tanh', outputActivation = 'tanh') {
  return (genes) => {
    const net = new NeuralNet(layerSizes, activation, outputActivation);
    net.fromGenes(genes);
    return evaluator(net);
  };
}

/**
 * Get the total parameter count for a network architecture.
 */
export function paramCount(layerSizes) {
  let count = 0;
  for (let i = 0; i < layerSizes.length - 1; i++) {
    count += layerSizes[i + 1] * layerSizes[i] + layerSizes[i + 1];
  }
  return count;
}

/**
 * Create an XOR test suite for neuroevolution benchmarking.
 * Returns an evaluator function for neuroFitness.
 */
export function xorEvaluator() {
  const data = [
    { input: [0, 0], output: 0 },
    { input: [0, 1], output: 1 },
    { input: [1, 0], output: 1 },
    { input: [1, 1], output: 0 }
  ];
  return (net) => {
    let totalError = 0;
    for (const { input, output } of data) {
      const predicted = net.forward(input)[0];
      totalError += (predicted - output) ** 2;
    }
    // Fitness = negative MSE (higher = better)
    return -(totalError / data.length);
  };
}

/**
 * Create a cart-pole-like balance task evaluator.
 * Simplified physics: pole on cart, net outputs force direction.
 * Returns steps balanced as fitness.
 */
export function cartPoleEvaluator(maxSteps = 200) {
  return (net) => {
    // State: [x, x_dot, theta, theta_dot]
    let x = 0, xDot = 0, theta = 0.05, thetaDot = 0;
    const gravity = 9.8, cartMass = 1.0, poleMass = 0.1;
    const totalMass = cartMass + poleMass;
    const poleHalfLen = 0.5, dt = 0.02;
    const forceScale = 10;

    let steps = 0;
    for (let i = 0; i < maxSteps; i++) {
      // Neural net decides force direction
      const output = net.forward([x, xDot, theta, thetaDot]);
      const force = output[0] > 0 ? forceScale : -forceScale;

      // Physics update
      const cosTheta = Math.cos(theta);
      const sinTheta = Math.sin(theta);
      const temp = (force + poleMass * poleHalfLen * thetaDot ** 2 * sinTheta) / totalMass;
      const thetaAcc = (gravity * sinTheta - cosTheta * temp) /
        (poleHalfLen * (4/3 - poleMass * cosTheta ** 2 / totalMass));
      const xAcc = temp - poleMass * poleHalfLen * thetaAcc * cosTheta / totalMass;

      x += xDot * dt;
      xDot += xAcc * dt;
      theta += thetaDot * dt;
      thetaDot += thetaAcc * dt;

      steps++;

      // Terminal conditions
      if (Math.abs(x) > 2.4 || Math.abs(theta) > 12 * Math.PI / 180) {
        break;
      }
    }
    return steps;
  };
}
