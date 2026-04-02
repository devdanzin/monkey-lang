/**
 * predictive-coding.js — Predictive Coding Network
 * 
 * Implements hierarchical predictive coding as described by Rao & Ballard (1999)
 * and connected to the Free Energy Principle (Friston, 2005).
 * 
 * Key idea: Each layer generates top-down predictions of the layer below.
 * Prediction errors propagate bottom-up and drive learning.
 * All learning is LOCAL — no backpropagation needed.
 * 
 * Architecture per layer:
 *   - Value nodes μ: current representation
 *   - Error nodes ε: prediction error = input - prediction
 *   - Weights W: generative model (predicts lower layer from higher)
 *   - Precision Π: inverse variance (confidence in predictions)
 */

import { Matrix } from './matrix.js';

// Activation functions
function sigmoid(x) { return 1 / (1 + Math.exp(-x)); }
function sigmoidDeriv(x) { const s = sigmoid(x); return s * (1 - s); }
function tanh(x) { return Math.tanh(x); }
function tanhDeriv(x) { const t = Math.tanh(x); return 1 - t * t; }
function relu(x) { return x > 0 ? x : 0; }
function reluDeriv(x) { return x > 0 ? 1 : 0; }
function identity(x) { return x; }
function identityDeriv(_x) { return 1; }

const ACTIVATIONS = {
  sigmoid: [sigmoid, sigmoidDeriv],
  tanh: [tanh, tanhDeriv],
  relu: [relu, reluDeriv],
  linear: [identity, identityDeriv],
};

/**
 * A single layer in the predictive coding hierarchy.
 * 
 * Contains value nodes (μ), error nodes (ε), and generative weights (W).
 * The generative model: prediction = f(W · μ_above + b)
 * Error: ε = input_from_below - prediction
 */
export class PredictiveCodingLayer {
  /**
   * @param {number} size - Number of value nodes in this layer
   * @param {number} inputSize - Size of the layer below (that this layer predicts)
   * @param {Object} opts
   * @param {string} [opts.activation='sigmoid'] - Activation function
   * @param {number} [opts.precision=1.0] - Initial precision (inverse variance)
   * @param {number} [opts.learningRate=0.01] - Weight learning rate
   * @param {number} [opts.inferenceRate=0.1] - Value node inference rate
   */
  constructor(size, inputSize, opts = {}) {
    this.size = size;
    this.inputSize = inputSize;

    const {
      activation = 'sigmoid',
      precision = 1.0,
      learningRate = 0.01,
      inferenceRate = 0.1,
    } = opts;

    const [act, actDeriv] = ACTIVATIONS[activation] || ACTIVATIONS.sigmoid;
    this.activation = act;
    this.activationDeriv = actDeriv;
    this.learningRate = learningRate;
    this.inferenceRate = inferenceRate;

    // Value nodes μ (the layer's representation)
    this.mu = new Matrix(size, 1);
    this._initRandom(this.mu, 0.1);

    // Error nodes ε (prediction error)
    this.epsilon = new Matrix(inputSize, 1);

    // Generative weights W: maps this layer → prediction of layer below
    // prediction = f(W · μ + b) where W is inputSize × size
    this.W = new Matrix(inputSize, size);
    this._initRandom(this.W, Math.sqrt(2 / (size + inputSize)));

    // Bias
    this.b = new Matrix(inputSize, 1);

    // Precision (scalar for simplicity, could be per-unit or full matrix)
    this.precision = precision;

    // Pre-activation cache (for derivative computation)
    this._preActivation = new Matrix(inputSize, 1);
  }

  /**
   * Initialize matrix with random values.
   */
  _initRandom(m, scale) {
    for (let i = 0; i < m.data.length; i++) {
      m.data[i] = (Math.random() * 2 - 1) * scale;
    }
  }

  /**
   * Generate a top-down prediction of the layer below.
   * prediction = f(W · μ + b)
   * @returns {Matrix} Predicted values (inputSize × 1)
   */
  predict() {
    // W (inputSize × size) · μ (size × 1) = (inputSize × 1)
    const preAct = this.W.dot(this.mu).add(this.b);
    this._preActivation = preAct;
    const result = new Matrix(preAct.rows, preAct.cols);
    for (let i = 0; i < result.data.length; i++) {
      result.data[i] = this.activation(preAct.data[i]);
    }
    return result;
  }

  /**
   * Compute prediction error given actual input from below.
   * ε = actual - predicted
   * @param {Matrix} actual - Actual input from the layer below
   * @returns {Matrix} Prediction error
   */
  computeError(actual) {
    const predicted = this.predict();
    this.epsilon = actual.sub(predicted);
    return this.epsilon;
  }

  /**
   * Update value nodes μ based on prediction errors.
   * 
   * The value update follows:
   * dμ/dt = -ε_own + W^T · Π · ε_below · f'(W·μ+b)
   * 
   * Where:
   * - ε_own: this layer's own prediction error (from layer above)
   * - ε_below: error at the layer below (this layer's prediction error)
   * - W^T: transpose of generative weights
   * - Π: precision (confidence)
   * - f': derivative of activation
   * 
   * @param {Matrix|null} errorFromAbove - Error signal from the layer above (null for top layer)
   */
  updateValues(errorFromAbove) {
    // Contribution from prediction error below (this layer's predictions were wrong)
    // W^T · (Π · ε_below · f'(pre_act))
    const scaledError = new Matrix(this.epsilon.rows, this.epsilon.cols);
    for (let i = 0; i < scaledError.data.length; i++) {
      scaledError.data[i] = this.precision * this.epsilon.data[i]
        * this.activationDeriv(this._preActivation.data[i]);
    }
    // W^T (size × inputSize) · scaledError (inputSize × 1) = (size × 1)
    const bottomUp = this.W.transpose().dot(scaledError);

    // Combine: move μ toward explaining the errors below
    let delta = bottomUp.mul(this.inferenceRate);

    // If there's error from above, also minimize that
    if (errorFromAbove) {
      // ε_above pushes μ toward what the layer above predicted
      delta = delta.sub(errorFromAbove.mul(this.inferenceRate));
    }

    this.mu = this.mu.add(delta);
  }

  /**
   * Update weights based on converged prediction errors.
   * This is the LEARNING step (after inference has converged).
   * 
   * dW/dt = Π · ε · f'(pre_act) · μ^T  (Hebbian-like!)
   * db/dt = Π · ε · f'(pre_act)
   */
  updateWeights() {
    // Compute gradient
    const scaledError = new Matrix(this.epsilon.rows, this.epsilon.cols);
    for (let i = 0; i < scaledError.data.length; i++) {
      scaledError.data[i] = this.precision * this.epsilon.data[i]
        * this.activationDeriv(this._preActivation.data[i]);
    }

    // dW = scaledError · μ^T (inputSize × 1) · (1 × size) = (inputSize × size)
    const dW = scaledError.dot(this.mu.transpose());
    this.W = this.W.add(dW.mul(this.learningRate));

    // db = scaledError
    this.b = this.b.add(scaledError.mul(this.learningRate));
  }

  /**
   * Get the current prediction error energy (squared error).
   */
  get energy() {
    let sum = 0;
    for (let i = 0; i < this.epsilon.data.length; i++) {
      sum += this.epsilon.data[i] * this.epsilon.data[i];
    }
    return 0.5 * this.precision * sum;
  }

  /**
   * Reset value nodes to small random values.
   */
  resetValues() {
    this._initRandom(this.mu, 0.1);
    for (let i = 0; i < this.epsilon.data.length; i++) {
      this.epsilon.data[i] = 0;
    }
  }

  /**
   * Clone this layer.
   */
  clone() {
    const layer = new PredictiveCodingLayer(this.size, this.inputSize, {
      precision: this.precision,
      learningRate: this.learningRate,
      inferenceRate: this.inferenceRate,
    });
    layer.W = new Matrix(this.W.rows, this.W.cols, new Float64Array(this.W.data));
    layer.b = new Matrix(this.b.rows, this.b.cols, new Float64Array(this.b.data));
    layer.mu = new Matrix(this.mu.rows, this.mu.cols, new Float64Array(this.mu.data));
    layer.activation = this.activation;
    layer.activationDeriv = this.activationDeriv;
    return layer;
  }
}
